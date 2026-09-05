import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import type { EmailBranding } from '../../../infrastructure/mail/templates/base-layout';
import { memberPaymentReceiptEmail } from '../../../infrastructure/mail/templates/member-templates';
import { tenantNotificationEmail } from '../../../infrastructure/mail/templates/notification-templates';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { tenantService } from '../../tenants/service/tenant.service';
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
 * Notification Center feed via `notifyTenant`, EMAIL fires `enqueueEmail`
 * directly to the member's own inbox (there's no member-facing in-app portal
 * in this codebase, so email is a member's only channel — see
 * BACKEND-GUIDE.md §Notifications & Communication). A template with
 * `isActive: false` fires nothing at all, on any channel.
 */
async function fireTemplated(
  tenantId: string,
  type: Parameters<typeof notificationTemplateService.getEffective>[1],
  vars: Record<string, string>,
  opts: {
    category: Parameters<typeof tenantNotificationService.notifyTenant>[1];
    recipientEmail?: string | null;
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
    const tenant = await tenantService.resolveById(tenantId);
    const branding = tenant
      ? { tenantName: tenant.name, primaryColor: tenant.branding.primaryColor, logoUrl: tenant.branding.emailLogoUrl ?? tenant.branding.logoUrl }
      : { tenantName: 'FitCloud' };
    const mail = opts.richEmail ? opts.richEmail(branding) : tenantNotificationEmail(branding, title, body);
    await enqueueEmail({ to: opts.recipientEmail, subject: mail.subject, html: mail.html });
  }
}

export async function notifyNewMemberRegistration(
  tenantId: string,
  params: { memberId: string; memberName: string; memberCode: string; memberEmail?: string | null },
): Promise<void> {
  await fireTemplated(tenantId, 'NEW_MEMBER_REGISTRATION', { memberName: params.memberName, memberCode: params.memberCode }, { category: 'MEMBER' });

  if (params.memberEmail) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    await fireTemplated(
      tenantId,
      'WELCOME_MESSAGE',
      { memberName: params.memberName, memberCode: params.memberCode, tenantName: tenant?.name ?? 'the gym' },
      { category: 'MEMBER', recipientEmail: params.memberEmail },
    );
    await cache.set(welcomeSentCacheKey(params.memberId), true, WELCOME_SENT_TTL_SECONDS);
  }
}

/** No matching named template (only "Membership Renewal"/"Membership Expiry" are in the 10-template list) — a plain in-app notice. */
export async function notifyMembershipAssigned(
  tenantId: string,
  params: { memberName: string; planName: string; endDate: string; startDate?: string },
): Promise<void> {
  const message = params.startDate
    ? `${params.memberName} was assigned the ${params.planName} plan, starting ${params.startDate} and valid through ${params.endDate}.`
    : `${params.memberName} was assigned the ${params.planName} plan, valid through ${params.endDate}.`;
  await tenantNotificationService.notifyTenant(tenantId, 'MEMBERSHIP', 'Membership assigned', message);
}

export async function notifyMembershipRenewed(
  tenantId: string,
  params: { memberName: string; planName: string; endDate: string; memberEmail?: string | null },
): Promise<void> {
  await fireTemplated(
    tenantId,
    'MEMBERSHIP_RENEWAL',
    { memberName: params.memberName, planName: params.planName, endDate: params.endDate },
    { category: 'MEMBERSHIP', recipientEmail: params.memberEmail },
  );
}

export async function notifyMembershipExpiring(
  tenantId: string,
  params: { memberName: string; planName: string; endDate: string; daysRemaining: number; memberEmail?: string | null },
): Promise<void> {
  await fireTemplated(
    tenantId,
    'MEMBERSHIP_EXPIRY',
    { memberName: params.memberName, planName: params.planName, endDate: params.endDate, expiryStatus: `expires in ${params.daysRemaining} day(s)` },
    { category: 'MEMBERSHIP', recipientEmail: params.memberEmail },
  );
}

export async function notifyMembershipExpired(
  tenantId: string,
  params: { memberName: string; planName: string; endDate: string; memberEmail?: string | null },
): Promise<void> {
  await fireTemplated(
    tenantId,
    'MEMBERSHIP_EXPIRY',
    { memberName: params.memberName, planName: params.planName, endDate: params.endDate, expiryStatus: 'has expired' },
    { category: 'MEMBERSHIP', recipientEmail: params.memberEmail },
  );
}

export async function notifyPaymentReceived(
  tenantId: string,
  params: {
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

export async function notifyPaymentFailed(tenantId: string, params: { memberName: string; amount: string; memberEmail?: string | null }): Promise<void> {
  await fireTemplated(
    tenantId,
    'PAYMENT_FAILED',
    { memberName: params.memberName, amount: params.amount },
    { category: 'PAYMENT', recipientEmail: params.memberEmail },
  );
}

export async function notifyWorkoutAssigned(tenantId: string, params: { memberName: string; planName: string }): Promise<void> {
  await fireTemplated(tenantId, 'WORKOUT_ASSIGNMENT', params, { category: 'WORKOUT' });
}

export async function notifyDietAssigned(tenantId: string, params: { memberName: string; planName: string }): Promise<void> {
  await fireTemplated(tenantId, 'DIET_ASSIGNMENT', params, { category: 'DIET' });
}

export async function notifyAttendanceCheckIn(tenantId: string, params: { memberName: string; time: string }): Promise<void> {
  await fireTemplated(tenantId, 'ATTENDANCE_CONFIRMATION', { memberName: params.memberName, time: params.time, direction: 'checked in' }, { category: 'ATTENDANCE' });
}

export async function notifyAttendanceCheckOut(tenantId: string, params: { memberName: string; time: string }): Promise<void> {
  await fireTemplated(tenantId, 'ATTENDANCE_CONFIRMATION', { memberName: params.memberName, time: params.time, direction: 'checked out' }, { category: 'ATTENDANCE' });
}

/** No matching named template — a plain in-app notice, same reasoning as Membership Assigned above. */
export async function notifyStaffInvitation(tenantId: string, params: { email: string; roleName: string }): Promise<void> {
  await tenantNotificationService.notifyTenant(tenantId, 'STAFF', 'Staff invitation sent', `An invitation was sent to ${params.email} for the ${params.roleName} role.`);
}

/** Called by the tenant-announcements module on publish (manual or via the scheduler sweep) — reuses the announcement's own title/body verbatim rather than a template. */
export async function notifyAnnouncementPublished(tenantId: string, params: { title: string; body: string }): Promise<void> {
  await tenantNotificationService.notifyTenant(tenantId, 'ANNOUNCEMENT', params.title, params.body);
}

/** Called by the Scheduler's `birthday-wishes` sweep — the `BIRTHDAY_WISHES` template existed since the Notifications module was built but had no firing point until now. */
export async function notifyBirthdayWishes(tenantId: string, params: { memberName: string; memberEmail?: string | null }): Promise<void> {
  await fireTemplated(tenantId, 'BIRTHDAY_WISHES', { memberName: params.memberName }, { category: 'MEMBER', recipientEmail: params.memberEmail });
}
