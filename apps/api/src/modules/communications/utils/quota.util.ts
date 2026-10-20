import type { TenantNotificationChannel } from '@prisma/client';

export type DisabledReason = 'disabled_platform' | 'disabled_tenant';

export interface ChannelQuotaInput {
  channel: TenantNotificationChannel;
  enabled: boolean;
  disabledReason: DisabledReason | null;
  /** Monthly limit; `null` = unlimited. */
  limit: number | null;
  /** Messages already used this period. */
  used: number;
  /** Messages this campaign would add on the channel. */
  wouldUse: number;
}

export interface ChannelQuotaView {
  enabled: boolean;
  disabledReason: DisabledReason | null;
  limit: number | null;
  used: number;
  remaining: number | null;
  wouldUse: number;
  over: boolean;
  shortBy: number;
}

/** Pure pre-check maths: how much of the monthly quota is left and whether the campaign would exceed it. */
export function computeQuota(input: ChannelQuotaInput): ChannelQuotaView {
  const remaining = input.limit === null ? null : Math.max(0, input.limit - input.used);
  const over = remaining !== null && input.wouldUse > remaining;
  return {
    enabled: input.enabled,
    disabledReason: input.disabledReason,
    limit: input.limit,
    used: input.used,
    remaining,
    wouldUse: input.wouldUse,
    over,
    shortBy: over && remaining !== null ? input.wouldUse - remaining : 0,
  };
}

export interface ShortChannel {
  channel: TenantNotificationChannel;
  remaining: number;
  wouldUse: number;
  shortBy: number;
}

/** Channels that are enabled but do not have enough quota left (only channels that would actually send anything). */
export function shortChannels(rows: Array<{ channel: TenantNotificationChannel; quota: ChannelQuotaView }>): ShortChannel[] {
  return rows
    .filter((r) => r.quota.enabled && r.quota.over && r.quota.wouldUse > 0)
    .map((r) => ({ channel: r.channel, remaining: r.quota.remaining ?? 0, wouldUse: r.quota.wouldUse, shortBy: r.quota.shortBy }));
}

/** Selected paid channels that are switched off for the gym and would have sent at least one message. */
export function disabledChannels(
  rows: Array<{ channel: TenantNotificationChannel; quota: ChannelQuotaView }>,
): Array<{ channel: TenantNotificationChannel; reason: DisabledReason }> {
  return rows
    .filter((r) => !r.quota.enabled && r.quota.wouldUse > 0)
    .map((r) => ({ channel: r.channel, reason: r.quota.disabledReason ?? 'disabled_platform' }));
}

/** One sentence naming every short channel and by how much, e.g. "Not enough SMS quota: 240 left, this send needs 412 (short by 172)." */
export function describeShortChannels(short: ShortChannel[]): string {
  const parts = short.map((s) => `${s.channel}: ${s.remaining.toLocaleString('en-IN')} left, this send needs ${s.wouldUse.toLocaleString('en-IN')} (short by ${s.shortBy.toLocaleString('en-IN')})`);
  return `Not enough monthly quota - ${parts.join('; ')}. Turn the channel off, narrow the audience, or ask the platform to raise the limit.`;
}
