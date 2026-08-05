import type { NextFunction, Request, Response } from 'express';

import { UnauthenticatedError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { memberJwtService } from '../../../core/security/member-jwt.service';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

/**
 * Verifies a member-audience access token and enforces that its `tenantId`
 * claim matches the tenant already resolved from the subdomain — same
 * cross-tenant-replay guard as the staff plane's `authenticateMiddleware`.
 * No Redis denylist check (unlike the staff plane) — logout revokes the
 * refresh token, not the still-live short-TTL access token; deliberately
 * out of scope for this pass, matching the access token's own short life.
 */
export function memberAuthenticateMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractBearerToken(req);
    if (!token) throw new UnauthenticatedError(ErrorCode.UNAUTHENTICATED, 'Authentication required');

    const claims = memberJwtService.verifyAccessToken(token);
    if (!req.tenant || req.tenant.id !== claims.tenantId) {
      throw new UnauthenticatedError(ErrorCode.TOKEN_INVALID, 'Token does not match the current tenant');
    }

    req.memberAuth = claims;
    next();
  } catch (error) {
    next(error);
  }
}
