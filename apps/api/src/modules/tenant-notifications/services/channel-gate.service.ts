import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { enqueueEmail, type EmailJobData } from '../../../infrastructure/queue/email.queue';
import { recordNotificationDelivery } from '../repositories/notification-delivery-log.repository';

/** The 3 channels this gate actually governs — IN_APP/PUSH are free/platform-configured and never checked here. */
export type GatedChannel = 'EMAIL' | 'SMS' | 'WHATSAPP';

export type ChannelGateReason = 'disabled_platform' | 'disabled_tenant' | 'quota_exceeded';

export interface ChannelGateResult {
  allowed: boolean;
  reason?: ChannelGateReason;
}

/** User-facing denial copy per reason — shown by callers that run inside a request/response cycle (a staff member clicked "Email invoice" and needs to know it genuinely did not go out), NOT by fire-and-forget event listeners/scheduler jobs, which only ever show this via the Message Log. */
export const CHANNEL_GATE_DENIAL_MESSAGE: Record<ChannelGateReason, string> = {
  disabled_platform: 'Email sending is not enabled for this gym yet — the platform has not granted this channel.',
  disabled_tenant: 'Email notifications are turned off in Gym Settings → Business — turn them back on to send this.',
  quota_exceeded: "This month's email quota has been used up. It resets next month, or ask the platform to raise the limit.",
};

/** "2026-10" in the server's own UTC calendar — see `TenantNotificationUsage.periodKey`'s doc comment for why this isn't per-tenant-timezone. */
export function currentPeriodKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * The one gate every EMAIL/SMS/WHATSAPP send goes through before it's
 * allowed to enqueue, called from `notification-trigger.service.ts`'s
 * `fireTemplated`. Checks, in order: the super-admin-set ceiling
 * (`TenantNotificationChannelLimit`), the tenant's own toggle
 * (`TenantSettings`), then this month's usage against the ceiling's quota.
 * A `true` result ALSO atomically bumps the current period's usage
 * counter — checking and incrementing are deliberately one call so a
 * caller can't check, then enqueue, without the counter moving (the
 * increment-at-enqueue-not-at-delivery tradeoff is intentional, same
 * "accepted tradeoff for a low-frequency write path" precedent already
 * documented for class-booking capacity — not worth a transaction here).
 */
export async function checkAndConsumeChannelQuota(tenantId: string, channel: GatedChannel): Promise<ChannelGateResult> {
  const db = getTenantScopedClient(tenantId);

  const limit = await db.tenantNotificationChannelLimit.findUnique({ where: { tenantId } });
  const { enabled, monthlyLimit } = readLimit(limit, channel);
  if (!enabled) return { allowed: false, reason: 'disabled_platform' };

  const settings = await db.tenantSettings.findUnique({ where: { tenantId } });
  if (!readTenantToggle(settings, channel)) return { allowed: false, reason: 'disabled_tenant' };

  const periodKey = currentPeriodKey();
  if (monthlyLimit !== null) {
    const usage = await db.tenantNotificationUsage.findUnique({ where: { tenantId_channel_periodKey: { tenantId, channel, periodKey } } });
    if ((usage?.sentCount ?? 0) >= monthlyLimit) return { allowed: false, reason: 'quota_exceeded' };
  }

  await db.tenantNotificationUsage.upsert({
    where: { tenantId_channel_periodKey: { tenantId, channel, periodKey } },
    create: { tenantId, channel, periodKey, sentCount: 1 },
    update: { sentCount: { increment: 1 } },
  });
  return { allowed: true };
}

export function readLimit(
  limit: { emailEnabled: boolean; emailMonthlyLimit: number | null; smsEnabled: boolean; smsMonthlyLimit: number | null; whatsappEnabled: boolean; whatsappMonthlyLimit: number | null } | null,
  channel: GatedChannel,
): { enabled: boolean; monthlyLimit: number | null } {
  // No row at all = never explicitly granted by a super-admin — every paid channel defaults OFF, the safe default (see the model's own doc comment).
  if (!limit) return { enabled: false, monthlyLimit: null };
  if (channel === 'EMAIL') return { enabled: limit.emailEnabled, monthlyLimit: limit.emailMonthlyLimit };
  if (channel === 'SMS') return { enabled: limit.smsEnabled, monthlyLimit: limit.smsMonthlyLimit };
  return { enabled: limit.whatsappEnabled, monthlyLimit: limit.whatsappMonthlyLimit };
}

/**
 * EVERY tenant email except login OTP and password reset/changed goes
 * through this now (user direction, same-session addendum to Prompt 128):
 * gate-then-send, so every one of those emails actually counts against the
 * tenant's Email quota exactly like `fireTemplated`'s own EMAIL branch does
 * — not just logged. A blocked result never calls `enqueueEmail` at all;
 * it writes the `SKIPPED_DISABLED`/`SKIPPED_QUOTA` row itself (mirrors
 * `notification-trigger.service.ts`'s private `recordSkipped`, duplicated
 * here rather than imported to avoid a circular import between the two
 * services). Callers pass the same shape `enqueueEmail` takes minus
 * `notificationTenantId` (this function sets it). Returns the gate result
 * so a caller running inside a request/response cycle (not a fire-and-forget
 * listener/scheduler job) can turn a blocked send into a real error instead
 * of reporting false success — see `CHANNEL_GATE_DENIAL_MESSAGE` above.
 */
export async function sendGatedEmail(tenantId: string, data: Omit<EmailJobData, 'notificationTenantId'>): Promise<ChannelGateResult> {
  const gate = await checkAndConsumeChannelQuota(tenantId, 'EMAIL');
  if (gate.allowed) {
    await enqueueEmail({ ...data, notificationTenantId: tenantId });
    return gate;
  }
  await recordNotificationDelivery({
    tenantId,
    channel: 'EMAIL',
    recipient: data.to,
    subject: data.subject,
    content: data.html,
    status: gate.reason === 'quota_exceeded' ? 'SKIPPED_QUOTA' : 'SKIPPED_DISABLED',
    errorMessage: gate.reason,
  });
  return gate;
}

function readTenantToggle(
  settings: { emailNotificationsEnabled: boolean; smsNotificationsEnabled: boolean; whatsappNotificationsEnabled: boolean } | null,
  channel: GatedChannel,
): boolean {
  if (!settings) return true; // no settings row yet (shouldn't normally happen post-onboarding) — don't let a missing row silently block sending
  if (channel === 'EMAIL') return settings.emailNotificationsEnabled;
  if (channel === 'SMS') return settings.smsNotificationsEnabled;
  return settings.whatsappNotificationsEnabled;
}
