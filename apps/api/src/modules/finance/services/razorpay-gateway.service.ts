import Razorpay from 'razorpay';

import { env } from '../../../config/env';
import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';

/**
 * Real Razorpay integration for Member Payments' online-payment flow
 * (Finance module) — staff generate a Payment Link and send it to the
 * member; the member pays on Razorpay's own hosted page. Staff never see or
 * handle card details. Deliberately separate from the platform Billing
 * module's `PaymentGatewayPort` (Prompt 8), which is a sandboxed
 * Stripe/Razorpay/PayPal abstraction for FitCloud charging TENANTS for their
 * own subscription — different money movement, different credentials, no
 * shared code.
 */
let client: Razorpay | null = null;

function getClient(): Razorpay {
  if (!env.razorpay.isConfigured) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'Online payments are not configured for this environment.', 503);
  }
  client ??= new Razorpay({ key_id: env.razorpay.keyId!, key_secret: env.razorpay.keySecret! });
  return client;
}

export interface RazorpayPaymentLink {
  id: string;
  shortUrl: string;
  status: 'created' | 'partially_paid' | 'expired' | 'cancelled' | 'paid';
}

export interface RazorpayPaymentLinkStatus extends RazorpayPaymentLink {
  razorpayPaymentId: string | null;
}

/** Amount must be in the currency's smallest unit (paise for INR, cents for USD) — Razorpay's own convention. */
export async function createPaymentLink(params: {
  amountInSmallestUnit: number;
  currency: string;
  description: string;
  referenceId: string;
  customerName: string;
  customerEmail?: string;
  customerContact?: string;
  /** Staff's explicit choice at generation time — Razorpay only auto-sends a channel it's told to, regardless of whether the contact detail is on file. */
  notifyEmail: boolean;
  notifySms: boolean;
  notes?: Record<string, string>;
}): Promise<RazorpayPaymentLink> {
  const link = await getClient().paymentLink.create({
    amount: params.amountInSmallestUnit,
    currency: params.currency,
    description: params.description,
    reference_id: params.referenceId,
    customer: {
      name: params.customerName,
      email: params.customerEmail,
      contact: params.customerContact,
    },
    notify: { email: params.notifyEmail, sms: params.notifySms },
    notes: params.notes,
  });
  return { id: link.id, shortUrl: link.short_url, status: link.status };
}

/** Manually (re)sends the Payment Link notification — Razorpay's own `notifyBy`, for staff to resend after generation without cancelling/recreating the link. */
export async function notifyPaymentLink(paymentLinkId: string, medium: 'email' | 'sms'): Promise<void> {
  await getClient().paymentLink.notifyBy(paymentLinkId, medium);
}

/**
 * Polled by `MemberPaymentService#verifyStatus` when staff click "Check
 * status" — there's no public webhook URL in local dev, so a manual poll
 * against Razorpay's own record of the Payment Link is the integration seam
 * instead of a webhook.
 */
export async function fetchPaymentLink(paymentLinkId: string): Promise<RazorpayPaymentLinkStatus> {
  const link = await getClient().paymentLink.fetch(paymentLinkId);
  return {
    id: link.id,
    shortUrl: link.short_url,
    status: link.status,
    razorpayPaymentId: link.payments?.payment_id ?? null,
  };
}
