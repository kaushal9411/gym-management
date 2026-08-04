import { logger } from '../../../core/logging/logger';
import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { subscriptionAlertEmail } from '../../../infrastructure/mail/templates/auth-templates';
import { gracePeriodReminderEmail, subscriptionExpiredEmail } from '../../../infrastructure/mail/templates/billing-templates';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { SubscriptionService } from '../../subscription/services/subscription.service';
import { tenantNotificationService } from '../../tenant-notifications/services/tenant-notification.service';
import type { JobHandler } from '../types';

const REMINDER_WINDOW_DAYS = 3;
const GRACE_PERIOD_DAYS = 3;
const EXPIRE_AFTER_SUSPENDED_DAYS = 7;
const DAY_MS = 86_400_000;
const DEDUPE_TTL_SECONDS = 8 * 86_400;

/**
 * Migrated verbatim from the old `subscription-billing.jobs.ts` module-local
 * BullMQ registration — the full Prompt 8 platform-billing lifecycle sweep
 * (Trial → Active → Renewal Due → Grace → Suspended → Expired), unchanged
 * phase-by-phase. Kept as a single atomic handler rather than split into the
 * spec's per-tenant "Payment Jobs" types — this is FitCloud's OWN billing of
 * its tenants (a different concern from `payment.handlers.ts`'s member-level
 * jobs), and its 7 phases were already tested together as one sweep; nothing
 * here changed except the trigger mechanism (this module's registry instead
 * of its own `Queue`/`Worker`/`repeat`).
 */
export const platformSubscriptionBillingSweep: JobHandler = async () => {
  await remindTrialsEndingSoon();
  await remindRenewalsDueSoon();
  await convertExpiredTrials();
  await processOverdueRenewals();
  await remindGracePeriod();
  await suspendExpiredGrace();
  await expireSuspended();
};

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
    // eslint-disable-next-line no-await-in-loop -- sequential across a small, infrequent (daily) batch; no throughput requirement justifies parallelizing
    if (await cache.get(dedupeKey)) continue;

    const template = subscriptionAlertEmail({ tenantName: tenant.name }, owner.name, 'trial_ending');
    // eslint-disable-next-line no-await-in-loop
    await enqueueEmail({ to: owner.email, subject: template.subject, html: template.html });
    // eslint-disable-next-line no-await-in-loop
    await tenantNotificationService.notifyTenant(tenant.id, 'SUBSCRIPTION', template.subject, template.subject);
    // eslint-disable-next-line no-await-in-loop
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
    // eslint-disable-next-line no-await-in-loop -- see remindTrialsEndingSoon
    if (await cache.get(dedupeKey)) continue;

    const template = subscriptionAlertEmail({ tenantName: subscription.tenant.name }, owner.name, 'renewal_reminder');
    // eslint-disable-next-line no-await-in-loop
    await enqueueEmail({ to: owner.email, subject: template.subject, html: template.html });
    // eslint-disable-next-line no-await-in-loop
    await tenantNotificationService.notifyTenant(subscription.tenantId, 'SUBSCRIPTION', template.subject, template.subject);
    // eslint-disable-next-line no-await-in-loop
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
    // eslint-disable-next-line no-await-in-loop -- sequential across a small, infrequent (daily) batch
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
      // eslint-disable-next-line no-await-in-loop -- see convertExpiredTrials
      await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'CANCELED', cancelledAt: new Date() } });
      // eslint-disable-next-line no-await-in-loop
      await prisma.tenant.update({ where: { id: subscription.tenantId }, data: { status: 'CANCELLED', suspendedAt: new Date() } });
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
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
    // eslint-disable-next-line no-await-in-loop -- see remindTrialsEndingSoon
    if (await cache.get(dedupeKey)) continue;

    const daysRemaining = Math.max(1, Math.ceil((subscription.graceEndsAt.getTime() - Date.now()) / DAY_MS));
    const template = gracePeriodReminderEmail({ tenantName: subscription.tenant.name }, owner.name, daysRemaining);
    // eslint-disable-next-line no-await-in-loop
    await enqueueEmail({ to: owner.email, subject: template.subject, html: template.html });
    // eslint-disable-next-line no-await-in-loop
    await tenantNotificationService.notifyTenant(subscription.tenantId, 'SUBSCRIPTION', template.subject, template.subject);
    // eslint-disable-next-line no-await-in-loop
    await cache.set(dedupeKey, true, DEDUPE_TTL_SECONDS);
  }
}

async function suspendExpiredGrace(): Promise<void> {
  const subscriptions = await prisma.subscription.findMany({ where: { status: 'PAST_DUE', graceEndsAt: { lte: new Date() } } });

  for (const subscription of subscriptions) {
    const now = new Date();
    // eslint-disable-next-line no-await-in-loop -- see remindTrialsEndingSoon
    await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'SUSPENDED', suspendedAt: now } });
    // eslint-disable-next-line no-await-in-loop
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
    // eslint-disable-next-line no-await-in-loop -- see remindTrialsEndingSoon
    await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'EXPIRED' } });

    const owner = subscription.tenant.users[0];
    if (!owner) continue;
    const template = subscriptionExpiredEmail({ tenantName: subscription.tenant.name }, owner.name);
    // eslint-disable-next-line no-await-in-loop
    await enqueueEmail({ to: owner.email, subject: template.subject, html: template.html });
    // eslint-disable-next-line no-await-in-loop
    await tenantNotificationService.notifyTenant(subscription.tenantId, 'SUBSCRIPTION', template.subject, template.subject);
  }
}
