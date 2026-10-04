import type { Request, Response } from 'express';

import { UnauthenticatedError } from '../../../core/errors/app-error';
import { sendSuccess } from '../../../core/http/response';
import { getAdminPermissions } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminDashboardOverviewService } from '../services/admin-dashboard-overview.service';
import { adminDashboardService } from '../services/admin-dashboard.service';
import type { OverviewRange } from '../utils/overview.util';

export class AdminDashboardController {
  async getStats(_req: Request, res: Response): Promise<void> {
    const stats = await adminDashboardService.getStats();
    sendSuccess(res, stats);
  }

  async getOverview(req: Request, res: Response): Promise<void> {
    if (!req.admin) throw new UnauthenticatedError();
    const permissions = await getAdminPermissions(req.admin);
    const { range } = req.query as unknown as { range: OverviewRange };
    sendSuccess(res, await adminDashboardOverviewService.getOverview(range, permissions));
  }
}

export const adminDashboardController = new AdminDashboardController();
