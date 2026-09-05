import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError } from '../../../core/errors/app-error';

/**
 * Hard API-level enforcement of the platform-wide kill switch (Prompt 80)
 * — `req.tenant.featureFlags` (`tenantMiddleware`, already ran) is the SAME
 * plan-granted-AND-platform-enabled array nav-hiding reads on web/mobile,
 * so this middleware and the nav simply can't disagree. Mounted at the top
 * of each gated router, right after `authenticateMiddleware` — a disabled
 * module 403s every route under it, not just the ones a UI happens to hide.
 */
export function requireModuleEnabled(key: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.tenant && !req.tenant.featureFlags.includes(key)) {
      next(new ForbiddenError('This module is currently unavailable.'));
      return;
    }
    next();
  };
}
