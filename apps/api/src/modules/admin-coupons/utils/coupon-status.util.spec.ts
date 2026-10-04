import { describe, expect, it } from 'vitest';

import { createCouponSchema, updateCouponSchema } from '../validators/admin-coupon.validators';
import { bulkGenerateCouponsSchema } from '../validators/coupon-extra.validators';

import {
  CODE_ALPHABET,
  couponShapeIssues,
  generateUniqueCodes,
  randomSuffix,
} from './coupon-rules.util';
import { buildComputed, dailySeries, deriveCouponStatus, usagePct } from './coupon-status.util';

const now = new Date('2026-10-04T12:00:00Z');
const base = { isActive: true, expiresAt: null, maxRedemptions: null, timesRedeemed: 0 };

describe('coupon status', () => {
  it('derives each status with precedence', () => {
    expect(deriveCouponStatus(base, now)).toBe('active');
    expect(
      deriveCouponStatus({ ...base, isActive: false, expiresAt: new Date('2020-01-01') }, now),
    ).toBe('disabled');
    expect(deriveCouponStatus({ ...base, expiresAt: new Date('2026-10-01') }, now)).toBe('expired');
    expect(deriveCouponStatus({ ...base, maxRedemptions: 5, timesRedeemed: 5 }, now)).toBe(
      'exhausted',
    );
    expect(
      deriveCouponStatus(
        { ...base, expiresAt: new Date('2026-10-01'), maxRedemptions: 1, timesRedeemed: 1 },
        now,
      ),
    ).toBe('expired');
    expect(deriveCouponStatus({ ...base, startsAt: new Date('2026-11-01') }, now)).toBe(
      'scheduled',
    );
    expect(
      deriveCouponStatus(
        { ...base, expiresAt: new Date('2026-12-01'), maxRedemptions: 5, timesRedeemed: 4 },
        now,
      ),
    ).toBe('active');
  });
  it('computes remaining/usage/discount', () => {
    const c = buildComputed(
      { ...base, maxRedemptions: 8, timesRedeemed: 2 },
      { redemptions: 3, discountGiven: 12.5, lastRedeemedAt: null },
      now,
    );
    expect(c).toMatchObject({
      status: 'active',
      redemptions: 3,
      remaining: 6,
      usagePct: 25,
      discountGiven: '12.50',
    });
    expect(usagePct(null, 3)).toBeNull();
    expect(usagePct(2, 5)).toBe(100);
  });
  it('zero-fills the daily series with previous-window counts', () => {
    const s = dailySeries(
      [
        new Date('2026-10-04T01:00:00Z'),
        new Date('2026-10-04T05:00:00Z'),
        new Date('2026-09-04T05:00:00Z'),
      ],
      now,
    );
    expect(s).toHaveLength(30);
    expect(s[29]).toEqual({ date: '2026-10-04', count: 2, previousCount: 1 });
    expect(s[0]!.date).toBe('2026-09-05');
    expect(s[10]!.count).toBe(0);
  });
});

describe('bulk code generation', () => {
  it('uses an unambiguous charset', () => {
    for (const ch of ['I', 'O', '0', '1']) expect(CODE_ALPHABET).not.toContain(ch);
    expect(randomSuffix(200)).toMatch(/^[A-HJ-NP-Z2-9]+$/);
  });
  it('generates distinct codes avoiding existing ones', () => {
    const codes = generateUniqueCodes('SUM', 200, 4, new Set(['SUMAAAA']))!;
    expect(new Set(codes).size).toBe(200);
    expect(codes.every((c) => /^SUM[A-HJ-NP-Z2-9]{4}$/.test(c))).toBe(true);
    expect(codes).not.toContain('SUMAAAA');
  });
  it('returns null when the keyspace is exhausted', () => {
    let i = 0;
    expect(generateUniqueCodes('X', 3, 1, new Set(), () => i++ % 2)).toBeNull();
  });
  it('validates the request', () => {
    const ok = { prefix: 'summer', count: 5, length: 6, type: 'PERCENTAGE', percentOff: 10 };
    expect(bulkGenerateCouponsSchema.parse(ok).prefix).toBe('SUMMER');
    expect(bulkGenerateCouponsSchema.safeParse({ ...ok, count: 201 }).success).toBe(false);
    expect(bulkGenerateCouponsSchema.safeParse({ ...ok, length: 3 }).success).toBe(false);
    expect(bulkGenerateCouponsSchema.safeParse({ ...ok, prefix: 'A-B' }).success).toBe(false);
    expect(bulkGenerateCouponsSchema.safeParse({ ...ok, prefix: 'ABCDEFGHIJKLM' }).success).toBe(
      false,
    );
    expect(bulkGenerateCouponsSchema.safeParse({ ...ok, percentOff: undefined }).success).toBe(
      false,
    );
    expect(bulkGenerateCouponsSchema.safeParse({ ...ok, expiresAt: '2020-01-01' }).success).toBe(
      false,
    );
  });
});

describe('coupon validation refinements', () => {
  it('shape issues per type', () => {
    expect(couponShapeIssues({ type: 'PERCENTAGE', percentOff: 0 })).toHaveLength(1);
    expect(couponShapeIssues({ type: 'PERCENTAGE', percentOff: 101 })).toHaveLength(1);
    expect(couponShapeIssues({ type: 'PERCENTAGE', percentOff: 100 })).toHaveLength(0);
    expect(couponShapeIssues({ type: 'FIXED_AMOUNT', amountOff: 50 }).map((i) => i.path)).toEqual([
      'currency',
    ]);
    expect(
      couponShapeIssues({ type: 'FIXED_AMOUNT', amountOff: 0, currency: 'INR' }).map((i) => i.path),
    ).toEqual(['amountOff']);
    expect(couponShapeIssues({ type: 'TRIAL_EXTENSION', trialExtensionDays: 7 })).toHaveLength(0);
    expect(couponShapeIssues({ type: 'TRIAL_EXTENSION' })).toHaveLength(1);
  });
  it('create mirrors the rules and requires future expiry', () => {
    expect(
      createCouponSchema.safeParse({ code: 'ABC', type: 'PERCENTAGE', percentOff: 20 }).success,
    ).toBe(true);
    expect(
      createCouponSchema.safeParse({ code: 'ABC', type: 'PERCENTAGE', percentOff: 0 }).success,
    ).toBe(false);
    expect(
      createCouponSchema.safeParse({ code: 'ABC', type: 'FIXED_AMOUNT', amountOff: 10 }).success,
    ).toBe(false);
    expect(
      createCouponSchema.safeParse({
        code: 'ABC',
        type: 'FIXED_AMOUNT',
        amountOff: 10,
        currency: 'inr',
      }).success,
    ).toBe(true);
    expect(
      createCouponSchema.safeParse({
        code: 'ABC',
        type: 'PERCENTAGE',
        percentOff: 5,
        expiresAt: '2020-01-01',
      }).success,
    ).toBe(false);
    expect(
      createCouponSchema.safeParse({
        code: 'ABC',
        type: 'PERCENTAGE',
        percentOff: 5,
        expiresAt: '2099-01-01',
      }).success,
    ).toBe(true);
  });
  it('update keeps valid partial updates and rejects out-of-range fields', () => {
    expect(updateCouponSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(updateCouponSchema.safeParse({ expiresAt: '2020-01-01' }).success).toBe(true);
    expect(updateCouponSchema.safeParse({ percentOff: 150 }).success).toBe(false);
    expect(updateCouponSchema.safeParse({ amountOff: 0 }).success).toBe(false);
    expect(updateCouponSchema.safeParse({ trialExtensionDays: 0 }).success).toBe(false);
  });
});
