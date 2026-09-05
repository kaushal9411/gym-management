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

export type PaymentMode = 'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'CARD' | 'OTHER';

/** Required when `mode: 'manual'` — captures the same detail a real payment already carries. */
export interface ManualPaymentInput {
  paymentMode: PaymentMode;
  paymentDate: string;
  amount?: number;
  proofDataUrl?: string;
  notes?: string;
}

/** The API returns whichever shape matches the `mode` the caller sent — no wrapper discriminator, since the caller already knows which one it asked for. */
export interface ManualPlanChangeResult {
  id: string;
  planId: string;
  status: string;
  billingCycle: string;
  currentPeriodEnd: string | null;
}

export type ChangePlanResult = ManualPlanChangeResult | PaymentLinkResult;
