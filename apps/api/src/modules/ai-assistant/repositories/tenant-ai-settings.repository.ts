import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export interface TenantAiSettingsUpdate {
  provider?: string | null;
  model?: string | null;
  apiKeyEncrypted?: string | null;
  baseUrl?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
}

export class TenantAiSettingsRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async find(tenantId: string) {
    return this.db.tenantAiSettings.findUnique({ where: { tenantId } });
  }

  async upsert(tenantId: string, data: TenantAiSettingsUpdate) {
    return this.db.tenantAiSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
  }

  /** Reverts to the platform default entirely. */
  async clear(tenantId: string) {
    await this.db.tenantAiSettings.deleteMany({ where: { tenantId } });
  }
}
