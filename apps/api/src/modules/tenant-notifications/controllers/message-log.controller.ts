import type { NotificationDeliveryStatus, TenantNotificationChannel } from '@prisma/client';
import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { messageLogService } from '../services/message-log.service';

interface ListQuery {
  channel?: TenantNotificationChannel;
  status?: NotificationDeliveryStatus;
  page: number;
  limit: number;
}

export class MessageLogController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await messageLogService.list(req.tenant!.id, req.query as unknown as ListQuery));
  }
}

export const messageLogController = new MessageLogController();
