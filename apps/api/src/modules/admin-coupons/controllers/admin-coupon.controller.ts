import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import type { UpsertCouponInput } from '../repositories/admin-coupon.repository';
import { adminCouponService } from '../services/admin-coupon.service';
import { couponInsightsService } from '../services/coupon-insights.service';

type ParamsDictionary = Record<string, string>;
type TypedBodyRequest<Body> = Request<ParamsDictionary, unknown, Body>;

export class AdminCouponController {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(
      res,
      await couponInsightsService.list(
        req.query as Parameters<typeof couponInsightsService.list>[0],
      ),
    );
  }

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await couponInsightsService.detail(req.params.couponId!));
  }

  async create(req: TypedBodyRequest<UpsertCouponInput>, res: Response): Promise<void> {
    const coupon = await adminCouponService.create(req.body, req.admin!.sub, req.admin!.role);
    sendSuccess(res, coupon, 'Coupon created.', 201);
  }

  async update(req: TypedBodyRequest<Partial<UpsertCouponInput>>, res: Response): Promise<void> {
    const coupon = await adminCouponService.update(
      req.params.couponId!,
      req.body,
      req.admin!.sub,
      req.admin!.role,
    );
    sendSuccess(res, coupon, 'Coupon updated.');
  }

  async overview(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await couponInsightsService.overview());
  }

  async setActive(req: TypedBodyRequest<{ isActive: boolean }>, res: Response): Promise<void> {
    const coupon = await couponInsightsService.setActive(
      req.params.couponId!,
      req.body.isActive,
      req.admin!.sub,
      req.admin!.role,
    );
    sendSuccess(res, coupon, req.body.isActive ? 'Coupon enabled.' : 'Coupon disabled.');
  }

  async bulkGenerate(
    req: TypedBodyRequest<Parameters<typeof couponInsightsService.bulkGenerate>[0]>,
    res: Response,
  ): Promise<void> {
    sendSuccess(
      res,
      await couponInsightsService.bulkGenerate(req.body, req.admin!.sub, req.admin!.role),
      'Coupons generated.',
      201,
    );
  }

  async remove(req: Request, res: Response): Promise<void> {
    await adminCouponService.remove(req.params.couponId!, req.admin!.sub, req.admin!.role);
    sendSuccess(res, null, 'Coupon deleted.');
  }
}

export const adminCouponController = new AdminCouponController();
