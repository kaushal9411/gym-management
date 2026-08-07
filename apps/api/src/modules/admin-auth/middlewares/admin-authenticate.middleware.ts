import type { NextFunction, Request, Response } from 'express';

import { UnauthenticatedError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { adminJwtService } from '../../../core/security/admin-jwt.service';
import { cache } from '../../../infrastructure/cache/redis';
import { adminUserRepository } from '../repositories/admin-user.repository';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

const STATUS_CACHE_TTL_SECONDS = 1800;
const statusCacheKey = (adminUserId: string) => `admin-status:${adminUserId}`;

/**
 * Verifies an admin-audience access token. A tenant access token (different
 * `aud` claim) is rejected here at the signature-verification layer, not by
 * a permission check afterward — see admin-jwt.service.ts for why that
 * distinction matters for "gym owners must never access this portal."
 *
 * Also re-checks the admin's LIVE status on every request (cache-aside,
 * same 30-min TTL as `requireAdminPermission`'s permission cache) — without
 * this, suspending an admin only blocked future logins/refreshes, not an
 * already-issued access token, which kept working for the rest of its
 * 15-minute lifetime (confirmed live). `AdminRoleService#setStatus` deletes
 * this cache key immediately on suspend, so the very next request — not
 * just the next login — sees the change.
 */
export async function adminAuthenticateMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) throw new UnauthenticatedError(ErrorCode.UNAUTHENTICATED, 'Authentication required');

    const claims = adminJwtService.verifyAccessToken(token);

    let status = await cache.get<string>(statusCacheKey(claims.sub));
    if (!status) {
      const admin = await adminUserRepository.findById(claims.sub);
      status = admin?.status ?? 'DEACTIVATED';
      await cache.set(statusCacheKey(claims.sub), status, STATUS_CACHE_TTL_SECONDS);
    }
    if (status !== 'ACTIVE') {
      throw new UnauthenticatedError(ErrorCode.ACCOUNT_SUSPENDED, 'This admin account is not active.');
    }

    req.admin = claims;
    next();
  } catch (error) {
    next(error);
  }
}
