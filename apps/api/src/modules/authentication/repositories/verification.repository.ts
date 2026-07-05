import type { OtpPurpose } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { IVerificationRepository } from '../interfaces/repositories.interface';

/** Password resets, email verification links, and OTP codes — all "prove you control this" tokens. */
export class VerificationRepository implements IVerificationRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async createEmailVerification(tenantId: string, userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.emailVerification.create({ data: { tenantId, userId, tokenHash, expiresAt } });
  }

  async consumeEmailVerification(tokenHash: string) {
    const record = await this.db.emailVerification.findUnique({ where: { tokenHash } });
    if (!record) return 'not_found' as const;
    if (record.verifiedAt) return 'already_verified' as const;
    if (record.expiresAt.getTime() < Date.now()) return 'expired' as const;

    await this.db.emailVerification.update({ where: { tokenHash }, data: { verifiedAt: new Date() } });
    return { tenantId: record.tenantId, userId: record.userId };
  }

  async createPasswordReset(tenantId: string, userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.passwordReset.create({ data: { tenantId, userId, tokenHash, expiresAt } });
  }

  async consumePasswordReset(tokenHash: string) {
    const record = await this.db.passwordReset.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt) return 'not_found' as const;
    if (record.expiresAt.getTime() < Date.now()) return 'expired' as const;

    await this.db.passwordReset.update({ where: { tokenHash }, data: { usedAt: new Date() } });
    return { tenantId: record.tenantId, userId: record.userId };
  }

  async createOtp(tenantId: string, userId: string, codeHash: string, purpose: OtpPurpose, expiresAt: Date): Promise<void> {
    // Invalidate any prior unconsumed codes for the same purpose before issuing a new one.
    await this.db.otpCode.updateMany({
      where: { tenantId, userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.db.otpCode.create({ data: { tenantId, userId, codeHash, purpose, expiresAt } });
  }

  async verifyOtp(tenantId: string, userId: string, purpose: OtpPurpose, codeHash: string) {
    const record = await this.db.otpCode.findFirst({
      where: { tenantId, userId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return 'invalid' as const;
    if (record.expiresAt.getTime() < Date.now()) return 'expired' as const;
    if (record.attempts >= record.maxAttempts) return 'max_attempts' as const;

    if (record.codeHash !== codeHash) {
      await this.db.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      return 'invalid' as const;
    }

    await this.db.otpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    return 'valid' as const;
  }

  async getLatestOtpIssuedAt(tenantId: string, userId: string, purpose: OtpPurpose): Promise<Date | null> {
    const record = await this.db.otpCode.findFirst({
      where: { tenantId, userId, purpose },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return record?.createdAt ?? null;
  }
}
