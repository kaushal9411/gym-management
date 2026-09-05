import { Router } from 'express';

import { razorpayWebhookController } from '../controllers/razorpay-webhook.controller';

export const razorpayWebhookRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/**
 * @openapi
 * /webhook/razorpay-payment-link:
 *   post:
 *     tags: [Webhook]
 *     summary: Razorpay Payment Link webhook — auto-resolves platform billing + member payment links (no auth, verified by signature only)
 *     parameters:
 *       - in: header
 *         name: X-Razorpay-Signature
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ received: true } or { ignored: true } for events this endpoint doesn't act on" }
 *       400: { description: Invalid signature }
 */
razorpayWebhookRouter.post('/', asyncHandler(razorpayWebhookController.handle.bind(razorpayWebhookController)));
