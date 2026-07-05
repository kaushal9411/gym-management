import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminSettingsService } from '../services/admin-settings.service';

export class AdminSettingsController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminSettingsService.list(req.query.category as string | undefined));
  }

  async get(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminSettingsService.get(req.params.key!));
  }

  async upsert(req: Request, res: Response): Promise<void> {
    const { category, value } = req.body as { category: string; value: unknown };
    const setting = await adminSettingsService.upsert(req.params.key!, category, value, req.admin!.sub, req.admin!.role);
    sendSuccess(res, setting, 'Setting saved.');
  }
}

export const adminSettingsController = new AdminSettingsController();
