import { describe, expect, it } from 'vitest';

import { overviewQuerySchema } from '../validators/admin-dashboard.validators';

import {
  alignSeries,
  buildArpa,
  buildTrialFunnel,
  sortTopTenants,
  buildActivitySummary,
  daysLeft,
  monthlyPrice,
  oldestOpenDays,
  pickAtRisk,
  resolveOverviewRanges,
  trialConversionRate,
  zeroFillDays,
  type AtRiskCandidate,
} from './overview.util';

describe('resolveOverviewRanges', () => {
  it('7d = today + 6 days, previous = the 7 days before', () => {
    const r = resolveOverviewRanges('7d', new Date('2026-10-10T12:00:00Z'));
    expect(r.range).toEqual({ from: '2026-10-04', to: '2026-10-10' });
    expect(r.previousRange).toEqual({ from: '2026-09-27', to: '2026-10-03' });
  });
  it('90d windows are equal length', () => {
    const r = resolveOverviewRanges('90d', new Date('2026-10-10T00:00:00Z'));
    expect(r.range.from).toBe('2026-07-13');
    expect(r.previousRange.to).toBe('2026-07-12');
  });
});

describe('12m range', () => {
  it('is 365 days with an equal preceding window', () => {
    const r = resolveOverviewRanges('12m', new Date('2026-10-10T12:00:00Z'));
    expect(r.range).toEqual({ from: '2025-10-11', to: '2026-10-10' });
    expect(r.previousRange).toEqual({ from: '2024-10-11', to: '2025-10-10' });
    expect(zeroFillDays(r.range, new Map())).toHaveLength(365);
  });
  it('validator accepts 12m', () => {
    expect(overviewQuerySchema.parse({ range: '12m' }).range).toBe('12m');
    expect(overviewQuerySchema.safeParse({ range: '6m' }).success).toBe(false);
  });
});

describe('churnedDaily alignment', () => {
  it('zero-fills and aligns previous by index like signupsDaily', () => {
    const range = { from: '2026-10-03', to: '2026-10-04' };
    const prev = { from: '2026-10-01', to: '2026-10-02' };
    const s = alignSeries(
      range,
      prev,
      new Map([
        ['2026-10-04', 2],
        ['2026-10-01', 1],
      ]),
    );
    expect(s.map((p) => [p.date, p.value, p.previousValue])).toEqual([
      ['2026-10-03', 0, 1],
      ['2026-10-04', 2, 0],
    ]);
  });
});

describe('buildTrialFunnel', () => {
  it('null when nothing started', () => {
    expect(buildTrialFunnel({ started: 0, activated: 0, converted: 0, expired: 0 })).toBeNull();
  });
  it('passes numeric counts through', () => {
    expect(buildTrialFunnel({ started: 10, activated: 6, converted: 2, expired: 3 })).toEqual({
      started: 10,
      activated: 6,
      converted: 2,
      expired: 3,
    });
  });
});

describe('buildArpa', () => {
  it('mrr / active paid, previous null when mrr previous is null', () => {
    expect(buildArpa(300, 4)).toEqual({ value: '75.00', previous: null });
    expect(buildArpa(300, 4, 200)).toEqual({ value: '75.00', previous: '50.00' });
  });
  it('null when mrr unknown or no paying tenants', () => {
    expect(buildArpa(null, 4)).toBeNull();
    expect(buildArpa(100, 0)).toBeNull();
  });
});

describe('sortTopTenants', () => {
  it('mrr desc, nulls last, then members desc', () => {
    const rows = [
      { id: 'a', mrr: null, members: 50 },
      { id: 'b', mrr: 100, members: 1 },
      { id: 'c', mrr: null, members: 80 },
      { id: 'd', mrr: 100, members: 9 },
      { id: 'e', mrr: 250, members: null },
      { id: 'f', mrr: null, members: null },
    ];
    expect(sortTopTenants(rows).map((r) => r.id)).toEqual(['e', 'd', 'b', 'c', 'a', 'f']);
  });
});

describe('overviewQuerySchema', () => {
  it('defaults to 30d and rejects invalid ranges', () => {
    expect(overviewQuerySchema.parse({}).range).toBe('30d');
    expect(overviewQuerySchema.safeParse({ range: '14d' }).success).toBe(false);
  });
});

describe('zero fill / align', () => {
  it('fills missing days and aligns previous by index', () => {
    const range = { from: '2026-10-02', to: '2026-10-04' };
    const prev = { from: '2026-09-29', to: '2026-10-01' };
    const m = new Map([
      ['2026-10-03', 5],
      ['2026-09-30', 2],
    ]);
    expect(zeroFillDays(range, m).map((p) => p.value)).toEqual([0, 5, 0]);
    expect(alignSeries(range, prev, m)).toEqual([
      { date: '2026-10-02', value: 0, previousValue: 0 },
      { date: '2026-10-03', value: 5, previousValue: 2 },
      { date: '2026-10-04', value: 0, previousValue: 0 },
    ]);
  });
});

describe('trialConversionRate / daysLeft / misc', () => {
  it('null when no trial ended, else share', () => {
    expect(trialConversionRate(0, 0)).toBeNull();
    expect(trialConversionRate(4, 1)).toBe(0.25);
  });
  it('daysLeft rounds up and floors at 0', () => {
    const now = new Date('2026-10-01T00:00:00Z');
    expect(daysLeft(new Date('2026-10-01T06:00:00Z'), now)).toBe(1);
    expect(daysLeft(new Date('2026-10-04T00:00:00Z'), now)).toBe(3);
    expect(daysLeft(new Date('2026-09-30T00:00:00Z'), now)).toBe(0);
  });
  it('oldestOpenDays', () => {
    expect(oldestOpenDays(null)).toBeNull();
    expect(oldestOpenDays(new Date('2026-09-28T00:00:00Z'), new Date('2026-10-01T10:00:00Z'))).toBe(
      3,
    );
  });
  it('monthlyPrice normalises yearly', () => {
    expect(monthlyPrice('YEARLY', 100, 1200)).toBe(100);
    expect(monthlyPrice('MONTHLY', 90, 1200)).toBe(90);
  });
});

describe('pickAtRisk', () => {
  const c = (tenantId: string, reason: AtRiskCandidate['reason']): AtRiskCandidate => ({
    tenantId,
    slug: tenantId,
    name: tenantId,
    reason,
    detail: '',
  });
  it('dedupes per tenant keeping the most severe and orders by severity', () => {
    const out = pickAtRisk([
      c('a', 'NEAR_LIMIT'),
      c('b', 'PAST_DUE'),
      c('a', 'PAYMENT_FAILED'),
      c('c', 'GRACE'),
      c('b', 'SUSPENDED_RECENTLY'),
    ]);
    expect(out.map((x) => [x.tenantId, x.reason])).toEqual([
      ['a', 'PAYMENT_FAILED'],
      ['c', 'GRACE'],
      ['b', 'PAST_DUE'],
    ]);
  });
  it('caps the list', () => {
    const many = Array.from({ length: 15 }, (_, i) => c(`t${i}`, 'NEAR_LIMIT'));
    expect(pickAtRisk(many, 10)).toHaveLength(10);
  });
});

describe('buildActivitySummary', () => {
  it('uses known labels and never leaks ids', () => {
    expect(buildActivitySummary('admin.tenant_trial_extended', 'Tenant')).toBe(
      'Tenant trial extended',
    );
  });
  it('falls back to a humanised action with entity type', () => {
    expect(buildActivitySummary('admin.plan_created', 'Plan')).toBe('Plan created');
    expect(buildActivitySummary('admin.coupon_created', 'Promo')).toBe('Coupon created (Promo)');
  });
});
