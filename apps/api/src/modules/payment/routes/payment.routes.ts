import { Router } from 'express';

import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { paymentController } from '../controllers/payment.controller';

export const paymentRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/**
 * @openapi
 * /payment/history:
 *   get:
 *     tags: [Payment]
 *     summary: Payment History — every charge attempt for the current tenant
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of payments, most recent first }
 */
paymentRouter.get(
  '/history',
  authenticateMiddleware,
  requirePermission('billing:read'),
  asyncHandler(paymentController.history.bind(paymentController)),
);

/**
 * @openapi
 * /payment/methods:
 *   get:
 *     tags: [Payment]
 *     summary: Saved payment methods for the current tenant
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of saved payment methods }
 */
paymentRouter.get(
  '/methods',
  authenticateMiddleware,
  requirePermission('billing:read'),
  asyncHandler(paymentController.listMethods.bind(paymentController)),
);
