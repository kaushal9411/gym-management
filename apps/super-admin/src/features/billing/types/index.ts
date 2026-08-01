export interface PaymentLinkResult {
  paymentId: string;
  invoiceId: string;
  shortUrl: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
}

export interface VerifyPaymentResult {
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
}

export type ChangePlanMode = 'manual' | 'payment_link';

/** The API returns whichever shape matches the `mode` the caller sent — no wrapper discriminator, since the caller already knows which one it asked for. */
export interface ManualPlanChangeResult {
  id: string;
  planId: string;
  status: string;
  billingCycle: string;
  currentPeriodEnd: string | null;
}

export type ChangePlanResult = ManualPlanChangeResult | PaymentLinkResult;
