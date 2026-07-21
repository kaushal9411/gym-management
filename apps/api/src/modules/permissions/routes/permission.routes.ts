import { Router } from 'express';

import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { permissionController } from '../controllers/permission.controller';

export const permissionRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

permissionRouter.use(authenticateMiddleware, requirePermission('permissions:read'));

/**
 * @openapi
 * /permissions:
 *   get:
 *     tags: [Permissions]
 *     summary: Permission registry grouped by resource
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ total, groups: [{ resource, permissions }] }" }
 */
permissionRouter.get('/', asyncHandler(permissionController.list.bind(permissionController)));

/**
 * @openapi
 * /permissions/matrix:
 *   get:
 *     tags: [Permissions]
 *     summary: Roles × permissions matrix
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ permissions, roles: [{ id, name, isSystem, permissionKeys }] }" }
 */
permissionRouter.get('/matrix', asyncHandler(permissionController.matrix.bind(permissionController)));
