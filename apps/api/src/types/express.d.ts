import type { AdminAccessTokenClaims } from '../core/security/admin-jwt.service';
import type { AccessTokenClaims } from '../core/security/jwt.service';
import type { ResolvedTenant } from '../modules/tenants/interfaces/tenant.interface';

declare global {
  namespace Express {
    interface Request {
      /** Resolved by tenantMiddleware. `null` only on platform routes (register, health, docs). */
      tenant?: ResolvedTenant | null;
      /** Populated by authenticateMiddleware after JWT verification. */
      auth?: AccessTokenClaims;
      /** Populated by adminAuthenticateMiddleware — completely separate from `auth` (see admin-jwt.service.ts). */
      admin?: AdminAccessTokenClaims;
    }
  }
}

export {};
