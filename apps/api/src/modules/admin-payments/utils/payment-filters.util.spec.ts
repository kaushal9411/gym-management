import { describe, expect, it } from 'vitest';

import { csvCell } from '../../admin-tenants/utils/tenant-list.util';

import {
  buildInvoiceWhere,
  buildPaymentOrderBy,
  buildPaymentWhere,
  buildPaymentsCsv,
  invoiceCounts,
  invoiceSummary,
  paymentCounts,
  paymentSummary,
  type PaymentCsvSource,
} from './payment-filters.util';

describe('buildPaymentWhere', () => {
  it('maps every filter', () => {
    const w = buildPaymentWhere({
      status: 'FAILED',
      provider: 'RAZORPAY',
      tenant: 'gym',
      from: '2026-10-01',
      to: '2026-10-03',
      minAmount: 10,
      maxAmount: 99,
      currency: 'inr',
      mode: 'UPI',
    });
    expect(w).toMatchObject({
      status: 'FAILED',
      provider: 'RAZORPAY',
      currency: 'INR',
      paymentMode: 'UPI',
      amount: { gte: 10, lte: 99 },
    });
    expect(w.tenant).toEqual({
      is: {
        OR: [
          { name: { contains: 'gym', mode: 'insensitive' } },
          { slug: { contains: 'gym', mode: 'insensitive' } },
        ],
      },
    });
    const range = { gte: new Date('2026-10-01T00:00:00Z'), lt: new Date('2026-10-04T00:00:00Z') };
    expect(w.AND).toEqual([{ OR: [{ paidAt: range }, { paidAt: null, createdAt: range }] }]);
  });
  it('ignoreStatus drops only status; empty filters give an empty where', () => {
    expect(
      buildPaymentWhere({ status: 'FAILED', provider: 'STRIPE' }, { ignoreStatus: true }),
    ).toEqual({ provider: 'STRIPE' });
    expect(buildPaymentWhere({})).toEqual({});
  });
  it('supports open-ended amount and date bounds', () => {
    expect(buildPaymentWhere({ minAmount: 5 }).amount).toEqual({ gte: 5 });
    expect(buildPaymentWhere({ minAmount: 0 }).amount).toEqual({ gte: 0 });
    const w = buildPaymentWhere({ to: '2026-10-03' });
    expect(JSON.stringify(w.AND)).not.toContain('gte');
  });
  it('orders by paidAt with nulls last and a stable tiebreak', () => {
    expect(buildPaymentOrderBy('paidAt', 'asc')[0]).toEqual({
      paidAt: { sort: 'asc', nulls: 'last' },
    });
    expect(buildPaymentOrderBy()[0]).toEqual({ createdAt: 'desc' });
  });
});

describe('buildInvoiceWhere', () => {
  const now = new Date('2026-10-04T15:00:00Z');
  it('overdue = OPEN and due before UTC today', () => {
    expect(buildInvoiceWhere({ overdue: true }, { now }).AND).toEqual([
      { status: 'OPEN', dueDate: { lt: new Date('2026-10-04T00:00:00Z') } },
    ]);
  });
  it('ignoreStatus drops status and overdue but keeps other filters', () => {
    expect(
      buildInvoiceWhere(
        { status: 'PAID', overdue: true, currency: 'usd', minAmount: 1 },
        { ignoreStatus: true },
      ),
    ).toEqual({
      currency: 'USD',
      total: { gte: 1 },
    });
  });
  it('issue date filter hits createdAt', () => {
    expect(buildInvoiceWhere({ from: '2026-10-01' }).createdAt).toEqual({
      gte: new Date('2026-10-01T00:00:00Z'),
    });
  });
});

describe('counts and summaries', () => {
  const groups = [
    { status: 'SUCCEEDED', currency: 'INR', count: 3, amount: 300 },
    { status: 'FAILED', currency: 'INR', count: 1, amount: 40 },
    { status: 'PENDING', currency: 'INR', count: 2, amount: 20.5 },
  ];
  it('payment counts and summary', () => {
    expect(paymentCounts(groups)).toEqual({
      all: 6,
      succeeded: 3,
      pending: 2,
      failed: 1,
      refunded: 0,
      partiallyRefunded: 0,
    });
    expect(paymentSummary(groups)).toEqual({
      count: 6,
      succeededAmount: '300.00',
      failedAmount: '40.00',
      pendingAmount: '20.50',
      currency: 'INR',
      mixedCurrency: false,
    });
    expect(
      paymentSummary([...groups, { status: 'SUCCEEDED', currency: 'USD', count: 1, amount: 1 }])
        .mixedCurrency,
    ).toBe(true);
  });
  it('invoice counts and summary', () => {
    const inv = [
      { status: 'OPEN', currency: 'INR', count: 2, amount: 50 },
      { status: 'PAID', currency: 'INR', count: 1, amount: 25 },
    ];
    expect(invoiceCounts(inv, 1)).toMatchObject({
      all: 3,
      open: 2,
      paid: 1,
      draft: 0,
      void: 0,
      uncollectible: 0,
      overdue: 1,
    });
    expect(invoiceSummary(inv)).toMatchObject({ count: 3, total: '75.00', outstanding: '50.00' });
  });
});

describe('CSV safety', () => {
  it('guards formula injection and quotes specials', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@sum')).toBe("'@sum");
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell(null)).toBe('');
  });
  it('payments CSV escapes tenant names and uses paidAt else createdAt', () => {
    const row: PaymentCsvSource = {
      paidAt: null,
      createdAt: new Date('2026-10-01T05:00:00Z'),
      provider: 'MANUAL',
      status: 'FAILED',
      amount: 12.5,
      currency: 'INR',
      paymentMode: null,
      gatewayReference: null,
      failureReason: '=cmd|x',
      tenant: { name: '-Evil, Gym', slug: 'evil' },
      invoice: { invoiceNumber: 'INV-1' },
    };
    const lines = buildPaymentsCsv([row]).split('\r\n');
    expect(lines[0]).toContain('Gateway reference');
    expect(lines[1]).toBe(`2026-10-01,"'-Evil, Gym",evil,MANUAL,FAILED,12.50,INR,,,'=cmd|x,INV-1`);
  });
});
