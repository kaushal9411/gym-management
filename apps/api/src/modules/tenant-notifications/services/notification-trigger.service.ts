import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
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
  opts: { category: Parameters<typeof tenantNotificationService.notifyTenant>[1]; recipientEmail?: string | null },
): Promise<void> {
  const template = await notificationTemplateService.getEffective(tenantId, type);
  if (!template.isActive) return;

  const title = renderTemplate(template.titleTemplate, vars);
  const body = renderTemplate(template.bodyTemplate, vars);

  if (template.channels.includes('IN_APP')) {
    await tenantNotificationService.notifyTenant(tenantId, opts.category, title, body);
  }
  if (template.channels.includes('EMAIL') && opts.recipientEmail) {
    await enqueueEmail({ to: opts.recipientEmail, subject: title, html: `<p>${body}</p>` });
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
export async function notifyMembershipAssigned(tenantId: string, params: { memberName: string; planName: string; endDate: string }): Promise<void> {
  await tenantNotificationService.notifyTenant(
    tenantId,
    'MEMBERSHIP',
    'Membership assigned',
    `${params.memberName} was assigned the ${params.planName} plan, valid through ${params.endDate}.`,
  );
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
  params: { memberName: string; amount: string; paymentNumber: string; memberEmail?: string | null },
): Promise<void> {
  await fireTemplated(
    tenantId,
    'PAYMENT_SUCCESS',
    { memberName: params.memberName, amount: params.amount, paymentNumber: params.paymentNumber },
    { category: 'PAYMENT', recipientEmail: params.memberEmail },
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
