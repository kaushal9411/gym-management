import type { MemberOtpPurpose } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

/** Mirrors `VerificationRepository`'s `OtpCode` methods line-for-line (staff plane), just against `MemberOtpCode`/`memberId`. */
export class MemberOtpRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async createOtp(tenantId: string, memberId: string, codeHash: string, purpose: MemberOtpPurpose, expiresAt: Date): Promise<void> {
    // Invalidate any prior unconsumed codes for the same purpose before issuing a new one.
    await this.db.memberOtpCode.updateMany({
      where: { tenantId, memberId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.db.memberOtpCode.create({ data: { tenantId, memberId, codeHash, purpose, expiresAt } });
  }

  async verifyOtp(tenantId: string, memberId: string, purpose: MemberOtpPurpose, codeHash: string) {
    const record = await this.db.memberOtpCode.findFirst({
      where: { tenantId, memberId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return 'invalid' as const;
    if (record.expiresAt.getTime() < Date.now()) return 'expired' as const;
    if (record.attempts >= record.maxAttempts) return 'max_attempts' as const;

    if (record.codeHash !== codeHash) {
      await this.db.memberOtpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      return 'invalid' as const;
    }

    await this.db.memberOtpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    return 'valid' as const;
  }

  async getLatestOtpIssuedAt(tenantId: string, memberId: string, purpose: MemberOtpPurpose): Promise<Date | null> {
    const record = await this.db.memberOtpCode.findFirst({
      where: { tenantId, memberId, purpose },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return record?.createdAt ?? null;
  }
}
