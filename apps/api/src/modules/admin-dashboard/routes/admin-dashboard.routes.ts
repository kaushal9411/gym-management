import { Router } from 'express';

import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminDashboardController } from '../controllers/admin-dashboard.controller';

export const adminDashboardRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/**
 * @openapi
 * /admin/dashboard/stats:
 *   get:
 *     tags: [Admin Dashboard]
 *     summary: Aggregated dashboard stats — tenant totals, revenue, growth chart, recent activity, ticket summary, top plans
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Dashboard stats }
 */
adminDashboardRouter.get(
  '/stats',
  adminAuthenticateMiddleware,
  requireAdminPermission('dashboard:read'),
  asyncHandler(adminDashboardController.getStats.bind(adminDashboardController)),
);
