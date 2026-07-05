import type { Payment, PaymentGatewayProvider, PaymentStatus } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class PaymentRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  /** Idempotency check — the caller must look this up before charging, never charge blind. */
  async findByIdempotencyKey(idempotencyKey: string): Promise<Payment | null> {
    return this.db.payment.findUnique({ where: { idempotencyKey } });
  }

  async create(input: {
    tenantId: string;
    subscriptionId: string | null;
    invoiceId: string | null;
    provider: PaymentGatewayProvider;
    amount: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<Payment> {
    return this.db.payment.create({
      data: {
        tenantId: input.tenantId,
        subscriptionId: input.subscriptionId,
        invoiceId: input.invoiceId,
        provider: input.provider,
        amount: input.amount,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey,
        status: 'PENDING',
      },
    });
  }

  async markResult(
    paymentId: string,
    result: { status: PaymentStatus; gatewayReference?: string; failureReason?: string },
  ): Promise<Payment> {
    return this.db.payment.update({ where: { id: paymentId }, data: result });
  }

  async recordTransaction(input: {
    paymentId: string;
    provider: PaymentGatewayProvider;
    eventType: string;
    rawPayload: object;
    signatureValid: boolean;
  }) {
    return this.db.paymentTransaction.create({
      data: { ...input, processedAt: new Date() },
    });
  }

  async listForTenant(tenantId: string, limit = 50) {
    return this.db.payment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findById(tenantId: string, paymentId: string): Promise<Payment | null> {
    return this.db.payment.findFirst({ where: { id: paymentId, tenantId } });
  }
}
