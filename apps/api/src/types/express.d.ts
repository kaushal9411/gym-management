import type { AdminAccessTokenClaims } from '../core/security/admin-jwt.service';
import type { AccessTokenClaims } from '../core/security/jwt.service';
import type { MemberAccessTokenClaims } from '../core/security/member-jwt.service';
import type { AttendanceDeviceRow } from '../modules/attendance-devices/repositories/attendance-device.repository';
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
      /** Populated by memberAuthenticateMiddleware — completely separate from `auth`/`admin` (see member-jwt.service.ts). */
      memberAuth?: MemberAccessTokenClaims;
      /** Populated by authenticateDeviceMiddleware (`X-Device-Key` header) — a fourth, even narrower auth plane: one physical attendance reader, not a user. */
      attendanceDevice?: AttendanceDeviceRow;
      /** Captured by `express.json()`'s `verify` callback in `app.ts` — the exact unparsed bytes of the request body, needed by gateway webhook signature verification (a re-serialized `JSON.stringify(req.body)` can differ from what the sender actually signed). */
      rawBody?: Buffer;
    }
  }
}

export {};
