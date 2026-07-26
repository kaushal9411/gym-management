import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { AnalyticsService } from '../services/analytics.service';

function serviceFor(req: Request): AnalyticsService {
  return new AnalyticsService(req.tenant!.id);
}

interface TrendQuery {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}

export class AnalyticsController {
  async revenueTrends(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo, branchId } = req.query as TrendQuery;
    sendSuccess(res, await serviceFor(req).revenueTrends(req.auth!.sub, dateFrom, dateTo, branchId));
  }

  async attendanceTrends(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo, branchId } = req.query as TrendQuery;
    sendSuccess(res, await serviceFor(req).attendanceTrends(req.auth!.sub, dateFrom, dateTo, branchId));
  }

  async membershipGrowth(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo, branchId } = req.query as TrendQuery;
    sendSuccess(res, await serviceFor(req).membershipGrowth(req.auth!.sub, dateFrom, dateTo, branchId));
  }

  async newMemberGrowth(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo, branchId } = req.query as TrendQuery;
    sendSuccess(res, await serviceFor(req).newMemberGrowth(req.auth!.sub, dateFrom, dateTo, branchId));
  }

  async retention(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo, branchId } = req.query as TrendQuery;
    sendSuccess(res, await serviceFor(req).memberRetention(req.auth!.sub, dateFrom, dateTo, branchId));
  }

  async paymentCollection(req: Request, res: Response): Promise<void> {
    const { dateFrom, dateTo, branchId } = req.query as TrendQuery;
    sendSuccess(res, await serviceFor(req).paymentCollection(req.auth!.sub, dateFrom, dateTo, branchId));
  }

  async branchComparison(req: Request, res: Response): Promise<void> {
    const branchId = req.query.branchId as string | undefined;
    sendSuccess(res, await serviceFor(req).branchComparison(req.auth!.sub, branchId));
  }
}

export const analyticsController = new AnalyticsController();
