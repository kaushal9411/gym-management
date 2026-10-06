import { Worker, type Job } from 'bullmq';

import { logger } from '../../core/logging/logger';
import { recordNotificationDelivery } from '../../modules/tenant-notifications/repositories/notification-delivery-log.repository';
import { mailer } from '../mail/mailer';

import { createQueueConnection } from './connection';
import type { EmailJobData } from './email.queue';

let worker: Worker<EmailJobData> | null = null;

export function startEmailWorker(): Worker<EmailJobData> {
  worker = new Worker<EmailJobData>(
    'notifications-email',
    async (job: Job<EmailJobData>) => {
      await mailer.send(job.data);
      // Only `fireTemplated`'s EMAIL branch sets this — every other of this
      // queue's ~27 call sites (password resets, invitations, platform
      // billing, …) is a plain transactional send, never logged here or
      // counted against a tenant's quota.
      if (job.data.notificationTenantId) {
        await recordNotificationDelivery({
          tenantId: job.data.notificationTenantId,
          channel: 'EMAIL',
          recipient: job.data.to,
          subject: job.data.subject,
          content: job.data.html,
          status: 'SENT',
        });
      }
    },
    { connection: createQueueConnection(), concurrency: 5 },
  );

  worker.on('completed', (job) => logger.info('Email job completed', { jobId: job.id, to: job.data.to }));
  worker.on('failed', async (job, err) => {
    logger.error('Email job failed', { jobId: job?.id, to: job?.data.to, error: err.message, attempts: job?.attemptsMade });
    // Only log a FAILED row once retries are exhausted (the job's final attempt), not on every transient retry.
    if (job?.data.notificationTenantId && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await recordNotificationDelivery({
        tenantId: job.data.notificationTenantId,
        channel: 'EMAIL',
        recipient: job.data.to,
        subject: job.data.subject,
        content: job.data.html,
        status: 'FAILED',
        errorMessage: err.message,
      });
    }
  });

  return worker;
}

export async function stopEmailWorker(): Promise<void> {
  await worker?.close();
}
