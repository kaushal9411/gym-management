import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { couponController } from '../controllers/coupon.controller';
import { validateCouponSchema } from '../validators/coupon.validators';

export const couponRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/**
 * @openapi
 * /coupon/validate:
 *   post:
 *     tags: [Coupon]
 *     summary: Coupon Validation — preview the discount a code would apply
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, amount]
 *             properties: { code: { type: string }, amount: { type: number } }
 *     responses:
 *       200: { description: "{ code, type, scope, discountAmount, trialExtensionDays, finalAmount }" }
 *       422: { description: Coupon invalid, expired, or redemption limit reached }
 */
couponRouter.post(
  '/validate',
  authenticateMiddleware,
  requirePermission('billing:manage'),
  validate({ body: validateCouponSchema }),
  asyncHandler(couponController.validate.bind(couponController)),
);
