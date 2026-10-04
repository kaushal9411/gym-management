import { describe, expect, it } from 'vitest';

import { memberNotificationsQuerySchema, memberRenewalPaymentParamSchema, memberVerifyRenewalCheckoutSchema } from './member-portal.validators';

describe('member-portal renewal validators', () => {
  describe('memberRenewalPaymentParamSchema', () => {
    it('accepts a valid uuid', () => {
      expect(memberRenewalPaymentParamSchema.safeParse({ paymentId: '11111111-1111-1111-1111-111111111111' }).success).toBe(true);
    });

    it('rejects a non-uuid', () => {
      expect(memberRenewalPaymentParamSchema.safeParse({ paymentId: 'not-a-uuid' }).success).toBe(false);
    });
  });

  describe('memberVerifyRenewalCheckoutSchema', () => {
    const valid = { razorpayOrderId: 'order_abc', razorpayPaymentId: 'pay_abc', razorpaySignature: 'sig_abc' };

    it('accepts a complete payload', () => {
      expect(memberVerifyRenewalCheckoutSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects a missing razorpaySignature', () => {
      const { razorpaySignature: _omit, ...rest } = valid;
      expect(memberVerifyRenewalCheckoutSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects an empty razorpayOrderId', () => {
      expect(memberVerifyRenewalCheckoutSchema.safeParse({ ...valid, razorpayOrderId: '' }).success).toBe(false);
    });
  });
});

describe('memberNotificationsQuerySchema', () => {
  it('parses the literal string "false" as false (not truthy)', () => {
    expect(memberNotificationsQuerySchema.parse({ unreadOnly: 'false' }).unreadOnly).toBe(false);
    expect(memberNotificationsQuerySchema.parse({ unreadOnly: 'true' }).unreadOnly).toBe(true);
    expect(memberNotificationsQuerySchema.parse({}).unreadOnly).toBeUndefined();
  });

  it('accepts a known category and rejects an unknown one', () => {
    expect(memberNotificationsQuerySchema.parse({ category: 'PAYMENT' }).category).toBe('PAYMENT');
    expect(memberNotificationsQuerySchema.safeParse({ category: 'NOPE' }).success).toBe(false);
  });
});
