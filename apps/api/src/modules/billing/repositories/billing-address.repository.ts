import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export interface BillingAddressInput {
  legalName?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  taxId?: string;
}

export class BillingAddressRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async find(tenantId: string) {
    return this.db.billingAddress.findUnique({ where: { tenantId } });
  }

  async upsert(tenantId: string, input: BillingAddressInput) {
    return this.db.billingAddress.upsert({
      where: { tenantId },
      create: { tenantId, ...input },
      update: input,
    });
  }
}
