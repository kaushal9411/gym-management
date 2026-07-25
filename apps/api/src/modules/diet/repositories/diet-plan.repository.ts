import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListDietPlansQuery, PlanMealInput } from '../dto/diet.dto';

const LIST_INCLUDE = {
  trainer: { select: { id: true, name: true } },
  _count: { select: { members: { where: { status: 'ACTIVE' } } } },
} satisfies Prisma.DietPlanInclude;

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  meals: { include: { food: true }, orderBy: [{ mealType: 'asc' }, { sortOrder: 'asc' }] },
} satisfies Prisma.DietPlanInclude;

export type DietPlanListRow = Prisma.DietPlanGetPayload<{ include: typeof LIST_INCLUDE }>;
export type DietPlanDetailRow = Prisma.DietPlanGetPayload<{ include: typeof DETAIL_INCLUDE }>;

function buildWhere(tenantId: string, query: Partial<ListDietPlansQuery>): Prisma.DietPlanWhereInput {
  const where: Prisma.DietPlanWhereInput = { tenantId };
  if (!query.includeDeleted) where.deletedAt = null;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.trainerId) where.trainerId = query.trainerId;
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' as const };
    where.OR = [{ name: contains }, { goal: contains }, { description: contains }];
  }
  return where;
}

export class DietPlanRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListDietPlansQuery): Promise<{ items: DietPlanListRow[]; total: number }> {
    const where = buildWhere(tenantId, query);
    const [items, total] = await Promise.all([
      this.db.dietPlan.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.dietPlan.count({ where }),
    ]);
    return { items, total };
  }

  /** Unfiltered active-only convenience list — backs the Assign Diet Plan dropdown. */
  async listAssignable(tenantId: string): Promise<DietPlanListRow[]> {
    return this.db.dietPlan.findMany({ where: { tenantId, deletedAt: null, isActive: true }, include: LIST_INCLUDE, orderBy: { name: 'asc' } });
  }

  async findById(tenantId: string, id: string, opts?: { includeDeleted?: boolean }): Promise<DietPlanDetailRow | null> {
    return this.db.dietPlan.findFirst({
      where: { tenantId, id, ...(opts?.includeDeleted ? {} : { deletedAt: null }) },
      include: DETAIL_INCLUDE,
    });
  }

  async findByName(tenantId: string, name: string): Promise<DietPlanDetailRow | null> {
    return this.db.dietPlan.findFirst({ where: { tenantId, name: { equals: name, mode: 'insensitive' }, deletedAt: null }, include: DETAIL_INCLUDE });
  }

  async create(data: Prisma.DietPlanUncheckedCreateInput): Promise<DietPlanDetailRow> {
    const plan = await this.db.dietPlan.create({ data });
    return (await this.findById(data.tenantId, plan.id, { includeDeleted: true }))!;
  }

  async update(id: string, data: Omit<Prisma.DietPlanUncheckedUpdateInput, 'tenantId'>): Promise<void> {
    await this.db.dietPlan.update({ where: { id }, data });
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.db.dietPlan.update({ where: { id }, data: { isActive } });
  }

  async softDelete(id: string): Promise<void> {
    await this.db.dietPlan.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /** Matches the Workout Plan restore convention: bring it back fully usable in one step. */
  async restore(id: string): Promise<void> {
    await this.db.dietPlan.update({ where: { id }, data: { deletedAt: null, isActive: true } });
  }

  /**
   * Replaces the ENTIRE meal builder — array order becomes `sortOrder`
   * within each meal type. Sequential awaits, NOT `$transaction([...])`: the
   * tenant-scoped client already wraps every individual call in its own
   * `set_config` + query transaction (see `getTenantScopedClient`), and
   * nesting a batched `$transaction` on top of that silently drops the
   * writes (a real bug caught live in the Workout Management module) — no
   * repository in this codebase uses `$transaction` for exactly that reason.
   */
  async replaceMeals(tenantId: string, planId: string, meals: PlanMealInput[]): Promise<void> {
    await this.db.dietPlanMeal.deleteMany({ where: { tenantId, planId } });
    const perMealCounter = new Map<string, number>();
    for (const meal of meals) {
      const sortOrder = perMealCounter.get(meal.mealType) ?? 0;
      perMealCounter.set(meal.mealType, sortOrder + 1);
      // eslint-disable-next-line no-await-in-loop -- must preserve array order as sortOrder; safe, tenant-scoped, bounded by the 200-item validator cap
      await this.db.dietPlanMeal.create({
        data: {
          tenantId,
          planId,
          foodId: meal.foodId,
          mealType: meal.mealType,
          sortOrder,
          quantity: meal.quantity ?? 1,
          notes: meal.notes,
        },
      });
    }
  }
}
