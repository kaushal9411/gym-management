import type { TenantNotificationCategory } from '@prisma/client';

import { NotFoundError } from '../../../core/errors/app-error';
import { prisma } from '../../../infrastructure/database/prisma';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { emitToTenant } from '../../../infrastructure/realtime/socket-server';
import { TenantNotificationRepository } from '../repositories/tenant-notification.repository';

export class TenantNotificationService {
  async list(tenantId: string, params: { unreadOnly?: boolean; page: number; limit: number }) {
    const repository = new TenantNotificationRepository(getTenantScopedClient(tenantId));
    const skip = (params.page - 1) * params.limit;
    const { total, unreadCount, items } = await repository.list(tenantId, { unreadOnly: params.unreadOnly, skip, take: params.limit });
    return { items, unreadCount, page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) };
  }

  async getById(tenantId: string, id: string) {
    const repository = new TenantNotificationRepository(getTenantScopedClient(tenantId));
    const notification = await repository.findById(tenantId, id);
    if (!notification) throw new NotFoundError('Notification not found.');
    return notification;
  }

  async unreadCount(tenantId: string): Promise<{ unreadCount: number }> {
    const repository = new TenantNotificationRepository(getTenantScopedClient(tenantId));
    return { unreadCount: await repository.countUnread(tenantId) };
  }

  /** Manual "Create Notification" — an ad-hoc staff-authored notice, distinct from the business-event triggers in `notification-trigger.service.ts`. */
  async create(tenantId: string, input: { category: TenantNotificationCategory; title: string; body: string }) {
    const repository = new TenantNotificationRepository(getTenantScopedClient(tenantId));
    const notification = await repository.create(tenantId, input);
    emitToTenant(tenantId, 'notification:new', notification);
    return notification;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.getById(tenantId, id);
    const repository = new TenantNotificationRepository(getTenantScopedClient(tenantId));
    await repository.remove(tenantId, id);
  }

  async markRead(tenantId: string, id: string): Promise<void> {
    const repository = new TenantNotificationRepository(getTenantScopedClient(tenantId));
    await repository.markRead(tenantId, id);
  }

  async markAllRead(tenantId: string): Promise<void> {
    const repository = new TenantNotificationRepository(getTenantScopedClient(tenantId));
    await repository.markAllRead(tenantId);
  }

  /**
   * One-tenant fan-out, used by lifecycle event listeners/jobs that already
   * have a single tenantId in hand (billing emails, subscription jobs) —
   * writes through the normal tenant-scoped/RLS path.
   */
  async notifyTenant(tenantId: string, category: TenantNotificationCategory, title: string, body: string): Promise<void> {
    const repository = new TenantNotificationRepository(getTenantScopedClient(tenantId));
    const notification = await repository.create(tenantId, { category, title, body });
    emitToTenant(tenantId, 'notification:new', notification);
  }

  /**
   * Cross-tenant broadcast fan-out for admin-sent Notifications — same
   * documented RLS caveat as every other platform-wide write in this
   * codebase (onboarding's duplicate-checks, the billing queue jobs): the
   * raw client bypasses RLS on this dev database's superuser role; a
   * hardened production deployment would run this under a dedicated
   * platform-service DB role instead.
   */
  async broadcast(tenantIds: string[], title: string, body: string, sourceNotificationId: string): Promise<void> {
    if (tenantIds.length === 0) return;
    await prisma.tenantNotification.createMany({
      data: tenantIds.map((tenantId) => ({ tenantId, category: 'ANNOUNCEMENT' as const, title, body, sourceNotificationId })),
    });
    for (const tenantId of tenantIds) {
      emitToTenant(tenantId, 'notification:new', { tenantId, category: 'ANNOUNCEMENT', title, body, sourceNotificationId, createdAt: new Date().toISOString() });
    }
  }
}

export const tenantNotificationService = new TenantNotificationService();
