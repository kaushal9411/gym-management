import { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListPaymentsQuery } from '../dto/finance.dto';
import { COLLECTED_STATUSES, type AnalyticsRaw, type DateRange } from '../utils/payments-analytics.util';

const LIST_INCLUDE = {
  member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
  branch: { select: { id: true, name: true } },
  membership: {
    select: { id: true, priceAtAssignment: true, endDate: true, plan: { select: { name: true } } },
  },
} satisfies Prisma.MemberPaymentInclude;

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  recordedByUser: { select: { id: true, name: true } },
  refunds: {
    include: { refundedByUser: { select: { id: true, name: true } } },
    orderBy: { refundedAt: 'desc' },
  },
} satisfies Prisma.MemberPaymentInclude;

export type MemberPaymentListRow = Prisma.MemberPaymentGetPayload<{ include: typeof LIST_INCLUDE }>;
export type MemberPaymentDetailRow = Prisma.MemberPaymentGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

/** Same branch rules as the list: explicit branchId must be inside the actor's restriction; no branchId → whole restriction. */
function resolveBranchIds(branchId: string | undefined, restrictToBranchIds?: string[]): string[] | undefined {
  if (restrictToBranchIds) return branchId ? (restrictToBranchIds.includes(branchId) ? [branchId] : []) : restrictToBranchIds;
  return branchId ? [branchId] : undefined;
}

const dayStart = (d: string) => new Date(`${d}T00:00:00.000Z`);

function buildWhere(tenantId: string, query: Partial<ListPaymentsQuery>, restrictToBranchIds?: string[]): Prisma.MemberPaymentWhereInput {
  const where: Prisma.MemberPaymentWhereInput = { tenantId };
  if (query.memberId) where.memberId = query.memberId;
  if (restrictToBranchIds) {
    where.branchId = query.branchId ? (restrictToBranchIds.includes(query.branchId) ? query.branchId : { in: [] }) : { in: restrictToBranchIds };
  } else if (query.branchId) {
    where.branchId = query.branchId;
  }
  if (query.method) where.method = query.method;
  if (query.status) where.status = query.status;
  if (query.dateFrom || query.dateTo) {
    where.paymentDate = {};
    if (query.dateFrom) where.paymentDate.gte = new Date(query.dateFrom);
    if (query.dateTo) where.paymentDate.lte = new Date(query.dateTo);
  }
  if (query.planId) where.membership = { planId: query.planId };
  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    where.finalAmount = {};
    if (query.minAmount !== undefined) where.finalAmount.gte = Number(query.minAmount);
    if (query.maxAmount !== undefined) where.finalAmount.lte = Number(query.maxAmount);
  }
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' as const };
    where.OR = [{ paymentNumber: contains }, { transactionReference: contains }, { member: { firstName: contains } }, { member: { lastName: contains } }];
  }
  return where;
}

export class MemberPaymentRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListPaymentsQuery, restrictToBranchIds?: string[]): Promise<{ items: MemberPaymentListRow[]; total: number }> {
    const where = buildWhere(tenantId, query, restrictToBranchIds);
    const [items, total] = await Promise.all([
      this.db.memberPayment.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.memberPayment.count({ where }),
    ]);
    return { items, total };
  }

  /** One grouped query for the page's payment ids → total refunded per payment. */
  async refundTotalsByPayment(tenantId: string, paymentIds: string[]): Promise<Map<string, number>> {
    if (paymentIds.length === 0) return new Map();
    const rows = await this.db.memberPaymentRefund.groupBy({
      by: ['paymentId'],
      where: { tenantId, paymentId: { in: paymentIds } },
      _sum: { amount: true },
    });
    return new Map(rows.map((r) => [r.paymentId, Number(r._sum.amount ?? 0)]));
  }

  /** Collected / refunded totals over the FULL filtered set (not just the page). */
  async listSummary(tenantId: string, query: Partial<ListPaymentsQuery>, restrictToBranchIds?: string[]): Promise<{ collectedTotal: number; refundedTotal: number }> {
    const where = buildWhere(tenantId, query, restrictToBranchIds);
    const [collected, refunded] = await Promise.all([
      this.db.memberPayment.aggregate({
        where: { AND: [where, { status: { in: COLLECTED_STATUSES } }] },
        _sum: { finalAmount: true },
      }),
      this.db.memberPaymentRefund.aggregate({
        where: { tenantId, payment: where },
        _sum: { amount: true },
      }),
    ]);
    return {
      collectedTotal: Number(collected._sum.finalAmount ?? 0),
      refundedTotal: Number(refunded._sum.amount ?? 0),
    };
  }

  // ── Analytics aggregates (all grouped in the DB) ─────────────────────

  /** Raw SQL must set the RLS tenant variable itself — the scoped client only wraps model operations. */
  private async rawScoped<T>(tenantId: string, query: Prisma.Sql): Promise<T[]> {
    const [, rows] = await this.db.$transaction([this.db.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`, this.db.$queryRaw<T[]>(query)]);
    return rows as T[];
  }

  async analyticsRaw(
    tenantId: string,
    range: DateRange,
    previousRange: DateRange,
    today: string,
    branchId: string | undefined,
    restrictToBranchIds?: string[],
  ): Promise<AnalyticsRaw> {
    const ids = resolveBranchIds(branchId, restrictToBranchIds);
    const branchWhere: Prisma.MemberPaymentWhereInput = ids ? { branchId: { in: ids } } : {};
    const base: Prisma.MemberPaymentWhereInput = { tenantId, ...branchWhere };
    const span = { gte: dayStart(previousRange.from), lte: dayStart(range.to) };
    const rangeFilter = (r: DateRange) => ({ gte: dayStart(r.from), lte: dayStart(r.to) });
    const branchSql = ids ? Prisma.sql`AND p.branch_id = ANY(${ids}::uuid[])` : Prisma.empty;
    const invoiceBranch: Prisma.MemberInvoiceWhereInput = ids ? { branchId: { in: ids } } : {};
    const todayStart = dayStart(today);
    const pendingCutoff = new Date(Date.now() - 24 * 3_600_000);

    const [dayStatus, todayAgg, outstanding, methods, curBranches, prevBranches, refunds, plans, pendingOver24h, overdue] = await Promise.all([
      this.db.memberPayment.groupBy({
        by: ['paymentDate', 'status'],
        where: { ...base, paymentDate: span },
        _sum: { finalAmount: true },
        _count: { _all: true },
      }),
      this.db.memberPayment.aggregate({
        where: { ...base, status: { in: COLLECTED_STATUSES }, paymentDate: todayStart },
        _sum: { finalAmount: true },
        _count: { _all: true },
      }),
      this.db.memberInvoice.aggregate({
        where: {
          tenantId,
          ...invoiceBranch,
          status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.db.memberPayment.groupBy({
        by: ['method'],
        where: { ...base, status: { in: COLLECTED_STATUSES }, paymentDate: rangeFilter(range) },
        _sum: { finalAmount: true },
        _count: { _all: true },
      }),
      this.db.memberPayment.groupBy({
        by: ['branchId'],
        where: { ...base, status: { in: COLLECTED_STATUSES }, paymentDate: rangeFilter(range) },
        _sum: { finalAmount: true },
      }),
      this.db.memberPayment.groupBy({
        by: ['branchId'],
        where: {
          ...base,
          status: { in: COLLECTED_STATUSES },
          paymentDate: rangeFilter(previousRange),
        },
        _sum: { finalAmount: true },
      }),
      this.rawScoped<{ day: string; amount: Prisma.Decimal; cnt: bigint }>(
        tenantId,
        Prisma.sql`SELECT to_char(r.refunded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, SUM(r.amount) AS amount, COUNT(*) AS cnt
          FROM member_payment_refunds r JOIN member_payments p ON p.id = r.payment_id
          WHERE r.tenant_id = ${tenantId}::uuid ${branchSql}
            AND (r.refunded_at AT TIME ZONE 'UTC')::date BETWEEN ${previousRange.from}::date AND ${range.to}::date
          GROUP BY 1`,
      ),
      this.rawScoped<{ name: string; revenue: Prisma.Decimal; cnt: bigint }>(
        tenantId,
        Prisma.sql`SELECT pl.name AS name, SUM(p.final_amount) AS revenue, COUNT(*) AS cnt
          FROM member_payments p JOIN memberships m ON m.id = p.membership_id JOIN membership_plans pl ON pl.id = m.plan_id
          WHERE p.tenant_id = ${tenantId}::uuid ${branchSql}
            AND p.status::text IN ('SUCCESS', 'PARTIALLY_REFUNDED')
            AND p.payment_date BETWEEN ${range.from}::date AND ${range.to}::date
          GROUP BY pl.id, pl.name ORDER BY revenue DESC LIMIT 5`,
      ),
      this.db.memberPayment.count({
        where: { ...base, status: 'PENDING', createdAt: { lt: pendingCutoff } },
      }),
      this.db.memberInvoice.aggregate({
        where: {
          tenantId,
          ...invoiceBranch,
          OR: [{ status: 'OVERDUE' }, { status: { in: ['UNPAID', 'PARTIALLY_PAID'] }, dueDate: { lt: todayStart } }],
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
    ]);

    const branchIds = [...new Set([...curBranches, ...prevBranches].map((b) => b.branchId))];
    const branchRows = branchIds.length
      ? await this.db.branch.findMany({
          where: { tenantId, id: { in: branchIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = new Map(branchRows.map((b) => [b.id, b.name]));
    const curMap = new Map(curBranches.map((b) => [b.branchId, Number(b._sum.finalAmount ?? 0)]));
    const prevMap = new Map(prevBranches.map((b) => [b.branchId, Number(b._sum.finalAmount ?? 0)]));

    return {
      range,
      previousRange,
      dayStatus: dayStatus.map((r) => ({
        date: r.paymentDate.toISOString().slice(0, 10),
        status: r.status,
        amount: Number(r._sum.finalAmount ?? 0),
        count: r._count._all,
      })),
      refundsByDay: refunds.map((r) => ({
        date: r.day,
        amount: Number(r.amount),
        count: Number(r.cnt),
      })),
      today: { amount: Number(todayAgg._sum.finalAmount ?? 0), count: todayAgg._count._all },
      outstanding: {
        amount: Number(outstanding._sum.totalAmount ?? 0),
        count: outstanding._count._all,
      },
      methods: methods
        .map((m) => ({
          method: m.method,
          amount: Number(m._sum.finalAmount ?? 0),
          count: m._count._all,
        }))
        .sort((a, b) => b.amount - a.amount),
      branches: branchIds.map((id) => ({
        branchId: id,
        name: nameOf.get(id) ?? 'Unknown',
        revenue: curMap.get(id) ?? 0,
        previousRevenue: prevMap.get(id) ?? 0,
      })),
      topPlans: plans.map((p) => ({
        planName: p.name,
        revenue: Number(p.revenue),
        count: Number(p.cnt),
      })),
      pendingOver24h,
      overdue: { amount: Number(overdue._sum.totalAmount ?? 0), count: overdue._count._all },
    };
  }

  async findById(tenantId: string, id: string): Promise<MemberPaymentDetailRow | null> {
    return this.db.memberPayment.findFirst({ where: { tenantId, id }, include: DETAIL_INCLUDE });
  }

  /** Any non-cancelled/non-failed payment already settling this invoice — backs the "prevent duplicate payments for the same invoice" rule. */
  async findActiveByInvoice(tenantId: string, invoiceId: string) {
    return this.db.memberPayment.findFirst({
      where: { tenantId, invoiceId, status: { in: ['PENDING', 'SUCCESS', 'PARTIALLY_REFUNDED'] } },
    });
  }

  async create(data: Prisma.MemberPaymentUncheckedCreateInput): Promise<MemberPaymentDetailRow> {
    const payment = await this.db.memberPayment.create({ data });
    return (await this.findById(data.tenantId, payment.id))!;
  }

  async update(id: string, data: Omit<Prisma.MemberPaymentUncheckedUpdateInput, 'tenantId'>): Promise<void> {
    await this.db.memberPayment.update({ where: { id }, data });
  }

  async findByPaymentNumber(tenantId: string, paymentNumber: string) {
    return this.db.memberPayment.findFirst({ where: { tenantId, paymentNumber } });
  }

  /** Count-based sequence — a collision just retries with the next number, same pattern as every other auto-numbered entity. */
  async nextPaymentNumber(tenantId: string): Promise<string> {
    const count = await this.db.memberPayment.count({ where: { tenantId } });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `PAY-${String(count + 1 + attempt).padStart(4, '0')}`;
      const existing = await this.findByPaymentNumber(tenantId, candidate);
      if (!existing) return candidate;
    }
    return `PAY-${Date.now()}`;
  }

  async createRefund(data: Prisma.MemberPaymentRefundUncheckedCreateInput): Promise<void> {
    await this.db.memberPaymentRefund.create({ data });
  }

  async sumRefunded(tenantId: string, paymentId: string): Promise<number> {
    const result = await this.db.memberPaymentRefund.aggregate({
      where: { tenantId, paymentId },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  /** Running total actually paid toward one membership (all SUCCESS payments) — powers the payment-receipt email's "Total Paid Till Date" / "Due Amount" fields for installment-style membership fees. */
  async sumSuccessForMembership(tenantId: string, membershipId: string): Promise<number> {
    const result = await this.db.memberPayment.aggregate({
      where: { tenantId, membershipId, status: 'SUCCESS' },
      _sum: { finalAmount: true },
    });
    return Number(result._sum.finalAmount ?? 0);
  }

  // ── Dashboard aggregates ─────────────────────────────────────────────

  async sumFinalAmountForDateRange(tenantId: string, from: Date, to: Date, branchId?: string): Promise<number> {
    const result = await this.db.memberPayment.aggregate({
      where: { tenantId, branchId, status: 'SUCCESS', paymentDate: { gte: from, lte: to } },
      _sum: { finalAmount: true },
    });
    return Number(result._sum.finalAmount ?? 0);
  }

  async sumOutstanding(tenantId: string, branchId?: string): Promise<{ total: number; count: number }> {
    const result = await this.db.memberInvoice.aggregate({
      where: { tenantId, branchId, status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
      _sum: { totalAmount: true },
      _count: true,
    });
    return { total: Number(result._sum.totalAmount ?? 0), count: result._count };
  }

  async recent(tenantId: string, limit: number, branchId?: string): Promise<MemberPaymentListRow[]> {
    return this.db.memberPayment.findMany({
      where: { tenantId, branchId },
      include: LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async dailyTotalsForRange(tenantId: string, from: Date, to: Date, branchId?: string): Promise<Array<{ date: Date; total: number }>> {
    const rows = await this.db.memberPayment.findMany({
      where: { tenantId, branchId, status: 'SUCCESS', paymentDate: { gte: from, lte: to } },
      select: { paymentDate: true, finalAmount: true },
    });
    const byDate = new Map<string, number>();
    for (const row of rows) {
      const key = row.paymentDate.toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) ?? 0) + Number(row.finalAmount));
    }
    return [...byDate.entries()].map(([date, total]) => ({ date: new Date(date), total }));
  }
}
