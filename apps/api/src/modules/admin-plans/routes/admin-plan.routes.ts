import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminPlanController } from '../controllers/admin-plan.controller';
import { createPlanSchema, planIdParamSchema, setPlanActiveSchema, updatePlanSchema } from '../validators/admin-plan.validators';

export const adminPlanRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminPlanRouter.use(adminAuthenticateMiddleware);

/** @openapi { "/admin/plans": { get: { tags: [Admin Plans], summary: List all plans, security: [{bearerAuth: []}], responses: { 200: { description: Plans } } } } } */
adminPlanRouter.get('/', requireAdminPermission('plans:manage'), asyncHandler(adminPlanController.list.bind(adminPlanController)));

/** @openapi { "/admin/plans/{planId}": { get: { tags: [Admin Plans], summary: Get plan, security: [{bearerAuth: []}], responses: { 200: { description: Plan } } } } } */
adminPlanRouter.get('/:planId', requireAdminPermission('plans:manage'), validate({ params: planIdParamSchema }), asyncHandler(adminPlanController.getById.bind(adminPlanController)));

/** @openapi { "/admin/plans": { post: { tags: [Admin Plans], summary: Create Plan, security: [{bearerAuth: []}], responses: { 201: { description: Created } } } } } */
adminPlanRouter.post('/', requireAdminPermission('plans:manage'), validate({ body: createPlanSchema }), asyncHandler(adminPlanController.create.bind(adminPlanController)));

/** @openapi { "/admin/plans/{planId}": { put: { tags: [Admin Plans], summary: Update Plan, security: [{bearerAuth: []}], responses: { 200: { description: Updated } } } } } */
adminPlanRouter.put(
  '/:planId',
  requireAdminPermission('plans:manage'),
  validate({ params: planIdParamSchema, body: updatePlanSchema }),
  asyncHandler(adminPlanController.update.bind(adminPlanController)),
);

/** @openapi { "/admin/plans/{planId}/active": { patch: { tags: [Admin Plans], summary: Enable/Disable Plan, security: [{bearerAuth: []}], responses: { 200: { description: Updated } } } } } */
adminPlanRouter.patch(
  '/:planId/active',
  requireAdminPermission('plans:manage'),
  validate({ params: planIdParamSchema, body: setPlanActiveSchema }),
  asyncHandler(adminPlanController.setActive.bind(adminPlanController)),
);

/** @openapi { "/admin/plans/{planId}": { delete: { tags: [Admin Plans], summary: Delete Plan, security: [{bearerAuth: []}], responses: { 200: { description: Deleted }, 409: { description: Plan has active subscriptions } } } } } */
adminPlanRouter.delete('/:planId', requireAdminPermission('plans:manage'), validate({ params: planIdParamSchema }), asyncHandler(adminPlanController.remove.bind(adminPlanController)));
