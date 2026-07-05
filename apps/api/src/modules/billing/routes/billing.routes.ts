import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { billingController } from '../controllers/billing.controller';
import { billingAddressSchema } from '../validators/billing.validators';

export const billingRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/**
 * @openapi
 * /billing/address:
 *   get:
 *     tags: [Billing]
 *     summary: Billing Address — the current tenant's billing/tax address
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Billing address, or null if not yet set }
 *   put:
 *     tags: [Billing]
 *     summary: Create or replace the tenant's billing address
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [line1, city, state, postalCode, country]
 *             properties:
 *               legalName: { type: string }
 *               line1: { type: string }
 *               line2: { type: string }
 *               city: { type: string }
 *               state: { type: string }
 *               postalCode: { type: string }
 *               country: { type: string, example: US }
 *               taxId: { type: string }
 *     responses:
 *       200: { description: Saved billing address }
 */
billingRouter.get(
  '/address',
  authenticateMiddleware,
  requirePermission('billing:read'),
  asyncHandler(billingController.getAddress.bind(billingController)),
);
billingRouter.put(
  '/address',
  authenticateMiddleware,
  requirePermission('billing:manage'),
  validate({ body: billingAddressSchema }),
  asyncHandler(billingController.upsertAddress.bind(billingController)),
);
