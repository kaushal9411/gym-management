import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminRevenueController } from '../controllers/admin-revenue.controller';
import {
  revenueGrowthQuerySchema,
  revenueRangeQuerySchema,
} from '../validators/admin-revenue.validators';

export const adminRevenueRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

adminRevenueRouter.use(adminAuthenticateMiddleware, requireAdminPermission('revenue:read'));

/**
 * @openapi
 * /admin/revenue/summary:
 *   get:
 *     tags: [Admin Revenue]
 *     summary: Revenue Analytics — MRR, ARR, top plans, top countries, revenue by currency/gateway
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Revenue summary }
 */
adminRevenueRouter.get(
  '/summary',
  asyncHandler(adminRevenueController.summary.bind(adminRevenueController)),
);

/**
 * @openapi
 * /admin/revenue/growth:
 *   get:
 *     tags: [Admin Revenue]
 *     summary: "Revenue growth — daily SUCCEEDED revenue for the last N UTC days; optional single-currency filter (points carry currency, null = all summed)"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: days, schema: { type: integer, minimum: 1, maximum: 366, default: 30 } }
 *       - { in: query, name: currency, schema: { type: string, example: INR } }
 *     responses:
 *       200: { description: "[{ date, amount, currency }]" }
 *       422: { description: Invalid days/currency }
 */
adminRevenueRouter.get(
  '/growth',
  validate({ query: revenueGrowthQuerySchema }),
  asyncHandler(adminRevenueController.growth.bind(adminRevenueController)),
);

/**
 * @openapi
 * /admin/revenue/overview:
 *   get:
 *     tags: [Admin Revenue]
 *     summary: "Revenue page payload — KPIs with previous-period deltas, daily/monthly series, MRR by plan, gateway/currency/country splits, dunning, invoice aging, top tenants. Money KPIs are in the dominant currency."
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: range, schema: { type: string, enum: [30d, 90d, 12m], default: 30d } }
 *     responses:
 *       200: { description: Overview payload }
 *       422: { description: Invalid range }
 */
adminRevenueRouter.get(
  '/overview',
  validate({ query: revenueRangeQuerySchema }),
  asyncHandler(adminRevenueController.overview.bind(adminRevenueController)),
);

/**
 * @openapi
 * /admin/revenue/export:
 *   get:
 *     tags: [Admin Revenue]
 *     summary: "Export daily revenue as CSV (date, collected, failed, payments, currency); formula-injection safe; audited admin.revenue_exported"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: range, schema: { type: string, enum: [30d, 90d, 12m], default: 30d } }
 *     responses:
 *       200: { description: text/csv attachment }
 *       422: { description: Invalid range }
 */
adminRevenueRouter.get(
  '/export',
  validate({ query: revenueRangeQuerySchema }),
  asyncHandler(adminRevenueController.export.bind(adminRevenueController)),
);
