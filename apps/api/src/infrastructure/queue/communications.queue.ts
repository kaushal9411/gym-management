import { Queue } from 'bullmq';

import { createQueueConnection } from './connection';

export interface CommunicationsJobData {
  /** `start` = resolve the audience and create the recipient rows; `batch` = hand the next ≤200 queued messages to their channel queues. */
  kind: 'start' | 'batch';
  tenantId: string;
  campaignId: string;
}

/**
 * Campaign orchestration queue (Communications). Both job kinds are idempotent and resumable: recipient rows are
 * seeded with a (campaign, member, channel) unique constraint and a message is claimed (`dispatchedAt`) before it
 * is handed to a channel queue, so a retried job can never double-send.
 */
export const communicationsQueue = new Queue<CommunicationsJobData, void, 'start' | 'batch'>('communications-dispatch', {
  connection: createQueueConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

/** BullMQ custom job ids may not contain ":". */
export async function enqueueCampaignStart(tenantId: string, campaignId: string): Promise<void> {
  await communicationsQueue.add('start', { kind: 'start', tenantId, campaignId }, { jobId: `start-${campaignId}-${Date.now()}` });
}

/** `slot` lets the minute sweeper dedupe (one pending sweep job per campaign per minute). */
export async function enqueueCampaignBatch(tenantId: string, campaignId: string, slot?: string): Promise<void> {
  await communicationsQueue.add('batch', { kind: 'batch', tenantId, campaignId }, { jobId: `batch-${campaignId}-${slot ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}` });
}
