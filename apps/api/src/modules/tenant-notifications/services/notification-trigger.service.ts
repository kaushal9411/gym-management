import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import { loadEmailBranding } from '../../../infrastructure/mail/branding';
import type { EmailBranding } from '../../../infrastructure/mail/templates/base-layout';
import { memberPaymentReceiptEmail } from '../../../infrastructure/mail/templates/member-templates';
import { tenantNotificationEmail } from '../../../infrastructure/mail/templates/notification-templates';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { renderTemplate } from '../constants/default-templates';

import { notificationTemplateService } from './notification-template.service';
import { tenantNotificationService } from './tenant-notification.service';

/** Marker set once a member's welcome message has actually fired (synchronously here, or as a catch-up by the Scheduler's `welcome-messages` job) — lets the catch-up sweep tell "never sent" apart from "already sent". */
export const WELCOME_SENT_TTL_SECONDS = 30 * 86_400;
export const welcomeSentCacheKey = (memberId: string): string => `welcome-sent:${memberId}`;

/**
 * The 12 trigger-event entry points the spec asks for, plus Membership
 * Renewal (a natural sibling of "Membership Assigned" even though the spec's
 * Trigger Events list didn't name it explicitly — its template exists in the
 * Notification Templates list, so it needs a firing point or it's dead
 * code). Two events (Membership Assigned, Staff Invitation) have no matching
 * named template in the 10-template list, so they fire a plain in-app
 * `notifyTenant` call instead of going through the template/email pipeline —
 * that's a deliberate scope match to the spec's template list, not an
 * oversight.
 *
 * Each templated event: resolve the tenant's effective template (override or
 * hardcoded default) → render `{{placeholders}}` → IN_APP fires the existing
 * Notification Center feed via `notifyTenant` (which itself now also pushes
 * every staff device in the tenant — see `TenantNotificationService`), EMAIL
 * fires `enqueueEmail` directly to the member's own inbox (there's no
 * member-facing in-app notification list in this codebase, so a push
 * notification + email are a member's only channels — see
 * BACKEND-GUIDE.md §Notifications & Communication), and PUSH — when a
 * `recipientMemberId` is given — pushes that specific member's own
 * device(s), independent of the IN_APP channel's staff-wide audience. A
 * template with `isActive: false` fires nothing at all, on any channel.
 */
async function fireTemplated(
  tenantId: string,
  type: Parameters<typeof notificationTemplateService.getEffective>[1],
  vars: Record<string, string>,
  opts: {
    category: Parameters<typeof tenantNotificationService.notifyTenant>[1];
    recipientEmail?: string | null;
    /** The member this event is actually about, if any — drives the PUSH channel's target. Distinct from `recipientEmail`: not every caller has both today, and email is nullable/not a reliable key to resolve a member from. */
    recipientMemberId?: string | null;
    /** When provided and the EMAIL channel is active, replaces the generic title/body wrapper with a fully-detailed template (e.g. a payment receipt) — the IN_APP feed still uses the tenant's own customizable title/body text either way. */
    richEmail?: (branding: EmailBranding) => { subject: string; html: string };
  },
): Promise<void> {
  const template = await notificationTemplateService.getEffective(tenantId, type);
  if (!template.isActive) return;

  const title = renderTemplate(template.titleTemplate, vars);
  const body = renderTemplate(template.bodyTemplate, vars);

  if (template.channels.includes('IN_APP')) {
    await tenantNotificationService.notifyTenant(tenantId, opts.category, title, body);
  }
  if (template.channels.includes('EMAIL') && opts.recipientEmail) {
    const branding = await loadEmailBranding(tenantId);
    const mail = opts.richEmail ? opts.richEmail(branding) : tenantNotificationEmail(branding, title, body);
    await enqueueEmail({ to: opts.recipientEmail, subject: mail.subject, html: mail.html });
  }
  if (template.channels.includes('PUSH') && opts.recipientMemberId) {
    await tenantNotificationService.notifyMember(tenantId, opts.recipientMemberId, opts.category, title, body);
  }
}

export async function notifyNewMemberRegistration(
  tenantId: string,
  params: { memberId: string; memberName: string; memberCode: string; memberEmail?: string | null },
): Promise<void> {
  await fireTemplated(tenantId, 'NEW_MEMBER_REGISTRATION', { memberName: params.memberName, memberCode: params.memberCode }, { category: 'MEMBER' });

  await fireTemplated(
    tenantId,
    'WELCOME_MESSAGE',
    { memberName: params.memberName, memberCode: params.memberCode, tenantName: (await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }))?.name ?? 'the gym' },
    { category: 'MEMBER', recipientEmail: params.memberEmail, recipientMemberId: params.memberId },
  );
  if (params.memberEmail) {
    await cache.set(welcomeSentCacheKey(params.memberId), true, WELCOME_SENT_TTL_SECONDS);
  }
}

/** No matching named template (only "Membership Renewal"/"Membership Expiry" are in the 10-template list) — a plain in-app notice, now also pushed directly to the member since the IN_APP channel's `notifyTenant` call only reaches staff. */
export async function notifyMembershipAssigned(
  tenantId: string,
  params: { memberId: string; memberName: string; planName: string; endDate: string; startDate?: string },
): Promise<void> {
  const message = params.startDate
    ? `${params.memberName} was assigned the ${params.planName} plan, starting ${params.startDate} and valid through ${params.endDate}.`
    : `${params.memberName} was assigned the ${params.planName} plan, valid through ${params.endDate}.`;
  await tenantNotificationService.notifyTenant(tenantId, 'MEMBERSHIP', 'Membership assigned', message);
  await tenantNotificationService.notifyMember(tenantId, params.memberId, 'MEMBERSHIP', 'Membership assigned', message);
}

export async function notifyMembershipRenewed(
  tenantId: string,
  params: { memberId: string; memberName: string; planName: string; endDate: string; memberEmail?: string | null },
): Promise<void> {
  await fireTemplated(
    tenantId,
    'MEMBERSHIP_RENEWAL',
    { memberName: params.memberName, planName: params.planName, endDate: params.endDate },
    { category: 'MEMBERSHIP', recipientEmail: params.memberEmail, recipientMemberId: params.memberId },
  );
}

export async function notifyMembershipExpiring(
  tenantId: string,
  params: { memberId: string; memberName: string; planName: string; endDate: string; daysRemaining: number; memberEmail?: string | null },
): Promise<void> {
  await fireTemplated(
    tenantId,
    'MEMBERSHIP_EXPIRY',
    { memberName: params.memberName, planName: params.planName, endDate: params.endDate, expiryStatus: `expires in ${params.daysRemaining} day(s)` },
    { category: 'MEMBERSHIP', recipientEmail: params.memberEmail, recipientMemberId: params.memberId },
  );
}

export async function notifyMembershipExpired(
  tenantId: string,
  params: { memberId: string; memberName: string; planName: string; endDate: string; memberEmail?: string | null },
): Promise<void> {
  await fireTemplated(
    tenantId,
    'MEMBERSHIP_EXPIRY',
    { memberName: params.memberName, planName: params.planName, endDate: params.endDate, expiryStatus: 'has expired' },
    { category: 'MEMBERSHIP', recipientEmail: params.memberEmail, recipientMemberId: params.memberId },
  );
}

export async function notifyPaymentReceived(
  tenantId: string,
  params: {
    memberId: string;
    memberName: string;
    amount: string;
    paymentNumber: string;
    memberEmail?: string | null;
    /** Full receipt detail — when present, the EMAIL channel sends `memberPaymentReceiptEmail` instead of the generic customizable-text wrapper; the IN_APP feed is unaffected either way. */
    receipt?: {
      paymentDate: string;
      method: string;
      currencySymbol: string;
      amountPaid: number;
      discount?: number;
      tax?: number;
      totalPaid: number;
      dueAmount: number;
      membershipPlanName?: string | null;
      membershipValidTill?: string | null;
      transactionReference?: string | null;
    };
  },
): Promise<void> {
  await fireTemplated(
    tenantId,
    'PAYMENT_SUCCESS',
    { memberName: params.memberName, amount: params.amount, paymentNumber: params.paymentNumber },
    {
      category: 'PAYMENT',
      recipientEmail: params.memberEmail,
      recipientMemberId: params.memberId,
      richEmail: params.receipt
        ? (branding) =>
            memberPaymentReceiptEmail(branding, {
              memberName: params.memberName,
              paymentNumber: params.paymentNumber,
              ...params.receipt!,
            })
        : undefined,
    },
  );
}

export async function notifyPaymentFailed(
  tenantId: string,
  params: { memberId: string; memberName: string; amount: string; memberEmail?: string | null },
): Promise<void> {
  await fireTemplated(
    tenantId,
    'PAYMENT_FAILED',
    { memberName: params.memberName, amount: params.amount },
    { category: 'PAYMENT', recipientEmail: params.memberEmail, recipientMemberId: params.memberId },
  );
}

/** IN_APP → staff feed (via `notifyTenant`'s own push-to-staff), PUSH → the assigned member directly. A new capability — this event previously had no member-facing channel at all. */
export async function notifyWorkoutAssigned(tenantId: string, params: { memberId: string; memberName: string; planName: string }): Promise<void> {
  await fireTemplated(tenantId, 'WORKOUT_ASSIGNMENT', { memberName: params.memberName, planName: params.planName }, { category: 'WORKOUT', recipientMemberId: params.memberId });
}

/** Same reasoning as `notifyWorkoutAssigned` above. */
export async function notifyDietAssigned(tenantId: string, params: { memberId: string; memberName: string; planName: string }): Promise<void> {
  await fireTemplated(tenantId, 'DIET_ASSIGNMENT', { memberName: params.memberName, planName: params.planName }, { category: 'DIET', recipientMemberId: params.memberId });
}

/** Same reasoning as `notifyWorkoutAssigned` above — a member is now told directly that their own check-in/check-out was recorded. */
export async function notifyAttendanceCheckIn(tenantId: string, params: { memberId: string; memberName: string; time: string }): Promise<void> {
  await fireTemplated(
    tenantId,
    'ATTENDANCE_CONFIRMATION',
    { memberName: params.memberName, time: params.time, direction: 'checked in' },
    { category: 'ATTENDANCE', recipientMemberId: params.memberId },
  );
}

export async function notifyAttendanceCheckOut(tenantId: string, params: { memberId: string; memberName: string; time: string }): Promise<void> {
  await fireTemplated(
    tenantId,
    'ATTENDANCE_CONFIRMATION',
    { memberName: params.memberName, time: params.time, direction: 'checked out' },
    { category: 'ATTENDANCE', recipientMemberId: params.memberId },
  );
}

/** No matching named template — a plain in-app notice, same reasoning as Membership Assigned above. No push here: the invited person has no account/device yet (that's the point of an invitation), so email stays the only channel. */
export async function notifyStaffInvitation(tenantId: string, params: { email: string; roleName: string }): Promise<void> {
  await tenantNotificationService.notifyTenant(tenantId, 'STAFF', 'Staff invitation sent', `An invitation was sent to ${params.email} for the ${params.roleName} role.`);
}

/**
 * Called by the tenant-announcements module on publish (manual or via the
 * scheduler sweep) — reuses the announcement's own title/body verbatim
 * rather than a template. The staff Notification Center feed (+ its own
 * staff-wide push, via `notifyTenant`) always gets a row, same as before
 * this feature existed — announcements are staff-authored, so staff always
 * sees what was published regardless of who it targets. What's new:
 * `audience: MEMBERS|ALL` ADDITIONALLY pushes every member device directly
 * (previously nothing reached members at all, on any channel — the
 * `audience` field was purely cosmetic), optionally narrowed to one
 * branch's members when the announcement targets a specific branch.
 */
export async function notifyAnnouncementPublished(
  tenantId: string,
  params: { title: string; body: string; audience: 'ALL' | 'MEMBERS' | 'STAFF'; branchId?: string | null },
): Promise<void> {
  await tenantNotificationService.notifyTenant(tenantId, 'ANNOUNCEMENT', params.title, params.body);
  if (params.audience === 'ALL' || params.audience === 'MEMBERS') {
    await tenantNotificationService.notifyMembersInTenant(tenantId, 'ANNOUNCEMENT', params.title, params.body, params.branchId ?? undefined);
  }
}

/** Called by the Scheduler's `birthday-wishes` sweep — the `BIRTHDAY_WISHES` template existed since the Notifications module was built but had no firing point until now. */
export async function notifyBirthdayWishes(tenantId: string, params: { memberId: string; memberName: string; memberEmail?: string | null }): Promise<void> {
  await fireTemplated(
    tenantId,
    'BIRTHDAY_WISHES',
    { memberName: params.memberName },
    { category: 'MEMBER', recipientEmail: params.memberEmail, recipientMemberId: params.memberId },
  );
}
