import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { DashboardService } from '../services/dashboard.service';

function serviceFor(req: Request): DashboardService {
  return new DashboardService(req.tenant!.id);
}

export class DashboardController {
  async getSummary(req: Request, res: Response): Promise<void> {
    const branchId = req.query.branchId as string | undefined;
    sendSuccess(res, await serviceFor(req).getSummary(req.auth!.sub, branchId));
  }

  async getKpis(req: Request, res: Response): Promise<void> {
    const branchId = req.query.branchId as string | undefined;
    sendSuccess(res, await serviceFor(req).getKpis(req.auth!.sub, branchId));
  }

  async getRecentActivities(req: Request, res: Response): Promise<void> {
    const branchId = req.query.branchId as string | undefined;
    sendSuccess(res, await serviceFor(req).getRecentActivities(req.auth!.sub, branchId));
  }
}

export const dashboardController = new DashboardController();
