import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { userController } from '../controllers/user.controller';
import {
  bulkImportSchema,
  createUserSchema,
  listUsersQuerySchema,
  setBranchesSchema,
  setPermissionOverridesSchema,
  setRolesSchema,
  updateUserSchema,
  userIdParamSchema,
} from '../validators/user.validators';

export const userRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

userRouter.use(authenticateMiddleware);

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Paginated staff list with search + filters (status, role, branch, dates)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ items, total, page, limit, totalPages }" }
 *   post:
 *     tags: [Users]
 *     summary: Create a staff account directly (skips invitation)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: User created }
 *       409: { description: Duplicate email or phone }
 */
userRouter.get(
  '/',
  requirePermission('users:read'),
  validate({ query: listUsersQuerySchema }),
  asyncHandler(userController.list.bind(userController)),
);
userRouter.post(
  '/',
  requirePermission('users:manage'),
  validate({ body: createUserSchema }),
  asyncHandler(userController.create.bind(userController)),
);

/**
 * @openapi
 * /users/export:
 *   get:
 *     tags: [Users]
 *     summary: Download the staff list as CSV (opens in Excel)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: CSV file }
 */
userRouter.get('/export', requirePermission('users:export'), asyncHandler(userController.exportCsv.bind(userController)));

/**
 * @openapi
 * /users/import:
 *   post:
 *     tags: [Users]
 *     summary: Bulk-create users from parsed CSV rows (client parses the file)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: All rows imported }
 *       207: { description: "Partial success - see failed[]" }
 */
userRouter.post(
  '/import',
  requirePermission('users:manage'),
  validate({ body: bulkImportSchema }),
  asyncHandler(userController.bulkImport.bind(userController)),
);

/**
 * @openapi
 * /users/{userId}:
 *   get:
 *     tags: [Users]
 *     summary: Full user detail — roles, branch access, overrides, effective permissions
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User detail }
 *   patch:
 *     tags: [Users]
 *     summary: Update profile fields (name, email, phone, avatar, emergency contact)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User updated }
 *   delete:
 *     tags: [Users]
 *     summary: Soft-delete a user (restorable; sessions revoked)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User deleted }
 */
userRouter.get(
  '/:userId',
  requirePermission('users:read'),
  validate({ params: userIdParamSchema }),
  asyncHandler(userController.getById.bind(userController)),
);
userRouter.patch(
  '/:userId',
  requirePermission('users:manage'),
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  asyncHandler(userController.update.bind(userController)),
);
userRouter.delete(
  '/:userId',
  requirePermission('users:manage'),
  validate({ params: userIdParamSchema }),
  asyncHandler(userController.softDelete.bind(userController)),
);

/** @openapi { "/users/{userId}/suspend": { post: { tags: [Users], summary: Suspend a user and revoke their sessions, security: [{bearerAuth: []}], responses: { 200: { description: Suspended } } } } } */
userRouter.post(
  '/:userId/suspend',
  requirePermission('users:manage'),
  validate({ params: userIdParamSchema }),
  asyncHandler(userController.suspend.bind(userController)),
);

/** @openapi { "/users/{userId}/deactivate": { post: { tags: [Users], summary: Deactivate a user, security: [{bearerAuth: []}], responses: { 200: { description: Deactivated } } } } } */
userRouter.post(
  '/:userId/deactivate',
  requirePermission('users:manage'),
  validate({ params: userIdParamSchema }),
  asyncHandler(userController.deactivate.bind(userController)),
);

/** @openapi { "/users/{userId}/restore": { post: { tags: [Users], summary: Restore a suspended/deactivated/deleted user, security: [{bearerAuth: []}], responses: { 200: { description: Restored } } } } } */
userRouter.post(
  '/:userId/restore',
  requirePermission('users:manage'),
  validate({ params: userIdParamSchema }),
  asyncHandler(userController.restore.bind(userController)),
);

/** @openapi { "/users/{userId}/roles": { put: { tags: [Users], summary: Replace the user's role set, security: [{bearerAuth: []}], responses: { 200: { description: Roles updated } } } } } */
userRouter.put(
  '/:userId/roles',
  requirePermission('users:manage'),
  validate({ params: userIdParamSchema, body: setRolesSchema }),
  asyncHandler(userController.setRoles.bind(userController)),
);

/** @openapi { "/users/{userId}/branches": { put: { tags: [Users], summary: Replace the user's branch access, security: [{bearerAuth: []}], responses: { 200: { description: Branch access updated } } } } } */
userRouter.put(
  '/:userId/branches',
  requirePermission('users:manage'),
  validate({ params: userIdParamSchema, body: setBranchesSchema }),
  asyncHandler(userController.setBranches.bind(userController)),
);

/** @openapi { "/users/{userId}/permissions": { put: { tags: [Users], summary: Replace the user's permission overrides (GRANT/DENY), security: [{bearerAuth: []}], responses: { 200: { description: Overrides updated } } } } } */
userRouter.put(
  '/:userId/permissions',
  requirePermission('users:manage'),
  validate({ params: userIdParamSchema, body: setPermissionOverridesSchema }),
  asyncHandler(userController.setPermissionOverrides.bind(userController)),
);
