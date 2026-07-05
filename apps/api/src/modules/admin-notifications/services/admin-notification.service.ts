import type { AnnouncementAudience } from '@prisma/client';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { prisma } from '../../../infrastructure/database/prisma';
import { renderEmailLayout } from '../../../infrastructure/mail/templates/base-layout';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { tenantNotificationService } from '../../tenant-notifications/services/tenant-notification.service';

const PLATFORM_BRANDING = { tenantName: 'FitCloud' };

async function tenantsForAudience(audience: AnnouncementAudience) {
  const statusFilter = audience === 'TRIAL' ? { status: 'TRIAL' as const } : audience === 'ACTIVE' ? { status: 'ACTIVE' as const } : {};
  return prisma.tenant.findMany({
    where: { deletedAt: null, ...statusFilter },
    include: { users: { where: { status: 'ACTIVE' }, take: 1, orderBy: { createdAt: 'asc' } } },
  });
}

export class AdminNotificationService {
  // ── Announcements (persistent in-portal banner) ──
  async listAnnouncements() {
    return prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createAnnouncement(input: { title: string; body: string; audience: AnnouncementAudience; expiresAt?: Date }, adminUserId: string, adminRole: string) {
    const announcement = await prisma.announcement.create({ data: { ...input, publishedAt: new Date() } });
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.announcement_created', entityType: 'Announcement', entityId: announcement.id });
    return announcement;
  }

  async setAnnouncementActive(id: string, isActive: boolean, adminUserId: string, adminRole: string) {
    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement) throw new AppError(ErrorCode.NOT_FOUND, 'Announcement not found', 404);
    const updated = await prisma.announcement.update({ where: { id }, data: { isActive } });
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: isActive ? 'admin.announcement_activated' : 'admin.announcement_deactivated', entityType: 'Announcement', entityId: id });
    return updated;
  }

  // ── One-time global notifications (email dispatch to every matching tenant owner) ──
  async listNotifications() {
    return prisma.notification.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createNotification(input: { title: string; body: string; channel: 'EMAIL' | 'PUSH' | 'IN_APP'; audience: AnnouncementAudience; scheduledAt?: Date }, adminUserId: string, adminRole: string) {
    const notification = await prisma.notification.create({ data: input });
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.notification_created', entityType: 'Notification', entityId: notification.id });
    return notification;
  }

  /** Dispatches immediately — "Schedule Notification" is captured by `scheduledAt` on create; sending on-schedule would be a queue-job follow-up. */
  async send(id: string, adminUserId: string, adminRole: string) {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new AppError(ErrorCode.NOT_FOUND, 'Notification not found', 404);
    if (notification.sentAt) throw new AppError(ErrorCode.CONFLICT, 'This notification was already sent.', 409);

    const tenants = await tenantsForAudience(notification.audience);

    if (notification.channel === 'EMAIL') {
      const html = renderEmailLayout(PLATFORM_BRANDING, `<h1 style="font-size:20px;margin:0 0 12px;">${notification.title}</h1><p>${notification.body}</p>`);
      for (const tenant of tenants) {
        const owner = tenant.users[0];
        if (owner) await enqueueEmail({ to: owner.email, subject: notification.title, html });
      }
    }
    // Regardless of channel, every matching tenant sees it in their in-portal
    // Notification Center — that's the one piece that's actually wired up
    // today; PUSH is architecture-only (no push provider configured yet).
    await tenantNotificationService.broadcast(tenants.map((t) => t.id), notification.title, notification.body, notification.id);

    const updated = await prisma.notification.update({ where: { id }, data: { sentAt: new Date() } });
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.notification_sent', entityType: 'Notification', entityId: id });
    return updated;
  }
}

export const adminNotificationService = new AdminNotificationService();
