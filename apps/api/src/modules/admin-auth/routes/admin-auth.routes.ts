import { Router } from 'express';

import { createRateLimiter } from '../../../core/middleware/rate-limiter';
import { validate } from '../../../core/middleware/validate.middleware';
import { adminAuthController } from '../controllers/admin-auth.controller';
import { adminAuthenticateMiddleware } from '../middlewares/admin-authenticate.middleware';
import { adminLoginSchema, adminLogoutSchema, adminRefreshSchema } from '../validators/admin-auth.validators';

export const adminAuthRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

const loginRateLimiter = () => createRateLimiter({ windowMs: 15 * 60_000, max: 10, prefix: 'admin-login' });

/**
 * @openapi
 * /admin/auth/login:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Super Admin portal login — issues an admin-audience token pair, completely separate from tenant auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties: { email: { type: string }, password: { type: string } }
 *     responses:
 *       200: { description: "{ admin, accessToken, accessTokenExpiresAt, refreshToken }" }
 *       401: { description: Invalid credentials }
 *       423: { description: Account locked }
 */
adminAuthRouter.post('/login', loginRateLimiter(), validate({ body: adminLoginSchema }), asyncHandler(adminAuthController.login.bind(adminAuthController)));

/**
 * @openapi
 * /admin/auth/refresh:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Rotate an admin refresh token for a new access token
 *     responses:
 *       200: { description: New token pair }
 */
adminAuthRouter.post('/refresh', validate({ body: adminRefreshSchema }), asyncHandler(adminAuthController.refresh.bind(adminAuthController)));

/**
 * @openapi
 * /admin/auth/logout:
 *   post:
 *     tags: [Admin Auth]
 *     summary: Revoke the current admin refresh token
 *     responses:
 *       200: { description: Logged out }
 */
adminAuthRouter.post('/logout', validate({ body: adminLogoutSchema }), asyncHandler(adminAuthController.logout.bind(adminAuthController)));

/**
 * @openapi
 * /admin/auth/me:
 *   get:
 *     tags: [Admin Auth]
 *     summary: The currently authenticated admin's profile + permissions
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Admin profile }
 */
adminAuthRouter.get('/me', adminAuthenticateMiddleware, asyncHandler(adminAuthController.me.bind(adminAuthController)));
