import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminDashboardService } from '../services/admin-dashboard.service';

export class AdminDashboardController {
  async getStats(_req: Request, res: Response): Promise<void> {
    const stats = await adminDashboardService.getStats();
    sendSuccess(res, stats);
  }
}

export const adminDashboardController = new AdminDashboardController();
