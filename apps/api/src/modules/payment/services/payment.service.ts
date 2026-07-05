import type { Payment } from '@prisma/client';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { PaymentRepository } from '../repositories/payment.repository';
import { fromGatewayEnum, toGatewayEnum, type ChargeSubscriptionInput, type PaymentSummary } from '../types/payment.types';

import { getPaymentGateway } from './payment-gateway.service';

export class PaymentService {
  private readonly paymentRepository: PaymentRepository;

  constructor(db: TenantScopedPrisma) {
    this.paymentRepository = new PaymentRepository(db);
  }

  /**
   * Charges through the provider pattern, idempotency-safe: a retried call
   * with the same `idempotencyKey` (e.g. a network-timeout retry from the
   * frontend, or a queue job re-run) returns the ALREADY-recorded result
   * instead of charging twice.
   */
  async charge(input: ChargeSubscriptionInput): Promise<Payment> {
    const existing = await this.paymentRepository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;

    const providerEnum = toGatewayEnum(input.provider);
    const payment = await this.paymentRepository.create({
      tenantId: input.tenantId,
      subscriptionId: input.subscriptionId,
      invoiceId: input.invoiceId,
      provider: providerEnum,
      amount: input.amount,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
    });

    const gateway = getPaymentGateway(input.provider);
    try {
      const result = await gateway.charge({
        provider: input.provider,
        paymentToken: input.paymentToken,
        amount: input.amount,
        currency: input.currency,
        customerEmail: input.customerEmail,
        description: input.description,
      });

      await this.paymentRepository.recordTransaction({
        paymentId: payment.id,
        provider: providerEnum,
        eventType: 'charge.attempted',
        rawPayload: result,
        signatureValid: true,
      });

      if (!result.success) {
        return this.paymentRepository.markResult(payment.id, { status: 'FAILED', failureReason: 'Gateway declined the charge' });
      }

      return this.paymentRepository.markResult(payment.id, {
        status: 'SUCCEEDED',
        gatewayReference: result.gatewayReference,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown gateway error';
      await this.paymentRepository.markResult(payment.id, { status: 'FAILED', failureReason: message });
      throw new AppError(ErrorCode.PAYMENT_FAILED, 'Payment could not be completed. Please try another method.', 402);
    }
  }

  async history(tenantId: string): Promise<PaymentSummary[]> {
    const payments = await this.paymentRepository.listForTenant(tenantId);
    return payments.map((p) => ({
      id: p.id,
      provider: fromGatewayEnum(p.provider),
      status: p.status,
      amount: Number(p.amount),
      currency: p.currency,
      gatewayReference: p.gatewayReference,
      failureReason: p.failureReason,
      createdAt: p.createdAt.toISOString(),
    }));
  }
}
