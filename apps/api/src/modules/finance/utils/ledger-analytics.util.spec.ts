import { describe, expect, it } from 'vitest';

import { ledgerAnalyticsQuerySchema } from '../validators/finance.validators';

import { assembleLedgerAnalytics, mergeCategories, netProfitOf, type LedgerRaw } from './ledger-analytics.util';
import { resolveRanges } from './payments-analytics.util';

const base: LedgerRaw = {
  kind: 'income',
  range: { from: '2026-10-01', to: '2026-10-03' },
  previousRange: { from: '2026-09-28', to: '2026-09-30' },
  dayRows: [
    { date: '2026-09-29', amount: 400, count: 1 },
    { date: '2026-10-01', amount: 1000, count: 2 },
    { date: '2026-10-03', amount: 500, count: 1 },
  ],
  categoriesCurrent: [
    { category: 'OTHER', amount: 500, count: 1 },
    { category: 'MEMBERSHIP_FEE', amount: 1000, count: 2 },
  ],
  categoriesPrevious: [
    { category: 'PRODUCT_SALES', amount: 400, count: 1 },
    { category: 'OTHER', amount: 100, count: 1 },
  ],
  branches: [
    { branchId: 'b1', name: 'A', total: 100, previousTotal: 0 },
    { branchId: 'b2', name: 'B', total: 1400, previousTotal: 400 },
  ],
  topEntries: [
    {
      id: 'e1',
      description: 'Annual fee',
      category: 'MEMBERSHIP_FEE',
      amount: 800,
      date: '2026-10-01',
    },
  ],
  otherTotal: { current: 600, previous: 900 },
};

describe('ledger period alignment (reuses payments util)', () => {
  it('resolves the same previous range as payments analytics', () => {
    expect(resolveRanges('2026-10-01', '2026-10-03').previousRange).toEqual(base.previousRange);
  });
});

describe('mergeCategories', () => {
  it('unions both ranges, zero-fills the missing side and sorts by amount desc', () => {
    expect(mergeCategories(base.categoriesCurrent, base.categoriesPrevious)).toEqual([
      { category: 'MEMBERSHIP_FEE', amount: '1000.00', count: 2, previousAmount: '0.00' },
      { category: 'OTHER', amount: '500.00', count: 1, previousAmount: '100.00' },
      { category: 'PRODUCT_SALES', amount: '0.00', count: 0, previousAmount: '400.00' },
    ]);
  });
});

describe('netProfitOf', () => {
  it('is income minus expenses regardless of which ledger is own', () => {
    expect(netProfitOf('income', 1500, 600)).toBe(900);
    expect(netProfitOf('expense', 600, 1500)).toBe(900);
    expect(netProfitOf('expense', 2000, 500)).toBe(-1500);
  });
});

describe('assembleLedgerAnalytics', () => {
  const out = assembleLedgerAnalytics(base);

  it('computes kpis for both ranges', () => {
    expect(out.kpis.total).toEqual({ value: '1500.00', previous: '400.00' });
    expect(out.kpis.count).toEqual({ value: 3, previous: 1 });
    expect(out.kpis.average).toEqual({ value: '500.00', previous: '400.00' });
    expect(out.kpis.largest).toEqual({
      value: '800.00',
      description: 'Annual fee',
      category: 'MEMBERSHIP_FEE',
      date: '2026-10-01',
    });
    expect(out.kpis.netProfit).toEqual({ value: '900.00', previous: '-500.00' });
  });

  it('zero-fills daily with previous aligned by index', () => {
    expect(out.daily).toEqual([
      { date: '2026-10-01', total: '1000.00', count: 2, previousTotal: '0.00' },
      { date: '2026-10-02', total: '0.00', count: 0, previousTotal: '400.00' },
      { date: '2026-10-03', total: '500.00', count: 1, previousTotal: '0.00' },
    ]);
  });

  it('sorts branches desc and handles an empty ledger', () => {
    expect(out.branches.map((b) => b.branchId)).toEqual(['b2', 'b1']);
    const empty = assembleLedgerAnalytics({
      ...base,
      dayRows: [],
      categoriesCurrent: [],
      categoriesPrevious: [],
      branches: [],
      topEntries: [],
      otherTotal: { current: 0, previous: 0 },
    });
    expect(empty.kpis.total.value).toBe('0.00');
    expect(empty.kpis.average.value).toBe('0.00');
    expect(empty.kpis.largest).toBeNull();
    expect(empty.daily).toHaveLength(3);
  });

  it('gives a negative netProfit for an expense ledger exceeding income', () => {
    const e = assembleLedgerAnalytics({
      ...base,
      kind: 'expense',
      otherTotal: { current: 100, previous: 0 },
    });
    expect(e.kpis.netProfit.value).toBe('-1400.00');
  });
});

describe('ledgerAnalyticsQuerySchema', () => {
  it('rejects an inverted range and over-366-day ranges', () => {
    expect(ledgerAnalyticsQuerySchema.safeParse({ dateFrom: '2026-10-05', dateTo: '2026-10-01' }).success).toBe(false);
    expect(ledgerAnalyticsQuerySchema.safeParse({ dateFrom: '2025-01-01', dateTo: '2026-10-01' }).success).toBe(false);
    expect(ledgerAnalyticsQuerySchema.safeParse({ dateFrom: '2026-10-01', dateTo: '2026-10-05' }).success).toBe(true);
  });
});
