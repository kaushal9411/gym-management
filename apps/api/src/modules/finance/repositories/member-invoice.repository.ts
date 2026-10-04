import { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { InvoiceItemInput, ListInvoicesQuery } from '../dto/finance.dto';
import {
  buildListExtras,
  type DebtorRow,
  type InvoiceAnalyticsRaw,
  type InvoiceBranchRow,
  type InvoiceDayRow,
  type InvoiceListStatusAgg,
  type InvoiceStatusRow,
  type OpenAgingRow,
} from '../utils/invoice-analytics.util';
import type { DateRange } from '../utils/payments-analytics.util';

const LIST_INCLUDE = {
  member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
  branch: { select: { id: true, name: true } },
} satisfies Prisma.MemberInvoiceInclude;

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  items: { orderBy: { sortOrder: 'asc' } },
  payments: { select: { id: true, paymentNumber: true, finalAmount: true, status: true, paymentDate: true } },
} satisfies Prisma.MemberInvoiceInclude;

export type MemberInvoiceListRow = Prisma.MemberInvoiceGetPayload<{ include: typeof LIST_INCLUDE }>;
export type MemberInvoiceDetailRow = Prisma.MemberInvoiceGetPayload<{ include: typeof DETAIL_INCLUDE }>;

const todayUtc = (): string => new Date().toISOString().slice(0, 10);
const dayStart = (d: string) => new Date(`${d}T00:00:00.000Z`);

/** `undefined` = no branch restriction; `[]` = nothing visible (foreign branch / empty scope). */
function resolveBranchIds(branchId: string | undefined, restrictToBranchIds?: string[]): string[] | undefined {
  if (restrictToBranchIds) return branchId ? (restrictToBranchIds.includes(branchId) ? [branchId] : []) : restrictToBranchIds;
  return branchId ? [branchId] : undefined;
}

/** Settled money linked to an invoice (same definition as the invoice detail page's `paid`). `i` is the invoice alias. */
const PAID_SQL = Prisma.sql`COALESCE((SELECT SUM(p.final_amount) FROM member_payments p WHERE p.tenant_id = i.tenant_id AND p.invoice_id = i.id AND p.status::text IN ('SUCCESS', 'PARTIALLY_REFUNDED')), 0)`;

function buildWhere(tenantId: string, query: Partial<ListInvoicesQuery>, restrictToBranchIds?: string[]): Prisma.MemberInvoiceWhereInput {
  const where: Prisma.MemberInvoiceWhereInput = { tenantId };
  if (query.memberId) where.memberId = query.memberId;
  if (restrictToBranchIds) {
    where.branchId = query.branchId
      ? restrictToBranchIds.includes(query.branchId)
        ? query.branchId
        : { in: [] }
      : { in: restrictToBranchIds };
  } else if (query.branchId) {
    where.branchId = query.branchId;
  }
  const and: Prisma.MemberInvoiceWhereInput[] = [];
  if (query.status) {
    // Effective status (OVERDUE is derived, never stored by a scheduler): see invoice-analytics.util.ts.
    const todayStart = dayStart(todayUtc());
    if (query.status === 'OVERDUE') and.push({ OR: [{ status: 'OVERDUE' }, { status: { in: ['UNPAID', 'PARTIALLY_PAID'] }, dueDate: { lt: todayStart } }] });
    else if (query.status === 'UNPAID' || query.status === 'PARTIALLY_PAID') and.push({ status: query.status, dueDate: { gte: todayStart } });
    else where.status = query.status;
  }
  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    where.totalAmount = {};
    if (query.minAmount !== undefined) where.totalAmount.gte = query.minAmount;
    if (query.maxAmount !== undefined) where.totalAmount.lte = query.maxAmount;
  }
  if (and.length) where.AND = and;
  if (query.dateFrom || query.dateTo) {
    where.invoiceDate = {};
    if (query.dateFrom) where.invoiceDate.gte = new Date(query.dateFrom);
    if (query.dateTo) where.invoiceDate.lte = new Date(query.dateTo);
  }
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' as const };
    where.OR = [{ invoiceNumber: contains }, { member: { firstName: contains } }, { member: { lastName: contains } }];
  }
  return where;
}

export class MemberInvoiceRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListInvoicesQuery, restrictToBranchIds?: string[]): Promise<{ items: MemberInvoiceListRow[]; total: number }> {
    const where = buildWhere(tenantId, query, restrictToBranchIds);
    const [items, total] = await Promise.all([
      this.db.memberInvoice.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.memberInvoice.count({ where }),
    ]);
    return { items, total };
  }

  /** Raw SQL must set the RLS tenant variable itself — the scoped client only wraps model operations. */
  private async rawScoped<T>(tenantId: string, query: Prisma.Sql): Promise<T[]> {
    const [, rows] = await this.db.$transaction([this.db.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`, this.db.$queryRaw<T[]>(query)]);
    return rows as T[];
  }

  /**
   * `summary` + `counts` for the list: ONE grouped query by effective status over the search/date/amount/member/branch-filtered
   * set (status filter intentionally not applied in SQL — `buildListExtras` applies it to `summary` only).
   */
  async listExtras(tenantId: string, query: Partial<ListInvoicesQuery>, restrictToBranchIds?: string[]) {
    const ids = resolveBranchIds(query.branchId, restrictToBranchIds);
    const conds: Prisma.Sql[] = [Prisma.sql`i.tenant_id = ${tenantId}::uuid`];
    if (query.memberId) conds.push(Prisma.sql`i.member_id = ${query.memberId}::uuid`);
    if (ids) conds.push(Prisma.sql`i.branch_id = ANY(${ids}::uuid[])`);
    if (query.dateFrom) conds.push(Prisma.sql`i.invoice_date >= ${new Date(query.dateFrom).toISOString().slice(0, 10)}::date`);
    if (query.dateTo) conds.push(Prisma.sql`i.invoice_date <= ${new Date(query.dateTo).toISOString().slice(0, 10)}::date`);
    if (query.minAmount !== undefined) conds.push(Prisma.sql`i.total_amount >= ${query.minAmount}`);
    if (query.maxAmount !== undefined) conds.push(Prisma.sql`i.total_amount <= ${query.maxAmount}`);
    if (query.search) {
      const like = `%${query.search}%`; // Prisma `contains` does not escape LIKE wildcards either — keep the two filters identical
      conds.push(Prisma.sql`(i.invoice_number ILIKE ${like} OR m.first_name ILIKE ${like} OR m.last_name ILIKE ${like})`);
    }
    const rows = await this.rawScoped<{ status: string; cnt: bigint; total: Prisma.Decimal; paid: Prisma.Decimal; balance: Prisma.Decimal }>(
      tenantId,
      Prisma.sql`SELECT x.eff AS status, COUNT(*) AS cnt, COALESCE(SUM(x.total), 0) AS total, COALESCE(SUM(x.paid), 0) AS paid,
          COALESCE(SUM(CASE WHEN x.eff IN ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE') THEN GREATEST(x.total - x.paid, 0) ELSE 0 END), 0) AS balance
        FROM (
          SELECT i.total_amount AS total, ${PAID_SQL} AS paid,
            CASE WHEN i.status::text = 'OVERDUE' OR (i.status::text IN ('UNPAID', 'PARTIALLY_PAID') AND i.due_date < ${todayUtc()}::date) THEN 'OVERDUE' ELSE i.status::text END AS eff
          FROM member_invoices i JOIN members m ON m.id = i.member_id
          WHERE ${Prisma.join(conds, ' AND ')}
        ) x GROUP BY x.eff`,
    );
    const aggs: InvoiceListStatusAgg[] = rows.map((r) => ({
      status: r.status as InvoiceListStatusAgg['status'],
      count: Number(r.cnt),
      total: Number(r.total),
      paid: Number(r.paid),
      balance: Number(r.balance),
    }));
    return buildListExtras(aggs, query.status);
  }

  /** All analytics aggregates, each grouped in the DB (no row-per-invoice loading). `range`/`previousRange` as produced by `resolveRanges`. */
  async analyticsRaw(
    tenantId: string,
    range: DateRange,
    previousRange: DateRange,
    today: string,
    branchId: string | undefined,
    restrictToBranchIds?: string[],
  ): Promise<InvoiceAnalyticsRaw> {
    const ids = resolveBranchIds(branchId, restrictToBranchIds);
    const branchSql = ids ? Prisma.sql`AND i.branch_id = ANY(${ids}::uuid[])` : Prisma.empty;
    const scope = Prisma.sql`i.tenant_id = ${tenantId}::uuid ${branchSql}`;
    const effStatus = Prisma.sql`CASE WHEN i.status::text = 'OVERDUE' OR (i.status::text IN ('UNPAID', 'PARTIALLY_PAID') AND i.due_date < ${today}::date) THEN 'OVERDUE' ELSE i.status::text END`;
    const open = Prisma.sql`i.status::text IN ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE')`;

    const [dayRows, statusRows, openRows, debtors, branches] = await Promise.all([
      this.rawScoped<{ day: string; invoiced: Prisma.Decimal; cnt: bigint; collected: Prisma.Decimal }>(
        tenantId,
        Prisma.sql`SELECT to_char(i.invoice_date, 'YYYY-MM-DD') AS day, SUM(i.total_amount) AS invoiced, COUNT(*) AS cnt, SUM(${PAID_SQL}) AS collected
          FROM member_invoices i
          WHERE ${scope} AND i.status::text <> 'CANCELLED'
            AND i.invoice_date BETWEEN ${previousRange.from}::date AND ${range.to}::date
          GROUP BY 1`,
      ),
      this.rawScoped<{ status: string; cnt: bigint; amount: Prisma.Decimal }>(
        tenantId,
        Prisma.sql`SELECT ${effStatus} AS status, COUNT(*) AS cnt, SUM(i.total_amount) AS amount
          FROM member_invoices i
          WHERE ${scope} AND i.invoice_date BETWEEN ${range.from}::date AND ${range.to}::date
          GROUP BY 1`,
      ),
      this.rawScoped<{ days_past: number; stored: boolean; balance: Prisma.Decimal; cnt: bigint }>(
        tenantId,
        Prisma.sql`SELECT (${today}::date - o.due_date) AS days_past, (o.status::text = 'OVERDUE') AS stored, SUM(o.rem) AS balance, COUNT(*) AS cnt
          FROM (SELECT i.due_date, i.status, GREATEST(i.total_amount - ${PAID_SQL}, 0) AS rem FROM member_invoices i WHERE ${scope} AND ${open}) o
          WHERE o.rem > 0
          GROUP BY 1, 2`,
      ),
      this.rawScoped<{ id: string; code: string; first_name: string; last_name: string; outstanding: Prisma.Decimal; cnt: bigint }>(
        tenantId,
        Prisma.sql`SELECT m.id, m.member_id AS code, m.first_name, m.last_name, SUM(o.rem) AS outstanding, COUNT(*) AS cnt
          FROM (SELECT i.member_id, GREATEST(i.total_amount - ${PAID_SQL}, 0) AS rem FROM member_invoices i WHERE ${scope} AND ${open}) o
          JOIN members m ON m.id = o.member_id
          WHERE o.rem > 0
          GROUP BY m.id, m.member_id, m.first_name, m.last_name
          ORDER BY outstanding DESC, m.member_id ASC LIMIT 5`,
      ),
      this.rawScoped<{ branch_id: string; name: string; invoiced: Prisma.Decimal; collected: Prisma.Decimal }>(
        tenantId,
        Prisma.sql`SELECT i.branch_id, b.name, SUM(i.total_amount) AS invoiced, SUM(${PAID_SQL}) AS collected
          FROM member_invoices i JOIN branches b ON b.id = i.branch_id
          WHERE ${scope} AND i.status::text <> 'CANCELLED' AND i.invoice_date BETWEEN ${range.from}::date AND ${range.to}::date
          GROUP BY i.branch_id, b.name`,
      ),
    ]);

    return {
      range,
      previousRange,
      dayRows: dayRows.map((r): InvoiceDayRow => ({ date: r.day, invoiced: Number(r.invoiced), count: Number(r.cnt), collected: Number(r.collected) })),
      statusRows: statusRows.map((r): InvoiceStatusRow => ({ status: r.status as InvoiceStatusRow['status'], count: Number(r.cnt), amount: Number(r.amount) })),
      openRows: openRows.map((r): OpenAgingRow => ({ daysPast: Number(r.days_past), storedOverdue: r.stored, balance: Number(r.balance), count: Number(r.cnt) })),
      debtors: debtors.map((r): DebtorRow => ({ memberId: r.id, memberCode: r.code, name: `${r.first_name} ${r.last_name}`.trim(), outstanding: Number(r.outstanding), invoiceCount: Number(r.cnt) })),
      branches: branches.map((r): InvoiceBranchRow => ({ branchId: r.branch_id, name: r.name, invoiced: Number(r.invoiced), collected: Number(r.collected) })),
    };
  }

  async findById(tenantId: string, id: string): Promise<MemberInvoiceDetailRow | null> {
    return this.db.memberInvoice.findFirst({ where: { tenantId, id }, include: DETAIL_INCLUDE });
  }

  /** Member-plane lookup: ownership is part of the WHERE, so another member's invoice is indistinguishable from a missing one. */
  async findOwnById(tenantId: string, memberId: string, id: string): Promise<MemberInvoiceDetailRow | null> {
    return this.db.memberInvoice.findFirst({ where: { tenantId, memberId, id }, include: DETAIL_INCLUDE });
  }

  async create(
    data: Omit<Prisma.MemberInvoiceUncheckedCreateInput, 'items'>,
    items: InvoiceItemInput[],
  ): Promise<MemberInvoiceDetailRow> {
    let sortOrder = 0;
    const invoice = await this.db.memberInvoice.create({
      data: {
        ...data,
        items: {
          create: items.map((item) => ({
            tenantId: data.tenantId,
            description: item.description,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice,
            amount: (item.quantity ?? 1) * item.unitPrice,
            // eslint-disable-next-line no-plusplus -- simple per-item counter, not a loop-mutation hazard
            sortOrder: sortOrder++,
          })),
        },
      },
    });
    return (await this.findById(data.tenantId, invoice.id))!;
  }

  /** Rewrites a balance invoice to a new remaining amount (single line item, no tax/discount) and reopens it as UNPAID. */
  async resizeBalance(tenantId: string, id: string, amount: number): Promise<void> {
    await this.db.memberInvoiceItem.updateMany({ where: { tenantId, invoiceId: id }, data: { unitPrice: amount, amount, quantity: 1 } });
    await this.db.memberInvoice.update({ where: { id }, data: { subtotal: amount, totalAmount: amount, taxAmount: 0, discountAmount: 0, status: 'UNPAID' } });
  }

  /** Turns an open balance invoice into the itemized receipt for the payment that covers it, marked PAID. */
  async settleWithReceipt(
    tenantId: string,
    id: string,
    items: InvoiceItemInput[],
    taxAmount: number,
    discountAmount: number,
  ): Promise<void> {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity ?? 1) * item.unitPrice, 0);
    await this.db.memberInvoiceItem.deleteMany({ where: { tenantId, invoiceId: id } });
    await this.db.memberInvoiceItem.createMany({
      data: items.map((item, i) => ({
        tenantId,
        invoiceId: id,
        description: item.description,
        quantity: item.quantity ?? 1,
        unitPrice: item.unitPrice,
        amount: (item.quantity ?? 1) * item.unitPrice,
        sortOrder: i,
      })),
    });
    await this.db.memberInvoice.update({
      where: { id },
      data: { subtotal, taxAmount, discountAmount, totalAmount: Math.max(subtotal - discountAmount + taxAmount, 0), status: 'PAID' },
    });
  }

  async setStatus(id: string, status: Prisma.MemberInvoiceUncheckedUpdateInput['status']): Promise<void> {
    await this.db.memberInvoice.update({ where: { id }, data: { status } });
  }

  async findByInvoiceNumber(tenantId: string, invoiceNumber: string) {
    return this.db.memberInvoice.findFirst({ where: { tenantId, invoiceNumber } });
  }

  /** Count-based sequence — a collision just retries with the next number, same pattern as every other auto-numbered entity. */
  async nextInvoiceNumber(tenantId: string, prefix: string): Promise<string> {
    const count = await this.db.memberInvoice.count({ where: { tenantId } });
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = `${prefix}-${String(count + 1 + attempt).padStart(4, '0')}`;
      const existing = await this.findByInvoiceNumber(tenantId, candidate);
      if (!existing) return candidate;
    }
    return `${prefix}-${Date.now()}`;
  }
}
