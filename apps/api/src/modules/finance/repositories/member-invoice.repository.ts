import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { InvoiceItemInput, ListInvoicesQuery } from '../dto/finance.dto';

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
  if (query.status) where.status = query.status;
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

  async findById(tenantId: string, id: string): Promise<MemberInvoiceDetailRow | null> {
    return this.db.memberInvoice.findFirst({ where: { tenantId, id }, include: DETAIL_INCLUDE });
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
