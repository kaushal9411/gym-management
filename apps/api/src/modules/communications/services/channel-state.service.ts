import type { TenantNotificationChannel } from '@prisma/client';

import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { currentPeriodKey, readLimit, readTenantToggle } from '../../tenant-notifications/services/channel-gate.service';
import { ALL_CHANNELS, isPaidChannel } from '../constants/limits';
import type { DisabledReason } from '../utils/quota.util';

export interface ChannelState {
  channel: TenantNotificationChannel;
  enabled: boolean;
  disabledReason: DisabledReason | null;
  /** Monthly limit; `null` = unlimited (always the case for PUSH / IN_APP). */
  limit: number | null;
  used: number;
  remaining: number | null;
}

/**
 * READ-ONLY view of every channel's gate for the current month: platform ceiling -> the gym's own toggle -> usage vs
 * quota. Same inputs as `checkAndConsumeChannelQuota`, but nothing is consumed - this backs the previews, the hub
 * and the pre-send quota check. PUSH / IN_APP are never gated.
 */
export async function getChannelStates(tenantId: string): Promise<Record<TenantNotificationChannel, ChannelState>> {
  const db = getTenantScopedClient(tenantId);
  const periodKey = currentPeriodKey();
  const [limitRow, settings, usageRows] = await Promise.all([
    db.tenantNotificationChannelLimit.findUnique({ where: { tenantId } }),
    db.tenantSettings.findUnique({ where: { tenantId } }),
    db.tenantNotificationUsage.findMany({ where: { tenantId, periodKey } }),
  ]);
  const usedBy = new Map(usageRows.map((u) => [u.channel, u.sentCount]));

  const out = {} as Record<TenantNotificationChannel, ChannelState>;
  for (const channel of ALL_CHANNELS) {
    if (!isPaidChannel(channel)) {
      out[channel] = { channel, enabled: true, disabledReason: null, limit: null, used: 0, remaining: null };
      continue;
    }
    const { enabled: platformOn, monthlyLimit } = readLimit(limitRow, channel);
    const tenantOn = readTenantToggle(settings, channel);
    const disabledReason: DisabledReason | null = !platformOn ? 'disabled_platform' : !tenantOn ? 'disabled_tenant' : null;
    const used = usedBy.get(channel) ?? 0;
    out[channel] = {
      channel,
      enabled: disabledReason === null,
      disabledReason,
      limit: monthlyLimit,
      used,
      remaining: monthlyLimit === null ? null : Math.max(0, monthlyLimit - used),
    };
  }
  return out;
}

export { currentPeriodKey };
