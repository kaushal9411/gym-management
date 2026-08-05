import type { MemberSession } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

/**
 * One row per refresh token, same combined shape as the admin plane's
 * `AdminRefreshToken` (not the tenant staff plane's split RefreshToken +
 * UserSession pair — the member portal has no "manage my devices" UI in
 * this pass, so there's no separate user-facing session record to keep
 * in lockstep).
 */
export class MemberSessionRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async findByTokenHash(tokenHash: string): Promise<MemberSession | null> {
    return this.db.memberSession.findUnique({ where: { tokenHash } });
  }

  async create(input: {
    tenantId: string;
    memberId: string;
    tokenHash: string;
    family: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<MemberSession> {
    return this.db.memberSession.create({ data: input });
  }

  /** Rotation: revoke the old token, point it at the new hash, insert the new row — same family. Sequential, not `$transaction([...])` — see tenant-scoped-client.ts's own warning about batching on this client. */
  async rotate(
    oldTokenHash: string,
    next: { tenantId: string; memberId: string; tokenHash: string; family: string; expiresAt: Date; ipAddress?: string; userAgent?: string },
  ): Promise<MemberSession> {
    await this.db.memberSession.update({ where: { tokenHash: oldTokenHash }, data: { revokedAt: new Date(), replacedByTokenHash: next.tokenHash } });
    return this.db.memberSession.create({ data: next });
  }

  async revokeFamily(family: string): Promise<void> {
    await this.db.memberSession.updateMany({ where: { family, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revoke(tokenHash: string): Promise<void> {
    await this.db.memberSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeAllForMember(tenantId: string, memberId: string): Promise<void> {
    await this.db.memberSession.updateMany({ where: { tenantId, memberId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
