import {
  getTenantScopedClient,
  type TenantScopedPrisma,
} from '../../../infrastructure/database/tenant-scoped-client';
import {
  COLLECTED_STATUSES,
  SUCCESSISH_STATUSES,
} from '../../finance/utils/payments-analytics.util';
import { STAFF_ROLE_NAMES } from '../../staff/dto/staff.dto';
import type { ReportFilters } from '../dto/reports.dto';
import { resolveBranchScope } from '../utils/branch-scope.util';
import {
  activeVsInactiveSummary,
  attendanceSummary,
  branchPerformanceSummary,
  expensesSummary,
  expiringMembershipsSummary,
  memberProgressSummary,
  membershipSummary,
  paymentsSummary,
  revenueSummary,
  staffSummary,
  trainerPerformanceSummary,
  type LabelValue,
  type RangeTotals,
  type ReportSummaryBody,
  type ReportSummaryDto,
  type SummaryReportType,
} from '../utils/report-summary.util';
import {
  addDaysStr,
  resolveRanges,
  sumByDay,
  totalOf,
  type DateRange,
} from '../utils/reports-overview.util';

import { ReportsService } from './reports.service';

const dayStart = (d: string) => new Date(`${d}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const rangeFilter = (r: DateRange) => ({ gte: dayStart(r.from), lte: dayStart(r.to) });
/** Member-progress summary reads each member's plan rows; cap it so a huge tenant can't turn one summary into a table scan. */
const MEMBER_PROGRESS_CAP = 2000;

type Scope = string | { in: string[] } | undefined;

/** Splits per-day rows over previousRange.from..range.to into current/previous totals and a per-day map. */
function totalsFromDays(
  rows: Array<{ date: string; value: number }>,
  range: DateRange,
  previousRange: DateRange,
): { totals: RangeTotals; byDay: Map<string, number> } {
  const cur = sumByDay(rows, (r) => r.value, range);
  const prev = sumByDay(rows, (r) => r.value, previousRange);
  const byDay = new Map<string, number>([...prev, ...cur]);
  return { totals: { total: totalOf(cur), previousTotal: totalOf(prev) }, byDay };
}

export class ReportSummaryService {
  private readonly db: TenantScopedPrisma;
  private readonly reports: ReportsService;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.reports = new ReportsService(tenantId);
  }

  async summary(
    type: SummaryReportType,
    userId: string,
    filters: ReportFilters,
  ): Promise<ReportSummaryDto> {
    const scope = await resolveBranchScope(this.tenantId, userId, filters.branchId);
    const { range, previousRange, today } = resolveRanges(filters.dateFrom, filters.dateTo);
    const body = await this.build(type, userId, filters, scope, range, previousRange, today);
    return { range, previousRange, ...body };
  }

  private build(
    type: SummaryReportType,
    userId: string,
    filters: ReportFilters,
    scope: Scope,
    range: DateRange,
    previousRange: DateRange,
    today: string,
  ): Promise<ReportSummaryBody> {
    switch (type) {
      case 'membership':
        return this.membership(filters, scope);
      case 'attendance':
        return this.attendance(scope, range, previousRange);
      case 'revenue':
        return this.revenue(scope, range, previousRange);
      case 'expenses':
        return this.expenses(scope, range, previousRange);
      case 'payments':
        return this.payments(filters, scope, range, previousRange);
      case 'staff':
        return this.staff(scope);
      case 'trainer-performance':
        return this.reports
          .trainerPerformanceReport(userId, filters)
          .then(trainerPerformanceSummary);
      case 'member-progress':
        return this.memberProgress(scope);
      case 'branch-performance':
        return this.reports.branchPerformanceReport(userId, filters).then(branchPerformanceSummary);
      case 'expiring-memberships':
        return this.expiring(scope, today);
      case 'active-vs-inactive':
        return this.reports.activeVsInactiveReport(userId, filters).then(activeVsInactiveSummary);
    }
  }

  private async membership(filters: ReportFilters, scope: Scope): Promise<ReportSummaryBody> {
    const t = this.tenantId;
    const [status, plans] = await Promise.all([
      this.db.member.groupBy({
        by: ['status'],
        where: {
          tenantId: t,
          deletedAt: null,
          branchId: scope,
          ...(filters.memberStatus ? { status: filters.memberStatus as never } : {}),
        },
        _count: { _all: true },
      }),
      this.db.membership.groupBy({
        by: ['planId'],
        where: {
          tenantId: t,
          status: 'ACTIVE',
          ...(filters.planId ? { planId: filters.planId } : {}),
          member: { deletedAt: null, branchId: scope },
        },
        _count: { _all: true },
      }),
    ]);
    const names = await this.planNames(plans.map((p) => p.planId));
    return membershipSummary({
      byStatus: status.map((s) => ({ label: s.status, value: s._count._all })),
      byPlan: plans
        .map((p) => ({ label: names.get(p.planId) ?? 'Unknown', value: p._count._all }))
        .sort((a, b) => b.value - a.value),
    });
  }

  private async planNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db.membershipPlan.findMany({
      where: { tenantId: this.tenantId, id: { in: ids } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private async attendance(
    scope: Scope,
    range: DateRange,
    previousRange: DateRange,
  ): Promise<ReportSummaryBody> {
    const t = this.tenantId;
    const base = { tenantId: t, deletedAt: null, branchId: scope };
    const [days, methods, uniqueCur, uniquePrev] = await Promise.all([
      this.db.attendance.groupBy({
        by: ['attendanceDate'],
        where: {
          ...base,
          attendanceDate: { gte: dayStart(previousRange.from), lte: dayStart(range.to) },
        },
        _count: { _all: true },
      }),
      this.db.attendance.groupBy({
        by: ['method'],
        where: { ...base, attendanceDate: rangeFilter(range) },
        _count: { _all: true },
      }),
      this.db.attendance.groupBy({
        by: ['memberId'],
        where: { ...base, attendanceDate: rangeFilter(range) },
      }),
      this.db.attendance.groupBy({
        by: ['memberId'],
        where: { ...base, attendanceDate: rangeFilter(previousRange) },
      }),
    ]);
    const { totals, byDay } = totalsFromDays(
      days.map((r) => ({ date: iso(r.attendanceDate), value: r._count._all })),
      range,
      previousRange,
    );
    return attendanceSummary({
      range,
      previousRange,
      checkIns: totals,
      unique: { total: uniqueCur.length, previousTotal: uniquePrev.length },
      byMethod: methods.map((m) => ({ label: m.method, value: m._count._all })),
      byDay,
    });
  }

  private async revenue(
    scope: Scope,
    range: DateRange,
    previousRange: DateRange,
  ): Promise<ReportSummaryBody> {
    const t = this.tenantId;
    // Same population as the Revenue report list (status SUCCESS) so the summary reconciles with the table beneath it.
    const base = { tenantId: t, branchId: scope, status: 'SUCCESS' as const };
    const [days, methods] = await Promise.all([
      this.db.memberPayment.groupBy({
        by: ['paymentDate'],
        where: {
          ...base,
          paymentDate: { gte: dayStart(previousRange.from), lte: dayStart(range.to) },
        },
        _sum: { finalAmount: true },
        _count: { _all: true },
      }),
      this.db.memberPayment.groupBy({
        by: ['method'],
        where: { ...base, paymentDate: rangeFilter(range) },
        _sum: { finalAmount: true },
      }),
    ]);
    const amount = totalsFromDays(
      days.map((r) => ({ date: iso(r.paymentDate), value: Number(r._sum.finalAmount ?? 0) })),
      range,
      previousRange,
    );
    const count = totalsFromDays(
      days.map((r) => ({ date: iso(r.paymentDate), value: r._count._all })),
      range,
      previousRange,
    );
    return revenueSummary({
      range,
      previousRange,
      amount: amount.totals,
      count: count.totals,
      byMethod: methods
        .map((m) => ({ label: m.method, value: Number(m._sum.finalAmount ?? 0) }))
        .sort((a, b) => b.value - a.value),
      byDay: amount.byDay,
    });
  }

  private async expenses(
    scope: Scope,
    range: DateRange,
    previousRange: DateRange,
  ): Promise<ReportSummaryBody> {
    const base = { tenantId: this.tenantId, deletedAt: null, branchId: scope };
    const [days, categories] = await Promise.all([
      this.db.expense.groupBy({
        by: ['expenseDate'],
        where: {
          ...base,
          expenseDate: { gte: dayStart(previousRange.from), lte: dayStart(range.to) },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.db.expense.groupBy({
        by: ['category'],
        where: { ...base, expenseDate: rangeFilter(range) },
        _sum: { amount: true },
      }),
    ]);
    const amount = totalsFromDays(
      days.map((r) => ({ date: iso(r.expenseDate), value: Number(r._sum.amount ?? 0) })),
      range,
      previousRange,
    );
    const count = totalsFromDays(
      days.map((r) => ({ date: iso(r.expenseDate), value: r._count._all })),
      range,
      previousRange,
    );
    return expensesSummary({
      range,
      previousRange,
      amount: amount.totals,
      count: count.totals,
      byCategory: categories
        .map((c) => ({ label: c.category, value: Number(c._sum.amount ?? 0) }))
        .sort((a, b) => b.value - a.value),
      byDay: amount.byDay,
    });
  }

  private async payments(
    filters: ReportFilters,
    scope: Scope,
    range: DateRange,
    previousRange: DateRange,
  ): Promise<ReportSummaryBody> {
    const base = {
      tenantId: this.tenantId,
      branchId: scope,
      ...(filters.paymentStatus ? { status: filters.paymentStatus as never } : {}),
    };
    const [dayStatus, methods] = await Promise.all([
      this.db.memberPayment.groupBy({
        by: ['paymentDate', 'status'],
        where: {
          ...base,
          paymentDate: { gte: dayStart(previousRange.from), lte: dayStart(range.to) },
        },
        _sum: { finalAmount: true },
        _count: { _all: true },
      }),
      this.db.memberPayment.groupBy({
        by: ['method'],
        where: { ...base, status: { in: COLLECTED_STATUSES }, paymentDate: rangeFilter(range) },
        _sum: { finalAmount: true },
      }),
    ]);
    const rows = dayStatus.map((r) => ({
      date: iso(r.paymentDate),
      status: r.status as string,
      amount: Number(r._sum.finalAmount ?? 0),
      count: r._count._all,
    }));
    const collectedSet = new Set<string>(COLLECTED_STATUSES);
    const successSet = new Set<string>(SUCCESSISH_STATUSES);
    const collected = totalsFromDays(
      rows
        .filter((r) => collectedSet.has(r.status))
        .map((r) => ({ date: r.date, value: r.amount })),
      range,
      previousRange,
    );
    const attempts = totalsFromDays(
      rows.map((r) => ({ date: r.date, value: r.count })),
      range,
      previousRange,
    );
    const successful = totalsFromDays(
      rows.filter((r) => successSet.has(r.status)).map((r) => ({ date: r.date, value: r.count })),
      range,
      previousRange,
    );
    const statusMap = new Map<string, number>();
    for (const r of rows)
      if (r.date >= range.from && r.date <= range.to)
        statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + r.count);
    return paymentsSummary({
      range,
      previousRange,
      collected: collected.totals,
      attempts: attempts.totals,
      successful: successful.totals,
      byStatus: [...statusMap.entries()].map(([label, value]) => ({ label, value })),
      byMethod: methods
        .map((m) => ({ label: m.method, value: Number(m._sum.finalAmount ?? 0) }))
        .sort((a, b) => b.value - a.value),
      byDay: collected.byDay,
    });
  }

  private async staff(scope: Scope): Promise<ReportSummaryBody> {
    const users = await this.db.user.findMany({
      where: {
        tenantId: this.tenantId,
        deletedAt: null,
        userRoles: { some: { role: { name: { in: [...STAFF_ROLE_NAMES] } } } },
        ...(scope ? { userBranches: { some: { branchId: scope } } } : {}),
      },
      select: { status: true, userRoles: { select: { role: { select: { name: true } } } } },
    });
    const byRole = new Map<string, number>();
    const byStatus = new Map<string, number>();
    for (const u of users) {
      const role =
        u.userRoles
          .map((r) => r.role.name)
          .find((n) => (STAFF_ROLE_NAMES as readonly string[]).includes(n)) ?? '—';
      byRole.set(role, (byRole.get(role) ?? 0) + 1);
      byStatus.set(u.status, (byStatus.get(u.status) ?? 0) + 1);
    }
    const list = (m: Map<string, number>): LabelValue[] =>
      [...m.entries()].map(([label, value]) => ({ label, value }));
    return staffSummary({ byRole: list(byRole), byStatus: list(byStatus) });
  }

  private async memberProgress(scope: Scope): Promise<ReportSummaryBody> {
    const members = await this.db.member.findMany({
      where: { tenantId: this.tenantId, deletedAt: null, branchId: scope },
      select: {
        workoutPlans: {
          where: { status: 'ACTIVE' },
          take: 1,
          select: { progress: { select: { status: true } } },
        },
        dietPlans: {
          where: { status: 'ACTIVE' },
          take: 1,
          select: { dailyLogs: { take: 1, select: { id: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: MEMBER_PROGRESS_CAP,
    });
    // Same percent formulas as the member-progress report rows.
    return memberProgressSummary(
      members.map((m) => {
        const wp = m.workoutPlans[0];
        const dp = m.dietPlans[0];
        const done = wp ? wp.progress.filter((p) => p.status === 'COMPLETED').length : 0;
        return {
          workoutPercent: wp
            ? wp.progress.length === 0
              ? 0
              : Math.round((done / wp.progress.length) * 100)
            : null,
          dietPercent: dp ? (dp.dailyLogs.length > 0 ? 100 : 0) : null,
        };
      }),
    );
  }

  private async expiring(scope: Scope, today: string): Promise<ReportSummaryBody> {
    const where = {
      tenantId: this.tenantId,
      status: 'ACTIVE' as const,
      endDate: { gte: dayStart(today), lte: dayStart(addDaysStr(today, 30)) },
      member: { deletedAt: null, branchId: scope },
    };
    const [byEnd, byPlan] = await Promise.all([
      this.db.membership.groupBy({ by: ['endDate'], where, _count: { _all: true } }),
      this.db.membership.groupBy({ by: ['planId'], where, _count: { _all: true } }),
    ]);
    const names = await this.planNames(byPlan.map((p) => p.planId));
    return expiringMembershipsSummary({
      today,
      byEndDate: byEnd.map((r) => ({ date: iso(r.endDate), count: r._count._all })),
      byPlan: byPlan
        .map((p) => ({ label: names.get(p.planId) ?? 'Unknown', value: p._count._all }))
        .sort((a, b) => b.value - a.value),
    });
  }
}
