import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { InvoiceService } from '../services/invoice.service';

export class InvoiceController {
  /** GET /invoice — invoice list for the current tenant, most recent first. */
  async list(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenant!.id;
    const service = new InvoiceService(getTenantScopedClient(tenantId));
    const invoices = await service.list(tenantId);
    sendSuccess(
      res,
      invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        subtotal: Number(inv.subtotal),
        taxAmount: Number(inv.taxAmount),
        discountAmount: Number(inv.discountAmount),
        total: Number(inv.total),
        currency: inv.currency,
        dueDate: inv.dueDate,
        paidAt: inv.paidAt,
        createdAt: inv.createdAt,
      })),
    );
  }

  /** GET /invoice/:id/download — printable HTML document (see InvoiceService.renderDownload). */
  async download(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenant!.id;
    const service = new InvoiceService(getTenantScopedClient(tenantId));
    const html = await service.renderDownload(tenantId, req.params.id!, req.tenant!.name);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.id}.html"`);
    res.send(html);
  }
}

export const invoiceController = new InvoiceController();
