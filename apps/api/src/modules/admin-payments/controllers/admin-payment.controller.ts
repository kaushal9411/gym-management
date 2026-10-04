import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import type { RevenueRange } from '../../admin-revenue/utils/revenue-insights.util';
import {
  paymentInsightsService,
  type InvoiceListParams,
  type PaymentListParams,
} from '../services/payment-insights.service';
import {
  buildPaymentsCsv,
  type PaymentFilters,
  type PaymentSort,
  type SortDir,
} from '../utils/payment-filters.util';

export class AdminPaymentController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await paymentInsightsService.list(req.query as unknown as PaymentListParams));
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await paymentInsightsService.getById(req.params.paymentId!));
  }

  async listInvoices(req: Request, res: Response): Promise<void> {
    sendSuccess(
      res,
      await paymentInsightsService.listInvoices(req.query as unknown as InvoiceListParams),
    );
  }

  async getInvoice(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await paymentInsightsService.getInvoice(req.params.invoiceId!));
  }

  async overview(req: Request, res: Response): Promise<void> {
    const { range } = req.query as unknown as { range: RevenueRange };
    sendSuccess(res, await paymentInsightsService.overview(range));
  }

  async export(req: Request, res: Response): Promise<void> {
    const filters = req.query as unknown as PaymentFilters & {
      sort?: PaymentSort;
      sortDir?: SortDir;
    };
    const { rows, matched } = await paymentInsightsService.exportRows(filters);
    await adminAuditLogRepository.record({
      adminUserId: req.admin!.sub,
      actorRole: req.admin!.role,
      action: 'admin.payments_exported',
      entityType: 'Payment',
      after: { rows: rows.length, matched, filters },
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(buildPaymentsCsv(rows));
  }
}

export const adminPaymentController = new AdminPaymentController();
