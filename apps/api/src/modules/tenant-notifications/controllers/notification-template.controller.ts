import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { notificationTemplateService } from '../services/notification-template.service';

export class NotificationTemplateController {
  async list(req: Request, res: Response): Promise<void> {
    const templates = await notificationTemplateService.list(req.tenant!.id);
    sendSuccess(res, templates);
  }

  async update(req: Request, res: Response): Promise<void> {
    const template = await notificationTemplateService.update(req.tenant!.id, req.params.type as never, req.body);
    sendSuccess(res, template, 'Template updated.');
  }
}

export const notificationTemplateController = new NotificationTemplateController();
