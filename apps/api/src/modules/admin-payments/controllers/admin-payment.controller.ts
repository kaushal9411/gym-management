import type { PaymentStatus } from '@prisma/client';
import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminPaymentService } from '../services/admin-payment.service';

interface ListQuery {
  status?: PaymentStatus;
  page: number;
  limit: number;
}

export class AdminPaymentController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminPaymentService.list(req.query as unknown as ListQuery));
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminPaymentService.getById(req.params.paymentId!));
  }

  async listInvoices(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminPaymentService.listInvoices(req.query as unknown as { page: number; limit: number }));
  }
}

export const adminPaymentController = new AdminPaymentController();
