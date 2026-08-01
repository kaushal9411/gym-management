import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { AdminTenantBillingService, type ChangePlanMode } from '../services/admin-tenant-billing.service';

function serviceFor(req: Request): AdminTenantBillingService {
  return new AdminTenantBillingService(req.params.tenantId!);
}

export class AdminTenantBillingController {
  async payments(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    sendSuccess(res, await serviceFor(req).payments(page, limit));
  }

  async invoices(req: Request, res: Response): Promise<void> {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    sendSuccess(res, await serviceFor(req).invoiceList(page, limit));
  }

  async createPaymentLink(req: Request, res: Response): Promise<void> {
    const { invoiceId } = req.body as { invoiceId?: string };
    const result = await serviceFor(req).createPaymentLink({ invoiceId }, req.admin!.sub, req.admin!.role);
    sendSuccess(res, result, 'Payment link created.');
  }

  async changePlan(req: Request, res: Response): Promise<void> {
    const { planId, mode } = req.body as { planId: string; mode: ChangePlanMode };
    const result = await serviceFor(req).changePlan(planId, mode, req.admin!.sub, req.admin!.role);
    sendSuccess(res, result, mode === 'manual' ? 'Plan changed.' : 'Payment link created.');
  }

  async verifyPaymentStatus(req: Request, res: Response): Promise<void> {
    const result = await serviceFor(req).verifyPaymentStatus(req.params.paymentId!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, result);
  }

  async resendNotification(req: Request, res: Response): Promise<void> {
    const { medium } = req.body as { medium: 'email' | 'sms' };
    await serviceFor(req).resendNotification(req.params.paymentId!, medium, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Notification resent.');
  }

  async downloadInvoicePdf(req: Request, res: Response): Promise<void> {
    const buffer = await serviceFor(req).downloadInvoicePdf(req.params.invoiceId!);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.invoiceId}.pdf"`);
    res.send(buffer);
  }

  async emailInvoice(req: Request, res: Response): Promise<void> {
    const { email } = req.body as { email?: string };
    await serviceFor(req).emailInvoice(req.params.invoiceId!, req.admin!.sub, req.admin!.role, email);
    sendSuccess(res, null, 'Invoice emailed.');
  }
}

export const adminTenantBillingController = new AdminTenantBillingController();
