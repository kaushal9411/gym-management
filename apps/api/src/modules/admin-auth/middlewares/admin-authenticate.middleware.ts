import type { NextFunction, Request, Response } from 'express';

import { UnauthenticatedError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { adminJwtService } from '../../../core/security/admin-jwt.service';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

/**
 * Verifies an admin-audience access token. A tenant access token (different
 * `aud` claim) is rejected here at the signature-verification layer, not by
 * a permission check afterward — see admin-jwt.service.ts for why that
 * distinction matters for "gym owners must never access this portal."
 */
export function adminAuthenticateMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractBearerToken(req);
    if (!token) throw new UnauthenticatedError(ErrorCode.UNAUTHENTICATED, 'Authentication required');

    req.admin = adminJwtService.verifyAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
}
