import type { MemberVerification, MemberVerificationPurpose } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class MemberVerificationRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async create(input: { tenantId: string; memberId: string; purpose: MemberVerificationPurpose; tokenHash: string; expiresAt: Date }): Promise<MemberVerification> {
    return this.db.memberVerification.create({ data: input });
  }

  async findByTokenHash(tokenHash: string): Promise<MemberVerification | null> {
    return this.db.memberVerification.findUnique({ where: { tokenHash } });
  }

  async consume(id: string): Promise<void> {
    await this.db.memberVerification.update({ where: { id }, data: { consumedAt: new Date() } });
  }
}
