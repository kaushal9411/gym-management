import { Router } from 'express';

import { adminAuthenticateMiddleware } from '../../admin-auth/middlewares/admin-authenticate.middleware';
import { requireAdminPermission } from '../../admin-auth/middlewares/admin-authorize.middleware';
import { adminRevenueController } from '../controllers/admin-revenue.controller';

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
adminRevenueRouter.get('/summary', asyncHandler(adminRevenueController.summary.bind(adminRevenueController)));

/** @openapi { "/admin/revenue/growth": { get: { tags: [Admin Revenue], summary: Revenue Growth over N days, security: [{bearerAuth: []}], responses: { 200: { description: Daily revenue series } } } } } */
adminRevenueRouter.get('/growth', asyncHandler(adminRevenueController.growth.bind(adminRevenueController)));
