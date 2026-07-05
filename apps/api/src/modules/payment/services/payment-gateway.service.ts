import { randomUUID } from 'node:crypto';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { logger } from '../../../core/logging/logger';

export type PaymentGatewayProvider = 'stripe' | 'razorpay' | 'paypal';

export interface ChargeInput {
  provider: PaymentGatewayProvider;
  /** Opaque token/nonce from the gateway's client-side SDK (e.g. Stripe PaymentMethod id). */
  paymentToken: string;
  amount: number;
  currency: string;
  customerEmail: string;
  description: string;
}

export interface ChargeResult {
  success: boolean;
  gatewayCustomerId: string;
  gatewayReference: string;
}

/**
 * Payment integration STRUCTURE, not a live integration — no real gateway
 * credentials exist in this environment. Each adapter below implements the
 * same `PaymentGatewayPort` a real SDK call would and always succeeds in
 * this sandboxed form; swapping in a real `stripe`/`razorpay`/`paypal` SDK
 * call is a change confined entirely to that one adapter class, since
 * everything upstream (subscription/billing services, the API contract,
 * the webhook receiver) already talks to only this interface.
 *
 * Originally built for onboarding's first payment step (Prompt 7); moved
 * here and made the canonical home once the full billing platform (Prompt
 * 8) needed the same abstraction for checkout, renewals, and webhooks.
 */
export interface PaymentGatewayPort {
  charge(input: ChargeInput): Promise<ChargeResult>;
  /** Sandbox adapters accept any non-empty signature — a real adapter would recompute an HMAC and compare. */
  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean;
}

abstract class SandboxGatewayAdapter implements PaymentGatewayPort {
  protected abstract readonly provider: PaymentGatewayProvider;

  async charge(input: ChargeInput): Promise<ChargeResult> {
    if (!input.paymentToken) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'A payment method is required', 422);
    }
    logger.info('Sandbox payment charge (no real gateway call made)', {
      provider: this.provider,
      amount: input.amount,
      currency: input.currency,
    });
    return {
      success: true,
      gatewayCustomerId: `sandbox_cus_${randomUUID().slice(0, 12)}`,
      gatewayReference: `sandbox_ch_${randomUUID().slice(0, 12)}`,
    };
  }

  verifyWebhookSignature(_rawBody: string, signature: string | undefined): boolean {
    return typeof signature === 'string' && signature.trim().length > 0;
  }
}

class StripeSandboxAdapter extends SandboxGatewayAdapter {
  protected readonly provider = 'stripe' as const;
}

class RazorpaySandboxAdapter extends SandboxGatewayAdapter {
  protected readonly provider = 'razorpay' as const;
}

class PaypalSandboxAdapter extends SandboxGatewayAdapter {
  protected readonly provider = 'paypal' as const;
}

const adapters: Record<PaymentGatewayProvider, PaymentGatewayPort> = {
  stripe: new StripeSandboxAdapter(),
  razorpay: new RazorpaySandboxAdapter(),
  paypal: new PaypalSandboxAdapter(),
};

export function getPaymentGateway(provider: PaymentGatewayProvider): PaymentGatewayPort {
  return adapters[provider];
}
