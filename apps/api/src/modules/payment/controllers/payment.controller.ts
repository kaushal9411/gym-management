import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { PaymentMethodRepository } from '../repositories/payment-method.repository';
import { PaymentService } from '../services/payment.service';

export class PaymentController {
  /** GET /payment/history — every charge attempt for the current tenant, most recent first. */
  async history(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenant!.id;
    const service = new PaymentService(getTenantScopedClient(tenantId));
    const payments = await service.history(tenantId);
    sendSuccess(res, payments);
  }

  /** GET /payment/methods — saved payment methods for the current tenant. */
  async listMethods(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenant!.id;
    const repository = new PaymentMethodRepository(getTenantScopedClient(tenantId));
    const methods = await repository.listForTenant(tenantId);
    sendSuccess(
      res,
      methods.map((m) => ({
        id: m.id,
        provider: m.provider.toLowerCase(),
        brand: m.brand,
        last4: m.last4,
        expiryMonth: m.expiryMonth,
        expiryYear: m.expiryYear,
        isDefault: m.isDefault,
      })),
    );
  }
}

export const paymentController = new PaymentController();
