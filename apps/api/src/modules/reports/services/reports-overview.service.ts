import { Prisma } from '@prisma/client';

import {
  getTenantScopedClient,
  type TenantScopedPrisma,
} from '../../../infrastructure/database/tenant-scoped-client';
import { COLLECTED_STATUSES } from '../../finance/utils/payments-analytics.util';
import { resolveBranchScope } from '../utils/branch-scope.util';
import {
  addDaysStr,
  assembleOverview,
  resolveRanges,
  type DateRange,
  type OverviewDto,
  type OverviewRaw,
} from '../utils/reports-overview.util';

const dayStart = (d: string) => new Date(`${d}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const rangeFilter = (r: DateRange) => ({ gte: dayStart(r.from), lte: dayStart(r.to) });

/** Prisma branch scope (undefined | id | {in}) → id list for raw SQL (undefined = unrestricted). */
export function scopeIds(scope: string | { in: string[] } | undefined): string[] | undefined {
  if (scope === undefined) return undefined;
  return typeof scope === 'string' ? [scope] : scope.in;
}

export class ReportsOverviewService {
  private readonly db: TenantScopedPrisma;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
  }

  /** Raw SQL must set the RLS tenant variable itself — the scoped client only wraps model operations. */
  private async rawScoped<T>(query: Prisma.Sql): Promise<T[]> {
    const [, rows] = await this.db.$transaction([
      this.db.$executeRaw`SELECT set_config('app.tenant_id', ${this.tenantId}, true)`,
      this.db.$queryRaw<T[]>(query),
    ]);
    return rows as T[];
  }

  async overview(
    userId: string,
    dateFrom?: string,
    dateTo?: string,
    requestedBranchId?: string,
  ): Promise<OverviewDto> {
    const scope = await resolveBranchScope(this.tenantId, userId, requestedBranchId);
    const ids = scopeIds(scope);
    const { range, previousRange, today } = resolveRanges(dateFrom, dateTo);
    const t = this.tenantId;
    const span = { gte: dayStart(previousRange.from), lte: dayStart(range.to) };
    const memberBranchSql = ids ? Prisma.sql`AND branch_id = ANY(${ids}::uuid[])` : Prisma.empty;
    const paymentBranchSql = ids ? Prisma.sql`AND p.branch_id = ANY(${ids}::uuid[])` : Prisma.empty;
    const collected = { in: COLLECTED_STATUSES };
    const spanEndExclusive = addDaysStr(range.to, 1);
    const expiryEnd = addDaysStr(today, 30);

    const [
      payDay,
      expDay,
      attDay,
      newMembersDay,
      activeMembers,
      expiring,
      churnCur,
      churnPrev,
      statusRows,
      planActive,
      planRevenue,
      methods,
      curBranchPay,
      prevBranchPay,
      hourly,
      trainerRows,
      branchRows,
      branchNew,
      branchAtt,
      branchActive,
    ] = await Promise.all([
      this.db.memberPayment.groupBy({
        by: ['paymentDate'],
        where: { tenantId: t, branchId: scope, status: collected, paymentDate: span },
        _sum: { finalAmount: true },
      }),
      this.db.expense.groupBy({
        by: ['expenseDate'],
        where: { tenantId: t, deletedAt: null, branchId: scope, expenseDate: span },
        _sum: { amount: true },
      }),
      this.db.attendance.groupBy({
        by: ['attendanceDate'],
        where: { tenantId: t, deletedAt: null, branchId: scope, attendanceDate: span },
        _count: { _all: true },
      }),
      this.rawScoped<{ day: string; cnt: bigint }>(
        Prisma.sql`SELECT to_char(created_at, 'YYYY-MM-DD') AS day, COUNT(*) AS cnt FROM members
            WHERE tenant_id = ${t}::uuid AND deleted_at IS NULL ${memberBranchSql}
              AND created_at >= ${dayStart(previousRange.from)} AND created_at < ${dayStart(spanEndExclusive)}
            GROUP BY 1`,
      ),
      this.db.member.count({
        where: { tenantId: t, deletedAt: null, branchId: scope, status: 'ACTIVE' },
      }),
      this.db.membership.groupBy({
        by: ['endDate'],
        where: {
          tenantId: t,
          status: 'ACTIVE',
          endDate: { gte: dayStart(today), lte: dayStart(expiryEnd) },
          member: { deletedAt: null, branchId: scope },
        },
        _count: { _all: true },
      }),
      this.churnCount(scope, range),
      this.churnCount(scope, previousRange),
      this.db.member.groupBy({
        by: ['status'],
        where: { tenantId: t, deletedAt: null, branchId: scope },
        _count: { _all: true },
      }),
      this.db.membership.groupBy({
        by: ['planId'],
        where: { tenantId: t, status: 'ACTIVE', member: { deletedAt: null, branchId: scope } },
        _count: { _all: true },
      }),
      this.rawScoped<{ plan_id: string; revenue: Prisma.Decimal }>(
        Prisma.sql`SELECT m.plan_id AS plan_id, SUM(p.final_amount) AS revenue
            FROM member_payments p JOIN memberships m ON m.id = p.membership_id
            WHERE p.tenant_id = ${t}::uuid ${paymentBranchSql}
              AND p.status::text IN ('SUCCESS', 'PARTIALLY_REFUNDED')
              AND p.payment_date BETWEEN ${range.from}::date AND ${range.to}::date
            GROUP BY m.plan_id`,
      ),
      this.db.memberPayment.groupBy({
        by: ['method'],
        where: { tenantId: t, branchId: scope, status: collected, paymentDate: rangeFilter(range) },
        _sum: { finalAmount: true },
        _count: { _all: true },
      }),
      this.db.memberPayment.groupBy({
        by: ['branchId'],
        where: { tenantId: t, branchId: scope, status: collected, paymentDate: rangeFilter(range) },
        _sum: { finalAmount: true },
      }),
      this.db.memberPayment.groupBy({
        by: ['branchId'],
        where: {
          tenantId: t,
          branchId: scope,
          status: collected,
          paymentDate: rangeFilter(previousRange),
        },
        _sum: { finalAmount: true },
      }),
      // check_in_time is stored as UTC (timestamp without tz), so the extracted hour is the UTC hour.
      this.rawScoped<{ hour: number; cnt: bigint }>(
        Prisma.sql`SELECT EXTRACT(HOUR FROM check_in_time)::int AS hour, COUNT(*) AS cnt FROM attendance_records
            WHERE tenant_id = ${t}::uuid AND deleted_at IS NULL ${memberBranchSql}
              AND attendance_date BETWEEN ${range.from}::date AND ${range.to}::date
            GROUP BY 1`,
      ),
      this.db.member.groupBy({
        by: ['trainerId'],
        where: { tenantId: t, deletedAt: null, branchId: scope, trainerId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { trainerId: 'desc' } },
        take: 5,
      }),
      this.db.branch.findMany({
        where: { tenantId: t, isActive: true, ...(scope ? { id: scope } : {}) },
        select: { id: true, name: true },
      }),
      this.db.member.groupBy({
        by: ['branchId'],
        where: {
          tenantId: t,
          deletedAt: null,
          branchId: scope,
          createdAt: { gte: dayStart(range.from), lt: dayStart(spanEndExclusive) },
        },
        _count: { _all: true },
      }),
      this.db.attendance.groupBy({
        by: ['branchId'],
        where: {
          tenantId: t,
          deletedAt: null,
          branchId: scope,
          attendanceDate: rangeFilter(range),
        },
        _count: { _all: true },
      }),
      this.db.member.groupBy({
        by: ['branchId'],
        where: { tenantId: t, deletedAt: null, branchId: scope, status: 'ACTIVE' },
        _count: { _all: true },
      }),
    ]);

    const planIds = planActive.map((p) => p.planId);
    const trainerIds = trainerRows.map((r) => r.trainerId).filter((x): x is string => !!x);
    const [planNames, trainerNames] = await Promise.all([
      planIds.length
        ? this.db.membershipPlan.findMany({
            where: { tenantId: t, id: { in: planIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      trainerIds.length
        ? this.db.user.findMany({
            where: { tenantId: t, id: { in: trainerIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const planName = new Map(planNames.map((p) => [p.id, p.name]));
    const trainerName = new Map(trainerNames.map((u) => [u.id, u.name]));
    const planRev = new Map(planRevenue.map((r) => [r.plan_id, Number(r.revenue)]));
    const curPay = new Map(curBranchPay.map((r) => [r.branchId, Number(r._sum.finalAmount ?? 0)]));
    const prevPay = new Map(
      prevBranchPay.map((r) => [r.branchId, Number(r._sum.finalAmount ?? 0)]),
    );
    const newBy = new Map(branchNew.map((r) => [r.branchId, r._count._all]));
    const attBy = new Map(branchAtt.map((r) => [r.branchId, r._count._all]));
    const activeBy = new Map(branchActive.map((r) => [r.branchId, r._count._all]));

    const raw: OverviewRaw = {
      range,
      previousRange,
      today,
      revenueByDay: payDay.map((r) => ({
        date: iso(r.paymentDate),
        amount: Number(r._sum.finalAmount ?? 0),
      })),
      expensesByDay: expDay.map((r) => ({
        date: iso(r.expenseDate),
        amount: Number(r._sum.amount ?? 0),
      })),
      attendanceByDay: attDay.map((r) => ({ date: iso(r.attendanceDate), count: r._count._all })),
      newMembersByDay: newMembersDay.map((r) => ({ date: r.day, count: Number(r.cnt) })),
      activeMembers,
      expiringByEndDate: expiring.map((r) => ({ date: iso(r.endDate), count: r._count._all })),
      churned: { value: churnCur, previous: churnPrev },
      memberStatus: statusRows.map((r) => ({ status: r.status, count: r._count._all })),
      plans: planActive.map((p) => ({
        planName: planName.get(p.planId) ?? 'Unknown',
        activeCount: p._count._all,
        revenue: planRev.get(p.planId) ?? 0,
      })),
      methods: methods
        .map((m) => ({
          method: m.method,
          amount: Number(m._sum.finalAmount ?? 0),
          count: m._count._all,
        }))
        .sort((a, b) => b.amount - a.amount),
      branches: branchRows.map((b) => ({
        branchId: b.id,
        name: b.name,
        revenue: curPay.get(b.id) ?? 0,
        previousRevenue: prevPay.get(b.id) ?? 0,
        newMembers: newBy.get(b.id) ?? 0,
        checkIns: attBy.get(b.id) ?? 0,
        activeMembers: activeBy.get(b.id) ?? 0,
      })),
      hourly: hourly.map((h) => ({ hour: Number(h.hour), count: Number(h.cnt) })),
      topTrainers: trainerRows.map((r) => ({
        trainerId: r.trainerId as string,
        name: trainerName.get(r.trainerId as string) ?? 'Unknown',
        assignedMembers: r._count._all,
      })),
    };
    return assembleOverview(raw);
  }

  /** Same predicate as `isChurnedInRange`: EXPIRED with endDate in range, or CANCELLED with its cancel-time (updatedAt) in range. */
  private churnCount(
    scope: string | { in: string[] } | undefined,
    range: DateRange,
  ): Promise<number> {
    return this.db.membership.count({
      where: {
        tenantId: this.tenantId,
        member: { deletedAt: null, branchId: scope },
        OR: [
          { status: 'EXPIRED', endDate: rangeFilter(range) },
          {
            status: 'CANCELLED',
            updatedAt: { gte: dayStart(range.from), lt: dayStart(addDaysStr(range.to, 1)) },
          },
        ],
      },
    });
  }
}
