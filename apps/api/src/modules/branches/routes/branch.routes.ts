import { Router } from 'express';

import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { branchController } from '../controllers/branch.controller';

export const branchRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/**
 * @openapi
 * /branches:
 *   get:
 *     tags: [Branches]
 *     summary: List the current tenant's active branches (for the portal's branch selector)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of branches }
 */
branchRouter.get('/', authenticateMiddleware, requirePermission('branches:read'), asyncHandler(branchController.list.bind(branchController)));
