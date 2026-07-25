import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListWorkoutPlansQuery, PlanExerciseInput } from '../dto/workout.dto';

const LIST_INCLUDE = {
  trainer: { select: { id: true, name: true } },
  _count: { select: { members: { where: { status: 'ACTIVE' } } } },
} satisfies Prisma.WorkoutPlanInclude;

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  exercises: { include: { exercise: true }, orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }] },
} satisfies Prisma.WorkoutPlanInclude;

export type WorkoutPlanListRow = Prisma.WorkoutPlanGetPayload<{ include: typeof LIST_INCLUDE }>;
export type WorkoutPlanDetailRow = Prisma.WorkoutPlanGetPayload<{ include: typeof DETAIL_INCLUDE }>;

function buildWhere(tenantId: string, query: Partial<ListWorkoutPlansQuery>): Prisma.WorkoutPlanWhereInput {
  const where: Prisma.WorkoutPlanWhereInput = { tenantId };
  if (!query.includeDeleted) where.deletedAt = null;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.level) where.level = query.level;
  if (query.trainerId) where.trainerId = query.trainerId;
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' as const };
    where.OR = [{ name: contains }, { goal: contains }, { description: contains }];
  }
  return where;
}

export class WorkoutPlanRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListWorkoutPlansQuery): Promise<{ items: WorkoutPlanListRow[]; total: number }> {
    const where = buildWhere(tenantId, query);
    const [items, total] = await Promise.all([
      this.db.workoutPlan.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.workoutPlan.count({ where }),
    ]);
    return { items, total };
  }

  /** Unfiltered active-only convenience list — backs the Assign Workout Plan dropdown. */
  async listAssignable(tenantId: string): Promise<WorkoutPlanListRow[]> {
    return this.db.workoutPlan.findMany({ where: { tenantId, deletedAt: null, isActive: true }, include: LIST_INCLUDE, orderBy: { name: 'asc' } });
  }

  async findById(tenantId: string, id: string, opts?: { includeDeleted?: boolean }): Promise<WorkoutPlanDetailRow | null> {
    return this.db.workoutPlan.findFirst({
      where: { tenantId, id, ...(opts?.includeDeleted ? {} : { deletedAt: null }) },
      include: DETAIL_INCLUDE,
    });
  }

  async findByName(tenantId: string, name: string): Promise<WorkoutPlanDetailRow | null> {
    return this.db.workoutPlan.findFirst({ where: { tenantId, name: { equals: name, mode: 'insensitive' }, deletedAt: null }, include: DETAIL_INCLUDE });
  }

  async create(data: Prisma.WorkoutPlanUncheckedCreateInput): Promise<WorkoutPlanDetailRow> {
    const plan = await this.db.workoutPlan.create({ data });
    return (await this.findById(data.tenantId, plan.id, { includeDeleted: true }))!;
  }

  async update(id: string, data: Omit<Prisma.WorkoutPlanUncheckedUpdateInput, 'tenantId'>): Promise<void> {
    await this.db.workoutPlan.update({ where: { id }, data });
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.db.workoutPlan.update({ where: { id }, data: { isActive } });
  }

  async softDelete(id: string): Promise<void> {
    await this.db.workoutPlan.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /** Matches the Membership Plan restore convention: bring it back fully usable in one step. */
  async restore(id: string): Promise<void> {
    await this.db.workoutPlan.update({ where: { id }, data: { deletedAt: null, isActive: true } });
  }

  /**
   * Replaces the ENTIRE weekly schedule — array order becomes `sortOrder`
   * within each day (drag-and-drop persistence). Sequential awaits, NOT
   * `$transaction([...])`: the tenant-scoped client already wraps every
   * individual call in its own `set_config` + query transaction (see
   * `getTenantScopedClient`), and nesting a batched `$transaction` on top of
   * that silently drops the writes — no other repository in this codebase
   * uses `$transaction` for exactly that reason.
   */
  async replaceExercises(tenantId: string, planId: string, exercises: PlanExerciseInput[]): Promise<void> {
    await this.db.workoutPlanExercise.deleteMany({ where: { tenantId, planId } });
    const perDayCounter = new Map<string, number>();
    for (const ex of exercises) {
      const sortOrder = perDayCounter.get(ex.dayOfWeek) ?? 0;
      perDayCounter.set(ex.dayOfWeek, sortOrder + 1);
      // eslint-disable-next-line no-await-in-loop -- must preserve array order as sortOrder; safe, tenant-scoped, bounded by the 200-item validator cap
      await this.db.workoutPlanExercise.create({
        data: {
          tenantId,
          planId,
          exerciseId: ex.exerciseId,
          dayOfWeek: ex.dayOfWeek,
          sortOrder,
          sets: ex.sets,
          repetitions: ex.repetitions,
          restSeconds: ex.restSeconds,
          notes: ex.notes,
        },
      });
    }
  }
}
