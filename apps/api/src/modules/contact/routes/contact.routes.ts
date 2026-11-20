import { Router } from 'express';

import { env } from '../../../config/env';
import { createRateLimiter } from '../../../core/middleware/rate-limiter';
import { validate } from '../../../core/middleware/validate.middleware';
import { contactController } from '../controllers/contact.controller';
import { contactRequestSchema } from '../validators/contact.validators';

export const contactRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

// 5 messages an hour per visitor in production; far looser elsewhere so testing the form never locks anyone out.
const contactRateLimiter = () => createRateLimiter({ windowMs: 60 * 60_000, max: env.isProduction ? 5 : 100, prefix: 'contact' });

/**
 * @openapi
 * /public/contact:
 *   post:
 *     tags: [Contact]
 *     summary: Submit a sales/billing inquiry (public — used by the expired-trial screens)
 *     responses:
 *       201: { description: Message queued for the team }
 *       429: { description: Rate limited }
 */
contactRouter.post(
  '/',
  contactRateLimiter(),
  validate({ body: contactRequestSchema }),
  asyncHandler(contactController.submit.bind(contactController)),
);
