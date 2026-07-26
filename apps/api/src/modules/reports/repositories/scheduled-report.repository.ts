import type { Prisma, PrismaClient } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

const INCLUDE = {
  branch: { select: { id: true, name: true } },
} satisfies Prisma.ScheduledReportInclude;

export type ScheduledReportRow = Prisma.ScheduledReportGetPayload<{ include: typeof INCLUDE }>;

export class ScheduledReportRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string): Promise<ScheduledReportRow[]> {
    return this.db.scheduledReport.findMany({ where: { tenantId }, include: INCLUDE, orderBy: { createdAt: 'desc' } });
  }

  async findById(tenantId: string, id: string): Promise<ScheduledReportRow | null> {
    return this.db.scheduledReport.findFirst({ where: { tenantId, id }, include: INCLUDE });
  }

  async create(data: Prisma.ScheduledReportUncheckedCreateInput): Promise<ScheduledReportRow> {
    const row = await this.db.scheduledReport.create({ data });
    return (await this.findById(data.tenantId, row.id))!;
  }

  async update(id: string, data: Omit<Prisma.ScheduledReportUncheckedUpdateInput, 'tenantId'>): Promise<void> {
    await this.db.scheduledReport.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.db.scheduledReport.delete({ where: { id } });
  }

  /** Cross-tenant scan for the BullMQ job — due, active schedules across every tenant. Raw `prisma` (platform-wide job, same documented pattern as `subscription-billing.jobs.ts`). */
  static async findDueAcrossTenants(prisma: PrismaClient, before: Date) {
    return prisma.scheduledReport.findMany({
      where: { isActive: true, nextRunAt: { lte: before } },
      include: { tenant: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
    });
  }
}
