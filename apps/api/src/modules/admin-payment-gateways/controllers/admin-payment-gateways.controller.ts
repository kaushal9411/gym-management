import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { adminRazorpayGatewayService } from '../services/admin-razorpay-gateway.service';
import type { TestRazorpayGatewayInput, UpsertRazorpayGatewayInput } from '../validators/admin-payment-gateways.validators';

export class AdminPaymentGatewaysController {
  async getRazorpay(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminRazorpayGatewayService.getView());
  }

  async upsertRazorpay(req: Request, res: Response): Promise<void> {
    const view = await adminRazorpayGatewayService.upsert(req.body as UpsertRazorpayGatewayInput, req.admin!.sub, req.admin!.role);
    sendSuccess(res, view, 'Razorpay credentials saved.');
  }

  async testRazorpay(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminRazorpayGatewayService.testConnection(req.body as TestRazorpayGatewayInput));
  }

  async removeRazorpay(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminRazorpayGatewayService.remove(req.admin!.sub, req.admin!.role), 'Razorpay credentials removed; using the environment configuration.');
  }
}

export const adminPaymentGatewaysController = new AdminPaymentGatewaysController();
