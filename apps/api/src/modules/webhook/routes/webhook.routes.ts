import { Router } from 'express';

import { webhookController } from '../controllers/webhook.controller';

export const webhookRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/**
 * @openapi
 * /webhook/{provider}:
 *   post:
 *     tags: [Webhook]
 *     summary: Gateway webhook receiver — no tenant/auth context, verified by signature only
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema: { type: string, enum: [stripe, razorpay, paypal] }
 *       - in: header
 *         name: X-Webhook-Signature
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ received: true } or { deduped: true }" }
 *       400: { description: Invalid signature }
 *       404: { description: Unknown provider or payment }
 */
webhookRouter.post('/:provider', asyncHandler(webhookController.handle.bind(webhookController)));
