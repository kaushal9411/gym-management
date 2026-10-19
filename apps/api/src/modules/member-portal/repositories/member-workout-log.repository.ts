import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

const LOG_INCLUDE = {
  exercise: { select: { id: true, name: true, muscleGroup: true } },
} satisfies Prisma.MemberWorkoutDailyLogInclude;

export type WorkoutLogRow = Prisma.MemberWorkoutDailyLogGetPayload<{ include: typeof LOG_INCLUDE }>;
export type WorkoutSessionRow = Prisma.MemberWorkoutSessionLogGetPayload<object>;

/** Data access for the member's daily workout log + session metadata (member-plane only). */
export class MemberWorkoutLogRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  // ── plan schedule ────────────────────────────────────────────────────────

  async planSchedule(tenantId: string, planId: string) {
    return this.db.workoutPlanExercise.findMany({
      where: { tenantId, planId },
      orderBy: [{ dayOfWeek: 'asc' }, { sortOrder: 'asc' }],
      select: {
        exerciseId: true,
        dayOfWeek: true,
        sortOrder: true,
        sets: true,
        repetitions: true,
        restSeconds: true,
        notes: true,
        exercise: { select: { name: true, muscleGroup: true, defaultSets: true, defaultReps: true, restSeconds: true } },
      },
    });
  }

  // ── daily logs ───────────────────────────────────────────────────────────

  async findById(tenantId: string, id: string): Promise<WorkoutLogRow | null> {
    return this.db.memberWorkoutDailyLog.findFirst({ where: { tenantId, id }, include: LOG_INCLUDE });
  }

  async findByKey(
    tenantId: string,
    memberWorkoutPlanId: string,
    exerciseId: string,
    logDate: Date,
  ): Promise<WorkoutLogRow | null> {
    return this.db.memberWorkoutDailyLog.findFirst({
      where: { tenantId, memberWorkoutPlanId, exerciseId, logDate },
      include: LOG_INCLUDE,
    });
  }

  async create(data: Prisma.MemberWorkoutDailyLogUncheckedCreateInput): Promise<WorkoutLogRow> {
    return this.db.memberWorkoutDailyLog.create({ data, include: LOG_INCLUDE });
  }

  async update(id: string, data: Prisma.MemberWorkoutDailyLogUncheckedUpdateInput): Promise<WorkoutLogRow> {
    return this.db.memberWorkoutDailyLog.update({ where: { id }, data, include: LOG_INCLUDE });
  }

  async delete(id: string): Promise<void> {
    await this.db.memberWorkoutDailyLog.delete({ where: { id } });
  }

  async listRange(tenantId: string, memberId: string, from: Date, to: Date): Promise<WorkoutLogRow[]> {
    return this.db.memberWorkoutDailyLog.findMany({
      where: { tenantId, memberId, logDate: { gte: from, lte: to } },
      include: LOG_INCLUDE,
      orderBy: [{ logDate: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async listForDay(tenantId: string, memberId: string, logDate: Date): Promise<WorkoutLogRow[]> {
    return this.db.memberWorkoutDailyLog.findMany({ where: { tenantId, memberId, logDate }, include: LOG_INCLUDE });
  }

  /** Every COMPLETED entry that carries a weight (all time) - feeds the personal bests. Capped for safety. */
  async listWeighted(tenantId: string, memberId: string): Promise<WorkoutLogRow[]> {
    return this.db.memberWorkoutDailyLog.findMany({
      where: { tenantId, memberId, status: 'COMPLETED', weightKg: { not: null } },
      include: LOG_INCLUDE,
      orderBy: { logDate: 'asc' },
      take: 5000,
    });
  }

  async count(tenantId: string, memberId: string): Promise<number> {
    return this.db.memberWorkoutDailyLog.count({ where: { tenantId, memberId } });
  }

  async latestForExercise(
    tenantId: string,
    memberWorkoutPlanId: string,
    exerciseId: string,
  ): Promise<WorkoutLogRow | null> {
    return this.db.memberWorkoutDailyLog.findFirst({
      where: { tenantId, memberWorkoutPlanId, exerciseId },
      include: LOG_INCLUDE,
      orderBy: [{ logDate: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async deleteForDay(tenantId: string, memberId: string, logDate: Date): Promise<void> {
    await this.db.memberWorkoutDailyLog.deleteMany({ where: { tenantId, memberId, logDate } });
  }

  // ── session metadata ─────────────────────────────────────────────────────

  async findSession(tenantId: string, memberId: string, logDate: Date): Promise<WorkoutSessionRow | null> {
    return this.db.memberWorkoutSessionLog.findFirst({ where: { tenantId, memberId, logDate } });
  }

  async createSession(data: Prisma.MemberWorkoutSessionLogUncheckedCreateInput): Promise<WorkoutSessionRow> {
    return this.db.memberWorkoutSessionLog.create({ data });
  }

  async updateSession(id: string, data: Prisma.MemberWorkoutSessionLogUncheckedUpdateInput): Promise<WorkoutSessionRow> {
    return this.db.memberWorkoutSessionLog.update({ where: { id }, data });
  }

  async deleteSessionForDay(tenantId: string, memberId: string, logDate: Date): Promise<void> {
    await this.db.memberWorkoutSessionLog.deleteMany({ where: { tenantId, memberId, logDate } });
  }

  async listSessions(tenantId: string, memberId: string, from: Date, to: Date): Promise<WorkoutSessionRow[]> {
    return this.db.memberWorkoutSessionLog.findMany({
      where: { tenantId, memberId, logDate: { gte: from, lte: to } },
      orderBy: { logDate: 'desc' },
    });
  }

  // ── legacy progress mirror ───────────────────────────────────────────────

  /** No log left for the exercise: put the legacy per-assignment status back to PENDING (only if a row exists). */
  async resetProgress(tenantId: string, memberWorkoutPlanId: string, exerciseId: string): Promise<void> {
    await this.db.memberWorkoutProgress.updateMany({
      where: { tenantId, memberWorkoutPlanId, exerciseId },
      data: { status: 'PENDING', markedAt: null },
    });
  }
}
