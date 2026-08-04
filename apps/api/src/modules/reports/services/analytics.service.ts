import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { BranchComparisonRow, RevenueTrendPoint, TrendPoint } from '../dto/reports.dto';
import { resolveBranchScope } from '../utils/branch-scope.util';
import { addDaysStr, fillDailyTrend, resolveDateRange } from '../utils/date-range.util';

export class AnalyticsService {
  private readonly db: TenantScopedPrisma;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
  }

  async revenueTrends(userId: string, dateFrom?: string, dateTo?: string, requestedBranchId?: string): Promise<RevenueTrendPoint[]> {
    const branchId = await resolveBranchScope(this.tenantId, userId, requestedBranchId);
    const { from, to } = resolveDateRange(dateFrom, dateTo, 30);
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const [incomeRows, expenseRows] = await Promise.all([
      this.db.income.findMany({ where: { tenantId: this.tenantId, deletedAt: null, branchId, incomeDate: { gte: fromDate, lte: toDate } }, select: { incomeDate: true, amount: true } }),
      this.db.expense.findMany({ where: { tenantId: this.tenantId, deletedAt: null, branchId, expenseDate: { gte: fromDate, lte: toDate } }, select: { expenseDate: true, amount: true } }),
    ]);

    const incomeByDate = new Map<string, number>();
    for (const r of incomeRows) {
      const key = r.incomeDate.toISOString().slice(0, 10);
      incomeByDate.set(key, (incomeByDate.get(key) ?? 0) + Number(r.amount));
    }
    const expenseByDate = new Map<string, number>();
    for (const r of expenseRows) {
      const key = r.expenseDate.toISOString().slice(0, 10);
      expenseByDate.set(key, (expenseByDate.get(key) ?? 0) + Number(r.amount));
    }

    const rows = [...new Set([...incomeByDate.keys(), ...expenseByDate.keys()])].map((date) => ({
      date,
      income: incomeByDate.get(date) ?? 0,
      expenses: expenseByDate.get(date) ?? 0,
    }));
    return fillDailyTrend(from, to, rows, { income: 0, expenses: 0 });
  }

  async attendanceTrends(userId: string, dateFrom?: string, dateTo?: string, requestedBranchId?: string): Promise<TrendPoint[]> {
    const branchId = await resolveBranchScope(this.tenantId, userId, requestedBranchId);
    const { from, to } = resolveDateRange(dateFrom, dateTo, 30);
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const rows = await this.db.attendance.findMany({
      where: { tenantId: this.tenantId, deletedAt: null, branchId, attendanceDate: { gte: fromDate, lte: toDate } },
      select: { attendanceDate: true },
    });
    const byDate = new Map<string, number>();
    for (const r of rows) {
      const key = r.attendanceDate.toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) ?? 0) + 1);
    }
    const series = [...byDate.entries()].map(([date, value]) => ({ date, value }));
    return fillDailyTrend(from, to, series, { value: 0 });
  }

  async membershipGrowth(userId: string, dateFrom?: string, dateTo?: string, requestedBranchId?: string): Promise<TrendPoint[]> {
    const branchId = await resolveBranchScope(this.tenantId, userId, requestedBranchId);
    const { from, to } = resolveDateRange(dateFrom, dateTo, 30);
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const rows = await this.db.membership.findMany({
      where: { tenantId: this.tenantId, createdAt: { gte: fromDate, lte: toDate }, member: { branchId } },
      select: { createdAt: true },
    });
    const byDate = new Map<string, number>();
    for (const r of rows) {
      const key = r.createdAt.toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) ?? 0) + 1);
    }
    const series = [...byDate.entries()].map(([date, value]) => ({ date, value }));
    return fillDailyTrend(from, to, series, { value: 0 });
  }

  async newMemberGrowth(userId: string, dateFrom?: string, dateTo?: string, requestedBranchId?: string): Promise<TrendPoint[]> {
    const branchId = await resolveBranchScope(this.tenantId, userId, requestedBranchId);
    const { from, to } = resolveDateRange(dateFrom, dateTo, 30);
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const rows = await this.db.member.findMany({
      where: { tenantId: this.tenantId, deletedAt: null, branchId, createdAt: { gte: fromDate, lte: toDate } },
      select: { createdAt: true },
    });
    const byDate = new Map<string, number>();
    for (const r of rows) {
      const key = r.createdAt.toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) ?? 0) + 1);
    }
    const series = [...byDate.entries()].map(([date, value]) => ({ date, value }));
    return fillDailyTrend(from, to, series, { value: 0 });
  }

  /**
   * Member Retention — deliberately simplified: a daily snapshot of the
   * ACTIVE member count over the range (a full cohort-based retention-rate
   * analysis was out of scope for this pass). Still answers the practical
   * question ("is our active base growing or shrinking?") a gym owner cares
   * about, via the same trend-chart shape as every other analytics endpoint.
   */
  async memberRetention(userId: string, dateFrom?: string, dateTo?: string, requestedBranchId?: string): Promise<TrendPoint[]> {
    const branchId = await resolveBranchScope(this.tenantId, userId, requestedBranchId);
    const { from, to } = resolveDateRange(dateFrom, dateTo, 30);

    const points: TrendPoint[] = [];
    for (let d = from; d <= to; d = addDaysStr(d, 1)) {
      const asOf = new Date(`${d}T23:59:59.999Z`);
      // eslint-disable-next-line no-await-in-loop -- one point per day over a bounded (default 30-day) range; a snapshot query per day is the simplest correct way to answer "active as of that date"
      const value = await this.db.member.count({
        where: { tenantId: this.tenantId, deletedAt: null, branchId, status: 'ACTIVE', createdAt: { lte: asOf } },
      });
      points.push({ date: d, value });
    }
    return points;
  }

  async paymentCollection(userId: string, dateFrom?: string, dateTo?: string, requestedBranchId?: string): Promise<RevenueTrendPoint[]> {
    const branchId = await resolveBranchScope(this.tenantId, userId, requestedBranchId);
    const { from, to } = resolveDateRange(dateFrom, dateTo, 30);
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const [collected, invoiced] = await Promise.all([
      this.db.memberPayment.findMany({
        where: { tenantId: this.tenantId, branchId, status: 'SUCCESS', paymentDate: { gte: fromDate, lte: toDate } },
        select: { paymentDate: true, finalAmount: true },
      }),
      this.db.memberInvoice.findMany({
        where: { tenantId: this.tenantId, branchId, invoiceDate: { gte: fromDate, lte: toDate } },
        select: { invoiceDate: true, totalAmount: true },
      }),
    ]);

    const collectedByDate = new Map<string, number>();
    for (const r of collected) {
      const key = r.paymentDate.toISOString().slice(0, 10);
      collectedByDate.set(key, (collectedByDate.get(key) ?? 0) + Number(r.finalAmount));
    }
    const invoicedByDate = new Map<string, number>();
    for (const r of invoiced) {
      const key = r.invoiceDate.toISOString().slice(0, 10);
      invoicedByDate.set(key, (invoicedByDate.get(key) ?? 0) + Number(r.totalAmount));
    }

    const rows = [...new Set([...collectedByDate.keys(), ...invoicedByDate.keys()])].map((date) => ({
      date,
      income: collectedByDate.get(date) ?? 0,
      expenses: invoicedByDate.get(date) ?? 0, // reused shape: "expenses" carries invoiced total here, not a real expense
    }));
    return fillDailyTrend(from, to, rows, { income: 0, expenses: 0 });
  }

  async branchComparison(userId: string, requestedBranchId?: string): Promise<BranchComparisonRow[]> {
    const branchScope = await resolveBranchScope(this.tenantId, userId, requestedBranchId);
    const branches = await this.db.branch.findMany({
      where: { tenantId: this.tenantId, isActive: true, ...(branchScope ? { id: branchScope } : {}) },
    });
    if (branches.length === 0) return [];
    const branchIds = branches.map((b) => b.id);

    const todayIso = new Date().toISOString().slice(0, 10);
    const monthStart = new Date(`${todayIso.slice(0, 7)}-01T00:00:00.000Z`);
    const todayEnd = new Date(`${todayIso}T23:59:59.999Z`);

    // Grouped aggregates instead of 3 queries per branch (Prompt 37 perf
    // pass — same fan-out shape as reports.service.ts's branch/trainer
    // reports had).
    const [members, revenue, attendance] = await Promise.all([
      this.db.member.groupBy({
        by: ['branchId'],
        where: { tenantId: this.tenantId, deletedAt: null, branchId: { in: branchIds }, status: 'ACTIVE' },
        _count: { _all: true },
      }),
      this.db.income.groupBy({
        by: ['branchId'],
        where: { tenantId: this.tenantId, deletedAt: null, branchId: { in: branchIds }, incomeDate: { gte: monthStart, lte: todayEnd } },
        _sum: { amount: true },
      }),
      this.db.attendance.groupBy({
        by: ['branchId'],
        where: { tenantId: this.tenantId, deletedAt: null, branchId: { in: branchIds }, attendanceDate: { gte: monthStart, lte: todayEnd } },
        _count: { _all: true },
      }),
    ]);

    const membersMap = new Map(members.map((r) => [r.branchId, r._count._all]));
    const revenueMap = new Map(revenue.map((r) => [r.branchId, Number(r._sum.amount) || 0]));
    const attendanceMap = new Map(attendance.map((r) => [r.branchId, r._count._all]));

    return branches.map((b) => ({
      branchId: b.id,
      branch: b.name,
      members: membersMap.get(b.id) ?? 0,
      revenue: revenueMap.get(b.id) ?? 0,
      attendance: attendanceMap.get(b.id) ?? 0,
    }));
  }
}
