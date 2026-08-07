import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListIncomeQuery } from '../dto/finance.dto';

const INCLUDE = {
  branch: { select: { id: true, name: true } },
  recordedByUser: { select: { id: true, name: true } },
} satisfies Prisma.IncomeInclude;

export type IncomeRow = Prisma.IncomeGetPayload<{ include: typeof INCLUDE }>;

/** `branchId` is nullable on Income (tenant-wide entries) — a branch-restricted actor can still see those, just not another branch's. */
function buildWhere(tenantId: string, query: Partial<ListIncomeQuery>, restrictToBranchIds?: string[]): Prisma.IncomeWhereInput {
  const where: Prisma.IncomeWhereInput = { tenantId };
  if (!query.includeDeleted) where.deletedAt = null;
  if (query.category) where.category = query.category;
  if (restrictToBranchIds) {
    if (query.branchId) {
      where.branchId = restrictToBranchIds.includes(query.branchId) ? query.branchId : { in: [] };
    } else {
      where.OR = [{ branchId: null }, { branchId: { in: restrictToBranchIds } }];
    }
  } else if (query.branchId) {
    where.branchId = query.branchId;
  }
  if (query.dateFrom || query.dateTo) {
    where.incomeDate = {};
    if (query.dateFrom) where.incomeDate.gte = new Date(query.dateFrom);
    if (query.dateTo) where.incomeDate.lte = new Date(query.dateTo);
  }
  if (query.search) where.description = { contains: query.search, mode: 'insensitive' };
  return where;
}

export class IncomeRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListIncomeQuery, restrictToBranchIds?: string[]): Promise<{ items: IncomeRow[]; total: number }> {
    const where = buildWhere(tenantId, query, restrictToBranchIds);
    const [items, total] = await Promise.all([
      this.db.income.findMany({
        where,
        include: INCLUDE,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.income.count({ where }),
    ]);
    return { items, total };
  }

  async findById(tenantId: string, id: string, opts?: { includeDeleted?: boolean }): Promise<IncomeRow | null> {
    return this.db.income.findFirst({ where: { tenantId, id, ...(opts?.includeDeleted ? {} : { deletedAt: null }) }, include: INCLUDE });
  }

  async create(data: Prisma.IncomeUncheckedCreateInput): Promise<IncomeRow> {
    const income = await this.db.income.create({ data });
    return (await this.findById(data.tenantId, income.id, { includeDeleted: true }))!;
  }

  async update(id: string, data: Omit<Prisma.IncomeUncheckedUpdateInput, 'tenantId'>): Promise<void> {
    await this.db.income.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.db.income.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async sumForDateRange(tenantId: string, from: Date, to: Date, branchId?: string): Promise<number> {
    const result = await this.db.income.aggregate({
      where: { tenantId, branchId, deletedAt: null, incomeDate: { gte: from, lte: to } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  async dailyTotalsForRange(tenantId: string, from: Date, to: Date, branchId?: string): Promise<Array<{ date: Date; total: number }>> {
    const rows = await this.db.income.findMany({
      where: { tenantId, branchId, deletedAt: null, incomeDate: { gte: from, lte: to } },
      select: { incomeDate: true, amount: true },
    });
    const byDate = new Map<string, number>();
    for (const row of rows) {
      const key = row.incomeDate.toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) ?? 0) + Number(row.amount));
    }
    return [...byDate.entries()].map(([date, total]) => ({ date: new Date(date), total }));
  }
}
