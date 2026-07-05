import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import type { UpsertCouponInput } from '../repositories/admin-coupon.repository';
import { adminCouponService } from '../services/admin-coupon.service';

type ParamsDictionary = Record<string, string>;
type TypedBodyRequest<Body> = Request<ParamsDictionary, unknown, Body>;

export class AdminCouponController {
  async list(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminCouponService.list());
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminCouponService.getById(req.params.couponId!));
  }

  async create(req: TypedBodyRequest<UpsertCouponInput>, res: Response): Promise<void> {
    const coupon = await adminCouponService.create(req.body, req.admin!.sub, req.admin!.role);
    sendSuccess(res, coupon, 'Coupon created.', 201);
  }

  async update(req: TypedBodyRequest<Partial<UpsertCouponInput>>, res: Response): Promise<void> {
    const coupon = await adminCouponService.update(req.params.couponId!, req.body, req.admin!.sub, req.admin!.role);
    sendSuccess(res, coupon, 'Coupon updated.');
  }

  async remove(req: Request, res: Response): Promise<void> {
    await adminCouponService.remove(req.params.couponId!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Coupon deleted.');
  }
}

export const adminCouponController = new AdminCouponController();
