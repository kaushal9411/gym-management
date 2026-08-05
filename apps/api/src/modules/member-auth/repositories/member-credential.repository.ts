import type { MemberCredential, MemberPortalStatus } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class MemberCredentialRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async findByMemberId(tenantId: string, memberId: string): Promise<MemberCredential | null> {
    return this.db.memberCredential.findFirst({ where: { tenantId, memberId } });
  }

  async findById(tenantId: string, id: string): Promise<MemberCredential | null> {
    return this.db.memberCredential.findFirst({ where: { tenantId, id } });
  }

  async create(input: { tenantId: string; memberId: string; passwordHash: string; status: MemberPortalStatus }): Promise<MemberCredential> {
    return this.db.memberCredential.create({ data: input });
  }

  async setPassword(id: string, passwordHash: string): Promise<void> {
    await this.db.memberCredential.update({ where: { id }, data: { passwordHash, status: 'ACTIVE', failedLoginAttempts: 0, lockedUntil: null } });
  }

  async setStatus(id: string, status: MemberPortalStatus): Promise<void> {
    await this.db.memberCredential.update({ where: { id }, data: { status } });
  }

  async recordFailedLogin(id: string, attempts: number, lockedUntil: Date | null): Promise<void> {
    await this.db.memberCredential.update({ where: { id }, data: { failedLoginAttempts: attempts, lockedUntil } });
  }

  async resetFailedLogins(id: string): Promise<void> {
    await this.db.memberCredential.update({ where: { id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.db.memberCredential.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }
}
