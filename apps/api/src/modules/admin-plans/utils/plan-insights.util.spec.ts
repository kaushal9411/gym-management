import { describe, expect, it } from 'vitest';

import { duplicatePlanSchema, planImpactQuerySchema } from '../validators/plan-insights.validators';

import {
  aggregateByPlan,
  bucketRenewals,
  computeImpact,
  deleteBlockers,
  dominantCurrency,
  mrrByCurrency,
  nextCopySlug,
  planShare,
  summarizeAudit,
  toStats,
  yearlyDiscountPct,
  type PlanPricing,
  type SubGroupRow,
} from './plan-insights.util';

const pro: PlanPricing = {
  id: 'p1',
  name: 'Pro',
  slug: 'pro',
  isActive: true,
  priceMonthly: 1000,
  priceYearly: 9600,
  currency: 'INR',
};
const usd: PlanPricing = {
  id: 'p2',
  name: 'US',
  slug: 'us',
  isActive: true,
  priceMonthly: 10,
  priceYearly: 100,
  currency: 'USD',
};
const rows: SubGroupRow[] = [
  { planId: 'p1', status: 'ACTIVE', billingCycle: 'MONTHLY', count: 2 },
  { planId: 'p1', status: 'ACTIVE', billingCycle: 'YEARLY', count: 1 },
  { planId: 'p1', status: 'TRIALING', billingCycle: 'MONTHLY', count: 3 },
  { planId: 'p1', status: 'PAST_DUE', billingCycle: 'MONTHLY', count: 1 },
  { planId: 'p1', status: 'GRACE', billingCycle: 'MONTHLY', count: 1 },
  { planId: 'p1', status: 'CANCELED', billingCycle: 'MONTHLY', count: 9 },
  { planId: 'p2', status: 'ACTIVE', billingCycle: 'YEARLY', count: 2 },
];

describe('plan stats aggregation', () => {
  const plans = [pro, usd];
  const aggs = aggregateByPlan(rows, plans);
  it('maps statuses and normalises MRR (ACTIVE only, yearly/12)', () => {
    const a = aggs.get('p1')!;
    expect(a).toMatchObject({ active: 3, trial: 3, pastDue: 2, monthly: 2, yearly: 1 });
    expect(a.mrr).toBeCloseTo(2 * 1000 + 9600 / 12);
  });
  it('sums per currency and picks INR as dominant', () => {
    const totals = mrrByCurrency(aggs, plans);
    expect(totals.get('INR')).toBeCloseTo(2800);
    expect(totals.get('USD')).toBeCloseTo(2 * (100 / 12));
    expect(dominantCurrency(totals)).toBe('INR');
    expect(
      dominantCurrency(
        new Map([
          ['USD', 5],
          ['EUR', 9],
        ]),
      ),
    ).toBe('EUR');
    expect(dominantCurrency(new Map())).toBe('INR');
  });
  it('computes share within the plan currency', () => {
    const totals = mrrByCurrency(aggs, plans);
    expect(toStats(aggs.get('p1'), pro, totals)).toEqual({
      activeSubscribers: 3,
      trialSubscribers: 3,
      pastDueSubscribers: 2,
      mrr: '2800.00',
      share: 1,
    });
    expect(toStats(undefined, pro, totals).mrr).toBe('0.00');
    expect(planShare(1, 0)).toBe(0);
    expect(planShare(1, 4)).toBe(0.25);
  });
});

describe('price ladder + renewals', () => {
  it('yearly discount pct', () => {
    expect(yearlyDiscountPct(1000, 9600)).toBe(20);
    expect(yearlyDiscountPct(0, 0)).toBeNull();
  });
  it('buckets renewals into weeks and sums revenue in the headline currency', () => {
    const now = new Date('2026-10-04T10:00:00Z');
    const out = bucketRenewals(
      [
        {
          planId: 'p1',
          billingCycle: 'MONTHLY',
          currentPeriodEnd: new Date('2026-10-05T00:00:00Z'),
        },
        {
          planId: 'p1',
          billingCycle: 'YEARLY',
          currentPeriodEnd: new Date('2026-10-12T00:00:00Z'),
        },
        {
          planId: 'p2',
          billingCycle: 'MONTHLY',
          currentPeriodEnd: new Date('2026-10-06T00:00:00Z'),
        },
        {
          planId: 'p1',
          billingCycle: 'MONTHLY',
          currentPeriodEnd: new Date('2026-10-01T00:00:00Z'),
        },
        {
          planId: 'p1',
          billingCycle: 'MONTHLY',
          currentPeriodEnd: new Date('2027-03-01T00:00:00Z'),
        },
      ],
      [pro, usd],
      'INR',
      now,
    );
    expect(out).toHaveLength(8);
    expect(out[0]).toEqual({
      weekStart: '2026-10-04',
      subscriptions: 3,
      expectedRevenue: '2000.00',
    });
    expect(out[1]).toEqual({
      weekStart: '2026-10-11',
      subscriptions: 1,
      expectedRevenue: '9600.00',
    });
  });
});

describe('impact maths', () => {
  it('projects MRR with cycle split and yearly price', () => {
    const r = computeImpact(
      pro,
      { priceMonthly: 1200, priceYearly: 12000 },
      { monthly: 2, yearly: 1 },
      2,
    );
    expect(r.affected).toEqual({ activeSubscribers: 3, monthlyCycle: 2, yearlyCycle: 1 });
    expect(r.currentMrr).toBe('2800.00');
    expect(r.projectedMrr).toBe('3400.00');
    expect(r.mrrDelta).toBe('600.00');
    expect(r.mrrDeltaPct).toBe(21.43);
    expect(r.renewalsInNext30Days).toBe(2);
    expect(r.note).toMatch(/next renewal/);
  });
  it('omitted price keeps current; zero MRR gives null pct', () => {
    expect(computeImpact(pro, { priceMonthly: 500 }, { monthly: 0, yearly: 4 }, 0).mrrDelta).toBe(
      '0.00',
    );
    expect(
      computeImpact(pro, { priceMonthly: 500 }, { monthly: 0, yearly: 0 }, 0).mrrDeltaPct,
    ).toBeNull();
  });
  it('query schema requires at least one price', () => {
    expect(planImpactQuerySchema.safeParse({}).success).toBe(false);
    expect(planImpactQuerySchema.safeParse({ priceYearly: '100' }).success).toBe(true);
  });
});

describe('duplicate + delete helpers', () => {
  it('generates unique copy slugs', () => {
    expect(nextCopySlug('pro', new Set())).toBe('pro-copy');
    expect(nextCopySlug('pro', new Set(['pro-copy']))).toBe('pro-copy-2');
    expect(nextCopySlug('pro', new Set(['pro-copy', 'pro-copy-2']))).toBe('pro-copy-3');
    const long = 'a'.repeat(40);
    const s = nextCopySlug(long, new Set());
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith('-copy')).toBe(true);
  });
  it('duplicate body validation', () => {
    expect(duplicatePlanSchema.safeParse({}).success).toBe(true);
    expect(duplicatePlanSchema.safeParse({ slug: 'Bad Slug!' }).success).toBe(false);
  });
  it('blocks delete for ACTIVE/TRIALING/PAST_DUE/GRACE only', () => {
    expect(deleteBlockers({ CANCELED: 4, EXPIRED: 1 }).blocked).toBe(false);
    const b = deleteBlockers({ PAST_DUE: 2, GRACE: 1, CANCELED: 3 });
    expect(b.blocked).toBe(true);
    expect(b.total).toBe(3);
    expect(b.message).toContain('PAST_DUE: 2');
    expect(b.message).toContain('GRACE: 1');
    expect(b.message).not.toContain('CANCELED');
    expect(deleteBlockers({ ACTIVE: 1 }).blocked).toBe(true);
    expect(deleteBlockers({ TRIALING: 1 }).blocked).toBe(true);
  });
  it('summarises audit rows', () => {
    expect(summarizeAudit('admin.plan_updated', { priceMonthly: 999, features: [1, 2] })).toBe(
      'Updated priceMonthly -> 999, features (2)',
    );
    expect(summarizeAudit('admin.plan_disabled', null)).toBe('Plan disabled');
  });
});
