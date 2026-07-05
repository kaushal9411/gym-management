import { randomUUID } from 'node:crypto';

import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

import { env } from '../../config/env';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';

/**
 * Claims for the Super Admin portal — deliberately NOT shaped like
 * `AccessTokenClaims` (no `tenantId`/`roles[]`) and signed under a
 * different `audience`. A tenant access token fails verification here
 * (wrong audience), and an admin token fails verification against the
 * tenant `jwtService` — this is the actual enforcement mechanism behind
 * "gym owners must never access this portal," not just a permission check.
 */
export interface AdminAccessTokenClaims extends JwtPayload {
  sub: string; // admin user id
  role: string; // admin role name
  permVer: number;
  jti: string;
}

export interface SignAdminAccessTokenInput {
  adminUserId: string;
  role: string;
  permVer: number;
}

export class AdminJwtService {
  signAccessToken(input: SignAdminAccessTokenInput): { token: string; jti: string; expiresAt: Date } {
    const jti = randomUUID();
    const token = jwt.sign(
      { role: input.role, permVer: input.permVer },
      env.jwt.privateKey,
      {
        algorithm: 'RS256',
        subject: input.adminUserId,
        issuer: env.jwt.issuer,
        audience: env.jwt.adminAudience,
        expiresIn: env.jwt.accessTtl as SignOptions['expiresIn'],
        jwtid: jti,
      },
    );

    const decoded = jwt.decode(token) as JwtPayload;
    return { token, jti, expiresAt: new Date((decoded.exp ?? 0) * 1000) };
  }

  verifyAccessToken(token: string): AdminAccessTokenClaims {
    try {
      const payload = jwt.verify(token, env.jwt.publicKey, {
        algorithms: ['RS256'],
        issuer: env.jwt.issuer,
        audience: env.jwt.adminAudience,
      });
      return payload as AdminAccessTokenClaims;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(ErrorCode.TOKEN_EXPIRED, 'Access token has expired', 401);
      }
      throw new AppError(ErrorCode.TOKEN_INVALID, 'Access token is invalid', 401);
    }
  }
}

export const adminJwtService = new AdminJwtService();
