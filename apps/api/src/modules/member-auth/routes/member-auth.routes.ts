import { Router } from 'express';

import { createRateLimiter } from '../../../core/middleware/rate-limiter';
import { validate } from '../../../core/middleware/validate.middleware';
import { memberAuthController } from '../controllers/member-auth.controller';
import {
  memberAcceptActivationSchema,
  memberActivationTokenParamSchema,
  memberForgotPasswordSchema,
  memberLoginSchema,
  memberLogoutSchema,
  memberRefreshSchema,
  memberResetPasswordSchema,
} from '../validators/member-auth.validators';

export const memberAuthRouter: Router = Router();

const asyncHandler =
  <T extends (req: never, res: never) => Promise<void>>(fn: T) =>
  (req: Parameters<T>[0], res: Parameters<T>[1], next: (err?: unknown) => void) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

const loginRateLimiter = () =>
  createRateLimiter({
    windowMs: 15 * 60_000,
    max: 10,
    prefix: 'member-login',
    keyGenerator: (req) => `${req.tenant?.id ?? 'platform'}:${String(req.body?.memberId ?? req.ip).toLowerCase()}`,
  });
const forgotPasswordRateLimiter = () =>
  createRateLimiter({
    windowMs: 15 * 60_000,
    max: 5,
    prefix: 'member-pwreset',
    keyGenerator: (req) => `${req.tenant?.id ?? 'platform'}:${String(req.body?.memberId ?? req.ip).toLowerCase()}`,
  });

memberAuthRouter.post('/login', loginRateLimiter(), validate({ body: memberLoginSchema }), asyncHandler(memberAuthController.login.bind(memberAuthController)));
memberAuthRouter.post('/refresh', validate({ body: memberRefreshSchema }), asyncHandler(memberAuthController.refresh.bind(memberAuthController)));
memberAuthRouter.post('/logout', validate({ body: memberLogoutSchema }), asyncHandler(memberAuthController.logout.bind(memberAuthController)));

memberAuthRouter.get(
  '/activate/:token',
  validate({ params: memberActivationTokenParamSchema }),
  asyncHandler(memberAuthController.lookupActivation.bind(memberAuthController)),
);
memberAuthRouter.post(
  '/activate',
  validate({ body: memberAcceptActivationSchema }),
  asyncHandler(memberAuthController.acceptActivation.bind(memberAuthController)),
);

memberAuthRouter.post(
  '/forgot-password',
  forgotPasswordRateLimiter(),
  validate({ body: memberForgotPasswordSchema }),
  asyncHandler(memberAuthController.forgotPassword.bind(memberAuthController)),
);
memberAuthRouter.get(
  '/reset-password/:token',
  validate({ params: memberActivationTokenParamSchema }),
  asyncHandler(memberAuthController.lookupPasswordReset.bind(memberAuthController)),
);
memberAuthRouter.post(
  '/reset-password',
  validate({ body: memberResetPasswordSchema }),
  asyncHandler(memberAuthController.resetPassword.bind(memberAuthController)),
);
