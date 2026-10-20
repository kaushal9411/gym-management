import type { CampaignRecipientStatus } from '@prisma/client';

import { logger } from '../../../core/logging/logger';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { CampaignRepository } from '../repositories/campaign.repository';
import { failureReasonFor, finalStatus } from '../utils/campaign-state.util';

export type FinalOutcome = {
  status: Exclude<CampaignRecipientStatus, 'QUEUED'>;
  error?: string | null;
  deliveryLogId?: string | null;
};

const COUNTER_FOR: Partial<Record<CampaignRecipientStatus, 'sentCount' | 'failedCount' | 'skippedCount' | 'cancelledCount'>> = {
  SENT: 'sentCount',
  FAILED: 'failedCount',
  SKIPPED_OPTED_OUT: 'skippedCount',
  SKIPPED_NO_CONTACT: 'skippedCount',
  SKIPPED_QUOTA: 'skippedCount',
  SKIPPED_DISABLED: 'skippedCount',
  CANCELLED: 'cancelledCount',
};

/**
 * Moves one QUEUED message to its outcome exactly once, bumps the campaign counter atomically
 * (`UPDATE ... SET x = x + 1`) and closes the campaign when nothing is left in flight.
 * Never throws: it is called from channel workers right after a provider call succeeded, and a thrown error
 * there would make the queue retry (and re-send) the message.
 */
export async function finalizeCampaignRecipient(tenantId: string, recipientId: string, outcome: FinalOutcome): Promise<void> {
  try {
    const repo = new CampaignRepository(getTenantScopedClient(tenantId));
    const changed = await repo.finalizeRecipient(recipientId, outcome);
    if (!changed) return; // already finalised (a retry) - counters must not move twice
    const row = await repo.findRecipient(recipientId);
    if (!row) return;
    const counter = COUNTER_FOR[outcome.status];
    if (counter) await repo.increment(row.campaignId, counter);
    await finishCampaignIfDone(tenantId, row.campaignId);
  } catch (error) {
    logger.error('Could not finalise campaign recipient', { tenantId, recipientId, error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * When a SENDING campaign has no QUEUED message left, recompute its counters from the recipient rows (the source of
 * truth) and set the terminal status (SENT / PARTIAL / FAILED). Compare-and-set on `SENDING`, so concurrent finishers
 * and cancelled campaigns are left alone.
 */
export async function finishCampaignIfDone(tenantId: string, campaignId: string): Promise<boolean> {
  const repo = new CampaignRepository(getTenantScopedClient(tenantId));
  const campaign = await repo.findById(tenantId, campaignId);
  if (!campaign || campaign.status !== 'SENDING') return false;
  if ((await repo.countQueued(campaignId)) > 0) return false;

  const groups = await repo.recipientStatusGroups(campaignId);
  const sum = (pred: (s: CampaignRecipientStatus) => boolean): number => groups.filter((g) => pred(g.status)).reduce((n, g) => n + g.count, 0);
  const total = sum(() => true);
  const sent = sum((s) => s === 'SENT');
  const failed = sum((s) => s === 'FAILED');
  const skipped = sum((s) => s.startsWith('SKIPPED_'));
  const skippedProblem = sum((s) => s === 'SKIPPED_QUOTA' || s === 'SKIPPED_DISABLED');
  const cancelled = sum((s) => s === 'CANCELLED');
  const counts = { total, sent, failed, skippedProblem };
  const status = finalStatus(counts);
  const changed = await repo.updateIfStatus(campaignId, tenantId, ['SENDING'], {
    status,
    finishedAt: new Date(),
    messageCount: total,
    sentCount: sent,
    failedCount: failed,
    skippedCount: skipped,
    cancelledCount: cancelled,
    failureReason: failureReasonFor({ ...counts, skipped }),
  });
  return changed === 1;
}

/** Rewrites the campaign counters from the recipient rows (the source of truth) - used after bulk transitions (seed / cancel / retry). */
export async function syncCampaignCounters(tenantId: string, campaignId: string): Promise<void> {
  const repo = new CampaignRepository(getTenantScopedClient(tenantId));
  const [groups, members] = await Promise.all([repo.recipientStatusGroups(campaignId), repo.distinctMemberCount(campaignId)]);
  const sum = (pred: (s: CampaignRecipientStatus) => boolean): number => groups.filter((g) => pred(g.status)).reduce((n, g) => n + g.count, 0);
  await repo.update(campaignId, {
    recipientCount: members,
    messageCount: sum(() => true),
    sentCount: sum((s) => s === 'SENT'),
    failedCount: sum((s) => s === 'FAILED'),
    skippedCount: sum((s) => s.startsWith('SKIPPED_')),
    cancelledCount: sum((s) => s === 'CANCELLED'),
  });
}
