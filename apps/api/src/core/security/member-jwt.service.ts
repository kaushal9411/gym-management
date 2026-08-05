import { randomUUID } from 'node:crypto';

import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

import { env } from '../../config/env';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';

/**
 * Claims for the member self-service portal — a third, fully independent
 * plane alongside the tenant staff (`AccessTokenClaims`) and admin
 * (`AdminAccessTokenClaims`) ones. No `role`/`permVer` — members have no
 * RBAC, every portal route just hard-filters by `sub` (the member id).
 * Signed under yet another distinct `audience`, same enforcement mechanism
 * as the admin plane: a staff or admin token fails verification here at
 * the signature layer, not a permission check afterward.
 */
export interface MemberAccessTokenClaims extends JwtPayload {
  sub: string; // member id
  tenantId: string;
  sid: string; // member session id
  jti: string;
}

export interface SignMemberAccessTokenInput {
  memberId: string;
  tenantId: string;
  sid: string;
}

export class MemberJwtService {
  signAccessToken(input: SignMemberAccessTokenInput): { token: string; jti: string; expiresAt: Date } {
    const jti = randomUUID();
    const token = jwt.sign(
      { tenantId: input.tenantId, sid: input.sid },
      env.jwt.privateKey,
      {
        algorithm: 'RS256',
        subject: input.memberId,
        issuer: env.jwt.issuer,
        audience: env.jwt.memberAudience,
        expiresIn: env.jwt.accessTtl as SignOptions['expiresIn'],
        jwtid: jti,
      },
    );

    const decoded = jwt.decode(token) as JwtPayload;
    return { token, jti, expiresAt: new Date((decoded.exp ?? 0) * 1000) };
  }

  verifyAccessToken(token: string): MemberAccessTokenClaims {
    try {
      const payload = jwt.verify(token, env.jwt.publicKey, {
        algorithms: ['RS256'],
        issuer: env.jwt.issuer,
        audience: env.jwt.memberAudience,
      });
      return payload as MemberAccessTokenClaims;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(ErrorCode.TOKEN_EXPIRED, 'Access token has expired', 401);
      }
      throw new AppError(ErrorCode.TOKEN_INVALID, 'Access token is invalid', 401);
    }
  }
}

export const memberJwtService = new MemberJwtService();
