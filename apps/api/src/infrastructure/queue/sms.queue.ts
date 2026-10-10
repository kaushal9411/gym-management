import { Queue } from 'bullmq';

import { createQueueConnection } from './connection';

export interface SmsJobData {
  tenantId: string;
  to: string;
  body: string;
  /**
   * Set ONLY by the OTP-issued listeners (`auth-email.listeners.ts` /
   * `member-auth-email.listeners.ts`) — an OTP code must never appear in a
   * tenant's own Message Log (same reasoning `EmailJobData.notificationTenantId`
   * already documents for why OTP email is never tagged/logged), so this
   * tells `sms.worker.ts` to skip the `NotificationDeliveryLog` write it
   * otherwise always does.
   */
  skipDeliveryLog?: boolean;
}

/**
 * Producer side of async SMS delivery — same shape as `email.queue.ts`.
 * Every job here comes from either `notification-trigger.service.ts`'s
 * `fireTemplated` (quota-gated business notifications — `tenantId` required
 * so `sms.worker.ts` can always write a `NotificationDeliveryLog` row) or an
 * OTP-issued listener (never gated, never logged — see `skipDeliveryLog`).
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
