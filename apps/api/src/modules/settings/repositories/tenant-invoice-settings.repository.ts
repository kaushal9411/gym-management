import type { Prisma, TenantInvoiceSettings } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

/** The gym's own invoice defaults (prefix/footer/tax/payment terms) — see schema comment for how this differs from platform Invoice. */
export class TenantInvoiceSettingsRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async find(tenantId: string): Promise<TenantInvoiceSettings | null> {
    return this.db.tenantInvoiceSettings.findFirst({ where: { tenantId } });
  }

  async update(
    tenantId: string,
    data: Omit<Prisma.TenantInvoiceSettingsUncheckedUpdateInput, 'tenantId'>,
  ): Promise<TenantInvoiceSettings> {
    const existing = await this.find(tenantId);
    if (!existing) {
      return this.db.tenantInvoiceSettings.create({
        data: { ...(data as Omit<Prisma.TenantInvoiceSettingsUncheckedCreateInput, 'tenantId'>), tenantId },
      });
    }
    return this.db.tenantInvoiceSettings.update({ where: { tenantId }, data });
  }
}
