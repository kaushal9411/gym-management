import { describe, expect, it } from 'vitest';

import { paymentsAnalyticsQuerySchema } from '../validators/finance.validators';

import { assembleAnalytics, resolveRanges, type AnalyticsRaw } from './payments-analytics.util';

describe('resolveRanges', () => {
  it('defaults to the current month so far, with an equal-length previous range', () => {
    const r = resolveRanges(undefined, undefined, new Date('2026-10-03T10:00:00Z'));
    expect(r.range).toEqual({ from: '2026-10-01', to: '2026-10-03' });
    expect(r.previousRange).toEqual({ from: '2026-09-28', to: '2026-09-30' });
    expect(r.today).toBe('2026-10-03');
  });

  it('aligns the previous range for a custom range across a leap-year February', () => {
    const r = resolveRanges('2028-03-01', '2028-03-10');
    expect(r.previousRange).toEqual({ from: '2028-02-20', to: '2028-02-29' });
  });

  it('treats a single day as a one-day previous range', () => {
    expect(resolveRanges('2026-01-01', '2026-01-01').previousRange).toEqual({
      from: '2025-12-31',
      to: '2025-12-31',
    });
  });
});

describe('assembleAnalytics', () => {
  const raw: AnalyticsRaw = {
    range: { from: '2026-10-01', to: '2026-10-03' },
    previousRange: { from: '2026-09-28', to: '2026-09-30' },
    dayStatus: [
      { date: '2026-10-01', status: 'SUCCESS', amount: 1000, count: 2 },
      { date: '2026-10-03', status: 'PARTIALLY_REFUNDED', amount: 500, count: 1 },
      { date: '2026-10-03', status: 'FAILED', amount: 300, count: 1 },
      { date: '2026-09-28', status: 'SUCCESS', amount: 400, count: 1 },
      { date: '2026-09-29', status: 'PENDING', amount: 100, count: 1 },
    ],
    refundsByDay: [
      { date: '2026-10-03', amount: 150, count: 1 },
      { date: '2026-09-29', amount: 50, count: 1 },
    ],
    today: { amount: 500, count: 1 },
    outstanding: { amount: 2000, count: 4 },
    methods: [{ method: 'CASH', amount: 1500, count: 3 }],
    branches: [
      { branchId: 'a', name: 'A', revenue: 100, previousRevenue: 0 },
      { branchId: 'b', name: 'B', revenue: 1400, previousRevenue: 400 },
    ],
    topPlans: [{ planName: 'Gold', revenue: 1500, count: 3 }],
    pendingOver24h: 2,
    overdue: { amount: 700, count: 2 },
  };
  const out = assembleAnalytics(raw);

  it('computes KPIs for the range and the previous range', () => {
    expect(out.kpis.collected).toEqual({ value: '1500.00', previous: '400.00' });
    expect(out.kpis.avgPayment).toEqual({ value: '500.00', previous: '400.00' });
    expect(out.kpis.paymentCount).toEqual({ value: 4, previous: 2 });
    expect(out.kpis.successRate.value).toBeCloseTo(3 / 4);
    expect(out.kpis.successRate.previous).toBeCloseTo(1 / 2);
  });

  it('computes the refund rate as refunded / collected', () => {
    expect(out.kpis.refunded).toMatchObject({ value: '150.00', previous: '50.00', count: 1 });
    expect(out.kpis.refunded.rate).toBeCloseTo(0.1);
  });

  it('returns a refund rate of 0 when nothing was collected', () => {
    const empty = assembleAnalytics({
      ...raw,
      dayStatus: [],
      refundsByDay: [{ date: '2026-10-02', amount: 10, count: 1 }],
    });
    expect(empty.kpis.refunded.rate).toBe(0);
    expect(empty.kpis.avgPayment.value).toBe('0.00');
    expect(empty.kpis.successRate.value).toBe(0);
  });

  it('zero-fills one daily row per day with the index-aligned previous day', () => {
    expect(out.daily).toEqual([
      {
        date: '2026-10-01',
        collected: '1000.00',
        refunded: '0.00',
        count: 2,
        previousCollected: '400.00',
      },
      {
        date: '2026-10-02',
        collected: '0.00',
        refunded: '0.00',
        count: 0,
        previousCollected: '0.00',
      },
      {
        date: '2026-10-03',
        collected: '500.00',
        refunded: '150.00',
        count: 2,
        previousCollected: '0.00',
      },
    ]);
  });

  it('reports statuses, sorted branches and attention counts', () => {
    expect(out.statuses).toEqual(
      expect.arrayContaining([
        { status: 'FAILED', count: 1 },
        { status: 'SUCCESS', count: 2 },
      ]),
    );
    expect(out.branches.map((b) => b.branchId)).toEqual(['b', 'a']);
    expect(out.attention).toEqual({
      pendingOver24h: 2,
      failed: 1,
      overdueInvoices: { count: 2, amount: '700.00' },
    });
  });
});

describe('paymentsAnalyticsQuerySchema', () => {
  it('accepts empty and ISO ranges, normalising to YYYY-MM-DD', () => {
    expect(paymentsAnalyticsQuerySchema.safeParse({}).success).toBe(true);
    const r = paymentsAnalyticsQuerySchema.parse({
      dateFrom: '2026-10-01T00:00:00.000Z',
      dateTo: '2026-10-05',
    });
    expect(r).toMatchObject({ dateFrom: '2026-10-01', dateTo: '2026-10-05' });
  });
  it('rejects inverted and oversized ranges', () => {
    expect(paymentsAnalyticsQuerySchema.safeParse({ dateFrom: '2026-10-05', dateTo: '2026-10-01' }).success).toBe(false);
    expect(paymentsAnalyticsQuerySchema.safeParse({ dateFrom: '2024-01-01', dateTo: '2026-01-01' }).success).toBe(false);
  });
});
