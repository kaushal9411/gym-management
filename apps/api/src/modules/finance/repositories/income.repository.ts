import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListIncomeQuery } from '../dto/finance.dto';
import type { LedgerRaw } from '../utils/ledger-analytics.util';
import type { DateRange } from '../utils/payments-analytics.util';

const dayStr = (d: Date): string => d.toISOString().slice(0, 10);

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

  /** Total + count over the FULL filtered set (same where as `list`, ignoring pagination) — backs the list `summary`. */
  async summary(tenantId: string, query: Partial<ListIncomeQuery>, restrictToBranchIds?: string[]): Promise<{ total: number; count: number }> {
    const r = await this.db.income.aggregate({
      where: buildWhere(tenantId, query, restrictToBranchIds),
      _sum: { amount: true },
      _count: { _all: true },
    });
    return { total: Number(r._sum.amount ?? 0), count: r._count._all };
  }

  /** Grouped aggregates for the analytics endpoint — same branch scoping + soft-delete rules as `list`; no rows are loaded beyond the top 5. */
  async analyticsRaw(
    tenantId: string,
    range: DateRange,
    previousRange: DateRange,
    branchId: string | undefined,
    restrictToBranchIds: string[] | undefined,
    otherTotal: { current: number; previous: number },
  ): Promise<LedgerRaw> {
    const scoped = (r: DateRange) => buildWhere(tenantId, { branchId, dateFrom: r.from, dateTo: r.to }, restrictToBranchIds);
    const curWhere = scoped(range);
    const prevWhere = scoped(previousRange);
    const spanWhere = buildWhere(tenantId, { branchId, dateFrom: previousRange.from, dateTo: range.to }, restrictToBranchIds);
    const sums = { _sum: { amount: true }, _count: { _all: true } } as const;

    const [days, catCur, catPrev, brCur, brPrev, top] = await Promise.all([
      this.db.income.groupBy({ by: ['incomeDate'], where: spanWhere, ...sums }),
      this.db.income.groupBy({ by: ['category'], where: curWhere, ...sums }),
      this.db.income.groupBy({ by: ['category'], where: prevWhere, ...sums }),
      this.db.income.groupBy({
        by: ['branchId'],
        where: { AND: [curWhere, { branchId: { not: null } }] },
        _sum: { amount: true },
      }),
      this.db.income.groupBy({
        by: ['branchId'],
        where: { AND: [prevWhere, { branchId: { not: null } }] },
        _sum: { amount: true },
      }),
      this.db.income.findMany({
        where: curWhere,
        orderBy: [{ amount: 'desc' }, { incomeDate: 'desc' }, { id: 'asc' }],
        take: 5,
        select: { id: true, description: true, category: true, amount: true, incomeDate: true },
      }),
    ]);

    const branchIds = [...new Set([...brCur, ...brPrev].map((b) => b.branchId).filter((id): id is string => id !== null))];
    const branchRows = branchIds.length
      ? await this.db.branch.findMany({
          where: { tenantId, id: { in: branchIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = new Map(branchRows.map((b) => [b.id, b.name]));
    const curMap = new Map(brCur.map((b) => [b.branchId, Number(b._sum.amount ?? 0)]));
    const prevMap = new Map(brPrev.map((b) => [b.branchId, Number(b._sum.amount ?? 0)]));
    const catRow = (r: (typeof catCur)[number]) => ({
      category: r.category as string,
      amount: Number(r._sum.amount ?? 0),
      count: r._count._all,
    });

    return {
      kind: 'income',
      range,
      previousRange,
      dayRows: days.map((r) => ({
        date: dayStr(r.incomeDate),
        amount: Number(r._sum.amount ?? 0),
        count: r._count._all,
      })),
      categoriesCurrent: catCur.map(catRow),
      categoriesPrevious: catPrev.map(catRow),
      branches: branchIds.map((id) => ({
        branchId: id,
        name: nameOf.get(id) ?? 'Unknown',
        total: curMap.get(id) ?? 0,
        previousTotal: prevMap.get(id) ?? 0,
      })),
      topEntries: top.map((e) => ({
        id: e.id,
        description: e.description,
        category: e.category as string,
        amount: Number(e.amount),
        date: dayStr(e.incomeDate),
      })),
      otherTotal,
    };
  }

  /** Total of this ledger for a range with the same branch scoping — used for the opposite page's netProfit. */
  async scopedTotal(tenantId: string, range: DateRange, branchId: string | undefined, restrictToBranchIds?: string[]): Promise<number> {
    const r = await this.db.income.aggregate({
      where: buildWhere(tenantId, { branchId, dateFrom: range.from, dateTo: range.to }, restrictToBranchIds),
      _sum: { amount: true },
    });
    return Number(r._sum.amount ?? 0);
  }

  async findById(tenantId: string, id: string, opts?: { includeDeleted?: boolean }): Promise<IncomeRow | null> {
    return this.db.income.findFirst({
      where: { tenantId, id, ...(opts?.includeDeleted ? {} : { deletedAt: null }) },
      include: INCLUDE,
    });
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
