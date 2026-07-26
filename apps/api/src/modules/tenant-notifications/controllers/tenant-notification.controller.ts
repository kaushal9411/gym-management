import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { tenantNotificationService } from '../services/tenant-notification.service';

interface ListQuery {
  unreadOnly?: boolean;
  page: number;
  limit: number;
}

export class TenantNotificationController {
  async list(req: Request, res: Response): Promise<void> {
    const result = await tenantNotificationService.list(req.tenant!.id, req.query as unknown as ListQuery);
    sendSuccess(res, result);
  }

  async unreadCount(req: Request, res: Response): Promise<void> {
    const result = await tenantNotificationService.unreadCount(req.tenant!.id);
    sendSuccess(res, result);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const notification = await tenantNotificationService.getById(req.tenant!.id, req.params.notificationId!);
    sendSuccess(res, notification);
  }

  async create(req: Request, res: Response): Promise<void> {
    const notification = await tenantNotificationService.create(req.tenant!.id, req.body);
    sendSuccess(res, notification, 'Notification created.', 201);
  }

  async remove(req: Request, res: Response): Promise<void> {
    await tenantNotificationService.remove(req.tenant!.id, req.params.notificationId!);
    sendSuccess(res, null, 'Notification deleted.');
  }

  async markRead(req: Request, res: Response): Promise<void> {
    await tenantNotificationService.markRead(req.tenant!.id, req.params.notificationId!);
    sendSuccess(res, null, 'Marked as read.');
  }

  async markAllRead(req: Request, res: Response): Promise<void> {
    await tenantNotificationService.markAllRead(req.tenant!.id);
    sendSuccess(res, null, 'All notifications marked as read.');
  }
}

export const tenantNotificationController = new TenantNotificationController();
