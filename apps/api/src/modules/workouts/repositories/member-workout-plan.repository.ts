import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

const ASSIGNMENT_INCLUDE = {
  member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
  workoutPlan: {
    select: {
      id: true,
      name: true,
      level: true,
      durationWeeks: true,
      exercises: { select: { exerciseId: true, dayOfWeek: true, exercise: { select: { name: true } } } },
    },
  },
  progress: true,
} satisfies Prisma.MemberWorkoutPlanInclude;

export type MemberWorkoutPlanRow = Prisma.MemberWorkoutPlanGetPayload<{ include: typeof ASSIGNMENT_INCLUDE }>;

export class MemberWorkoutPlanRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async findActiveByMember(tenantId: string, memberId: string): Promise<MemberWorkoutPlanRow | null> {
    return this.db.memberWorkoutPlan.findFirst({
      where: { tenantId, memberId, status: 'ACTIVE' },
      include: ASSIGNMENT_INCLUDE,
    });
  }

  async findById(tenantId: string, id: string): Promise<MemberWorkoutPlanRow | null> {
    return this.db.memberWorkoutPlan.findFirst({ where: { tenantId, id }, include: ASSIGNMENT_INCLUDE });
  }

  async listByMember(tenantId: string, memberId: string): Promise<MemberWorkoutPlanRow[]> {
    return this.db.memberWorkoutPlan.findMany({
      where: { tenantId, memberId },
      include: ASSIGNMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: Prisma.MemberWorkoutPlanUncheckedCreateInput): Promise<MemberWorkoutPlanRow> {
    const row = await this.db.memberWorkoutPlan.create({ data });
    return (await this.findById(data.tenantId, row.id))!;
  }

  async update(id: string, data: Omit<Prisma.MemberWorkoutPlanUncheckedUpdateInput, 'tenantId'>): Promise<void> {
    await this.db.memberWorkoutPlan.update({ where: { id }, data });
  }

  async setStatus(id: string, status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'): Promise<void> {
    await this.db.memberWorkoutPlan.update({ where: { id }, data: { status } });
  }

  /** Upsert-by-(assignment, exercise) — marking progress again just overwrites the same row. */
  async upsertProgress(
    tenantId: string,
    memberWorkoutPlanId: string,
    exerciseId: string,
    data: { status: 'PENDING' | 'COMPLETED' | 'SKIPPED'; notes?: string },
  ): Promise<void> {
    await this.db.memberWorkoutProgress.upsert({
      where: { memberWorkoutPlanId_exerciseId: { memberWorkoutPlanId, exerciseId } },
      create: { tenantId, memberWorkoutPlanId, exerciseId, status: data.status, notes: data.notes, markedAt: new Date() },
      update: { status: data.status, notes: data.notes, markedAt: new Date() },
    });
  }
}
