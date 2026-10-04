import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { adminRevenueService } from '../services/admin-revenue.service';
import { revenueInsightsService } from '../services/revenue-insights.service';
import type { RevenueRange } from '../utils/revenue-insights.util';

export class AdminRevenueController {
  async summary(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminRevenueService.summary());
  }

  async growth(req: Request, res: Response): Promise<void> {
    const { days, currency } = req.query as unknown as { days: number; currency?: string };
    sendSuccess(res, await adminRevenueService.growth(days, currency));
  }

  async overview(req: Request, res: Response): Promise<void> {
    const { range } = req.query as unknown as { range: RevenueRange };
    sendSuccess(res, await revenueInsightsService.overview(range));
  }

  async export(req: Request, res: Response): Promise<void> {
    const { range } = req.query as unknown as { range: RevenueRange };
    const out = await revenueInsightsService.exportCsv(range);
    await adminAuditLogRepository.record({
      adminUserId: req.admin!.sub,
      actorRole: req.admin!.role,
      action: 'admin.revenue_exported',
      entityType: 'Revenue',
      after: {
        range,
        from: out.range.from,
        to: out.range.to,
        currency: out.currency,
        rows: out.rows,
      },
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="revenue-${range}-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(out.csv);
  }
}

export const adminRevenueController = new AdminRevenueController();
