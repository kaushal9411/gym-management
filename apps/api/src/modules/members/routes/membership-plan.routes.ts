import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { membershipPlanController } from '../controllers/membership-plan.controller';
import {
  createMembershipPlanSchema,
  listMembershipPlansQuerySchema,
  membershipPlanParamSchema,
  updateMembershipPlanSchema,
} from '../validators/member.validators';

export const membershipPlanRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

membershipPlanRouter.use(authenticateMiddleware);

/**
 * @openapi
 * /membership-plans:
 *   get:
 *     tags: [Membership Plans]
 *     summary: Paginated membership plan catalog with search + filters (category, status)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ items, total, page, limit, totalPages }" }
 *   post:
 *     tags: [Membership Plans]
 *     summary: Create a membership plan — auto-generates a Plan Code
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Plan created }
 *       409: { description: Duplicate plan name or plan code }
 */
membershipPlanRouter.get(
  '/',
  requirePermission('memberships:view'),
  validate({ query: listMembershipPlansQuerySchema }),
  asyncHandler(membershipPlanController.list.bind(membershipPlanController)),
);
membershipPlanRouter.post(
  '/',
  requirePermission('memberships:create'),
  validate({ body: createMembershipPlanSchema }),
  asyncHandler(membershipPlanController.create.bind(membershipPlanController)),
);

/** @openapi { "/membership-plans/assignable": { get: { tags: [Membership Plans], summary: Unfiltered active-plan list for Assign/Renew/Upgrade dropdowns, security: [{bearerAuth: []}], responses: { 200: { description: Active plans } } } } } */
membershipPlanRouter.get(
  '/assignable',
  requirePermission('memberships:view'),
  asyncHandler(membershipPlanController.listAssignable.bind(membershipPlanController)),
);

/**
 * @openapi
 * /membership-plans/{planId}:
 *   get:
 *     tags: [Membership Plans]
 *     summary: Full membership plan detail
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Plan detail }
 *   patch:
 *     tags: [Membership Plans]
 *     summary: Update a membership plan
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Plan updated }
 *   delete:
 *     tags: [Membership Plans]
 *     summary: Soft-delete a membership plan (restorable; cannot be assigned while deleted)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Plan deleted }
 */
membershipPlanRouter.get(
  '/:planId',
  requirePermission('memberships:view'),
  validate({ params: membershipPlanParamSchema }),
  asyncHandler(membershipPlanController.getById.bind(membershipPlanController)),
);
membershipPlanRouter.patch(
  '/:planId',
  requirePermission('memberships:update'),
  validate({ params: membershipPlanParamSchema, body: updateMembershipPlanSchema }),
  asyncHandler(membershipPlanController.update.bind(membershipPlanController)),
);
membershipPlanRouter.delete(
  '/:planId',
  requirePermission('memberships:delete'),
  validate({ params: membershipPlanParamSchema }),
  asyncHandler(membershipPlanController.softDelete.bind(membershipPlanController)),
);

/** @openapi { "/membership-plans/{planId}/activate": { post: { tags: [Membership Plans], summary: Activate a plan (assignable again), security: [{bearerAuth: []}], responses: { 200: { description: Activated } } } } } */
membershipPlanRouter.post(
  '/:planId/activate',
  requirePermission('memberships:update'),
  validate({ params: membershipPlanParamSchema }),
  asyncHandler(membershipPlanController.activate.bind(membershipPlanController)),
);

/** @openapi { "/membership-plans/{planId}/deactivate": { post: { tags: [Membership Plans], summary: Deactivate a plan (cannot be assigned while inactive), security: [{bearerAuth: []}], responses: { 200: { description: Deactivated } } } } } */
membershipPlanRouter.post(
  '/:planId/deactivate',
  requirePermission('memberships:update'),
  validate({ params: membershipPlanParamSchema }),
  asyncHandler(membershipPlanController.deactivate.bind(membershipPlanController)),
);

/** @openapi { "/membership-plans/{planId}/restore": { post: { tags: [Membership Plans], summary: Restore a soft-deleted plan, security: [{bearerAuth: []}], responses: { 200: { description: Restored } } } } } */
membershipPlanRouter.post(
  '/:planId/restore',
  requirePermission('memberships:restore'),
  validate({ params: membershipPlanParamSchema }),
  asyncHandler(membershipPlanController.restore.bind(membershipPlanController)),
);

/** @openapi { "/membership-plans/{planId}/duplicate": { post: { tags: [Membership Plans], summary: Duplicate a plan as a new inactive draft, security: [{bearerAuth: []}], responses: { 201: { description: Duplicated } } } } } */
membershipPlanRouter.post(
  '/:planId/duplicate',
  requirePermission('memberships:create'),
  validate({ params: membershipPlanParamSchema }),
  asyncHandler(membershipPlanController.duplicate.bind(membershipPlanController)),
);
