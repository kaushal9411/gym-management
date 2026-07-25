import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListFoodsQuery } from '../dto/diet.dto';

export type FoodRow = Prisma.FoodGetPayload<Record<string, never>>;

function buildWhere(tenantId: string, query: Partial<ListFoodsQuery>): Prisma.FoodWhereInput {
  const where: Prisma.FoodWhereInput = { tenantId };
  if (!query.includeDeleted) where.deletedAt = null;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.category) where.category = { equals: query.category, mode: 'insensitive' };
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' as const };
    where.OR = [{ name: contains }, { category: contains }];
  }
  return where;
}

export class FoodRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListFoodsQuery): Promise<{ items: FoodRow[]; total: number }> {
    const where = buildWhere(tenantId, query);
    const [items, total] = await Promise.all([
      this.db.food.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.food.count({ where }),
    ]);
    return { items, total };
  }

  /** Unfiltered active-only convenience list — backs the food picker used when building a diet plan's meals. */
  async listActive(tenantId: string): Promise<FoodRow[]> {
    return this.db.food.findMany({ where: { tenantId, deletedAt: null, isActive: true }, orderBy: { name: 'asc' } });
  }

  async findById(tenantId: string, id: string, opts?: { includeDeleted?: boolean }): Promise<FoodRow | null> {
    return this.db.food.findFirst({ where: { tenantId, id, ...(opts?.includeDeleted ? {} : { deletedAt: null }) } });
  }

  async findByName(tenantId: string, name: string): Promise<FoodRow | null> {
    return this.db.food.findFirst({ where: { tenantId, name: { equals: name, mode: 'insensitive' }, deletedAt: null } });
  }

  async create(data: Prisma.FoodUncheckedCreateInput): Promise<FoodRow> {
    return this.db.food.create({ data });
  }

  async update(id: string, data: Omit<Prisma.FoodUncheckedUpdateInput, 'tenantId'>): Promise<void> {
    await this.db.food.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.db.food.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /** Matches the Exercise/Membership Plan/Member/Staff restore convention: bring it back fully usable in one step. */
  async restore(id: string): Promise<void> {
    await this.db.food.update({ where: { id }, data: { deletedAt: null, isActive: true } });
  }
}
