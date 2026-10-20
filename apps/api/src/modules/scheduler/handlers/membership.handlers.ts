import { prisma } from '../../../infrastructure/database/prisma';
import { sweepMembershipExpired, sweepMembershipExpiring } from '../../communications/services/automation-sweeps.service';
import type { JobHandler } from '../types';

/**
 * Expiring-membership reminders. Since Communications (Prompt 172) the timing (default 7, 3 and 1 days before the end
 * date), channels (default push + email) and message come from the gym's `MEMBERSHIP_EXPIRING` automation rule; the
 * dedupe ledger (`automation_dispatches`) replaces the old per-membership Redis key (which is still honoured once, so
 * the upgrade does not re-send the first reminder).
 */
export const membershipRenewalReminder: JobHandler = async () => sweepMembershipExpiring();

/** Read-only audit: counts ACTIVE memberships whose `endDate` has already passed without mutating anything — distinct from `auto-membership-status-update`, which does the actual flip. */
export const membershipExpiryCheck: JobHandler = async () => {
  const overdue = await prisma.membership.count({ where: { status: 'ACTIVE', endDate: { lt: new Date() } } });
  return { overdueActiveMemberships: overdue };
};

/**
 * The status-flip half of the old `expirePastDue` — ACTIVE memberships past
 * `endDate` become EXPIRED. Notification is a separate job
 * (`membership-expired-notification`) so a notification failure never
 * blocks the status mutation.
 */
export const autoMembershipStatusUpdate: JobHandler = async () => {
  const result = await prisma.membership.updateMany({
    where: { status: 'ACTIVE', endDate: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  return { updated: result.count };
};

/**
 * Mirror of `autoMembershipStatusUpdate`, opposite direction: a membership
 * assigned with a future `startDate` (the "signed up today, starts in N
 * days" flow — see `MemberService#assignMembership`) is stored PENDING so
 * it grants no check-in access until its start date actually arrives. This
 * flips it to ACTIVE once `startDate <= now`.
 */
export const pendingMembershipActivation: JobHandler = async () => {
  const result = await prisma.membership.updateMany({
    where: { status: 'PENDING', startDate: { lte: new Date() } },
    data: { status: 'ACTIVE' },
  });
  return { activated: result.count };
};

/**
 * "Your membership has expired" message, driven by the gym's `MEMBERSHIP_EXPIRED` rule (default: 1 day after the end
 * date, push + email, once per membership per timing). Kept a separate job from the status flip so a notification
 * failure never blocks the mutation.
 */
export const membershipExpiredNotification: JobHandler = async () => sweepMembershipExpired();
