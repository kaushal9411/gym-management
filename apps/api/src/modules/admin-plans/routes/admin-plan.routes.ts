import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminPlanController } from '../controllers/admin-plan.controller';
import { planInsightsController } from '../controllers/plan-insights.controller';
import {
  createPlanSchema,
  planIdParamSchema,
  planSubscribersQuerySchema,
  setPlanActiveSchema,
  updatePlanSchema,
} from '../validators/admin-plan.validators';
import {
  duplicatePlanSchema,
  planImpactQuerySchema,
  planListQuerySchema,
} from '../validators/plan-insights.validators';

export const adminPlanRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminPlanRouter.use(adminAuthenticateMiddleware);

/** @openapi { "/admin/plans": { get: { tags: [Admin Plans], summary: List all plans, security: [{bearerAuth: []}], responses: { 200: { description: Plans } } } } } */
adminPlanRouter.get(
  '/',
  requireAdminPermission('plans:manage'),
  validate({ query: planListQuerySchema }),
  asyncHandler(adminPlanController.list.bind(adminPlanController)),
);

/** @openapi { "/admin/plans/overview": { get: { tags: [Admin Plans], summary: "Plans KPIs, per-plan MRR share and cycle split, price ladder, upcoming renewals", security: [{bearerAuth: []}], responses: { 200: { description: Overview } } } } } */
adminPlanRouter.get(
  '/overview',
  requireAdminPermission('plans:manage'),
  asyncHandler(planInsightsController.overview.bind(planInsightsController)),
);

/** @openapi { "/admin/plans/{planId}/overview": { get: { tags: [Admin Plans], summary: "Plan detail insights (stats, subscribers, renewals, recent changes)", security: [{bearerAuth: []}], responses: { 200: { description: Plan overview } } } } } */
adminPlanRouter.get(
  '/:planId/overview',
  requireAdminPermission('plans:manage'),
  validate({ params: planIdParamSchema }),
  asyncHandler(planInsightsController.planOverview.bind(planInsightsController)),
);

/** @openapi { "/admin/plans/{planId}/impact": { get: { tags: [Admin Plans], summary: "Read-only price change impact projection", security: [{bearerAuth: []}], responses: { 200: { description: Impact } } } } } */
adminPlanRouter.get(
  '/:planId/impact',
  requireAdminPermission('plans:manage'),
  validate({ params: planIdParamSchema, query: planImpactQuerySchema }),
  asyncHandler(planInsightsController.impact.bind(planInsightsController)),
);

/** @openapi { "/admin/plans/{planId}/duplicate": { post: { tags: [Admin Plans], summary: "Duplicate a plan as an inactive copy", security: [{bearerAuth: []}], responses: { 201: { description: Created }, 409: { description: Slug taken } } } } } */
adminPlanRouter.post(
  '/:planId/duplicate',
  requireAdminPermission('plans:manage'),
  validate({ params: planIdParamSchema, body: duplicatePlanSchema }),
  asyncHandler(planInsightsController.duplicate.bind(planInsightsController)),
);

/** @openapi { "/admin/plans/{planId}": { get: { tags: [Admin Plans], summary: Get plan, security: [{bearerAuth: []}], responses: { 200: { description: Plan } } } } } */
adminPlanRouter.get(
  '/:planId',
  requireAdminPermission('plans:manage'),
  validate({ params: planIdParamSchema }),
  asyncHandler(adminPlanController.getById.bind(adminPlanController)),
);

/** @openapi { "/admin/plans/{planId}/subscribers": { get: { tags: [Admin Plans], summary: Tenants currently on this plan, security: [{bearerAuth: []}], responses: { 200: { description: Paginated subscribers } } } } } */
adminPlanRouter.get(
  '/:planId/subscribers',
  requireAdminPermission('plans:manage'),
  validate({ params: planIdParamSchema, query: planSubscribersQuerySchema }),
  asyncHandler(adminPlanController.subscribers.bind(adminPlanController)),
);

/** @openapi { "/admin/plans": { post: { tags: [Admin Plans], summary: Create Plan, security: [{bearerAuth: []}], responses: { 201: { description: Created } } } } } */
adminPlanRouter.post(
  '/',
  requireAdminPermission('plans:manage'),
  validate({ body: createPlanSchema }),
  asyncHandler(adminPlanController.create.bind(adminPlanController)),
);

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
adminPlanRouter.delete(
  '/:planId',
  requireAdminPermission('plans:manage'),
  validate({ params: planIdParamSchema }),
  asyncHandler(adminPlanController.remove.bind(adminPlanController)),
);
