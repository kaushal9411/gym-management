import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { financeDashboardController } from '../controllers/finance-dashboard.controller';
import { financeDashboardQuerySchema } from '../validators/finance.validators';

export const financeDashboardRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

financeDashboardRouter.use(authenticateMiddleware);

/** @openapi { "/finance/summary": { get: { tags: [Finance], summary: "Dashboard widgets — today's/monthly income, monthly expenses, outstanding payments, recent payments, revenue trend", security: [{bearerAuth: []}], responses: { 200: { description: Summary } } } } } */
financeDashboardRouter.get(
  '/summary',
  requirePermission('finance:view'),
  validate({ query: financeDashboardQuerySchema }),
  asyncHandler(financeDashboardController.getSummary.bind(financeDashboardController)),
);
