import { randomUUID } from 'node:crypto';

import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

import { env } from '../../config/env';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';

/** Claims embedded in every access token — kept minimal and cache-friendly. */
export interface AccessTokenClaims extends JwtPayload {
  sub: string; // user id
  tenantId: string;
  role: string;
  roles: string[];
  permVer: number;
  sid: string; // session id (UserSession.id) — lets logout-this-device revoke precisely
  jti: string;
  /** Set only on Super Admin impersonation tokens (see admin-tenants module) — makes every such session auditable at a glance. */
  impersonatedByAdminId?: string;
}

export interface SignAccessTokenInput {
  userId: string;
  tenantId: string;
  role: string;
  roles: string[];
  permVer: number;
  sessionId: string;
  impersonatedByAdminId?: string;
  /** Overrides the default TTL — impersonation tokens are deliberately short-lived. */
  expiresInOverride?: string;
}

/**
 * RS256 access/refresh-adjacent signing. Access tokens are self-contained
 * and short-lived; refresh tokens are opaque (see token.util.ts) and never
 * JWTs — this service only ever signs the access token.
 */
export class JwtService {
  signAccessToken(input: SignAccessTokenInput): { token: string; jti: string; expiresAt: Date } {
    const jti = randomUUID();
    const token = jwt.sign(
      {
        tenantId: input.tenantId,
        role: input.role,
        roles: input.roles,
        permVer: input.permVer,
        sid: input.sessionId,
        ...(input.impersonatedByAdminId ? { impersonatedByAdminId: input.impersonatedByAdminId } : {}),
      },
      env.jwt.privateKey,
      {
        algorithm: 'RS256',
        subject: input.userId,
        issuer: env.jwt.issuer,
        audience: env.jwt.audience,
        // env.jwt.accessTtl is a validated env string (e.g. "15m") — the `ms`
        // string-literal union `jsonwebtoken` types `expiresIn` against is
        // narrower than a plain `string`, hence the cast.
        expiresIn: (input.expiresInOverride ?? env.jwt.accessTtl) as SignOptions['expiresIn'],
        jwtid: jti,
      },
    );

    const decoded = jwt.decode(token) as JwtPayload;
    return { token, jti, expiresAt: new Date((decoded.exp ?? 0) * 1000) };
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    try {
      const payload = jwt.verify(token, env.jwt.publicKey, {
        algorithms: ['RS256'],
        issuer: env.jwt.issuer,
        audience: env.jwt.audience,
      });
      return payload as AccessTokenClaims;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(ErrorCode.TOKEN_EXPIRED, 'Access token has expired', 401);
      }
      throw new AppError(ErrorCode.TOKEN_INVALID, 'Access token is invalid', 401);
    }
  }
}

export const jwtService = new JwtService();
