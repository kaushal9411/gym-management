import { NotFoundError } from '../../../core/errors/app-error';
import { logger } from '../../../core/logging/logger';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { deviceTokenService } from '../../device-tokens/services/device-token.service';
import type { NotificationDto, Paginated } from '../dto/hr.dto';

export type HrNotificationType = 'LEAVE_APPLIED' | 'LEAVE_APPROVED' | 'LEAVE_REJECTED' | 'LEAVE_CANCELLED' | 'PAYSLIP_PAID';

export interface HrNotifyInput {
  type: HrNotificationType;
  title: string;
  body: string;
  entityType: 'leave_request' | 'payslip';
  entityId: string;
}

/**
 * Per-user HR inbox (`hr_notifications`) + FCM push to that user's devices.
 * The tenant-wide staff Notification Center feed is deliberately NOT used —
 * it is shared by every staff member and would leak leave / salary details.
 * Failures to push never fail the business action.
 */
export class HrNotificationService {
  private readonly db: TenantScopedPrisma;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
  }

  async notify(userIds: string[], n: HrNotifyInput): Promise<void> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return;
    try {
      await this.db.hrNotification.createMany({
        data: ids.map((userId) => ({ tenantId: this.tenantId, userId, type: n.type, title: n.title, body: n.body, entityType: n.entityType, entityId: n.entityId })),
      });
    } catch (err) {
      logger.warn('HR notification insert failed', { error: (err as Error).message });
      return;
    }
    try {
      await deviceTokenService.pushToStaffUsers(this.tenantId, ids, n.title, n.body, { type: 'hr', hrType: n.type, entityType: n.entityType, entityId: n.entityId });
    } catch (err) {
      logger.warn('HR push failed', { error: (err as Error).message });
    }
  }

  async list(userId: string, q: { unreadOnly?: boolean; page: number; limit: number }): Promise<Paginated<NotificationDto> & { unreadCount: number }> {
    const where = { tenantId: this.tenantId, userId, ...(q.unreadOnly ? { readAt: null } : {}) };
    const [rows, total, unreadCount] = await Promise.all([
      this.db.hrNotification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
      this.db.hrNotification.count({ where }),
      this.unreadCount(userId),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        entityType: r.entityType,
        entityId: r.entityId,
        readAt: r.readAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      unreadCount,
      total,
      page: q.page,
      limit: q.limit,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
    };
  }

  unreadCount(userId: string): Promise<number> {
    return this.db.hrNotification.count({ where: { tenantId: this.tenantId, userId, readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    const r = await this.db.hrNotification.updateMany({ where: { tenantId: this.tenantId, userId, id }, data: { readAt: new Date() } });
    if (r.count === 0) {
      const exists = await this.db.hrNotification.count({ where: { tenantId: this.tenantId, userId, id } });
      if (!exists) throw new NotFoundError('Notification not found.');
    }
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db.hrNotification.updateMany({ where: { tenantId: this.tenantId, userId, readAt: null }, data: { readAt: new Date() } });
  }
}
