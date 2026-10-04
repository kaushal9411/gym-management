import type { Prisma } from '@prisma/client';

import { csvRow } from '../../admin-tenants/utils/tenant-list.util';

export const PAYMENT_SORTS = ['createdAt', 'amount', 'paidAt'] as const;
export type PaymentSort = (typeof PAYMENT_SORTS)[number];
export const INVOICE_SORTS = ['createdAt', 'total', 'dueDate'] as const;
export type InvoiceSort = (typeof INVOICE_SORTS)[number];
export type SortDir = 'asc' | 'desc';

export const PAYMENT_EXPORT_CAP = 10_000;

const dayStart = (d: string) => new Date(`${d}T00:00:00Z`);
const nextDay = (d: string) => new Date(dayStart(d).getTime() + 86_400_000);

export const todayStart = (now: Date = new Date()): Date =>
  dayStart(now.toISOString().slice(0, 10));

export interface PaymentFilters {
  status?: string;
  provider?: string;
  tenant?: string;
  /** YYYY-MM-DD, inclusive, matched against paidAt when set, otherwise createdAt. */
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  mode?: string;
}

const tenantSearch = (q: string) => ({
  is: {
    OR: [
      { name: { contains: q, mode: 'insensitive' as const } },
      { slug: { contains: q, mode: 'insensitive' as const } },
    ],
  },
});

const amountRange = (min?: number, max?: number) =>
  min !== undefined || max !== undefined
    ? { ...(min !== undefined ? { gte: min } : {}), ...(max !== undefined ? { lte: max } : {}) }
    : undefined;

/** Filters -> Prisma where. `ignoreStatus` is used for the per-status counts (they respect every other filter). */
export function buildPaymentWhere(
  f: PaymentFilters,
  opts: { ignoreStatus?: boolean; tenantId?: string } = {},
): Prisma.PaymentWhereInput {
  const and: Prisma.PaymentWhereInput[] = [];
  const amount = amountRange(f.minAmount, f.maxAmount);
  if (f.from || f.to) {
    const range = {
      ...(f.from ? { gte: dayStart(f.from) } : {}),
      ...(f.to ? { lt: nextDay(f.to) } : {}),
    };
    and.push({ OR: [{ paidAt: range }, { paidAt: null, createdAt: range }] });
  }
  return {
    ...(opts.tenantId ? { tenantId: opts.tenantId } : {}),
    ...(f.status && !opts.ignoreStatus
      ? { status: f.status as Prisma.PaymentWhereInput['status'] }
      : {}),
    ...(f.provider ? { provider: f.provider as Prisma.PaymentWhereInput['provider'] } : {}),
    ...(f.currency ? { currency: f.currency.toUpperCase() } : {}),
    ...(f.mode ? { paymentMode: f.mode as Prisma.PaymentWhereInput['paymentMode'] } : {}),
    ...(f.tenant ? { tenant: tenantSearch(f.tenant) } : {}),
    ...(amount ? { amount } : {}),
    ...(and.length ? { AND: and } : {}),
  };
}

export function buildPaymentOrderBy(
  sort: PaymentSort = 'createdAt',
  dir: SortDir = 'desc',
): Prisma.PaymentOrderByWithRelationInput[] {
  const primary: Prisma.PaymentOrderByWithRelationInput =
    sort === 'amount'
      ? { amount: dir }
      : sort === 'paidAt'
        ? { paidAt: { sort: dir, nulls: 'last' } }
        : { createdAt: dir };
  return sort === 'createdAt'
    ? [primary, { id: 'desc' }]
    : [primary, { createdAt: 'desc' }, { id: 'desc' }];
}

// ── Invoices ───────────────────────────────────────────────────────────────
export interface InvoiceFilters {
  status?: string;
  tenant?: string;
  /** Issue date (createdAt), YYYY-MM-DD inclusive. */
  from?: string;
  to?: string;
  /** OPEN and dueDate before today (UTC). */
  overdue?: boolean;
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
}

/** `ignoreStatus` drops BOTH `status` and `overdue` (both are "view" selectors; counts respect the remaining filters). */
export function buildInvoiceWhere(
  f: InvoiceFilters,
  opts: { ignoreStatus?: boolean; tenantId?: string; now?: Date } = {},
): Prisma.InvoiceWhereInput {
  const amount = amountRange(f.minAmount, f.maxAmount);
  const created =
    f.from || f.to
      ? { ...(f.from ? { gte: dayStart(f.from) } : {}), ...(f.to ? { lt: nextDay(f.to) } : {}) }
      : undefined;
  const and: Prisma.InvoiceWhereInput[] = [];
  if (!opts.ignoreStatus && f.overdue)
    and.push({ status: 'OPEN', dueDate: { lt: todayStart(opts.now) } });
  return {
    ...(opts.tenantId ? { tenantId: opts.tenantId } : {}),
    ...(f.status && !opts.ignoreStatus
      ? { status: f.status as Prisma.InvoiceWhereInput['status'] }
      : {}),
    ...(f.currency ? { currency: f.currency.toUpperCase() } : {}),
    ...(f.tenant ? { tenant: tenantSearch(f.tenant) } : {}),
    ...(amount ? { total: amount } : {}),
    ...(created ? { createdAt: created } : {}),
    ...(and.length ? { AND: and } : {}),
  };
}

export function buildInvoiceOrderBy(
  sort: InvoiceSort = 'createdAt',
  dir: SortDir = 'desc',
): Prisma.InvoiceOrderByWithRelationInput[] {
  const primary: Prisma.InvoiceOrderByWithRelationInput =
    sort === 'total'
      ? { total: dir }
      : sort === 'dueDate'
        ? { dueDate: { sort: dir, nulls: 'last' } }
        : { createdAt: dir };
  return sort === 'createdAt'
    ? [primary, { id: 'desc' }]
    : [primary, { createdAt: 'desc' }, { id: 'desc' }];
}

// ── Aggregations ───────────────────────────────────────────────────────────
export interface StatusGroup {
  status: string;
  currency?: string;
  count: number;
  amount: number;
}

export function paymentCounts(groups: StatusGroup[]) {
  const n = (s: string) => groups.filter((g) => g.status === s).reduce((a, g) => a + g.count, 0);
  return {
    all: groups.reduce((a, g) => a + g.count, 0),
    succeeded: n('SUCCEEDED'),
    pending: n('PENDING'),
    failed: n('FAILED'),
    refunded: n('REFUNDED'),
    partiallyRefunded: n('PARTIALLY_REFUNDED'),
  };
}

const fixed = (n: number) => n.toFixed(2);

/** Totals over the FULL filtered set (all pages). Amounts sum across currencies unless filtered — see `mixedCurrency`. */
export function paymentSummary(groups: StatusGroup[]) {
  const sum = (s: string) => groups.filter((g) => g.status === s).reduce((a, g) => a + g.amount, 0);
  const currencies = [...new Set(groups.map((g) => g.currency).filter((c): c is string => !!c))];
  return {
    count: groups.reduce((a, g) => a + g.count, 0),
    succeededAmount: fixed(sum('SUCCEEDED')),
    failedAmount: fixed(sum('FAILED')),
    pendingAmount: fixed(sum('PENDING')),
    currency: currencies.length === 1 ? currencies[0]! : null,
    mixedCurrency: currencies.length > 1,
  };
}

export function invoiceCounts(groups: StatusGroup[], overdue: number) {
  const n = (s: string) => groups.filter((g) => g.status === s).reduce((a, g) => a + g.count, 0);
  return {
    all: groups.reduce((a, g) => a + g.count, 0),
    draft: n('DRAFT'),
    open: n('OPEN'),
    paid: n('PAID'),
    void: n('VOID'),
    uncollectible: n('UNCOLLECTIBLE'),
    overdue,
  };
}

export function invoiceSummary(groups: StatusGroup[]) {
  const currencies = [...new Set(groups.map((g) => g.currency).filter((c): c is string => !!c))];
  return {
    count: groups.reduce((a, g) => a + g.count, 0),
    total: fixed(groups.reduce((a, g) => a + g.amount, 0)),
    outstanding: fixed(groups.filter((g) => g.status === 'OPEN').reduce((a, g) => a + g.amount, 0)),
    currency: currencies.length === 1 ? currencies[0]! : null,
    mixedCurrency: currencies.length > 1,
  };
}

// ── CSV ────────────────────────────────────────────────────────────────────
export const PAYMENT_CSV_HEADERS = [
  'Date',
  'Tenant',
  'Slug',
  'Provider',
  'Status',
  'Amount',
  'Currency',
  'Mode',
  'Gateway reference',
  'Failure reason',
  'Invoice number',
] as const;

export interface PaymentCsvSource {
  paidAt: Date | null;
  createdAt: Date;
  provider: string;
  status: string;
  amount: { toString(): string } | number | string;
  currency: string;
  paymentMode: string | null;
  gatewayReference: string | null;
  failureReason: string | null;
  tenant: { name: string; slug: string };
  invoice: { invoiceNumber: string } | null;
}

/** Date column = paidAt when set, otherwise createdAt (same event time the date filter uses). */
export function paymentCsvRow(p: PaymentCsvSource): string {
  return csvRow([
    (p.paidAt ?? p.createdAt).toISOString().slice(0, 10),
    p.tenant.name,
    p.tenant.slug,
    p.provider,
    p.status,
    Number(p.amount.toString()).toFixed(2),
    p.currency,
    p.paymentMode,
    p.gatewayReference,
    p.failureReason,
    p.invoice?.invoiceNumber,
  ]);
}

export const buildPaymentsCsv = (rows: PaymentCsvSource[]): string =>
  csvRow([...PAYMENT_CSV_HEADERS]) + rows.map(paymentCsvRow).join('');
