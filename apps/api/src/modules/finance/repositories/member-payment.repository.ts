import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListPaymentsQuery } from '../dto/finance.dto';

const LIST_INCLUDE = {
  member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
  branch: { select: { id: true, name: true } },
  membership: { select: { id: true, plan: { select: { name: true } } } },
} satisfies Prisma.MemberPaymentInclude;

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  recordedByUser: { select: { id: true, name: true } },
  refunds: { include: { refundedByUser: { select: { id: true, name: true } } }, orderBy: { refundedAt: 'desc' } },
} satisfies Prisma.MemberPaymentInclude;

export type MemberPaymentListRow = Prisma.MemberPaymentGetPayload<{ include: typeof LIST_INCLUDE }>;
export type MemberPaymentDetailRow = Prisma.MemberPaymentGetPayload<{ include: typeof DETAIL_INCLUDE }>;

function buildWhere(tenantId: string, query: Partial<ListPaymentsQuery>): Prisma.MemberPaymentWhereInput {
  const where: Prisma.MemberPaymentWhereInput = { tenantId };
  if (query.memberId) where.memberId = query.memberId;
  if (query.branchId) where.branchId = query.branchId;
  if (query.method) where.method = query.method;
  if (query.status) where.status = query.status;
  if (query.dateFrom || query.dateTo) {
    where.paymentDate = {};
    if (query.dateFrom) where.paymentDate.gte = new Date(query.dateFrom);
    if (query.dateTo) where.paymentDate.lte = new Date(query.dateTo);
  }
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' as const };
    where.OR = [
      { paymentNumber: contains },
      { transactionReference: contains },
      { member: { firstName: contains } },
      { member: { lastName: contains } },
    ];
  }
  return where;
}

export class MemberPaymentRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListPaymentsQuery): Promise<{ items: MemberPaymentListRow[]; total: number }> {
    const where = buildWhere(tenantId, query);
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
    const result = await this.db.memberPaymentRefund.aggregate({ where: { tenantId, paymentId }, _sum: { amount: true } });
    return Number(result._sum.amount ?? 0);
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
