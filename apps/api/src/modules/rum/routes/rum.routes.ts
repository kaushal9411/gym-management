import { Router } from 'express';

import { createRateLimiter } from '../../../core/middleware/rate-limiter';
import { validate } from '../../../core/middleware/validate.middleware';
import { rumController } from '../controllers/rum.controller';
import { reportWebVitalSchema } from '../validators/rum.validators';

export const rumRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

// Several metrics fire per page load, from every visitor — a much higher
// ceiling than contact's 5/hour, but still bounded (this is a beacon
// sink, not something that should ever need unlimited throughput from one IP).
const rumRateLimiter = () => createRateLimiter({ windowMs: 60_000, max: 120, prefix: 'rum' });

/**
 * @openapi
 * /public/rum:
 *   post:
 *     tags: [RUM]
 *     summary: Report one Web Vitals metric from a real page load (public — fired via navigator.sendBeacon)
 *     responses:
 *       204: { description: Recorded }
 *       429: { description: Rate limited }
 */
rumRouter.post('/', rumRateLimiter(), validate({ body: reportWebVitalSchema }), asyncHandler(rumController.report.bind(rumController)));
