import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { IMfaRepository } from '../interfaces/repositories.interface';

/** Backup codes, the login-time mandatory-setup grace token, and the tenant-wide `mfaRequiredRoles` policy read — all the 2FA state that isn't the `User.mfaEnabled`/`mfaSecret` pair itself (owned by `UserRepository`). */
export class MfaRepository implements IMfaRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async getMfaRequiredRoles(tenantId: string): Promise<string[]> {
    const settings = await this.db.tenantSettings.findFirst({ where: { tenantId }, select: { mfaRequiredRoles: true } });
    return (settings?.mfaRequiredRoles as string[] | undefined) ?? [];
  }

  async createSetupToken(tenantId: string, userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.mfaSetupToken.create({ data: { tenantId, userId, tokenHash, expiresAt } });
  }

  async findValidSetupToken(tokenHash: string): Promise<{ tenantId: string; userId: string } | null> {
    const record = await this.db.mfaSetupToken.findUnique({ where: { tokenHash } });
    if (!record || record.consumedAt || record.expiresAt.getTime() < Date.now()) return null;
    return { tenantId: record.tenantId, userId: record.userId };
  }

  async consumeSetupToken(tokenHash: string): Promise<void> {
    await this.db.mfaSetupToken.update({ where: { tokenHash }, data: { consumedAt: new Date() } });
  }

  async replaceBackupCodes(tenantId: string, userId: string, codeHashes: string[]): Promise<void> {
    await this.db.mfaBackupCode.deleteMany({ where: { tenantId, userId } });
    await this.db.mfaBackupCode.createMany({ data: codeHashes.map((codeHash) => ({ tenantId, userId, codeHash })) });
  }

  async consumeBackupCodeIfValid(tenantId: string, userId: string, codeHash: string): Promise<boolean> {
    const record = await this.db.mfaBackupCode.findFirst({ where: { tenantId, userId, codeHash, usedAt: null } });
    if (!record) return false;
    await this.db.mfaBackupCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return true;
  }

  async deleteAllBackupCodes(tenantId: string, userId: string): Promise<void> {
    await this.db.mfaBackupCode.deleteMany({ where: { tenantId, userId } });
  }
}
