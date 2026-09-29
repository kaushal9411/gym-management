import { Worker, type Job } from 'bullmq';

import { logger } from '../../core/logging/logger';
import { MemberDeviceTokenRepository } from '../../modules/device-tokens/repositories/member-device-token.repository';
import { StaffDeviceTokenRepository } from '../../modules/device-tokens/repositories/staff-device-token.repository';
import { getTenantScopedClient } from '../database/tenant-scoped-client';
import { fcmClient } from '../push/fcm.client';

import { createQueueConnection } from './connection';
import type { PushJobData } from './push.queue';

let worker: Worker<PushJobData> | null = null;

export function startPushWorker(): Worker<PushJobData> {
  worker = new Worker<PushJobData>(
    'notifications-push',
    async (job: Job<PushJobData>) => {
      const { tenantId, tokens, tokenOwner, title, body, data } = job.data;
      if (!fcmClient.isConfigured) {
        logger.debug('Firebase not configured — skipping push job', { jobId: job.id, tenantId });
        return;
      }

      const { deadTokens } = await fcmClient.sendToTokens(tokens, { title, body, data });
      if (deadTokens.length === 0) return;

      const db = getTenantScopedClient(tenantId);
      if (tokenOwner === 'STAFF') {
        await new StaffDeviceTokenRepository(db).removeMany(tenantId, deadTokens);
      } else {
        await new MemberDeviceTokenRepository(db).removeMany(tenantId, deadTokens);
      }
    },
    { connection: createQueueConnection(), concurrency: 5 },
  );

  worker.on('completed', (job) => logger.info('Push job completed', { jobId: job.id, tenantId: job.data.tenantId, recipients: job.data.tokens.length }));
  worker.on('failed', (job, err) =>
    logger.error('Push job failed', { jobId: job?.id, tenantId: job?.data.tenantId, error: err.message, attempts: job?.attemptsMade }),
  );

  return worker;
}

export async function stopPushWorker(): Promise<void> {
  await worker?.close();
}
