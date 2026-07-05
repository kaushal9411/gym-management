import type { Request, Response } from 'express';
import type { z } from 'zod';

import { env } from '../../../config/env';
import { UnauthenticatedError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { sendSuccess } from '../../../core/http/response';
import { cache } from '../../../infrastructure/cache/redis';
import { tenantRepository } from '../../tenants/repository/tenant.repository';
import { tenantService } from '../../tenants/service/tenant.service';
import { buildAuthModule } from '../utils/auth-module.factory';
import type {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerGymSchema,
  resendOtpSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  sessionIdParamSchema,
  verifyEmailSchema,
  verifyOtpSchema,
} from '../validators/auth.validators';

const REFRESH_COOKIE_NAME = 'fc_refresh_token';
const TRIAL_DAYS = 14;

/** Express's own generics require the params slot to be a string-keyed record — these aliases keep call sites terse. */
type ParamsDictionary = Record<string, string>;
type TypedBodyRequest<Body> = Request<ParamsDictionary, unknown, Body>;
type TypedQueryRequest<Query> = Request<ParamsDictionary, unknown, unknown, Query>;
type TypedParamsRequest<Params extends ParamsDictionary> = Request<Params>;

function deviceInfo(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    expires: expiresAt,
    path: '/api/v1/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
}

function requireTenant(req: Request) {
  if (!req.tenant) throw new UnauthenticatedError(ErrorCode.TENANT_NOT_FOUND, 'Tenant context is required');
  return req.tenant;
}

function requireAuth(req: Request) {
  if (!req.auth) throw new UnauthenticatedError();
  return req.auth;
}

/** Immediately revokes the access token used to CALL logout (see authenticate.middleware.ts's denylist check). */
async function denylistCurrentAccessToken(req: Request): Promise<void> {
  if (!req.auth?.exp) return;
  const ttlSeconds = req.auth.exp - Math.floor(Date.now() / 1000);
  if (ttlSeconds > 0) await cache.set(`denylist:jti:${req.auth.jti}`, true, ttlSeconds);
}

export class AuthController {
  /** POST /auth/register — platform route, no tenant resolved yet (creates one). */
  async register(req: TypedBodyRequest<z.infer<typeof registerGymSchema>>, res: Response): Promise<void> {
    const input = req.body;
    await tenantService.assertSlugAvailable(input.slug);

    const tenantRecord = await tenantRepository.createTenantWithSettings({
      slug: input.slug,
      name: input.gymName,
      trialDays: TRIAL_DAYS,
    });

    const authService = buildAuthModule(tenantRecord.id);
    const result = await authService.registerGymOwner(input);

    sendSuccess(
      res,
      result,
      'Gym created — check your email to verify your account.',
      201,
    );
  }

  async login(req: TypedBodyRequest<z.infer<typeof loginSchema>>, res: Response): Promise<void> {
    const tenant = requireTenant(req);
    const authService = buildAuthModule(tenant.id);
    const result = await authService.login(req.body.email, req.body.password, deviceInfo(req));

    if ('challenge' in result) {
      sendSuccess(res, result, 'Verification code required', 200);
      return;
    }

    setRefreshCookie(res, result.refreshToken, new Date(Date.now() + env.jwt.refreshTtlDays * 86_400_000));
    sendSuccess(res, result, 'Login successful');
  }

  async verifyOtp(req: TypedBodyRequest<z.infer<typeof verifyOtpSchema>>, res: Response): Promise<void> {
    const tenant = requireTenant(req);
    const authService = buildAuthModule(tenant.id);
    const result = await authService.verifyOtpAndCompleteLogin(req.body.email, req.body.code, req.body.purpose);

    setRefreshCookie(res, result.refreshToken, new Date(Date.now() + env.jwt.refreshTtlDays * 86_400_000));
    sendSuccess(res, result, 'Verification successful');
  }

  async resendOtp(req: TypedBodyRequest<z.infer<typeof resendOtpSchema>>, res: Response): Promise<void> {
    const tenant = requireTenant(req);
    const authService = buildAuthModule(tenant.id);
    await authService.resendOtp(req.body.email, req.body.purpose);
    sendSuccess(res, null, 'If the account exists, a new code has been sent.');
  }

  async refresh(req: TypedBodyRequest<z.infer<typeof refreshSchema>>, res: Response): Promise<void> {
    const tenant = requireTenant(req);
    const token = req.body.refreshToken ?? (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined);
    if (!token) throw new UnauthenticatedError(ErrorCode.TOKEN_INVALID, 'No refresh token provided');

    const authService = buildAuthModule(tenant.id);
    const tokens = await authService.refreshTokens(token, deviceInfo(req));

    setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
    sendSuccess(res, {
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
      refreshToken: tokens.refreshToken,
    });
  }

  async logout(req: Request, res: Response): Promise<void> {
    const tenant = requireTenant(req);
    const token = (req.body as { refreshToken?: string } | undefined)?.refreshToken ??
      (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined);
    const authService = buildAuthModule(tenant.id);
    await authService.logoutCurrentDevice(token, req.auth?.sid);
    await denylistCurrentAccessToken(req);

    clearRefreshCookie(res);
    sendSuccess(res, null, 'Logged out');
  }

  async logoutAllDevices(req: Request, res: Response): Promise<void> {
    const tenant = requireTenant(req);
    const auth = requireAuth(req);
    const authService = buildAuthModule(tenant.id);
    await authService.logoutAllDevices(auth.sub as string);
    await denylistCurrentAccessToken(req);

    clearRefreshCookie(res);
    sendSuccess(res, null, 'Signed out of all devices');
  }

  async listSessions(req: Request, res: Response): Promise<void> {
    const tenant = requireTenant(req);
    const auth = requireAuth(req);
    const authService = buildAuthModule(tenant.id);
    const sessions = await authService.listSessions(auth.sub as string, auth.sid);
    sendSuccess(res, sessions);
  }

  async logoutDevice(req: TypedParamsRequest<z.infer<typeof sessionIdParamSchema>>, res: Response): Promise<void> {
    const tenant = requireTenant(req);
    const auth = requireAuth(req);
    const authService = buildAuthModule(tenant.id);
    await authService.logoutDevice(auth.sub as string, req.params.sessionId);
    sendSuccess(res, null, 'Device signed out');
  }

  async forgotPassword(req: TypedBodyRequest<z.infer<typeof forgotPasswordSchema>>, res: Response): Promise<void> {
    const tenant = requireTenant(req);
    const authService = buildAuthModule(tenant.id);
    await authService.forgotPassword(req.body.email);
    sendSuccess(res, null, 'If an account exists for this email, a reset link is on its way.');
  }

  async resetPassword(req: TypedBodyRequest<z.infer<typeof resetPasswordSchema>>, res: Response): Promise<void> {
    const tenant = requireTenant(req);
    const authService = buildAuthModule(tenant.id);
    await authService.resetPassword(req.body.token, req.body.password);
    sendSuccess(res, null, 'Password updated. Please sign in with your new password.');
  }

  async changePassword(req: TypedBodyRequest<z.infer<typeof changePasswordSchema>>, res: Response): Promise<void> {
    const tenant = requireTenant(req);
    const auth = requireAuth(req);
    const authService = buildAuthModule(tenant.id);
    await authService.changePassword(auth.sub as string, req.body.currentPassword, req.body.newPassword);
    sendSuccess(res, null, 'Password changed. Please sign in again on your other devices.');
  }

  async verifyEmail(req: TypedQueryRequest<z.infer<typeof verifyEmailSchema>>, res: Response): Promise<void> {
    const tenant = requireTenant(req);
    const authService = buildAuthModule(tenant.id);
    const result = await authService.verifyEmail(req.query.token);
    sendSuccess(res, { status: result }, result === 'verified' ? 'Email verified' : 'Email was already verified');
  }

  async resendVerificationEmail(
    req: TypedBodyRequest<z.infer<typeof resendVerificationSchema>>,
    res: Response,
  ): Promise<void> {
    const tenant = requireTenant(req);
    const authService = buildAuthModule(tenant.id);
    await authService.resendVerificationEmail(req.body.email);
    sendSuccess(res, null, 'If the account exists and is unverified, a new link has been sent.');
  }

  async me(req: Request, res: Response): Promise<void> {
    const tenant = requireTenant(req);
    const auth = requireAuth(req);
    const authService = buildAuthModule(tenant.id);
    const profile = await authService.getCurrentUser(auth.sub as string);
    sendSuccess(res, profile);
  }

  /** GET /auth/validate — trivial once authenticateMiddleware has already run. */
  async validateToken(req: Request, res: Response): Promise<void> {
    const auth = requireAuth(req);
    sendSuccess(res, { valid: true, userId: auth.sub, tenantId: auth.tenantId, roles: auth.roles });
  }
}

export const authController = new AuthController();
