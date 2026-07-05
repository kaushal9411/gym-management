import type { TenantNotificationCategory } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class TenantNotificationRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, params: { unreadOnly?: boolean; skip: number; take: number }) {
    const where = { tenantId, ...(params.unreadOnly ? { readAt: null } : {}) };
    const [total, unreadCount, items] = await Promise.all([
      this.db.tenantNotification.count({ where }),
      this.db.tenantNotification.count({ where: { tenantId, readAt: null } }),
      this.db.tenantNotification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take }),
    ]);
    return { total, unreadCount, items };
  }

  async markRead(tenantId: string, id: string): Promise<void> {
    await this.db.tenantNotification.updateMany({ where: { id, tenantId, readAt: null }, data: { readAt: new Date() } });
  }

  async markAllRead(tenantId: string): Promise<void> {
    await this.db.tenantNotification.updateMany({ where: { tenantId, readAt: null }, data: { readAt: new Date() } });
  }

  async create(tenantId: string, input: { category: TenantNotificationCategory; title: string; body: string; sourceNotificationId?: string }) {
    return this.db.tenantNotification.create({ data: { tenantId, ...input } });
  }
}
