import { Queue } from 'bullmq';

import { createQueueConnection } from './connection';

export interface SmsJobData {
  tenantId: string;
  to: string;
  body: string;
}

/**
 * Producer side of async SMS delivery — same shape as `email.queue.ts`.
 * Unlike email, every job here always comes from `notification-trigger.service.ts`'s
 * `fireTemplated` (no other call site sends SMS today), so `tenantId` is
 * required, not optional — `sms.worker.ts` always writes a
 * `NotificationDeliveryLog` row.
 */
export const smsQueue = new Queue<SmsJobData, void, 'send'>('notifications-sms', {
  connection: createQueueConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

export async function enqueueSms(data: SmsJobData): Promise<void> {
  await smsQueue.add('send', data);
}
