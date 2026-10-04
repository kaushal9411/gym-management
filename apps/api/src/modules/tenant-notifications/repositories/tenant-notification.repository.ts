import { Prisma, type TenantNotificationCategory } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class TenantNotificationRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(
    tenantId: string,
    params: {
      unreadOnly?: boolean;
      category?: TenantNotificationCategory;
      search?: string;
      skip: number;
      take: number;
    },
  ) {
    const filter: Prisma.TenantNotificationWhereInput = {
      tenantId,
      ...(params.category ? { category: params.category } : {}),
      ...(params.search
        ? {
            OR: [
              { title: { contains: params.search, mode: 'insensitive' } },
              { body: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const where = { ...filter, ...(params.unreadOnly ? { readAt: null } : {}) };
    const [total, unreadCount, all, unread, items] = await Promise.all([
      this.db.tenantNotification.count({ where }),
      this.db.tenantNotification.count({ where: { tenantId, readAt: null } }),
      this.db.tenantNotification.count({ where: filter }),
      this.db.tenantNotification.count({ where: { ...filter, readAt: null } }),
      this.db.tenantNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
    ]);
    return { total, unreadCount, counts: { all, unread }, items };
  }

  /** Raw SQL must set the RLS tenant variable itself — the scoped client only wraps model operations. */
  private async rawScoped<T>(tenantId: string, query: Prisma.Sql): Promise<T[]> {
    const [, rows] = await this.db.$transaction([
      this.db.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      this.db.$queryRaw<T[]>(query),
    ]);
    return rows as T[];
  }

  /** Per-(UTC day, category) totals over [spanFrom, spanToExclusive) — `read` = rows created that day that are read now. */
  async statsDayCategory(tenantId: string, spanFrom: Date, spanToExclusive: Date) {
    return this.rawScoped<{ date: string; category: string; total: number; read: number }>(
      tenantId,
      Prisma.sql`SELECT to_char(created_at, 'YYYY-MM-DD') AS date, category::text AS category, COUNT(*)::int AS total, COUNT(read_at)::int AS read
        FROM tenant_notifications
        WHERE tenant_id = ${tenantId}::uuid AND created_at >= ${spanFrom} AND created_at < ${spanToExclusive}
        GROUP BY 1, 2`,
    );
  }

  async statsHourly(tenantId: string, from: Date, toExclusive: Date) {
    return this.rawScoped<{ hour: number; count: number }>(
      tenantId,
      Prisma.sql`SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS count
        FROM tenant_notifications
        WHERE tenant_id = ${tenantId}::uuid AND created_at >= ${from} AND created_at < ${toExclusive}
        GROUP BY 1`,
    );
  }

  async markRead(tenantId: string, id: string): Promise<void> {
    await this.db.tenantNotification.updateMany({
      where: { id, tenantId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(tenantId: string): Promise<void> {
    await this.db.tenantNotification.updateMany({
      where: { tenantId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async create(
    tenantId: string,
    input: {
      category: TenantNotificationCategory;
      title: string;
      body: string;
      sourceNotificationId?: string;
    },
  ) {
    return this.db.tenantNotification.create({ data: { tenantId, ...input } });
  }

  async findById(tenantId: string, id: string) {
    return this.db.tenantNotification.findFirst({ where: { id, tenantId } });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.db.tenantNotification.deleteMany({ where: { id, tenantId } });
  }

  async countUnread(tenantId: string): Promise<number> {
    return this.db.tenantNotification.count({ where: { tenantId, readAt: null } });
  }
}
