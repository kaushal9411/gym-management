import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import type { UpdatePlatformNotificationCredentialInput } from '../services/platform-notification-credential.service';
import { platformNotificationCredentialService } from '../services/platform-notification-credential.service';

export class AdminNotificationSettingsController {
  async getCredentials(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await platformNotificationCredentialService.getView());
  }

  async updateCredentials(req: Request, res: Response): Promise<void> {
    const view = await platformNotificationCredentialService.update(req.body as UpdatePlatformNotificationCredentialInput, req.admin!.sub, req.admin!.role);
    sendSuccess(res, view, 'Notification provider credentials updated.');
  }
}

export const adminNotificationSettingsController = new AdminNotificationSettingsController();
