import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListExpensesQuery } from '../dto/finance.dto';

const INCLUDE = {
  branch: { select: { id: true, name: true } },
  recordedByUser: { select: { id: true, name: true } },
} satisfies Prisma.ExpenseInclude;

export type ExpenseRow = Prisma.ExpenseGetPayload<{ include: typeof INCLUDE }>;

function buildWhere(tenantId: string, query: Partial<ListExpensesQuery>): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = { tenantId };
  if (!query.includeDeleted) where.deletedAt = null;
  if (query.category) where.category = query.category;
  if (query.branchId) where.branchId = query.branchId;
  if (query.dateFrom || query.dateTo) {
    where.expenseDate = {};
    if (query.dateFrom) where.expenseDate.gte = new Date(query.dateFrom);
    if (query.dateTo) where.expenseDate.lte = new Date(query.dateTo);
  }
  if (query.search) where.description = { contains: query.search, mode: 'insensitive' };
  return where;
}

export class ExpenseRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListExpensesQuery): Promise<{ items: ExpenseRow[]; total: number }> {
    const where = buildWhere(tenantId, query);
    const [items, total] = await Promise.all([
      this.db.expense.findMany({
        where,
        include: INCLUDE,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.expense.count({ where }),
    ]);
    return { items, total };
  }

  async findById(tenantId: string, id: string, opts?: { includeDeleted?: boolean }): Promise<ExpenseRow | null> {
    return this.db.expense.findFirst({ where: { tenantId, id, ...(opts?.includeDeleted ? {} : { deletedAt: null }) }, include: INCLUDE });
  }

  async create(data: Prisma.ExpenseUncheckedCreateInput): Promise<ExpenseRow> {
    const expense = await this.db.expense.create({ data });
    return (await this.findById(data.tenantId, expense.id, { includeDeleted: true }))!;
  }

  async update(id: string, data: Omit<Prisma.ExpenseUncheckedUpdateInput, 'tenantId'>): Promise<void> {
    await this.db.expense.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.db.expense.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async sumForDateRange(tenantId: string, from: Date, to: Date, branchId?: string): Promise<number> {
    const result = await this.db.expense.aggregate({
      where: { tenantId, branchId, deletedAt: null, expenseDate: { gte: from, lte: to } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  async dailyTotalsForRange(tenantId: string, from: Date, to: Date, branchId?: string): Promise<Array<{ date: Date; total: number }>> {
    const rows = await this.db.expense.findMany({
      where: { tenantId, branchId, deletedAt: null, expenseDate: { gte: from, lte: to } },
      select: { expenseDate: true, amount: true },
    });
    const byDate = new Map<string, number>();
    for (const row of rows) {
      const key = row.expenseDate.toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) ?? 0) + Number(row.amount));
    }
    return [...byDate.entries()].map(([date, total]) => ({ date: new Date(date), total }));
  }
}
