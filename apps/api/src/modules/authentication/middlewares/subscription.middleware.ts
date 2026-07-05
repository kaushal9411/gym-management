import type { NextFunction, Request, Response } from 'express';

import { TenantError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';

/**
 * Subscription/trial/maintenance validation itself runs inside
 * tenantMiddleware (modules/tenants/middleware/tenant.middleware.ts),
 * immediately after the tenant is resolved — that's the only point with
 * the raw trial/subscription dates needed to decide, and doing it there
 * avoids a second database round trip per request.
 *
 * This middleware is the explicit, semantic gate for routes that must
 * NEVER be reached without a fully-validated subscription — it fails
 * loudly if tenantMiddleware was accidentally skipped for a route (e.g. a
 * future module wiring its router directly instead of through the shared
 * pipeline), rather than silently allowing an unvalidated tenant through.
 */
export function subscriptionMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.tenant === undefined) {
    next(new TenantError(ErrorCode.TENANT_NOT_FOUND, 'Tenant was not resolved before subscription check', 500));
    return;
  }
  next();
}
