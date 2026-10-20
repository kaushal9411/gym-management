import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { ALL_CHANNELS } from '../constants/limits';
import { CampaignRepository } from '../repositories/campaign.repository';

import { AutomationService, QUIET_HOURS_VIEW } from './automation.service';
import { toCampaignDto } from './campaign.service';
import { currentPeriodKey, getChannelStates } from './channel-state.service';

/** The Communications hub: quota at a glance, the five most recent campaigns, automation count. */
export async function buildOverview(tenantId: string) {
  const [states, recent, automations] = await Promise.all([
    getChannelStates(tenantId),
    new CampaignRepository(getTenantScopedClient(tenantId)).recent(tenantId, 5),
    new AutomationService(tenantId).enabledSummary(),
  ]);
  return {
    periodKey: currentPeriodKey(),
    channels: ALL_CHANNELS.map((c) => states[c]),
    recent: recent.map(toCampaignDto),
    automations,
    quietHours: QUIET_HOURS_VIEW,
  };
}
