import { createHmac, timingSafeEqual } from 'node:crypto';

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

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

/**
 * Creates a Razorpay Order for the client-side Checkout modal
 * (`checkout.js`, opened in-page as a popup — not a hosted redirect page
 * like the Payment Link flow above). Used by the tenant self-service plan
 * upgrade/downgrade flow. Amount must be in the currency's smallest unit.
 */
export async function createOrder(params: {
  amountInSmallestUnit: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const order = await getClient().orders.create({
    amount: params.amountInSmallestUnit,
    currency: params.currency,
    receipt: params.receipt,
    notes: params.notes,
  });
  return { id: order.id, amount: Number(order.amount), currency: order.currency };
}

/**
 * Verifies the Checkout modal's success callback genuinely came from
 * Razorpay — HMAC-SHA256 of `orderId|paymentId` keyed with the account
 * secret, per Razorpay's documented Checkout verification scheme. Pure
 * local computation, no API call — unlike polling a Payment Link's status,
 * this can't be affected by upstream API flakiness.
 */
export function verifyOrderPaymentSignature(params: { orderId: string; paymentId: string; signature: string }): boolean {
  if (!env.razorpay.isConfigured) return false;
  const expected = createHmac('sha256', env.razorpay.keySecret!)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest('hex');
  return expected === params.signature;
}

/**
 * Verifies a Razorpay webhook delivery — HMAC-SHA256 of the exact raw
 * request body, keyed with the webhook secret configured alongside the
 * webhook URL in the Razorpay Dashboard (distinct from `keySecret`, which
 * only signs Checkout success callbacks). Needs the unparsed bytes Razorpay
 * actually signed, not `JSON.stringify(req.body)` — a re-serialized object
 * can differ in key order/whitespace and would silently fail verification
 * against a real delivery (see `app.ts`'s `express.json({ verify })`, which
 * captures `req.rawBody` for exactly this).
 */
export function verifyWebhookSignature(rawBody: string | Buffer, signature: string | undefined): boolean {
  if (!signature || !env.razorpay.webhookSecret) return false;
  const expected = createHmac('sha256', env.razorpay.webhookSecret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const signatureBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== signatureBuf.length) return false;
  return timingSafeEqual(expectedBuf, signatureBuf);
}
