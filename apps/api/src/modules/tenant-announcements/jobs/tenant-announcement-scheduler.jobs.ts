import { Queue, Worker } from 'bullmq';

import { logger } from '../../../core/logging/logger';
import { prisma } from '../../../infrastructure/database/prisma';
import { createQueueConnection } from '../../../infrastructure/queue/connection';
import { notifyAnnouncementPublished } from '../../tenant-notifications/services/notification-trigger.service';
import { TenantAnnouncementRepository } from '../repositories/tenant-announcement.repository';

const QUEUE_NAME = 'tenant-announcement-scheduler';
const CHECK_INTERVAL_MS = 60 * 60_000; // hourly — same granularity as this codebase's other BullMQ sweeps

let queue: Queue | null = null;
let worker: Worker | null = null;

/** Rich-text body is stored as HTML; the Notification Center feed item is plain text. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * "Scheduled announcements publish automatically" — an hourly sweep, same
 * repeatable-job shape as `subscription-billing.jobs.ts`/`scheduled-reports.jobs.ts`:
 * flips due SCHEDULED rows to PUBLISHED (and fires the same in-app
 * notification a manual Publish click would), and separately flips
 * PUBLISHED rows past their own `expiresAt` to EXPIRED so they stop showing
 * in the tenant's active announcement list.
 */
export async function startTenantAnnouncementSchedulerJobs(): Promise<void> {
  queue = new Queue(QUEUE_NAME, { connection: createQueueConnection() });

  worker = new Worker(
    QUEUE_NAME,
    async () => {
      await publishDue();
      await expireDue();
    },
    { connection: createQueueConnection() },
  );
  worker.on('failed', (job, err) => logger.error('Tenant announcement scheduler job failed', { jobId: job?.id, error: err.message }));

  await queue.add('hourly-scan', {}, { repeat: { every: CHECK_INTERVAL_MS }, removeOnComplete: true, removeOnFail: true });
  await queue.add('startup-scan', {}, { removeOnComplete: true, removeOnFail: true });

  logger.info('Tenant announcement scheduler jobs scheduled (hourly sweep for scheduled/expiring announcements)');
}

export async function stopTenantAnnouncementSchedulerJobs(): Promise<void> {
  await worker?.close();
  await queue?.close();
}

async function publishDue(): Promise<void> {
  const due = await TenantAnnouncementRepository.findDuePublications(prisma, new Date());
  for (const announcement of due) {
    const now = new Date();
    // eslint-disable-next-line no-await-in-loop -- sequential across a small, infrequent (hourly) batch; no throughput requirement justifies parallelizing
    await prisma.tenantAnnouncement.update({ where: { id: announcement.id }, data: { status: 'PUBLISHED', publishAt: null, publishedAt: now } });
    // eslint-disable-next-line no-await-in-loop
    await notifyAnnouncementPublished(announcement.tenantId, { title: announcement.title, body: stripHtml(announcement.body) });
  }
}

async function expireDue(): Promise<void> {
  const due = await TenantAnnouncementRepository.findDueExpirations(prisma, new Date());
  for (const announcement of due) {
    // eslint-disable-next-line no-await-in-loop -- see publishDue
    await prisma.tenantAnnouncement.update({ where: { id: announcement.id }, data: { status: 'EXPIRED' } });
  }
}
