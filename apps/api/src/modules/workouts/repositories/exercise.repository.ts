import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListExercisesQuery } from '../dto/workout.dto';

export type ExerciseRow = Prisma.ExerciseGetPayload<Record<string, never>>;

function buildWhere(tenantId: string, query: Partial<ListExercisesQuery>): Prisma.ExerciseWhereInput {
  const where: Prisma.ExerciseWhereInput = { tenantId };
  if (!query.includeDeleted) where.deletedAt = null;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.category) where.category = { equals: query.category, mode: 'insensitive' };
  if (query.muscleGroup) where.muscleGroup = { equals: query.muscleGroup, mode: 'insensitive' };
  if (query.difficultyLevel) where.difficultyLevel = query.difficultyLevel;
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' as const };
    where.OR = [{ name: contains }, { category: contains }, { muscleGroup: contains }, { equipment: contains }];
  }
  return where;
}

export class ExerciseRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListExercisesQuery): Promise<{ items: ExerciseRow[]; total: number }> {
    const where = buildWhere(tenantId, query);
    const [items, total] = await Promise.all([
      this.db.exercise.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.exercise.count({ where }),
    ]);
    return { items, total };
  }

  /** Unfiltered active-only convenience list — backs the exercise-picker used when building a plan's weekly schedule. */
  async listActive(tenantId: string): Promise<ExerciseRow[]> {
    return this.db.exercise.findMany({ where: { tenantId, deletedAt: null, isActive: true }, orderBy: { name: 'asc' } });
  }

  async findById(tenantId: string, id: string, opts?: { includeDeleted?: boolean }): Promise<ExerciseRow | null> {
    return this.db.exercise.findFirst({ where: { tenantId, id, ...(opts?.includeDeleted ? {} : { deletedAt: null }) } });
  }

  async findByName(tenantId: string, name: string): Promise<ExerciseRow | null> {
    return this.db.exercise.findFirst({ where: { tenantId, name: { equals: name, mode: 'insensitive' }, deletedAt: null } });
  }

  async findByIds(tenantId: string, ids: string[]): Promise<ExerciseRow[]> {
    return this.db.exercise.findMany({ where: { tenantId, id: { in: ids }, deletedAt: null } });
  }

  async create(data: Prisma.ExerciseUncheckedCreateInput): Promise<ExerciseRow> {
    return this.db.exercise.create({ data });
  }

  async update(id: string, data: Omit<Prisma.ExerciseUncheckedUpdateInput, 'tenantId'>): Promise<void> {
    await this.db.exercise.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.db.exercise.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  /** Matches the Membership Plan / Member / Staff restore convention: bring it back fully usable in one step. */
  async restore(id: string): Promise<void> {
    await this.db.exercise.update({ where: { id }, data: { deletedAt: null, isActive: true } });
  }
}
