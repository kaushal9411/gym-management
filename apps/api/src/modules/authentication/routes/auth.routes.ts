import { Router } from 'express';

import {
  loginRateLimiter,
  otpRateLimiter,
  passwordResetRateLimiter,
  registrationRateLimiter,
} from '../../../core/middleware/rate-limiter';
import { validate } from '../../../core/middleware/validate.middleware';
import { authController } from '../controllers/auth.controller';
import { authenticateMiddleware } from '../middlewares/authenticate.middleware';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerGymSchema,
  resendOtpSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  sessionIdParamSchema,
  verifyEmailSchema,
  verifyOtpSchema,
} from '../validators/auth.validators';

export const authRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new gym (creates the tenant + its Owner account)
 *     description: Platform-plane route — no tenant subdomain required. Creates a bare TRIAL tenant and its first Owner user, then emails a verification link.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gymName, slug, ownerName, email, password]
 *             properties:
 *               gymName: { type: string, example: "Gold's Gym" }
 *               slug: { type: string, example: goldgym }
 *               ownerName: { type: string, example: Arjun Mehta }
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       201: { description: Gym created, verification email sent }
 *       409: { description: "Slug already taken or reserved" }
 *       422: { $ref: '#/components/responses/ValidationError' }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
authRouter.post(
  '/register',
  registrationRateLimiter(),
  validate({ body: registerGymSchema }),
  asyncHandler(authController.register.bind(authController)),
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Log in with email + password
 *     description: Tenant is resolved from the subdomain. Returns either an AuthSuccess payload or an OTP challenge if the account has 2FA enabled.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *               rememberMe: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: Login successful, or OTP challenge issued
 *         content: { application/json: { schema: { $ref: '#/components/schemas/AuthSuccess' } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: "Account suspended or email not verified" }
 *       423: { description: "Account locked after repeated failed attempts" }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
authRouter.post(
  '/login',
  loginRateLimiter(),
  validate({ body: loginSchema }),
  asyncHandler(authController.login.bind(authController)),
);

/**
 * @openapi
 * /auth/verify-otp:
 *   post:
 *     tags: [Authentication]
 *     summary: Complete login with a 6-digit OTP / 2FA code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string, format: email }
 *               code: { type: string, example: "123456" }
 *               purpose: { type: string, enum: [login, 2fa], default: login }
 *     responses:
 *       200: { content: { application/json: { schema: { $ref: '#/components/schemas/AuthSuccess' } } } }
 *       401: { description: "Code invalid or expired" }
 */
authRouter.post(
  '/verify-otp',
  otpRateLimiter(),
  validate({ body: verifyOtpSchema }),
  asyncHandler(authController.verifyOtp.bind(authController)),
);

/**
 * @openapi
 * /auth/resend-otp:
 *   post:
 *     tags: [Authentication]
 *     summary: Resend the OTP / 2FA code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *               purpose: { type: string, enum: [login, 2fa], default: login }
 *     responses:
 *       200: { description: "Code resent if the account exists" }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
authRouter.post(
  '/resend-otp',
  otpRateLimiter(),
  validate({ body: resendOtpSchema }),
  asyncHandler(authController.resendOtp.bind(authController)),
);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Authentication]
 *     summary: Rotate the refresh token and mint a new access token
 *     description: Refresh token may be supplied in the body (mobile) or read from the httpOnly cookie (web). Reuse of an already-rotated token revokes the entire session family.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { refreshToken: { type: string } }
 *     responses:
 *       200: { description: New token pair issued }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
authRouter.post('/refresh', validate({ body: refreshSchema }), asyncHandler(authController.refresh.bind(authController)));

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Log out of the current device
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Logged out }
 */
authRouter.post(
  '/logout',
  authenticateMiddleware,
  validate({ body: logoutSchema }),
  asyncHandler(authController.logout.bind(authController)),
);

/**
 * @openapi
 * /auth/logout-all:
 *   post:
 *     tags: [Authentication]
 *     summary: Log out of every device (revokes all sessions)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: All sessions revoked }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
authRouter.post('/logout-all', authenticateMiddleware, asyncHandler(authController.logoutAllDevices.bind(authController)));

/**
 * @openapi
 * /auth/sessions:
 *   get:
 *     tags: [Authentication]
 *     summary: List active sessions/devices for the current user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Active sessions }
 */
authRouter.get('/sessions', authenticateMiddleware, asyncHandler(authController.listSessions.bind(authController)));

/**
 * @openapi
 * /auth/sessions/{sessionId}:
 *   delete:
 *     tags: [Authentication]
 *     summary: Log out a specific device by session id
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Device signed out }
 *       404: { description: Session not found }
 */
authRouter.delete(
  '/sessions/:sessionId',
  authenticateMiddleware,
  validate({ params: sessionIdParamSchema }),
  asyncHandler(authController.logoutDevice.bind(authController)),
);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Request a password reset link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [email], properties: { email: { type: string, format: email } } }
 *     responses:
 *       200: { description: "Always succeeds — never reveals whether the account exists" }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
authRouter.post(
  '/forgot-password',
  passwordResetRateLimiter(),
  validate({ body: forgotPasswordSchema }),
  asyncHandler(authController.forgotPassword.bind(authController)),
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Reset password using a reset-link token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties: { token: { type: string }, password: { type: string, format: password } }
 *     responses:
 *       200: { description: Password updated, all sessions revoked }
 *       401: { description: "Token invalid or expired" }
 *       422: { $ref: '#/components/responses/ValidationError' }
 */
authRouter.post(
  '/reset-password',
  validate({ body: resetPasswordSchema }),
  asyncHandler(authController.resetPassword.bind(authController)),
);

/**
 * @openapi
 * /auth/change-password:
 *   patch:
 *     tags: [Authentication]
 *     summary: Change password (authenticated) — also covers "update password"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties: { currentPassword: { type: string }, newPassword: { type: string, format: password } }
 *     responses:
 *       200: { description: Password changed, other sessions revoked }
 *       422: { description: "Current password incorrect or policy violation" }
 */
authRouter.patch(
  '/change-password',
  authenticateMiddleware,
  validate({ body: changePasswordSchema }),
  asyncHandler(authController.changePassword.bind(authController)),
);

/**
 * @openapi
 * /auth/verify-email:
 *   get:
 *     tags: [Authentication]
 *     summary: Verify email address via link token
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "verified | already_verified" }
 *       401: { description: "Token invalid or expired" }
 */
authRouter.get(
  '/verify-email',
  validate({ query: verifyEmailSchema }),
  asyncHandler(authController.verifyEmail.bind(authController)),
);

/**
 * @openapi
 * /auth/resend-verification:
 *   post:
 *     tags: [Authentication]
 *     summary: Resend the email verification link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [email], properties: { email: { type: string, format: email } } }
 *     responses:
 *       200: { description: "Always succeeds — never reveals account state" }
 */
authRouter.post(
  '/resend-verification',
  registrationRateLimiter(),
  validate({ body: resendVerificationSchema }),
  asyncHandler(authController.resendVerificationEmail.bind(authController)),
);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get the current authenticated user's profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { content: { application/json: { schema: { $ref: '#/components/schemas/UserProfile' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
authRouter.get('/me', authenticateMiddleware, asyncHandler(authController.me.bind(authController)));

/**
 * @openapi
 * /auth/validate:
 *   get:
 *     tags: [Authentication]
 *     summary: Validate the current access token
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ valid: true, userId, tenantId, roles }" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
authRouter.get('/validate', authenticateMiddleware, asyncHandler(authController.validateToken.bind(authController)));
