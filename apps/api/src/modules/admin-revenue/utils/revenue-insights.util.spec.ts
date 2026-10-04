import { describe, expect, it } from 'vitest';

import {
  ageBucket,
  aggregateMrr,
  bucketAging,
  buildRevenueCsv,
  collectionRate,
  dayMap,
  fillDays,
  lastMonths,
  pickDominantCurrency,
  resolveRevenueRanges,
  sortDunning,
  statusMix,
  windowStats,
  type DayStatusRow,
  type MrrRow,
} from './revenue-insights.util';

const NOW = new Date('2026-10-04T10:00:00Z');

describe('range maths', () => {
  it('30d is 30 UTC days ending today; previous is the 30 before', () => {
    const r = resolveRevenueRanges('30d', NOW);
    expect(r.range).toEqual({ from: '2026-09-05', to: '2026-10-04' });
    expect(r.previousRange).toEqual({ from: '2026-08-06', to: '2026-09-04' });
  });
  it('12m is 365 days', () => {
    const r = resolveRevenueRanges('12m', NOW);
    expect(r.range).toEqual({ from: '2025-10-05', to: '2026-10-04' });
    expect(r.previousRange.to).toBe('2025-10-04');
    expect(r.previousRange.from).toBe('2024-10-05');
  });
  it('lastMonths gives 12 months oldest first across a year boundary', () => {
    const m = lastMonths(new Date('2026-02-10T00:00:00Z'));
    expect(m).toHaveLength(12);
    expect(m[0]).toBe('2025-03');
    expect(m[11]).toBe('2026-02');
  });
});

describe('daily alignment / zero-fill', () => {
  const rows: DayStatusRow[] = [
    { d: '2026-10-02', status: 'SUCCEEDED', stale: false, amt: 100, n: 1 },
    { d: '2026-10-04', status: 'SUCCEEDED', stale: false, amt: 50, n: 2 },
    { d: '2026-10-03', status: 'FAILED', stale: false, amt: 20, n: 1 },
  ];
  it('zero-fills every day of the window', () => {
    const f = fillDays({ from: '2026-10-01', to: '2026-10-04' }, dayMap(rows, 'SUCCEEDED', 'amt'));
    expect(f.map((p) => p.value)).toEqual([0, 100, 0, 50]);
    expect(f.map((p) => p.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  });
  it('windowStats only counts days inside the window', () => {
    const s = windowStats(rows, { from: '2026-10-03', to: '2026-10-04' });
    expect(s.succeededAmount).toBe(50);
    expect(s.succeededCount).toBe(2);
    expect(s.failedCount).toBe(1);
  });
  it('statusMix returns all five statuses', () => {
    const m = statusMix([{ status: 'FAILED', n: 2, amt: 5 }]);
    expect(m.map((x) => x.status)).toHaveLength(5);
    expect(m.find((x) => x.status === 'FAILED')).toEqual({
      status: 'FAILED',
      count: 2,
      amount: '5.00',
    });
    expect(m.find((x) => x.status === 'REFUNDED')?.count).toBe(0);
  });
});

describe('collectionRate', () => {
  it('is succeeded over succeeded+failed+stale pending', () => {
    expect(collectionRate(75, 15, 10)).toBe(0.75);
  });
  it('is 0 with no data and 1 when all succeeded', () => {
    expect(collectionRate(0, 0, 0)).toBe(0);
    expect(collectionRate(10, 0, 0)).toBe(1);
  });
});

describe('MRR alignment (ACTIVE only)', () => {
  const base = {
    planId: 'p1',
    planName: 'Pro',
    currency: 'INR',
    priceMonthly: 1000,
    priceYearly: 6000,
  };
  const rows: MrrRow[] = [
    { ...base, billingCycle: 'MONTHLY', status: 'ACTIVE', count: 2 },
    { ...base, billingCycle: 'YEARLY', status: 'ACTIVE', count: 1 },
    { ...base, billingCycle: 'MONTHLY', status: 'TRIALING', count: 3 },
    { ...base, billingCycle: 'MONTHLY', status: 'PAST_DUE', count: 9 },
    {
      planId: 'p2',
      planName: 'Global',
      currency: 'USD',
      billingCycle: 'MONTHLY',
      status: 'ACTIVE',
      count: 1,
      priceMonthly: 20,
      priceYearly: 200,
    },
  ];
  const agg = aggregateMrr(rows);
  it('excludes TRIALING from mrr and reports it as mrrTrialing', () => {
    const inr = agg.byCurrency.find((c) => c.currency === 'INR')!;
    expect(inr.mrr).toBe(2 * 1000 + 6000 / 12);
    expect(inr.mrrTrialing).toBe(3000);
    expect(inr.activeSubscribers).toBe(3);
  });
  it('splits by currency and plan', () => {
    expect(agg.byCurrency.map((c) => c.currency)).toEqual(['INR', 'USD']);
    expect(agg.byPlan[0]).toMatchObject({ planId: 'p1', mrr: 2500, activeSubscribers: 3 });
  });
  it('ignores non-ACTIVE/TRIALING statuses', () => {
    expect(
      aggregateMrr([{ ...base, billingCycle: 'MONTHLY', status: 'PAST_DUE', count: 5 }]).byCurrency,
    ).toEqual([]);
  });
});

describe('dominant currency', () => {
  it('prefers most collected, then MRR, then INR', () => {
    expect(
      pickDominantCurrency(
        [
          { currency: 'USD', amount: 5 },
          { currency: 'INR', amount: 100 },
        ],
        [],
      ).currency,
    ).toBe('INR');
    expect(pickDominantCurrency([], [{ currency: 'USD', mrr: 9 }]).currency).toBe('USD');
    expect(pickDominantCurrency([], []).currency).toBe('INR');
    expect(
      pickDominantCurrency([{ currency: 'USD', amount: 5 }], [{ currency: 'EUR', mrr: 1 }])
        .currencies,
    ).toEqual(['EUR', 'USD']);
  });
});

describe('invoice aging buckets', () => {
  const today = '2026-10-04';
  const due = (n: number) => new Date(Date.UTC(2026, 9, 4 - n));
  it.each([
    [-5, 'Current'],
    [0, 'Current'],
    [1, '1-30'],
    [30, '1-30'],
    [31, '31-60'],
    [60, '31-60'],
    [61, '61-90'],
    [90, '61-90'],
    [91, '90+'],
  ])('%i days overdue -> %s', (n, bucket) => {
    expect(ageBucket(due(n), today)).toBe(bucket);
  });
  it('null due date is Current; bucketAging is zero-filled and sums', () => {
    expect(ageBucket(null, today)).toBe('Current');
    const b = bucketAging(
      [
        { due: '2026-10-03', count: 2, amount: 10 },
        { due: '2026-10-02', count: 1, amount: 5.5 },
        { due: null, count: 1, amount: 1 },
      ],
      today,
    );
    expect(b.map((x) => x.bucket)).toEqual(['Current', '1-30', '31-60', '61-90', '90+']);
    expect(b[1]).toEqual({ bucket: '1-30', count: 3, amount: '15.50' });
    expect(b[4]).toEqual({ bucket: '90+', count: 0, amount: '0.00' });
  });
});

describe('dunning ordering', () => {
  it('soonest grace end first, nulls last, stable', () => {
    const rows = [
      { id: 'a', graceEndsAt: null, status: 'PAST_DUE' },
      { id: 'b', graceEndsAt: new Date('2026-10-09T00:00:00Z'), status: 'GRACE' },
      { id: 'c', graceEndsAt: new Date('2026-10-06T00:00:00Z'), status: 'GRACE' },
      { id: 'd', graceEndsAt: null, status: 'PAST_DUE' },
    ];
    expect(sortDunning(rows).map((r) => r.id)).toEqual(['c', 'b', 'a', 'd']);
  });
});

describe('revenue CSV', () => {
  it('has a single table with header and rows', () => {
    const csv = buildRevenueCsv(
      [{ date: '2026-10-01', collected: '10.00', failed: 1, payments: 2 }],
      'INR',
    );
    expect(csv.split('\r\n')).toEqual([
      'Date,Collected,Failed payments,Payments,Currency',
      '2026-10-01,10.00,1,2,INR',
      '',
    ]);
  });
});
