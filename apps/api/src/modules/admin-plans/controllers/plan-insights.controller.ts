import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { planDuplicateService } from '../services/plan-duplicate.service';
import { planInsightsService } from '../services/plan-insights.service';

export class PlanInsightsController {
  async overview(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await planInsightsService.overview());
  }

  async planOverview(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await planInsightsService.planOverview(req.params.planId!));
  }

  async impact(req: Request, res: Response): Promise<void> {
    const q = req.query as unknown as { priceMonthly?: number; priceYearly?: number };
    sendSuccess(res, await planInsightsService.impact(req.params.planId!, q));
  }

  async duplicate(req: Request, res: Response): Promise<void> {
    const plan = await planDuplicateService.duplicate(
      req.params.planId!,
      req.body as { name?: string; slug?: string },
      req.admin!.sub,
      req.admin!.role,
    );
    sendSuccess(res, plan, 'Plan duplicated.', 201);
  }
}

export const planInsightsController = new PlanInsightsController();
