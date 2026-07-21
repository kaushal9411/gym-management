import type { Prisma, TenantProfile } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

/** Gym Profile (legal/contact/address/hours/social) — one row per tenant, created lazily on first write. */
export class TenantProfileRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async find(tenantId: string): Promise<TenantProfile | null> {
    return this.db.tenantProfile.findFirst({ where: { tenantId } });
  }

  async upsert(tenantId: string, data: Omit<Prisma.TenantProfileUncheckedUpdateInput, 'tenantId'>): Promise<TenantProfile> {
    return this.db.tenantProfile.upsert({
      where: { tenantId },
      create: { ...(data as Omit<Prisma.TenantProfileUncheckedCreateInput, 'tenantId'>), tenantId },
      update: data,
    });
  }
}
