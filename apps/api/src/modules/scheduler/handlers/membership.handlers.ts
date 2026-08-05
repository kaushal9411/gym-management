import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import { decryptMemberContact } from '../../members/utils/member-pii.util';
import { notifyMembershipExpired, notifyMembershipExpiring } from '../../tenant-notifications/services/notification-trigger.service';
import type { JobHandler } from '../types';

const REMINDER_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;
const DEDUPE_TTL_SECONDS = 8 * 86_400;

/**
 * Ported verbatim from the old `membership-expiry.jobs.ts`'s `remindExpiringSoon` —
 * only the trigger mechanism (this module's cron registry instead of a
 * module-local BullMQ `repeat`) changed, not the query or dedupe logic.
 */
export const membershipRenewalReminder: JobHandler = async () => {
  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_DAYS * DAY_MS);
  const memberships = (
    await prisma.membership.findMany({
      where: { status: 'ACTIVE', endDate: { gte: new Date(), lte: windowEnd } },
      include: { member: true, plan: { select: { name: true } } },
    })
  ).map((membership) => ({ ...membership, member: decryptMemberContact(membership.member) }));

  let reminded = 0;
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
    reminded += 1;
  }
  return { scanned: memberships.length, reminded };
};

/** Read-only audit: counts ACTIVE memberships whose `endDate` has already passed without mutating anything — distinct from `auto-membership-status-update`, which does the actual flip. */
export const membershipExpiryCheck: JobHandler = async () => {
  const overdue = await prisma.membership.count({ where: { status: 'ACTIVE', endDate: { lt: new Date() } } });
  return { overdueActiveMemberships: overdue };
};

/** The status-flip half of the old `expirePastDue` — ACTIVE memberships past `endDate` become EXPIRED. Notification is a separate job (`membership-expired-notification`) so a notification failure never blocks the status mutation. */
export const autoMembershipStatusUpdate: JobHandler = async () => {
  const result = await prisma.membership.updateMany({
    where: { status: 'ACTIVE', endDate: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  return { updated: result.count };
};

const RECENTLY_EXPIRED_WINDOW_DAYS = 14;
const RECENTLY_EXPIRED_DEDUPE_TTL_SECONDS = 20 * 86_400; // must outlive the window above, or a membership could re-notify before aging out of the query

/**
 * Notifies members whose membership was flipped to EXPIRED, deduped so a
 * member is only ever notified once per membership. Bounded to a recent
 * window (not "all EXPIRED memberships ever") — otherwise every run would
 * re-scan the entire historical EXPIRED population and rely solely on the
 * dedupe TTL never lapsing, which it eventually would.
 */
export const membershipExpiredNotification: JobHandler = async () => {
  const windowStart = new Date(Date.now() - RECENTLY_EXPIRED_WINDOW_DAYS * DAY_MS);
  const memberships = (
    await prisma.membership.findMany({
      where: { status: 'EXPIRED', endDate: { gte: windowStart, lt: new Date() } },
      include: { member: true, plan: { select: { name: true } } },
    })
  ).map((membership) => ({ ...membership, member: decryptMemberContact(membership.member) }));

  let notified = 0;
  for (const membership of memberships) {
    const dedupeKey = `notif:membership-expired:${membership.id}`;
    // eslint-disable-next-line no-await-in-loop -- see membershipRenewalReminder
    if (await cache.get(dedupeKey)) continue;

    // eslint-disable-next-line no-await-in-loop
    await notifyMembershipExpired(membership.tenantId, {
      memberName: `${membership.member.firstName} ${membership.member.lastName}`.trim(),
      planName: membership.plan.name,
      endDate: membership.endDate.toISOString().slice(0, 10),
      memberEmail: membership.member.email,
    });
    // eslint-disable-next-line no-await-in-loop
    await cache.set(dedupeKey, true, RECENTLY_EXPIRED_DEDUPE_TTL_SECONDS);
    notified += 1;
  }
  return { scanned: memberships.length, notified };
};
