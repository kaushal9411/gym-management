import { Router } from 'express';

import { env } from '../../../config/env';
import { createRateLimiter } from '../../../core/middleware/rate-limiter';
import { validate } from '../../../core/middleware/validate.middleware';
import { gymDiscoveryController } from '../controllers/gym-discovery.controller';
import { discoverGymsSchema } from '../validators/gym-discovery.validators';

export const gymDiscoveryRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

// Checks a password against every matching account, so it's throttled harder than a normal login.
const discoverRateLimiter = () =>
  createRateLimiter({
    windowMs: 15 * 60_000,
    max: env.isProduction ? 10 : 100,
    prefix: 'gym-discover',
    keyGenerator: (req) => `${req.ip}:${String(req.body?.identifier ?? '').toLowerCase()}`,
  });

/**
 * @openapi
 * /public/auth/discover-gyms:
 *   post:
 *     tags: [Authentication]
 *     summary: Find the gym(s) a staff email / Member ID + password belongs to (no auth, no tenant)
 *     description: Lets the mobile app show a plain login form first and only ask which gym when the credentials exist in more than one. Returns only gyms where the password verifies. The real tenant-scoped login must still follow.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [actorType, identifier, password]
 *             properties:
 *               actorType: { type: string, enum: [staff, member] }
 *               identifier: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: "{ gyms: [{ slug, name, logoUrl }] } — at least one" }
 *       401: { description: No account matches these credentials }
 *       429: { description: Rate limited }
 */
gymDiscoveryRouter.post(
  '/discover-gyms',
  discoverRateLimiter(),
  validate({ body: discoverGymsSchema }),
  asyncHandler(gymDiscoveryController.discover.bind(gymDiscoveryController)),
);
