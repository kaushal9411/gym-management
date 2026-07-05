import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { CouponService } from '../services/coupon.service';

export class CouponController {
  /** POST /coupon/validate — read-only preview of a coupon's discount; does not consume a redemption. */
  async validate(req: Request, res: Response): Promise<void> {
    const tenantId = req.tenant!.id;
    const { code, amount } = req.body as { code: string; amount: number };

    const service = new CouponService(getTenantScopedClient(tenantId));
    const result = await service.validate(code, tenantId, amount);
    sendSuccess(res, result);
  }
}

export const couponController = new CouponController();
