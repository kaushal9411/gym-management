import { Worker, type Job } from 'bullmq';

import { logger } from '../../core/logging/logger';
import { finalizeCampaignRecipient } from '../../modules/communications/services/recipient-finalizer.service';
import { humanizeDeliveryError } from '../../modules/communications/utils/delivery-error.util';
import { recordNotificationDelivery } from '../../modules/tenant-notifications/repositories/notification-delivery-log.repository';
import { kaleyraClient } from '../sms/kaleyra.client';

import { createQueueConnection } from './connection';
import type { WhatsAppJobData } from './whatsapp.queue';

let worker: Worker<WhatsAppJobData> | null = null;

export function startWhatsAppWorker(): Worker<WhatsAppJobData> {
  worker = new Worker<WhatsAppJobData>(
    'notifications-whatsapp',
    async (job: Job<WhatsAppJobData>) => {
      const result = await kaleyraClient.sendWhatsApp({ to: job.data.to, body: job.data.body });
      const logId = await recordNotificationDelivery({
        tenantId: job.data.tenantId,
        channel: 'WHATSAPP',
        recipient: job.data.to,
        content: job.data.body,
        status: 'messageId' in result ? 'SENT' : 'FAILED',
        providerRef: 'messageId' in result ? result.messageId : undefined,
        errorMessage: 'messageId' in result ? undefined : result.error,
      });
      if (job.data.campaignRecipientId) {
        await finalizeCampaignRecipient(job.data.tenantId, job.data.campaignRecipientId, {
          status: 'messageId' in result ? 'SENT' : 'FAILED',
          error: 'messageId' in result ? undefined : humanizeDeliveryError('WHATSAPP', result.error),
          deliveryLogId: logId,
        });
      }
    },
    { connection: createQueueConnection(), concurrency: 5 },
  );

  worker.on('completed', (job) => logger.info('WhatsApp job completed', { jobId: job.id, to: job.data.to }));
  worker.on('failed', async (job, err) => {
    logger.error('WhatsApp job failed', { jobId: job?.id, to: job?.data.to, error: err.message, attempts: job?.attemptsMade });
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      const logId = await recordNotificationDelivery({
        tenantId: job.data.tenantId,
        channel: 'WHATSAPP',
        recipient: job.data.to,
        content: job.data.body,
        status: 'FAILED',
        errorMessage: err.message,
      });
      if (job.data.campaignRecipientId) {
        await finalizeCampaignRecipient(job.data.tenantId, job.data.campaignRecipientId, {
          status: 'FAILED',
          error: humanizeDeliveryError('WHATSAPP', err.message),
          deliveryLogId: logId,
        });
      }
    }
  });

  return worker;
}

export async function stopWhatsAppWorker(): Promise<void> {
  await worker?.close();
}
