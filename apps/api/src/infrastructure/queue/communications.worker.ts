import { Worker, type Job } from 'bullmq';

import { logger } from '../../core/logging/logger';
import { runCampaignBatch, startCampaign } from '../../modules/communications/services/campaign-dispatch.service';

import type { CommunicationsJobData } from './communications.queue';
import { createQueueConnection } from './connection';

let worker: Worker<CommunicationsJobData> | null = null;

export function startCommunicationsWorker(): Worker<CommunicationsJobData> {
  worker = new Worker<CommunicationsJobData>(
    'communications-dispatch',
    async (job: Job<CommunicationsJobData>) => {
      const { kind, tenantId, campaignId } = job.data;
      if (kind === 'start') await startCampaign(tenantId, campaignId);
      else await runCampaignBatch(tenantId, campaignId);
    },
    // Two jobs at a time: each batch is sequential inside, and tenants share the channel queues' own concurrency.
    { connection: createQueueConnection(), concurrency: 2 },
  );

  worker.on('completed', (job) => logger.info('Communications job completed', { jobId: job.id, kind: job.data.kind, campaignId: job.data.campaignId }));
  worker.on('failed', (job, err) =>
    logger.error('Communications job failed', { jobId: job?.id, kind: job?.data.kind, campaignId: job?.data.campaignId, error: err.message, attempts: job?.attemptsMade }),
  );

  return worker;
}

export async function stopCommunicationsWorker(): Promise<void> {
  await worker?.close();
}
