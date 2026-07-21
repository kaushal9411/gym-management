import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { roleController } from '../controllers/role.controller';
import { cloneRoleSchema, createRoleSchema, roleIdParamSchema, updateRoleSchema } from '../validators/role.validators';

export const roleRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

roleRouter.use(authenticateMiddleware);

/**
 * @openapi
 * /roles:
 *   get:
 *     tags: [Roles]
 *     summary: List system + custom roles with permissions and user counts
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Role list }
 *   post:
 *     tags: [Roles]
 *     summary: Create a custom tenant role
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Role created }
 *       409: { description: Name already in use }
 */
roleRouter.get('/', requirePermission('roles:read'), asyncHandler(roleController.list.bind(roleController)));
roleRouter.post(
  '/',
  requirePermission('roles:manage-custom'),
  validate({ body: createRoleSchema }),
  asyncHandler(roleController.create.bind(roleController)),
);

/**
 * @openapi
 * /roles/{roleId}:
 *   get:
 *     tags: [Roles]
 *     summary: Get one role with its permission keys
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Role detail }
 *   patch:
 *     tags: [Roles]
 *     summary: Update a custom role (name, metadata, permission set)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Role updated }
 *       403: { description: System roles are immutable }
 *   delete:
 *     tags: [Roles]
 *     summary: Delete an unassigned custom role
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Role deleted }
 *       409: { description: Role still has users assigned }
 */
roleRouter.get(
  '/:roleId',
  requirePermission('roles:read'),
  validate({ params: roleIdParamSchema }),
  asyncHandler(roleController.getById.bind(roleController)),
);
roleRouter.patch(
  '/:roleId',
  requirePermission('roles:manage-custom'),
  validate({ params: roleIdParamSchema, body: updateRoleSchema }),
  asyncHandler(roleController.update.bind(roleController)),
);
roleRouter.delete(
  '/:roleId',
  requirePermission('roles:manage-custom'),
  validate({ params: roleIdParamSchema }),
  asyncHandler(roleController.delete.bind(roleController)),
);

/**
 * @openapi
 * /roles/{roleId}/clone:
 *   post:
 *     tags: [Roles]
 *     summary: Clone a system or custom role into a new custom role
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Role cloned }
 */
roleRouter.post(
  '/:roleId/clone',
  requirePermission('roles:manage-custom'),
  validate({ params: roleIdParamSchema, body: cloneRoleSchema }),
  asyncHandler(roleController.clone.bind(roleController)),
);
