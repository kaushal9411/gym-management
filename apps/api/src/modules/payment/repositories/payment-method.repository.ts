import type { PaymentGatewayProvider } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class PaymentMethodRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async listForTenant(tenantId: string) {
    return this.db.paymentMethod.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  async findDefault(tenantId: string) {
    return this.db.paymentMethod.findFirst({ where: { tenantId, isDefault: true } });
  }

  async save(input: {
    tenantId: string;
    provider: PaymentGatewayProvider;
    gatewayCustomerId?: string;
    gatewayMethodId: string;
    brand?: string;
    last4?: string;
    makeDefault: boolean;
  }) {
    if (input.makeDefault) {
      await this.db.paymentMethod.updateMany({ where: { tenantId: input.tenantId }, data: { isDefault: false } });
    }
    return this.db.paymentMethod.create({
      data: {
        tenantId: input.tenantId,
        provider: input.provider,
        gatewayCustomerId: input.gatewayCustomerId,
        gatewayMethodId: input.gatewayMethodId,
        brand: input.brand,
        last4: input.last4,
        isDefault: input.makeDefault,
      },
    });
  }
}
