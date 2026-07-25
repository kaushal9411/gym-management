import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

const ASSIGNMENT_INCLUDE = {
  member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
  dietPlan: { select: { id: true, name: true, dailyCalories: true, durationDays: true, meals: { select: { mealType: true } } } },
  dailyLogs: { orderBy: { date: 'desc' } },
} satisfies Prisma.MemberDietPlanInclude;

export type MemberDietPlanRow = Prisma.MemberDietPlanGetPayload<{ include: typeof ASSIGNMENT_INCLUDE }>;

export class MemberDietPlanRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async findActiveByMember(tenantId: string, memberId: string): Promise<MemberDietPlanRow | null> {
    return this.db.memberDietPlan.findFirst({
      where: { tenantId, memberId, status: 'ACTIVE' },
      include: ASSIGNMENT_INCLUDE,
    });
  }

  async findById(tenantId: string, id: string): Promise<MemberDietPlanRow | null> {
    return this.db.memberDietPlan.findFirst({ where: { tenantId, id }, include: ASSIGNMENT_INCLUDE });
  }

  async listByMember(tenantId: string, memberId: string): Promise<MemberDietPlanRow[]> {
    return this.db.memberDietPlan.findMany({
      where: { tenantId, memberId },
      include: ASSIGNMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: Prisma.MemberDietPlanUncheckedCreateInput): Promise<MemberDietPlanRow> {
    const row = await this.db.memberDietPlan.create({ data });
    return (await this.findById(data.tenantId, row.id))!;
  }

  async update(id: string, data: Omit<Prisma.MemberDietPlanUncheckedUpdateInput, 'tenantId'>): Promise<void> {
    await this.db.memberDietPlan.update({ where: { id }, data });
  }

  async setStatus(id: string, status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'): Promise<void> {
    await this.db.memberDietPlan.update({ where: { id }, data: { status } });
  }

  /** Upsert-by-(assignment, date) — logging progress again for the same date just overwrites the row. */
  async upsertDailyLog(
    tenantId: string,
    memberDietPlanId: string,
    date: Date,
    data: { waterIntakeMl?: number; weightKg?: number; mealsStatus?: Prisma.InputJsonValue; notes?: string },
  ): Promise<void> {
    await this.db.memberDietDailyLog.upsert({
      where: { memberDietPlanId_date: { memberDietPlanId, date } },
      create: {
        tenantId,
        memberDietPlanId,
        date,
        waterIntakeMl: data.waterIntakeMl,
        weightKg: data.weightKg,
        mealsStatus: data.mealsStatus,
        notes: data.notes,
      },
      update: {
        waterIntakeMl: data.waterIntakeMl,
        weightKg: data.weightKg,
        mealsStatus: data.mealsStatus,
        notes: data.notes,
      },
    });
  }
}
