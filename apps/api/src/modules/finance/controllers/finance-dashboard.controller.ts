import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { FinanceDashboardService } from '../services/finance-dashboard.service';

export class FinanceDashboardController {
  async getSummary(req: Request, res: Response): Promise<void> {
    const service = new FinanceDashboardService(req.tenant!.id);
    sendSuccess(res, await service.getSummary(req.query.branchId as string | undefined, req.tenant!.featureFlags));
  }
}

export const financeDashboardController = new FinanceDashboardController();
