import { describe, expect, it } from 'vitest';

import { invoiceAnalyticsQuerySchema } from '../validators/finance.validators';

import {
  agingBucket,
  assembleInvoiceAnalytics,
  balanceOf,
  bucketAging,
  buildListExtras,
  collectionRate,
  fillStatuses,
  rankDebtors,
  type InvoiceAnalyticsRaw,
} from './invoice-analytics.util';

describe('agingBucket', () => {
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
  ])('%i days past due -> %s', (days, bucket) => {
    expect(agingBucket(days)).toBe(bucket);
  });
});

describe('bucketAging', () => {
  it('always returns the five buckets in order, summing rows into them', () => {
    const out = bucketAging([
      { daysPast: 0, storedOverdue: false, balance: 100, count: 1 },
      { daysPast: -3, storedOverdue: false, balance: 50, count: 2 },
      { daysPast: 31, storedOverdue: false, balance: 70, count: 1 },
    ]);
    expect(out.map((b) => b.bucket)).toEqual(['Current', '1-30', '31-60', '61-90', '90+']);
    expect(out[0]).toEqual({ bucket: 'Current', count: 3, amount: 150 });
    expect(out[2]).toEqual({ bucket: '31-60', count: 1, amount: 70 });
    expect(out[4]).toEqual({ bucket: '90+', count: 0, amount: 0 });
  });
});

describe('balanceOf / collectionRate', () => {
  it('never goes negative', () => {
    expect(balanceOf(100, 40)).toBe(60);
    expect(balanceOf(100, 100)).toBe(0);
    expect(balanceOf(100, 150)).toBe(0);
  });
  it('is 0 for nothing invoiced and clamps to 1', () => {
    expect(collectionRate(50, 0)).toBe(0);
    expect(collectionRate(50, 200)).toBe(0.25);
    expect(collectionRate(300, 200)).toBe(1);
  });
});

describe('fillStatuses', () => {
  it('includes all five statuses, zero when absent', () => {
    const out = fillStatuses([{ status: 'PAID', count: 2, amount: 90 }]);
    expect(out.map((s) => s.status)).toEqual([
      'UNPAID',
      'PARTIALLY_PAID',
      'PAID',
      'OVERDUE',
      'CANCELLED',
    ]);
    expect(out.find((s) => s.status === 'PAID')).toEqual({ status: 'PAID', count: 2, amount: 90 });
    expect(out.find((s) => s.status === 'OVERDUE')).toEqual({
      status: 'OVERDUE',
      count: 0,
      amount: 0,
    });
  });
});

describe('rankDebtors', () => {
  const row = (memberCode: string, outstanding: number) => ({
    memberId: memberCode,
    memberCode,
    name: memberCode,
    outstanding,
    invoiceCount: 1,
  });
  it('orders by balance desc, ties by member code, drops zero balances and caps at 5', () => {
    const out = rankDebtors([
      row('M3', 10),
      row('M1', 50),
      row('M2', 50),
      row('M0', 0),
      row('M4', 5),
      row('M5', 4),
      row('M6', 3),
    ]);
    expect(out.map((d) => d.memberCode)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5']);
  });
});

describe('assembleInvoiceAnalytics', () => {
  const raw: InvoiceAnalyticsRaw = {
    range: { from: '2026-10-01', to: '2026-10-03' },
    previousRange: { from: '2026-09-28', to: '2026-09-30' },
    dayRows: [
      { date: '2026-10-01', invoiced: 1000, count: 2, collected: 600 },
      { date: '2026-10-03', invoiced: 500, count: 1, collected: 700 },
      { date: '2026-09-29', invoiced: 400, count: 1, collected: 100 },
    ],
    statusRows: [{ status: 'UNPAID', count: 1, amount: 400 }],
    openRows: [
      { daysPast: 0, storedOverdue: false, balance: 400, count: 1 },
      { daysPast: 12, storedOverdue: false, balance: 100, count: 1 },
      { daysPast: -2, storedOverdue: true, balance: 25, count: 1 },
    ],
    debtors: [{ memberId: 'u1', memberCode: 'M1', name: 'A B', outstanding: 525, invoiceCount: 3 }],
    branches: [
      { branchId: 'b1', name: 'Small', invoiced: 100, collected: 0 },
      { branchId: 'b2', name: 'Big', invoiced: 1400, collected: 1300 },
    ],
  };
  const out = assembleInvoiceAnalytics(raw);

  it('zero-fills the daily series and aligns previous by index', () => {
    expect(out.daily).toEqual([
      { date: '2026-10-01', invoiced: '1000.00', count: 2, previousInvoiced: '0.00' },
      { date: '2026-10-02', invoiced: '0.00', count: 0, previousInvoiced: '400.00' },
      { date: '2026-10-03', invoiced: '500.00', count: 1, previousInvoiced: '0.00' },
    ]);
  });

  it('computes KPIs with previous values and a clamped rate', () => {
    expect(out.kpis.invoiced).toEqual({ value: '1500.00', previous: '400.00' });
    expect(out.kpis.count).toEqual({ value: 3, previous: 1 });
    expect(out.kpis.collected).toEqual({ value: '1300.00', previous: '100.00' });
    expect(out.kpis.avgInvoice).toEqual({ value: '500.00', previous: '400.00' });
    expect(out.kpis.collectionRate).toEqual({ value: 0.8666666666666667, previous: 0.25 });
  });

  it('derives outstanding and overdue (stored OVERDUE or past due) from open rows', () => {
    expect(out.kpis.outstanding).toEqual({ value: '525.00', invoiceCount: 3 });
    expect(out.kpis.overdue).toEqual({ value: '125.00', count: 2 });
  });

  it('fills statuses/aging, sorts branches by invoiced desc', () => {
    expect(out.byStatus).toHaveLength(5);
    expect(out.aging.map((a) => a.bucket)).toEqual(['Current', '1-30', '31-60', '61-90', '90+']);
    expect(out.branches.map((b) => b.name)).toEqual(['Big', 'Small']);
    expect(out.topDebtors[0]).toMatchObject({
      memberId: 'u1',
      outstanding: '525.00',
      invoiceCount: 3,
    });
  });

  it('is all zeros for an empty scope', () => {
    const empty = assembleInvoiceAnalytics({
      ...raw,
      dayRows: [],
      statusRows: [],
      openRows: [],
      debtors: [],
      branches: [],
    });
    expect(empty.kpis.collectionRate).toEqual({ value: 0, previous: 0 });
    expect(empty.kpis.avgInvoice.value).toBe('0.00');
    expect(empty.topDebtors).toEqual([]);
    expect(empty.aging.every((a) => a.count === 0)).toBe(true);
  });
});

describe('buildListExtras', () => {
  const rows = [
    { status: 'UNPAID' as const, count: 2, total: 300, paid: 0, balance: 300 },
    { status: 'PAID' as const, count: 3, total: 900, paid: 900, balance: 0 },
    { status: 'OVERDUE' as const, count: 1, total: 100, paid: 40, balance: 60 },
    { status: 'CANCELLED' as const, count: 4, total: 777, paid: 0, balance: 0 },
  ];
  it('counts ignore the status filter; missing statuses are 0', () => {
    expect(buildListExtras(rows, 'PAID').counts).toEqual({
      all: 10,
      unpaid: 2,
      partiallyPaid: 0,
      paid: 3,
      overdue: 1,
      cancelled: 4,
    });
  });
  it('summary spans the whole set, excluding CANCELLED money', () => {
    expect(buildListExtras(rows).summary).toEqual({
      invoiced: '1300.00',
      collected: '940.00',
      outstanding: '360.00',
      count: 10,
    });
  });
  it('summary honours the status filter', () => {
    expect(buildListExtras(rows, 'OVERDUE').summary).toEqual({
      invoiced: '100.00',
      collected: '40.00',
      outstanding: '60.00',
      count: 1,
    });
  });
});

describe('invoiceAnalyticsQuerySchema', () => {
  it('rejects an inverted range', () => {
    expect(
      invoiceAnalyticsQuerySchema.safeParse({ dateFrom: '2026-10-05', dateTo: '2026-10-01' })
        .success,
    ).toBe(false);
  });
});
