import { Queue } from 'bullmq';

import { createQueueConnection } from './connection';

export interface PushJobData {
  tenantId: string;
  tokens: string[];
  tokenOwner: 'STAFF' | 'MEMBER';
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Producer side of async push delivery — the FCM counterpart to
 * `email.queue.ts`, same reasoning (a slow/unreachable FCM call never blocks
 * the request/job that triggered the notification).
 */
export const pushQueue = new Queue<PushJobData, void, 'send'>('notifications-push', {
  connection: createQueueConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

export async function enqueuePush(data: PushJobData): Promise<void> {
  if (data.tokens.length === 0) return;
  await pushQueue.add('send', data);
}
