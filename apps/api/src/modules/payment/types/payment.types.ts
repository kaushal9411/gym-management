import type { PaymentGatewayProvider as PrismaGatewayProvider } from '@prisma/client';

import type { PaymentGatewayProvider } from '../services/payment-gateway.service';

/**
 * The onboarding/checkout API contract uses lowercase provider literals
 * ('stripe' | 'razorpay' | 'paypal') — already shipped and depended on by
 * the frontend (Prompt 7). The Prisma enum backing the new `payments`/
 * `payment_methods` tables (Prompt 8) is uppercase, matching this
 * project's enum convention elsewhere. Both are kept, with a small mapper
 * at the boundary, rather than breaking the existing API contract to make
 * the two match syntactically.
 */
export function toGatewayEnum(provider: PaymentGatewayProvider): PrismaGatewayProvider {
  return provider.toUpperCase() as PrismaGatewayProvider;
}

export function fromGatewayEnum(provider: PrismaGatewayProvider): PaymentGatewayProvider {
  return provider.toLowerCase() as PaymentGatewayProvider;
}

export interface ChargeSubscriptionInput {
  tenantId: string;
  subscriptionId: string | null;
  invoiceId: string | null;
  provider: PaymentGatewayProvider;
  paymentToken: string;
  amount: number;
  currency: string;
  customerEmail: string;
  description: string;
  /** Caller-supplied — guarantees a retried request can never double-charge. */
  idempotencyKey: string;
}

export interface PaymentSummary {
  id: string;
  provider: string;
  status: string;
  amount: number;
  currency: string;
  gatewayReference: string | null;
  failureReason: string | null;
  createdAt: string;
}
