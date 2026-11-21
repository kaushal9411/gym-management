import { createHmac } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  config: { keyId: 'rzp_test_dbkey123' as string | null, keySecret: 'resolved-key-secret' as string | null, webhookSecret: 'resolved-webhook-secret' as string | null, source: 'database' },
}));

vi.mock('../../admin-payment-gateways/services/razorpay-config.service', () => ({
  getRazorpayConfig: async () => state.config,
}));

import { verifyOrderPaymentSignature, verifyWebhookSignature } from './razorpay-gateway.service';

const hmac = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('hex');

describe('razorpay-gateway signature verification uses the resolved credentials', () => {
  beforeEach(() => {
    state.config = { keyId: 'rzp_test_dbkey123', keySecret: 'resolved-key-secret', webhookSecret: 'resolved-webhook-secret', source: 'database' };
  });

  it('accepts a checkout signature made with the resolved key secret and rejects others', async () => {
    const params = { orderId: 'order_1', paymentId: 'pay_1', signature: hmac('resolved-key-secret', 'order_1|pay_1') };
    expect(await verifyOrderPaymentSignature(params)).toBe(true);
    expect(await verifyOrderPaymentSignature({ ...params, signature: hmac('some-other-secret', 'order_1|pay_1') })).toBe(false);
  });

  it('rejects checkout signatures when nothing is configured', async () => {
    state.config = { keyId: null, keySecret: null, webhookSecret: null, source: 'none' };
    expect(await verifyOrderPaymentSignature({ orderId: 'o', paymentId: 'p', signature: hmac('x', 'o|p') })).toBe(false);
  });

  it('verifies webhook signatures against the resolved webhook secret', async () => {
    const body = '{"event":"payment_link.paid"}';
    expect(await verifyWebhookSignature(body, hmac('resolved-webhook-secret', body))).toBe(true);
    expect(await verifyWebhookSignature(body, hmac('stale-env-webhook-secret', body))).toBe(false);
    expect(await verifyWebhookSignature(body, undefined)).toBe(false);
  });

  it('rejects every webhook when no webhook secret is resolved', async () => {
    state.config = { ...state.config, webhookSecret: null };
    const body = '{}';
    expect(await verifyWebhookSignature(body, hmac('anything', body))).toBe(false);
  });
});
