import { Worker, type Job } from 'bullmq';

import { logger } from '../../core/logging/logger';
import { recordNotificationDelivery } from '../../modules/tenant-notifications/repositories/notification-delivery-log.repository';
import { twilioClient } from '../sms/twilio.client';

import { createQueueConnection } from './connection';
import type { SmsJobData } from './sms.queue';

let worker: Worker<SmsJobData> | null = null;

export function startSmsWorker(): Worker<SmsJobData> {
  worker = new Worker<SmsJobData>(
    'notifications-sms',
    async (job: Job<SmsJobData>) => {
      const result = await twilioClient.sendSms({ to: job.data.to, body: job.data.body });
      await recordNotificationDelivery({
        tenantId: job.data.tenantId,
        channel: 'SMS',
        recipient: job.data.to,
        content: job.data.body,
        // Twilio not configured anywhere → `result` is null, not a thrown
        // error (that's a `FAILED` case below) — log it as FAILED too, just
        // with a clearer reason, since nothing actually reached the member.
        status: result ? 'SENT' : 'FAILED',
        providerRef: result?.sid,
        errorMessage: result ? undefined : 'Twilio is not configured.',
      });
    },
    { connection: createQueueConnection(), concurrency: 5 },
  );

  worker.on('completed', (job) => logger.info('SMS job completed', { jobId: job.id, to: job.data.to }));
  worker.on('failed', async (job, err) => {
    logger.error('SMS job failed', { jobId: job?.id, to: job?.data.to, error: err.message, attempts: job?.attemptsMade });
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
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
