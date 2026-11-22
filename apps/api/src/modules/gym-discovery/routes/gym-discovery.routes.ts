import { Router } from 'express';

import { env } from '../../../config/env';
import { createRateLimiter } from '../../../core/middleware/rate-limiter';
import { validate } from '../../../core/middleware/validate.middleware';
import { crossGymAccessController } from '../controllers/cross-gym-access.controller';
import { gymDiscoveryController } from '../controllers/gym-discovery.controller';
import { crossGymForgotPasswordSchema, crossGymPhoneRequestSchema, crossGymPhoneVerifySchema, discoverGymsSchema } from '../validators/gym-discovery.validators';

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

// ── Forgot password / phone login without picking a gym ──────────────────

const crossGymLimiter = (prefix: string, max: number, key: 'identifier' | 'phone') =>
  createRateLimiter({
    windowMs: 15 * 60_000,
    max: env.isProduction ? max : 100,
    prefix,
    keyGenerator: (req) => `${req.ip}:${String(req.body?.[key] ?? '').toLowerCase()}`,
  });

/**
 * @openapi
 * /public/auth/forgot-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Forgot password for staff (email) or members (Member ID) without choosing a gym (no auth, no tenant)
 *     description: Sends the reset email for every gym the identifier exists in. Always answers the same way — never reveals whether an account exists.
 *     responses:
 *       200: { description: Generic acknowledgement }
 */
gymDiscoveryRouter.post(
  '/forgot-password',
  crossGymLimiter('xgym-forgot', 5, 'identifier'),
  validate({ body: crossGymForgotPasswordSchema }),
  asyncHandler(crossGymAccessController.forgotPassword.bind(crossGymAccessController)),
);

/**
 * @openapi
 * /public/auth/phone-login/request-otp:
 *   post:
 *     tags: [Authentication]
 *     summary: Email a phone-login code without choosing a gym (no auth, no tenant)
 *     description: |
 *       `actorType` is optional (default `any`) — a phone number cannot say whether it is staff or a member, so `any` runs the request flow for BOTH planes in every matching login-eligible gym. `staff` / `member` still restrict it to one plane. Always the same generic 200 — never reveals whether an account exists.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               actorType: { type: string, enum: [any, staff, member], default: any }
 *               phone: { type: string }
 *     responses:
 *       200: { description: Generic acknowledgement }
 */
gymDiscoveryRouter.post(
  '/phone-login/request-otp',
  crossGymLimiter('xgym-phone-otp', 5, 'phone'),
  validate({ body: crossGymPhoneRequestSchema }),
  asyncHandler(crossGymAccessController.requestPhoneOtp.bind(crossGymAccessController)),
);

/**
 * @openapi
 * /public/auth/phone-login/verify-otp:
 *   post:
 *     tags: [Authentication]
 *     summary: Verify a phone-login code; the gym whose code it is signs the person in (no auth, no tenant)
 *     description: |
 *       Returns that gym's normal login result plus `tenantSlug` and `actorType` (`staff` | `member`, the plane that matched) so the app can build the right session and load only that gym. `actorType` in the request is optional (default `any` = try the staff plane, then the member plane); `staff` / `member` restrict it to one plane. Wrong/unknown phone is a generic OTP_INVALID; a stale code OTP_EXPIRED.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, code]
 *             properties:
 *               actorType: { type: string, enum: [any, staff, member], default: any }
 *               phone: { type: string }
 *               code: { type: string, example: "123456" }
 *     responses:
 *       200: { description: Login result (or a 2FA / MFA-setup challenge) with tenantSlug }
 *       401: { description: Incorrect or expired code }
 */
gymDiscoveryRouter.post(
  '/phone-login/verify-otp',
  crossGymLimiter('xgym-phone-verify', 10, 'phone'),
  validate({ body: crossGymPhoneVerifySchema }),
  asyncHandler(crossGymAccessController.verifyPhoneOtp.bind(crossGymAccessController)),
);
