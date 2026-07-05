import { Queue } from 'bullmq';

import { createQueueConnection } from './connection';

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  fromAddress?: string;
}

/**
 * Producer side of async email delivery. Runs as a real BullMQ queue
 * (Background Jobs requirement) so a slow/unreachable SMTP provider never
 * blocks a request. The worker (email.worker.ts) currently runs in-process
 * within this same api server — it moves to a dedicated `apps/worker`
 * deployable, unchanged, once that app exists (see docs/architecture
 * ARCHITECTURE.md §22).
 */
export const emailQueue = new Queue<EmailJobData, void, 'send'>('notifications-email', {
  connection: createQueueConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

export async function enqueueEmail(data: EmailJobData): Promise<void> {
  await emailQueue.add('send', data);
}
