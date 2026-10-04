import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminDashboardController } from '../controllers/admin-dashboard.controller';
import { overviewQuerySchema } from '../validators/admin-dashboard.validators';

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

/**
 * @openapi
 * /admin/dashboard/overview:
 *   get:
 *     tags: [Admin Dashboard]
 *     summary: HUD overview — KPIs with previous-period deltas, daily series, plan mix, at-risk tenants, activity, health. Sections gated by payments:read / revenue:read / support:manage / scheduler:view degrade to null or empty.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: range
 *         schema: { type: string, enum: [7d, 30d, 90d], default: 30d }
 *     responses:
 *       200: { description: Overview payload }
 *       422: { description: Invalid range }
 */
adminDashboardRouter.get(
  '/overview',
  adminAuthenticateMiddleware,
  requireAdminPermission('dashboard:read'),
  validate({ query: overviewQuerySchema }),
  asyncHandler(adminDashboardController.getOverview.bind(adminDashboardController)),
);
