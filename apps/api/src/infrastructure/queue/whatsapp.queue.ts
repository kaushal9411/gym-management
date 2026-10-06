import { Queue } from 'bullmq';

import { createQueueConnection } from './connection';

export interface WhatsAppJobData {
  tenantId: string;
  to: string;
  body: string;
}

/** Producer side of async WhatsApp delivery — same shape as `sms.queue.ts`, through the same Twilio account (`whatsapp:` prefix applied in `twilio.client.ts`). */
export const whatsappQueue = new Queue<WhatsAppJobData, void, 'send'>('notifications-whatsapp', {
  connection: createQueueConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

export async function enqueueWhatsApp(data: WhatsAppJobData): Promise<void> {
  await whatsappQueue.add('send', data);
}
