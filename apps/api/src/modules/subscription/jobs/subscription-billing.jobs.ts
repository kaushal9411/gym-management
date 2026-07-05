import { Queue, Worker } from 'bullmq';

import { logger } from '../../../core/logging/logger';
import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { subscriptionAlertEmail } from '../../../infrastructure/mail/templates/auth-templates';
import { gracePeriodReminderEmail, subscriptionExpiredEmail } from '../../../infrastructure/mail/templates/billing-templates';
import { createQueueConnection } from '../../../infrastructure/queue/connection';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { tenantNotificationService } from '../../tenant-notifications/services/tenant-notification.service';
import { SubscriptionService } from '../services/subscription.service';

const QUEUE_NAME = 'subscription-billing';
const REMINDER_WINDOW_DAYS = 3;
const GRACE_PERIOD_DAYS = 3;
const EXPIRE_AFTER_SUSPENDED_DAYS = 7;
const DAY_MS = 86_400_000;
const DEDUPE_TTL_SECONDS = 8 * 86_400;

/**
 * The full Prompt 8 lifecycle sweep — Trial → Active → Renewal Due → Grace
 * → Suspended → (Reactivated by a successful renew()) → Cancelled/Expired —
 * plus the reminder emails at each transition. Supersedes onboarding's
 * narrower subscription-lifecycle.jobs.ts (trial/renewal reminders only),
 * which this file's trial/renewal reminder functions absorbed unchanged.
 *
 * "Invoice Generation" from Prompt 8's queue-job list isn't a separate job
 * here — invoices are generated synchronously as part of checkout()/renew()
 * (see subscription.service.ts), so every job below that successfully
 * renews a subscription has already generated that period's invoice by the
 * time this sweep moves on.
 *
 * Cross-tenant scans use the raw client — same documented dev-superuser RLS
 * caveat as every other platform-wide job in this codebase (see
 * onboarding's original subscription-lifecycle.jobs.ts).
 */
let queue: Queue | null = null;
let worker: Worker | null = null;

export async function startSubscriptionBillingJobs(): Promise<void> {
  queue = new Queue(QUEUE_NAME, { connection: createQueueConnection() });

  worker = new Worker(
    QUEUE_NAME,
    async () => {
      await remindTrialsEndingSoon();
      await remindRenewalsDueSoon();
      await convertExpiredTrials();
      await processOverdueRenewals();
      await remindGracePeriod();
      await suspendExpiredGrace();
      await expireSuspended();
    },
    { connection: createQueueConnection() },
  );
  worker.on('failed', (job, err) => logger.error('Subscription billing job failed', { jobId: job?.id, error: err.message }));

  await queue.add('daily-scan', {}, { repeat: { every: 24 * 60 * 60_000 }, removeOnComplete: true, removeOnFail: true });
  await queue.add('startup-scan', {}, { removeOnComplete: true, removeOnFail: true });

  logger.info('Subscription billing jobs scheduled (reminders + lifecycle sweep, every 24h)');
}

export async function stopSubscriptionBillingJobs(): Promise<void> {
  await worker?.close();
  await queue?.close();
}

async function remindTrialsEndingSoon(): Promise<void> {
  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_DAYS * DAY_MS);
  const tenants = await prisma.tenant.findMany({
    where: { status: 'TRIAL', trialEndsAt: { gte: new Date(), lte: windowEnd } },
    include: { users: { where: { status: 'ACTIVE' }, take: 1 } },
  });

  for (const tenant of tenants) {
    const owner = tenant.users[0];
    if (!owner) continue;
    const dedupeKey = `reminder:trial:${tenant.id}`;
    if (await cache.get(dedupeKey)) continue;

    const template = subscriptionAlertEmail({ tenantName: tenant.name }, owner.name, 'trial_ending');
    await enqueueEmail({ to: owner.email, subject: template.subject, html: template.html });
    await tenantNotificationService.notifyTenant(tenant.id, 'SUBSCRIPTION', template.subject, template.subject);
    await cache.set(dedupeKey, true, DEDUPE_TTL_SECONDS);
  }
}

async function remindRenewalsDueSoon(): Promise<void> {
  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_DAYS * DAY_MS);
  const subscriptions = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', cancelAtPeriodEnd: false, currentPeriodEnd: { gte: new Date(), lte: windowEnd } },
    include: { tenant: { include: { users: { where: { status: 'ACTIVE' }, take: 1 } } } },
  });

  for (const subscription of subscriptions) {
    const owner = subscription.tenant.users[0];
    if (!owner) continue;
    const dedupeKey = `reminder:renewal:${subscription.id}`;
    if (await cache.get(dedupeKey)) continue;

    const template = subscriptionAlertEmail({ tenantName: subscription.tenant.name }, owner.name, 'renewal_reminder');
    await enqueueEmail({ to: owner.email, subject: template.subject, html: template.html });
    await tenantNotificationService.notifyTenant(subscription.tenantId, 'SUBSCRIPTION', template.subject, template.subject);
    await cache.set(dedupeKey, true, DEDUPE_TTL_SECONDS);
  }
}

/** A trial that ended: auto-charge the saved payment method if there is one, otherwise start the grace period. */
async function convertExpiredTrials(): Promise<void> {
  const subscriptions = await prisma.subscription.findMany({
    where: { status: 'TRIALING', trialEndsAt: { lte: new Date() } },
    include: { tenant: { include: { users: { where: { status: 'ACTIVE' }, take: 1 } } } },
  });

  for (const subscription of subscriptions) {
    await tryRenewOrEnterGrace(subscription.tenantId, subscription.id, subscription.tenant.name, subscription.tenant.users[0]?.email);
  }
}

/** A paid period ended: renew via the saved method, honor a pending cancellation, or start the grace period. */
async function processOverdueRenewals(): Promise<void> {
  const subscriptions = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', currentPeriodEnd: { lte: new Date() } },
    include: { tenant: { include: { users: { where: { status: 'ACTIVE' }, take: 1 } } } },
  });

  for (const subscription of subscriptions) {
    if (subscription.cancelAtPeriodEnd) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'CANCELED', cancelledAt: new Date() },
      });
      await prisma.tenant.update({ where: { id: subscription.tenantId }, data: { status: 'CANCELLED', suspendedAt: new Date() } });
      continue;
    }
    await tryRenewOrEnterGrace(subscription.tenantId, subscription.id, subscription.tenant.name, subscription.tenant.users[0]?.email);
  }
}

async function tryRenewOrEnterGrace(tenantId: string, subscriptionId: string, tenantName: string, ownerEmail: string | undefined): Promise<void> {
  const defaultMethod = await prisma.paymentMethod.findFirst({ where: { tenantId, isDefault: true } });

  if (defaultMethod && ownerEmail) {
    try {
      const service = new SubscriptionService(getTenantScopedClient(tenantId));
      await service.renew(tenantId, tenantName, ownerEmail, `auto-renew:${subscriptionId}:${new Date().toISOString().slice(0, 10)}`);
      return;
    } catch (error) {
      logger.error('Automatic renewal charge failed — entering grace period', { tenantId, error: (error as Error).message });
    }
  }

  const graceEndsAt = new Date(Date.now() + GRACE_PERIOD_DAYS * DAY_MS);
  await prisma.subscription.update({ where: { id: subscriptionId }, data: { status: 'PAST_DUE', graceEndsAt } });
  await prisma.tenant.update({ where: { id: tenantId }, data: { status: 'PAST_DUE', subscriptionExpiresAt: graceEndsAt } });
}

async function remindGracePeriod(): Promise<void> {
  const subscriptions = await prisma.subscription.findMany({
    where: { status: 'PAST_DUE', graceEndsAt: { gt: new Date() } },
    include: { tenant: { include: { users: { where: { status: 'ACTIVE' }, take: 1 } } } },
  });

  for (const subscription of subscriptions) {
    const owner = subscription.tenant.users[0];
    if (!owner || !subscription.graceEndsAt) continue;
    const dedupeKey = `reminder:grace:${subscription.id}:${new Date().toISOString().slice(0, 10)}`;
    if (await cache.get(dedupeKey)) continue;

    const daysRemaining = Math.max(1, Math.ceil((subscription.graceEndsAt.getTime() - Date.now()) / DAY_MS));
    const template = gracePeriodReminderEmail({ tenantName: subscription.tenant.name }, owner.name, daysRemaining);
    await enqueueEmail({ to: owner.email, subject: template.subject, html: template.html });
    await tenantNotificationService.notifyTenant(subscription.tenantId, 'SUBSCRIPTION', template.subject, template.subject);
    await cache.set(dedupeKey, true, DEDUPE_TTL_SECONDS);
  }
}

async function suspendExpiredGrace(): Promise<void> {
  const subscriptions = await prisma.subscription.findMany({
    where: { status: 'PAST_DUE', graceEndsAt: { lte: new Date() } },
  });

  for (const subscription of subscriptions) {
    const now = new Date();
    await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'SUSPENDED', suspendedAt: now } });
    await prisma.tenant.update({ where: { id: subscription.tenantId }, data: { status: 'SUSPENDED', suspendedAt: now } });
  }
}

/** Terminal state — SUSPENDED for too long with no reactivation. Tenant.status has no EXPIRED value, so it stays SUSPENDED (same access-blocking effect). */
async function expireSuspended(): Promise<void> {
  const cutoff = new Date(Date.now() - EXPIRE_AFTER_SUSPENDED_DAYS * DAY_MS);
  const subscriptions = await prisma.subscription.findMany({
    where: { status: 'SUSPENDED', suspendedAt: { lte: cutoff } },
    include: { tenant: { include: { users: { where: { status: 'ACTIVE' }, take: 1 } } } },
  });

  for (const subscription of subscriptions) {
    await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'EXPIRED' } });

    const owner = subscription.tenant.users[0];
    if (!owner) continue;
    const template = subscriptionExpiredEmail({ tenantName: subscription.tenant.name }, owner.name);
    await enqueueEmail({ to: owner.email, subject: template.subject, html: template.html });
    await tenantNotificationService.notifyTenant(subscription.tenantId, 'SUBSCRIPTION', template.subject, template.subject);
  }
}
