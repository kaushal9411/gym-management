import {
  Prisma,
  type PrismaClient,
  type TenantAnnouncementAudience,
  type TenantAnnouncementStatus,
} from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

const INCLUDE = {
  branch: { select: { id: true, name: true } },
  createdByUser: { select: { id: true, name: true } },
} satisfies Prisma.TenantAnnouncementInclude;

export type TenantAnnouncementRow = Prisma.TenantAnnouncementGetPayload<{
  include: typeof INCLUDE;
}>;

export class TenantAnnouncementRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(
    tenantId: string,
    params: {
      status?: TenantAnnouncementStatus;
      audience?: TenantAnnouncementAudience;
      search?: string;
      skip: number;
      take: number;
    },
  ) {
    const filter: Prisma.TenantAnnouncementWhereInput = {
      tenantId,
      ...(params.audience ? { audience: params.audience } : {}),
      ...(params.search ? { title: { contains: params.search, mode: 'insensitive' } } : {}),
    };
    const where = { ...filter, ...(params.status ? { status: params.status } : {}) };
    const [total, grouped, items] = await Promise.all([
      this.db.tenantAnnouncement.count({ where }),
      this.db.tenantAnnouncement.groupBy({ by: ['status'], where: filter, _count: { _all: true } }),
      this.db.tenantAnnouncement.findMany({
        where,
        include: INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
    ]);
    const n = (s: TenantAnnouncementStatus) =>
      grouped.find((g) => g.status === s)?._count._all ?? 0;
    const counts = {
      all: grouped.reduce((a, g) => a + g._count._all, 0),
      draft: n('DRAFT'),
      scheduled: n('SCHEDULED'),
      published: n('PUBLISHED'),
      expired: n('EXPIRED'),
    };
    return { total, counts, items };
  }

  /** Raw SQL must set the RLS tenant variable itself — the scoped client only wraps model operations. */
  async statsDayAudience(tenantId: string, spanFrom: Date, spanToExclusive: Date) {
    const [, rows] = await this.db.$transaction([
      this.db.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      this.db.$queryRaw<Array<{ date: string; audience: string; count: number }>>(
        Prisma.sql`SELECT to_char(published_at, 'YYYY-MM-DD') AS date, audience::text AS audience, COUNT(*)::int AS count
          FROM tenant_announcements
          WHERE tenant_id = ${tenantId}::uuid AND published_at >= ${spanFrom} AND published_at < ${spanToExclusive}
          GROUP BY 1, 2`,
      ),
    ]);
    return rows;
  }

  async statusCounts(tenantId: string) {
    const grouped = await this.db.tenantAnnouncement.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
    });
    return grouped.map((g) => ({ status: g.status as string, count: g._count._all }));
  }

  async countExpiringSoon(tenantId: string, from: Date, to: Date) {
    return this.db.tenantAnnouncement.count({
      where: { tenantId, status: 'PUBLISHED', expiresAt: { gte: from, lte: to } },
    });
  }

  async publishedByBranch(tenantId: string, from: Date, toExclusive: Date) {
    const grouped = await this.db.tenantAnnouncement.groupBy({
      by: ['branchId'],
      where: { tenantId, branchId: { not: null }, publishedAt: { gte: from, lt: toExclusive } },
      _count: { _all: true },
    });
    const ids = grouped.map((g) => g.branchId!).filter(Boolean);
    const branches = ids.length
      ? await this.db.branch.findMany({
          where: { tenantId, id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const names = new Map(branches.map((b) => [b.id, b.name]));
    return grouped
      .map((g) => ({
        branchId: g.branchId!,
        name: names.get(g.branchId!) ?? 'Unknown',
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  async upcoming(tenantId: string, take: number) {
    return this.db.tenantAnnouncement.findMany({
      where: { tenantId, status: 'SCHEDULED', publishAt: { not: null } },
      orderBy: { publishAt: 'asc' },
      take,
      select: { id: true, title: true, audience: true, publishAt: true },
    });
  }

  async expiring(tenantId: string, take: number) {
    return this.db.tenantAnnouncement.findMany({
      where: { tenantId, status: 'PUBLISHED', expiresAt: { not: null } },
      orderBy: { expiresAt: 'asc' },
      take,
      select: { id: true, title: true, audience: true, expiresAt: true },
    });
  }

  async recentPublished(tenantId: string, take: number) {
    return this.db.tenantAnnouncement.findMany({
      where: { tenantId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take,
      select: { id: true, title: true, audience: true, publishedAt: true },
    });
  }

  async findById(tenantId: string, id: string): Promise<TenantAnnouncementRow | null> {
    return this.db.tenantAnnouncement.findFirst({ where: { tenantId, id }, include: INCLUDE });
  }

  async create(
    data: Prisma.TenantAnnouncementUncheckedCreateInput,
  ): Promise<TenantAnnouncementRow> {
    const row = await this.db.tenantAnnouncement.create({ data });
    return (await this.findById(data.tenantId, row.id))!;
  }

  async update(
    id: string,
    data: Omit<Prisma.TenantAnnouncementUncheckedUpdateInput, 'tenantId'>,
  ): Promise<void> {
    await this.db.tenantAnnouncement.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.db.tenantAnnouncement.delete({ where: { id } });
  }

  /** Cross-tenant scan for the BullMQ scheduler sweep — raw `prisma`, same documented pattern as `subscription-billing.jobs.ts`/`scheduled-reports.jobs.ts`. */
  static async findDuePublications(prisma: PrismaClient, before: Date) {
    return prisma.tenantAnnouncement.findMany({
      where: { status: 'SCHEDULED', publishAt: { lte: before } },
    });
  }

  static async findDueExpirations(prisma: PrismaClient, before: Date) {
    return prisma.tenantAnnouncement.findMany({
      where: { status: 'PUBLISHED', expiresAt: { lte: before } },
    });
  }
}
