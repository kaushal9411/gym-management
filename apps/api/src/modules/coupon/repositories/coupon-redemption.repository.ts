import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class CouponRedemptionRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async countForTenant(tenantId: string, couponId: string): Promise<number> {
    return this.db.couponRedemption.count({ where: { tenantId, couponId } });
  }

  async create(tenantId: string, couponId: string) {
    return this.db.couponRedemption.create({ data: { tenantId, couponId } });
  }
}
