import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { branchController } from '../controllers/branch.controller';
import { branchIdParamSchema, createBranchSchema, listBranchesQuerySchema, updateBranchSchema } from '../validators/branch.validators';

export const branchRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

branchRouter.use(authenticateMiddleware);

/**
 * @openapi
 * /branches:
 *   get:
 *     tags: [Branches]
 *     summary: Paginated branch list with search + filters (status)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ items, total, page, limit, totalPages }" }
 *   post:
 *     tags: [Branches]
 *     summary: Create a branch — auto-generates a Branch Code
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Branch created }
 *       409: { description: Duplicate branch name/code, or the plan's branch limit is reached }
 */
branchRouter.get('/', requirePermission('branches:view'), validate({ query: listBranchesQuerySchema }), asyncHandler(branchController.list.bind(branchController)));
branchRouter.post('/', requirePermission('branches:create'), validate({ body: createBranchSchema }), asyncHandler(branchController.create.bind(branchController)));

/**
 * @openapi
 * /branches/assignable:
 *   get:
 *     tags: [Branches]
 *     summary: Unfiltered active-branch list — backs the portal's branch selector and every branch-picker dropdown
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Active branches }
 */
branchRouter.get('/assignable', requirePermission('branches:view'), asyncHandler(branchController.listAssignable.bind(branchController)));

/**
 * @openapi
 * /branches/{branchId}:
 *   get:
 *     tags: [Branches]
 *     summary: Full branch detail
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Branch detail }
 *   patch:
 *     tags: [Branches]
 *     summary: Update a branch
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Branch updated }
 *   delete:
 *     tags: [Branches]
 *     summary: Soft-delete a branch (restorable; the default branch cannot be deleted, and a tenant must keep at least one active branch)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Branch deleted }
 *       409: { description: Default branch, or the tenant's last active branch }
 */
branchRouter.get(
  '/:branchId',
  requirePermission('branches:view'),
  validate({ params: branchIdParamSchema }),
  asyncHandler(branchController.getById.bind(branchController)),
);
branchRouter.patch(
  '/:branchId',
  requirePermission('branches:update'),
  validate({ params: branchIdParamSchema, body: updateBranchSchema }),
  asyncHandler(branchController.update.bind(branchController)),
);
branchRouter.delete(
  '/:branchId',
  requirePermission('branches:delete'),
  validate({ params: branchIdParamSchema }),
  asyncHandler(branchController.softDelete.bind(branchController)),
);

/** @openapi { "/branches/{branchId}/activate": { post: { tags: [Branches], summary: Activate a branch, security: [{bearerAuth: []}], responses: { 200: { description: Activated } } } } } */
branchRouter.post(
  '/:branchId/activate',
  requirePermission('branches:activate'),
  validate({ params: branchIdParamSchema }),
  asyncHandler(branchController.activate.bind(branchController)),
);

/** @openapi { "/branches/{branchId}/deactivate": { post: { tags: [Branches], summary: "Deactivate a branch (blocked for the default branch or the tenant's last active branch)", security: [{bearerAuth: []}], responses: { 200: { description: Deactivated }, 409: { description: Default branch or last active branch } } } } } */
branchRouter.post(
  '/:branchId/deactivate',
  requirePermission('branches:activate'),
  validate({ params: branchIdParamSchema }),
  asyncHandler(branchController.deactivate.bind(branchController)),
);

/** @openapi { "/branches/{branchId}/set-default": { post: { tags: [Branches], summary: "Set as the tenant's default branch (must already be active)", security: [{bearerAuth: []}], responses: { 200: { description: Default branch updated } } } } } */
branchRouter.post(
  '/:branchId/set-default',
  requirePermission('branches:update'),
  validate({ params: branchIdParamSchema }),
  asyncHandler(branchController.setDefault.bind(branchController)),
);

/** @openapi { "/branches/{branchId}/restore": { post: { tags: [Branches], summary: Restore a soft-deleted branch, security: [{bearerAuth: []}], responses: { 200: { description: Restored } } } } } */
branchRouter.post(
  '/:branchId/restore',
  requirePermission('branches:restore'),
  validate({ params: branchIdParamSchema }),
  asyncHandler(branchController.restore.bind(branchController)),
);
