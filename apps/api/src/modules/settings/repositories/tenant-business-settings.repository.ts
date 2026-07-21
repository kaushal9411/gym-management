import type { Prisma, TenantSettings } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

/**
 * Reads/writes `TenantSettings` — the single row backing Business Settings,
 * Email Settings, and Notification Preferences (three distinct API
 * resources sharing one underlying table, exactly like `TenantBranding`
 * already backs both the portal theme and this module's Branding page).
 */
export class TenantBusinessSettingsRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async find(tenantId: string): Promise<TenantSettings | null> {
    return this.db.tenantSettings.findFirst({ where: { tenantId } });
  }

  async update(
    tenantId: string,
    data: Omit<Prisma.TenantSettingsUncheckedUpdateInput, 'tenantId'>,
  ): Promise<TenantSettings> {
    const existing = await this.find(tenantId);
    if (!existing) {
      // Every tenant gets a TenantSettings row at provisioning — this is a
      // defensive fallback for pre-existing tenants from before that field set.
      return this.db.tenantSettings.create({
        data: { ...(data as Omit<Prisma.TenantSettingsUncheckedCreateInput, 'tenantId'>), tenantId },
      });
    }
    return this.db.tenantSettings.update({ where: { tenantId }, data });
  }
}
