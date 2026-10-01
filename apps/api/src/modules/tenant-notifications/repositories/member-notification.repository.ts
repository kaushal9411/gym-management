import type { TenantNotificationCategory } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class MemberNotificationRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, memberId: string, params: { unreadOnly?: boolean; skip: number; take: number }) {
    const where = { tenantId, memberId, ...(params.unreadOnly ? { readAt: null } : {}) };
    const [total, unreadCount, items] = await Promise.all([
      this.db.memberNotification.count({ where }),
      this.db.memberNotification.count({ where: { tenantId, memberId, readAt: null } }),
      this.db.memberNotification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take }),
    ]);
    return { total, unreadCount, items };
  }

  async markRead(tenantId: string, memberId: string, id: string): Promise<void> {
    await this.db.memberNotification.updateMany({ where: { id, tenantId, memberId, readAt: null }, data: { readAt: new Date() } });
  }

  async markAllRead(tenantId: string, memberId: string): Promise<void> {
    await this.db.memberNotification.updateMany({ where: { tenantId, memberId, readAt: null }, data: { readAt: new Date() } });
  }

  async countUnread(tenantId: string, memberId: string): Promise<number> {
    return this.db.memberNotification.count({ where: { tenantId, memberId, readAt: null } });
  }

  async create(tenantId: string, memberId: string, input: { category: TenantNotificationCategory; title: string; body: string }) {
    return this.db.memberNotification.create({ data: { tenantId, memberId, ...input } });
  }

  /** Announcement bulk fan-out — one row per targeted member, so each has their own read/unread state. */
  async createManyForMembers(tenantId: string, memberIds: string[], input: { category: TenantNotificationCategory; title: string; body: string }): Promise<void> {
    if (memberIds.length === 0) return;
    await this.db.memberNotification.createMany({
      data: memberIds.map((memberId) => ({ tenantId, memberId, ...input })),
    });
  }
}
