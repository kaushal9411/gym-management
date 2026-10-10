import { Worker, type Job } from 'bullmq';

import { logger } from '../../core/logging/logger';
import { recordNotificationDelivery } from '../../modules/tenant-notifications/repositories/notification-delivery-log.repository';
import { kaleyraClient } from '../sms/kaleyra.client';

import { createQueueConnection } from './connection';
import type { SmsJobData } from './sms.queue';

let worker: Worker<SmsJobData> | null = null;

export function startSmsWorker(): Worker<SmsJobData> {
  worker = new Worker<SmsJobData>(
    'notifications-sms',
    async (job: Job<SmsJobData>) => {
      const result = await kaleyraClient.sendSms({ to: job.data.to, body: job.data.body });
      if (job.data.skipDeliveryLog) return;
      await recordNotificationDelivery({
        tenantId: job.data.tenantId,
        channel: 'SMS',
        recipient: job.data.to,
        content: job.data.body,
        // Kaleyra not configured/no sender id → `result` carries a real
        // `error` string, not a thrown exception (that's a `FAILED` case
        // below too, via the `failed` handler) — log it as FAILED with the
        // actual reason, since nothing actually reached the member.
        status: 'messageId' in result ? 'SENT' : 'FAILED',
        providerRef: 'messageId' in result ? result.messageId : undefined,
        errorMessage: 'messageId' in result ? undefined : result.error,
      });
    },
    { connection: createQueueConnection(), concurrency: 5 },
  );

  worker.on('completed', (job) => logger.info('SMS job completed', { jobId: job.id, to: job.data.to }));
  worker.on('failed', async (job, err) => {
    logger.error('SMS job failed', { jobId: job?.id, to: job?.data.to, error: err.message, attempts: job?.attemptsMade });
    if (job && !job.data.skipDeliveryLog && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await recordNotificationDelivery({
        tenantId: job.data.tenantId,
        channel: 'SMS',
        recipient: job.data.to,
        content: job.data.body,
        status: 'FAILED',
        errorMessage: err.message,
      });
    }
  });

  return worker;
}

export async function stopSmsWorker(): Promise<void> {
  await worker?.close();
}
