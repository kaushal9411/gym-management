import type { NextFunction, Request, Response } from 'express';

import { UnauthenticatedError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { updateRequestContext } from '../../../core/logging/request-context';
import { jwtService } from '../../../core/security/jwt.service';
import { cache } from '../../../infrastructure/cache/redis';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

/**
 * Verifies the access token and enforces that its `tenantId` claim matches
 * the tenant already resolved from the subdomain (tenantMiddleware must run
 * first). A token minted for one tenant can never authenticate against
 * another tenant's subdomain, even if somehow replayed there.
 */
export async function authenticateMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) throw new UnauthenticatedError(ErrorCode.UNAUTHENTICATED, 'Authentication required');

    const claims = jwtService.verifyAccessToken(token);

    const denied = await cache.get<boolean>(`denylist:jti:${claims.jti}`);
    if (denied) throw new UnauthenticatedError(ErrorCode.TOKEN_INVALID, 'This session has been signed out');

    if (!req.tenant || req.tenant.id !== claims.tenantId) {
      throw new UnauthenticatedError(ErrorCode.TOKEN_INVALID, 'Token does not match the current tenant');
    }

    req.auth = claims;
    updateRequestContext({ userId: claims.sub });
    next();
  } catch (error) {
    next(error);
  }
}
