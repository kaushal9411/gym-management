import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListGroupClassesQuery, ScheduleSlotInput } from '../dto/classes.dto';

const LIST_INCLUDE = {
  trainer: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  schedule: { orderBy: { dayOfWeek: 'asc' } },
} satisfies Prisma.GroupClassInclude;

export type GroupClassRow = Prisma.GroupClassGetPayload<{ include: typeof LIST_INCLUDE }>;

function buildWhere(tenantId: string, query: Partial<ListGroupClassesQuery>): Prisma.GroupClassWhereInput {
  const where: Prisma.GroupClassWhereInput = { tenantId };
  if (!query.includeDeleted) where.deletedAt = null;
  if (query.branchId) where.branchId = query.branchId;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
  return where;
}

export class GroupClassRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListGroupClassesQuery): Promise<{ items: GroupClassRow[]; total: number }> {
    const where = buildWhere(tenantId, query);
    const [items, total] = await Promise.all([
      this.db.groupClass.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.groupClass.count({ where }),
    ]);
    return { items, total };
  }

  /** Unfiltered active-only — backs the BullMQ session-generation sweep and any "pick a class" dropdown. */
  async listActive(tenantId: string): Promise<GroupClassRow[]> {
    return this.db.groupClass.findMany({ where: { tenantId, deletedAt: null, isActive: true }, include: LIST_INCLUDE });
  }

  async findById(tenantId: string, id: string, opts?: { includeDeleted?: boolean }): Promise<GroupClassRow | null> {
    return this.db.groupClass.findFirst({ where: { tenantId, id, ...(opts?.includeDeleted ? {} : { deletedAt: null }) }, include: LIST_INCLUDE });
  }

  async findByName(tenantId: string, branchId: string, name: string): Promise<GroupClassRow | null> {
    return this.db.groupClass.findFirst({ where: { tenantId, branchId, name: { equals: name, mode: 'insensitive' }, deletedAt: null }, include: LIST_INCLUDE });
  }

  async create(data: Prisma.GroupClassUncheckedCreateInput): Promise<GroupClassRow> {
    const row = await this.db.groupClass.create({ data });
    return (await this.findById(data.tenantId, row.id, { includeDeleted: true }))!;
  }

  async update(id: string, data: Omit<Prisma.GroupClassUncheckedUpdateInput, 'tenantId'>): Promise<void> {
    await this.db.groupClass.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.db.groupClass.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }

  async restore(id: string): Promise<void> {
    await this.db.groupClass.update({ where: { id }, data: { deletedAt: null, isActive: true } });
  }

  /**
   * Replaces the whole weekly pattern. Sequential awaits, not
   * `$transaction([...])` — same reasoning as `WorkoutPlanRepository#replaceExercises`:
   * the tenant-scoped client already wraps each call in its own transaction.
   */
  async replaceSchedule(tenantId: string, groupClassId: string, slots: ScheduleSlotInput[]): Promise<void> {
    await this.db.groupClassSchedule.deleteMany({ where: { tenantId, groupClassId } });
    for (const slot of slots) {
      // eslint-disable-next-line no-await-in-loop -- bounded (7 days max), order doesn't matter here unlike replaceExercises' sortOrder
      await this.db.groupClassSchedule.create({ data: { tenantId, groupClassId, dayOfWeek: slot.dayOfWeek, startTime: slot.startTime } });
    }
  }
}
