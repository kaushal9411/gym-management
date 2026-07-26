import type { Prisma, PrismaClient, TenantAnnouncementStatus } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

const INCLUDE = {
  branch: { select: { id: true, name: true } },
  createdByUser: { select: { id: true, name: true } },
} satisfies Prisma.TenantAnnouncementInclude;

export type TenantAnnouncementRow = Prisma.TenantAnnouncementGetPayload<{ include: typeof INCLUDE }>;

export class TenantAnnouncementRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, params: { status?: TenantAnnouncementStatus; skip: number; take: number }) {
    const where = { tenantId, ...(params.status ? { status: params.status } : {}) };
    const [total, items] = await Promise.all([
      this.db.tenantAnnouncement.count({ where }),
      this.db.tenantAnnouncement.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take }),
    ]);
    return { total, items };
  }

  async findById(tenantId: string, id: string): Promise<TenantAnnouncementRow | null> {
    return this.db.tenantAnnouncement.findFirst({ where: { tenantId, id }, include: INCLUDE });
  }

  async create(data: Prisma.TenantAnnouncementUncheckedCreateInput): Promise<TenantAnnouncementRow> {
    const row = await this.db.tenantAnnouncement.create({ data });
    return (await this.findById(data.tenantId, row.id))!;
  }

  async update(id: string, data: Omit<Prisma.TenantAnnouncementUncheckedUpdateInput, 'tenantId'>): Promise<void> {
    await this.db.tenantAnnouncement.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.db.tenantAnnouncement.delete({ where: { id } });
  }

  /** Cross-tenant scan for the BullMQ scheduler sweep — raw `prisma`, same documented pattern as `subscription-billing.jobs.ts`/`scheduled-reports.jobs.ts`. */
  static async findDuePublications(prisma: PrismaClient, before: Date) {
    return prisma.tenantAnnouncement.findMany({ where: { status: 'SCHEDULED', publishAt: { lte: before } } });
  }

  static async findDueExpirations(prisma: PrismaClient, before: Date) {
    return prisma.tenantAnnouncement.findMany({ where: { status: 'PUBLISHED', expiresAt: { lte: before } } });
  }
}
