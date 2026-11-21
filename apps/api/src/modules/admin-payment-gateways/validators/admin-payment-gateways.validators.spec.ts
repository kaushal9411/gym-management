import { describe, expect, it } from 'vitest';

import { testRazorpayGatewaySchema, upsertRazorpayGatewaySchema } from './admin-payment-gateways.validators';

describe('upsertRazorpayGatewaySchema', () => {
  const valid = { keyId: 'rzp_test_AbC123xyz', keySecret: 'secret-1234567890' };

  it('accepts test and live key ids', () => {
    expect(upsertRazorpayGatewaySchema.safeParse(valid).success).toBe(true);
    expect(upsertRazorpayGatewaySchema.safeParse({ ...valid, keyId: 'rzp_live_AbC123xyz' }).success).toBe(true);
  });

  it.each(['rzp_prod_abcdef123', 'rzp_test_abc', 'rzp_test_ab-cdef12', 'abcdef', ''])('rejects key id %j', (keyId) => {
    expect(upsertRazorpayGatewaySchema.safeParse({ ...valid, keyId }).success).toBe(false);
  });

  it('requires a key id', () => {
    expect(upsertRazorpayGatewaySchema.safeParse({ keySecret: valid.keySecret }).success).toBe(false);
  });

  it('allows omitting or blanking the secrets (keep stored ones)', () => {
    const parsed = upsertRazorpayGatewaySchema.parse({ keyId: valid.keyId, keySecret: '', webhookSecret: '  ' });
    expect(parsed.keySecret).toBeUndefined();
    expect(parsed.webhookSecret).toBeUndefined();
    expect(upsertRazorpayGatewaySchema.safeParse({ keyId: valid.keyId }).success).toBe(true);
  });

  it('enforces secret minimum lengths when provided', () => {
    expect(upsertRazorpayGatewaySchema.safeParse({ ...valid, keySecret: 'short' }).success).toBe(false);
    expect(upsertRazorpayGatewaySchema.safeParse({ ...valid, webhookSecret: 'short' }).success).toBe(false);
    expect(upsertRazorpayGatewaySchema.safeParse({ ...valid, webhookSecret: 'eight888' }).success).toBe(true);
  });

  it('only accepts a boolean isEnabled', () => {
    expect(upsertRazorpayGatewaySchema.safeParse({ ...valid, isEnabled: false }).success).toBe(true);
    expect(upsertRazorpayGatewaySchema.safeParse({ ...valid, isEnabled: 'no' }).success).toBe(false);
  });
});

describe('testRazorpayGatewaySchema', () => {
  it('accepts an empty body (test the stored credentials)', () => {
    expect(testRazorpayGatewaySchema.safeParse({}).success).toBe(true);
  });

  it('validates override fields when present', () => {
    expect(testRazorpayGatewaySchema.safeParse({ keyId: 'bad' }).success).toBe(false);
    expect(testRazorpayGatewaySchema.safeParse({ keySecret: 'short' }).success).toBe(false);
    expect(testRazorpayGatewaySchema.safeParse({ keyId: 'rzp_live_abcdef12', keySecret: 'long-enough-secret' }).success).toBe(true);
  });
});
