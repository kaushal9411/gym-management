import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminFeatureFlagService } from '../services/admin-feature-flag.service';

export class AdminFeatureFlagController {
  async list(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminFeatureFlagService.list());
  }

  async setEnabled(req: Request, res: Response): Promise<void> {
    const { enabled } = req.body as { enabled: boolean };
    const flag = await adminFeatureFlagService.setEnabled(req.params.key!, enabled, req.admin!.sub, req.admin!.role);
    sendSuccess(res, flag, enabled ? 'Feature enabled.' : 'Feature disabled.');
  }
}

export const adminFeatureFlagController = new AdminFeatureFlagController();
