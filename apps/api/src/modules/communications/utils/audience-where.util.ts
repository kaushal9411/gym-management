import type { Prisma } from '@prisma/client';

import { addDays } from './automation-timing.util';

/** Same shape as the validated `audienceFilter` request object. */
export interface AudienceFilter {
  membershipStatus?: 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'FROZEN' | 'NO_PLAN';
  expiringWithinDays?: number;
  planIds?: string[];
  branchIds?: string[];
  trainerIds?: string[];
  hasTrainer?: boolean;
  hasOverdueInvoice?: boolean;
  hasUnpaidInvoice?: boolean;
  notVisitedDays?: number;
  birthdayThisWeek?: boolean;
  bookedClassSessionId?: string;
}

export interface AudienceContext {
  /** UTC midnight of "today". */
  today: Date;
  /** Branches the acting staff user may reach; `null` = all branches. */
  scopeBranchIds: string[] | null;
  /** Required when `filter.birthdayThisWeek` is set — ids already resolved from date-of-birth. */
  birthdayMemberIds?: string[];
}

export const DEFAULT_EXPIRING_DAYS = 7;
const OPEN_INVOICE: Array<'UNPAID' | 'PARTIALLY_PAID' | 'OVERDUE'> = ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'];
const IN_FORCE: Array<'ACTIVE' | 'PENDING'> = ['ACTIVE', 'PENDING'];

/** A member who has had memberships but none that is ACTIVE/PENDING. */
const lapsed: Prisma.MemberWhereInput = {
  AND: [{ memberships: { some: {} } }, { memberships: { none: { status: { in: IN_FORCE } } } }],
};

/** Members that can ever be messaged: not deleted, ACTIVE or FROZEN (never INACTIVE). */
export function baseMemberWhere(tenantId: string, scopeBranchIds: string[] | null): Prisma.MemberWhereInput {
  return {
    tenantId,
    deletedAt: null,
    status: { in: ['ACTIVE', 'FROZEN'] },
    ...(scopeBranchIds ? { branchId: { in: scopeBranchIds } } : {}),
  };
}

/** Prisma `where` for a FILTERS-mode audience. Filters are AND-combined. */
export function buildMemberWhere(tenantId: string, filter: AudienceFilter, ctx: AudienceContext): Prisma.MemberWhereInput {
  const and: Prisma.MemberWhereInput[] = [baseMemberWhere(tenantId, ctx.scopeBranchIds)];

  switch (filter.membershipStatus) {
    case 'ACTIVE':
      and.push({ memberships: { some: { status: 'ACTIVE', endDate: { gte: ctx.today } } } });
      break;
    case 'EXPIRING': {
      const days = filter.expiringWithinDays ?? DEFAULT_EXPIRING_DAYS;
      and.push({ memberships: { some: { status: 'ACTIVE', endDate: { gte: ctx.today, lte: addDays(ctx.today, days) } } } });
      break;
    }
    case 'EXPIRED':
      and.push(lapsed);
      break;
    case 'FROZEN':
      and.push({ status: 'FROZEN' });
      break;
    case 'NO_PLAN':
      and.push({ memberships: { none: {} } });
      break;
    default:
      // "Everyone": a lapsed member is only reachable by choosing Expired explicitly.
      and.push({ NOT: lapsed });
  }

  if (filter.branchIds?.length) and.push({ branchId: { in: filter.branchIds } });
  if (filter.trainerIds?.length) and.push({ trainerId: { in: filter.trainerIds } });
  if (filter.hasTrainer) and.push({ trainerId: { not: null } });
  if (filter.planIds?.length) {
    and.push({
      memberships: {
        some: { planId: { in: filter.planIds }, ...(filter.membershipStatus === 'EXPIRED' ? {} : { status: { in: IN_FORCE } }) },
      },
    });
  }
  if (filter.hasOverdueInvoice) and.push({ invoices: { some: { status: { in: OPEN_INVOICE }, dueDate: { lt: ctx.today } } } });
  if (filter.hasUnpaidInvoice) and.push({ invoices: { some: { status: { in: OPEN_INVOICE } } } });
  if (filter.notVisitedDays) {
    const cutoff = addDays(ctx.today, -filter.notVisitedDays);
    // Recent joiners have had no chance to visit yet - do not call them "inactive".
    and.push({ joiningDate: { lte: cutoff } });
    and.push({ attendances: { none: { deletedAt: null, attendanceDate: { gte: cutoff } } } });
  }
  if (filter.birthdayThisWeek) and.push({ id: { in: ctx.birthdayMemberIds ?? [] } });
  if (filter.bookedClassSessionId) {
    and.push({ classBookings: { some: { classSessionId: filter.bookedClassSessionId, status: 'BOOKED' } } });
  }

  return { AND: and };
}

/** Prisma `where` for a PICKED-mode audience (ids already validated against the tenant). */
export function buildPickedWhere(tenantId: string, ids: string[], scopeBranchIds: string[] | null): Prisma.MemberWhereInput {
  return { AND: [baseMemberWhere(tenantId, scopeBranchIds), { id: { in: ids } }] };
}

/** Human-readable one-liner of the active filters, for audit/debug (never contains PII). */
export function describeFilter(filter: AudienceFilter): string[] {
  const parts: string[] = [];
  if (filter.membershipStatus) parts.push(`status:${filter.membershipStatus}${filter.membershipStatus === 'EXPIRING' ? `(${filter.expiringWithinDays ?? DEFAULT_EXPIRING_DAYS}d)` : ''}`);
  if (filter.planIds?.length) parts.push(`plans:${filter.planIds.length}`);
  if (filter.branchIds?.length) parts.push(`branches:${filter.branchIds.length}`);
  if (filter.trainerIds?.length) parts.push(`trainers:${filter.trainerIds.length}`);
  if (filter.hasTrainer) parts.push('hasTrainer');
  if (filter.hasOverdueInvoice) parts.push('overdue');
  if (filter.hasUnpaidInvoice) parts.push('unpaid');
  if (filter.notVisitedDays) parts.push(`inactive:${filter.notVisitedDays}d`);
  if (filter.birthdayThisWeek) parts.push('birthday');
  if (filter.bookedClassSessionId) parts.push('booked');
  return parts;
}
