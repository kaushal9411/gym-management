import { Worker, type Job } from 'bullmq';

import { logger } from '../../core/logging/logger';
import { mailer } from '../mail/mailer';

import { createQueueConnection } from './connection';
import type { EmailJobData } from './email.queue';

let worker: Worker<EmailJobData> | null = null;

export function startEmailWorker(): Worker<EmailJobData> {
  worker = new Worker<EmailJobData>(
    'notifications-email',
    async (job: Job<EmailJobData>) => {
      await mailer.send(job.data);
    },
    { connection: createQueueConnection(), concurrency: 5 },
  );

  worker.on('completed', (job) => logger.info('Email job completed', { jobId: job.id, to: job.data.to }));
  worker.on('failed', (job, err) =>
    logger.error('Email job failed', { jobId: job?.id, to: job?.data.to, error: err.message, attempts: job?.attemptsMade }),
  );

  return worker;
}

export async function stopEmailWorker(): Promise<void> {
  await worker?.close();
}
