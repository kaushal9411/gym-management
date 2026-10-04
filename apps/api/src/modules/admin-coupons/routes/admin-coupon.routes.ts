import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminCouponController } from '../controllers/admin-coupon.controller';
import {
  couponIdParamSchema,
  createCouponSchema,
  updateCouponSchema,
} from '../validators/admin-coupon.validators';
import {
  bulkGenerateCouponsSchema,
  couponListQuerySchema,
  setCouponActiveSchema,
} from '../validators/coupon-extra.validators';

export const adminCouponRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminCouponRouter.use(adminAuthenticateMiddleware, requireAdminPermission('coupons:manage'));

/** @openapi { "/admin/coupons": { get: { tags: [Admin Coupons], summary: List coupons, security: [{bearerAuth: []}], responses: { 200: { description: Coupons } } } } } */
adminCouponRouter.get(
  '/',
  validate({ query: couponListQuerySchema }),
  asyncHandler(adminCouponController.list.bind(adminCouponController)),
);

/** @openapi { "/admin/coupons/overview": { get: { tags: [Admin Coupons], summary: "Coupon KPIs, daily redemptions, by type, top coupons, expiring soon", security: [{bearerAuth: []}], responses: { 200: { description: Overview } } } } } */
adminCouponRouter.get(
  '/overview',
  asyncHandler(adminCouponController.overview.bind(adminCouponController)),
);

/** @openapi { "/admin/coupons/bulk-generate": { post: { tags: [Admin Coupons], summary: "Generate N unique coupon codes", security: [{bearerAuth: []}], responses: { 201: { description: Created codes } } } } } */
adminCouponRouter.post(
  '/bulk-generate',
  validate({ body: bulkGenerateCouponsSchema }),
  asyncHandler(adminCouponController.bulkGenerate.bind(adminCouponController)),
);

/** @openapi { "/admin/coupons/{couponId}/active": { patch: { tags: [Admin Coupons], summary: Enable or disable a coupon, security: [{bearerAuth: []}], responses: { 200: { description: Updated } } } } } */
adminCouponRouter.patch(
  '/:couponId/active',
  validate({ params: couponIdParamSchema, body: setCouponActiveSchema }),
  asyncHandler(adminCouponController.setActive.bind(adminCouponController)),
);

/** @openapi { "/admin/coupons/{couponId}": { get: { tags: [Admin Coupons], summary: Get coupon + usage report, security: [{bearerAuth: []}], responses: { 200: { description: Coupon } } } } } */
adminCouponRouter.get(
  '/:couponId',
  validate({ params: couponIdParamSchema }),
  asyncHandler(adminCouponController.getById.bind(adminCouponController)),
);

/** @openapi { "/admin/coupons": { post: { tags: [Admin Coupons], summary: Create Coupon, security: [{bearerAuth: []}], responses: { 201: { description: Created } } } } } */
adminCouponRouter.post(
  '/',
  validate({ body: createCouponSchema }),
  asyncHandler(adminCouponController.create.bind(adminCouponController)),
);

/** @openapi { "/admin/coupons/{couponId}": { put: { tags: [Admin Coupons], summary: Update Coupon, security: [{bearerAuth: []}], responses: { 200: { description: Updated } } } } } */
adminCouponRouter.put(
  '/:couponId',
  validate({ params: couponIdParamSchema, body: updateCouponSchema }),
  asyncHandler(adminCouponController.update.bind(adminCouponController)),
);

/** @openapi { "/admin/coupons/{couponId}": { delete: { tags: [Admin Coupons], summary: Delete Coupon, security: [{bearerAuth: []}], responses: { 200: { description: Deleted } } } } } */
adminCouponRouter.delete(
  '/:couponId',
  validate({ params: couponIdParamSchema }),
  asyncHandler(adminCouponController.remove.bind(adminCouponController)),
);
