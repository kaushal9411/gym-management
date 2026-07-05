import { Router } from 'express';

import { validate } from '../../../core/middleware/validate.middleware';
import { authenticateMiddleware } from '../../authentication/middlewares/authenticate.middleware';
import { requirePermission } from '../../authentication/middlewares/authorize.middleware';
import { subscriptionController } from '../controllers/subscription.controller';
import { cancelSubscriptionSchema, checkoutSchema } from '../validators/subscription.validators';

export const subscriptionRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

const requireBilling = [authenticateMiddleware, requirePermission('billing:manage')];
const requireBillingRead = [authenticateMiddleware, requirePermission('billing:read')];

/**
 * @openapi
 * /subscription:
 *   get:
 *     tags: [Subscription]
 *     summary: The current subscription (plan, status, period) for the logged-in tenant
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current subscription }
 *   post:
 *     tags: [Subscription]
 *     summary: Create Subscription — choose a plan (checkout flow — plan, coupon, tax, gateway, invoice, activation)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         schema: { type: string }
 *         description: Client-supplied key so a retried request never double-charges
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planSlug, billingCycle]
 *             properties:
 *               planSlug: { type: string, example: professional }
 *               billingCycle: { type: string, enum: [MONTHLY, YEARLY] }
 *               couponCode: { type: string }
 *               provider: { type: string, enum: [stripe, razorpay, paypal] }
 *               paymentToken: { type: string }
 *     responses:
 *       201: { description: "{ subscription, invoice, plan }" }
 *       402: { description: Payment required or failed }
 */
subscriptionRouter.get('/', ...requireBillingRead, asyncHandler(subscriptionController.getCurrent.bind(subscriptionController)));
subscriptionRouter.post(
  '/',
  ...requireBilling,
  validate({ body: checkoutSchema }),
  asyncHandler(subscriptionController.create.bind(subscriptionController)),
);

/**
 * @openapi
 * /subscription/upgrade:
 *   post:
 *     tags: [Subscription]
 *     summary: Upgrade Subscription — same checkout flow, rejected if the target plan isn't a higher tier
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: "{ subscription, invoice, plan }" }
 *       422: { description: Target plan is not an upgrade }
 */
subscriptionRouter.post(
  '/upgrade',
  ...requireBilling,
  validate({ body: checkoutSchema }),
  asyncHandler(subscriptionController.upgrade.bind(subscriptionController)),
);

/**
 * @openapi
 * /subscription/downgrade:
 *   post:
 *     tags: [Subscription]
 *     summary: Downgrade Subscription — same checkout flow, rejected if the target plan isn't a lower tier
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: "{ subscription, invoice, plan }" }
 *       422: { description: Target plan is not a downgrade }
 */
subscriptionRouter.post(
  '/downgrade',
  ...requireBilling,
  validate({ body: checkoutSchema }),
  asyncHandler(subscriptionController.downgrade.bind(subscriptionController)),
);

/**
 * @openapi
 * /subscription/cancel:
 *   post:
 *     tags: [Subscription]
 *     summary: Cancel Subscription — immediately, or at the end of the current billing period
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { immediate: { type: boolean, default: false }, reason: { type: string } }
 *     responses:
 *       200: { description: Updated subscription }
 */
subscriptionRouter.post(
  '/cancel',
  ...requireBilling,
  validate({ body: cancelSubscriptionSchema }),
  asyncHandler(subscriptionController.cancel.bind(subscriptionController)),
);

/**
 * @openapi
 * /subscription/renew:
 *   post:
 *     tags: [Subscription]
 *     summary: Renew Subscription — charges the saved default payment method for the next period
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: "{ subscription, invoice, plan }" }
 *       402: { description: No saved payment method, or the charge failed }
 */
subscriptionRouter.post('/renew', ...requireBilling, asyncHandler(subscriptionController.renew.bind(subscriptionController)));

/**
 * @openapi
 * /subscription/history:
 *   get:
 *     tags: [Subscription]
 *     summary: Subscription state-transition history (created/upgraded/downgraded/renewed/cancelled/...)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of subscription history entries, most recent first }
 */
subscriptionRouter.get('/history', ...requireBillingRead, asyncHandler(subscriptionController.history.bind(subscriptionController)));
