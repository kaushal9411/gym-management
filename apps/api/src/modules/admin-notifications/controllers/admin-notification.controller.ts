import type { AnnouncementAudience, NotificationChannel } from '@prisma/client';
import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminNotificationService } from '../services/admin-notification.service';

type ParamsDictionary = Record<string, string>;
type TypedBodyRequest<Body> = Request<ParamsDictionary, unknown, Body>;

export class AdminNotificationController {
  async listAnnouncements(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminNotificationService.listAnnouncements());
  }

  async createAnnouncement(
    req: TypedBodyRequest<{ title: string; body: string; audience: AnnouncementAudience; expiresAt?: Date }>,
    res: Response,
  ): Promise<void> {
    const announcement = await adminNotificationService.createAnnouncement(req.body, req.admin!.sub, req.admin!.role);
    sendSuccess(res, announcement, 'Announcement created.', 201);
  }

  async setAnnouncementActive(req: TypedBodyRequest<{ isActive: boolean }>, res: Response): Promise<void> {
    const announcement = await adminNotificationService.setAnnouncementActive(req.params.id!, req.body.isActive, req.admin!.sub, req.admin!.role);
    sendSuccess(res, announcement, 'Announcement updated.');
  }

  async listNotifications(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminNotificationService.listNotifications());
  }

  async createNotification(
    req: TypedBodyRequest<{ title: string; body: string; channel: NotificationChannel; audience: AnnouncementAudience; scheduledAt?: Date }>,
    res: Response,
  ): Promise<void> {
    const notification = await adminNotificationService.createNotification(req.body, req.admin!.sub, req.admin!.role);
    sendSuccess(res, notification, 'Notification created.', 201);
  }

  async send(req: Request, res: Response): Promise<void> {
    const notification = await adminNotificationService.send(req.params.id!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, notification, 'Notification sent.');
  }
}

export const adminNotificationController = new AdminNotificationController();
