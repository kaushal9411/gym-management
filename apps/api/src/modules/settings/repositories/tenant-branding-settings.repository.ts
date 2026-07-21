import type { Prisma, TenantBranding } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

/** Reads/writes `TenantBranding` for this module's Branding page (colors, theme, logo/favicon/banner uploads). */
export class TenantBrandingSettingsRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async find(tenantId: string): Promise<TenantBranding | null> {
    return this.db.tenantBranding.findFirst({ where: { tenantId } });
  }

  async update(
    tenantId: string,
    data: Omit<Prisma.TenantBrandingUncheckedUpdateInput, 'tenantId'>,
  ): Promise<TenantBranding> {
    const existing = await this.find(tenantId);
    if (!existing) {
      return this.db.tenantBranding.create({
        data: { ...(data as Omit<Prisma.TenantBrandingUncheckedCreateInput, 'tenantId'>), tenantId },
      });
    }
    return this.db.tenantBranding.update({ where: { tenantId }, data });
  }
}
