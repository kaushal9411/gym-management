import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { BillingAddressRepository, type BillingAddressInput } from '../repositories/billing-address.repository';

export class BillingController {
  /** GET /billing/address — the current tenant's billing address, if set. */
  async getAddress(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenant!.id;
    const repository = new BillingAddressRepository(getTenantScopedClient(tenantId));
    const address = await repository.find(tenantId);
    sendSuccess(res, address);
  }

  /** PUT /billing/address — create or replace the tenant's billing address (feeds tax calculation + invoices). */
  async upsertAddress(req: Request<unknown, unknown, BillingAddressInput>, res: Response): Promise<void> {
    const tenantId = req.tenant!.id;
    const repository = new BillingAddressRepository(getTenantScopedClient(tenantId));
    const address = await repository.upsert(tenantId, req.body);
    sendSuccess(res, address, 'Billing address saved.');
  }
}

export const billingController = new BillingController();
