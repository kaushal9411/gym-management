import { Queue, Worker } from 'bullmq';

import { logger } from '../../../core/logging/logger';
import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import { createQueueConnection } from '../../../infrastructure/queue/connection';
import {
  notifyMembershipExpired,
  notifyMembershipExpiring,
} from '../../tenant-notifications/services/notification-trigger.service';

const QUEUE_NAME = 'membership-expiry';
const REMINDER_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;
const DEDUPE_TTL_SECONDS = 8 * 86_400;

let queue: Queue | null = null;
let worker: Worker | null = null;

/**
 * "Membership Expiring" / "Membership Expired" trigger events. No prior
 * sweep existed for this anywhere in the codebase — `Membership.status`
 * previously only ever flipped away from ACTIVE via an explicit
 * cancel/renew/upgrade action (see `member.service.ts`); a membership whose
 * `endDate` had simply passed stayed `ACTIVE` forever (the Reports module's
 * Expiring/Active-vs-Inactive reports query `endDate` directly rather than
 * relying on status). This job is the first thing that actually closes that
 * loop, modeled on `subscription-billing.jobs.ts`'s daily-scan shape:
 * cross-tenant raw-`prisma` scan (same documented dev-superuser RLS caveat),
 * Redis dedupe key so the expiring-soon reminder doesn't refire every day
 * within the 7-day window.
 */
export async function startMembershipExpiryJobs(): Promise<void> {
  queue = new Queue(QUEUE_NAME, { connection: createQueueConnection() });

  worker = new Worker(
    QUEUE_NAME,
    async () => {
      await remindExpiringSoon();
      await expirePastDue();
    },
    { connection: createQueueConnection() },
  );
  worker.on('failed', (job, err) => logger.error('Membership expiry job failed', { jobId: job?.id, error: err.message }));

  await queue.add('daily-scan', {}, { repeat: { every: 24 * 60 * 60_000 }, removeOnComplete: true, removeOnFail: true });
  await queue.add('startup-scan', {}, { removeOnComplete: true, removeOnFail: true });

  logger.info('Membership expiry jobs scheduled (expiring/expired reminders, every 24h)');
}

export async function stopMembershipExpiryJobs(): Promise<void> {
  await worker?.close();
  await queue?.close();
}

async function remindExpiringSoon(): Promise<void> {
  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_DAYS * DAY_MS);
  const memberships = await prisma.membership.findMany({
    where: { status: 'ACTIVE', endDate: { gte: new Date(), lte: windowEnd } },
    include: { member: true, plan: { select: { name: true } } },
  });

  for (const membership of memberships) {
    const dedupeKey = `notif:membership-expiring:${membership.id}`;
    // eslint-disable-next-line no-await-in-loop -- sequential across a small, infrequent (daily) batch; no throughput requirement justifies parallelizing
    if (await cache.get(dedupeKey)) continue;

    const daysRemaining = Math.max(1, Math.ceil((membership.endDate.getTime() - Date.now()) / DAY_MS));
    // eslint-disable-next-line no-await-in-loop
    await notifyMembershipExpiring(membership.tenantId, {
      memberName: `${membership.member.firstName} ${membership.member.lastName}`.trim(),
      planName: membership.plan.name,
      endDate: membership.endDate.toISOString().slice(0, 10),
      daysRemaining,
      memberEmail: membership.member.email,
    });
    // eslint-disable-next-line no-await-in-loop
    await cache.set(dedupeKey, true, DEDUPE_TTL_SECONDS);
  }
}

async function expirePastDue(): Promise<void> {
  const memberships = await prisma.membership.findMany({
    where: { status: 'ACTIVE', endDate: { lt: new Date() } },
    include: { member: true, plan: { select: { name: true } } },
  });

  for (const membership of memberships) {
    // eslint-disable-next-line no-await-in-loop -- see remindExpiringSoon
    await prisma.membership.update({ where: { id: membership.id }, data: { status: 'EXPIRED' } });
    // eslint-disable-next-line no-await-in-loop
    await notifyMembershipExpired(membership.tenantId, {
      memberName: `${membership.member.firstName} ${membership.member.lastName}`.trim(),
      planName: membership.plan.name,
      endDate: membership.endDate.toISOString().slice(0, 10),
      memberEmail: membership.member.email,
    });
  }
}
