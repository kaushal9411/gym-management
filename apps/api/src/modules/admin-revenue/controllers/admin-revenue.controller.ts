import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminRevenueService } from '../services/admin-revenue.service';

export class AdminRevenueController {
  async summary(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminRevenueService.summary());
  }

  async growth(req: Request, res: Response): Promise<void> {
    const days = req.query.days ? Number(req.query.days) : 30;
    sendSuccess(res, await adminRevenueService.growth(days));
  }
}

export const adminRevenueController = new AdminRevenueController();
