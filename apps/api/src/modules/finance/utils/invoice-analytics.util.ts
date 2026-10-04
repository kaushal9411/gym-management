import type { MemberInvoiceStatus } from '@prisma/client';

import type { InvoiceAnalyticsDto, InvoiceListExtrasDto } from '../dto/finance.dto';

import { addDaysStr, daysInclusive, money, type DateRange } from './payments-analytics.util';

/**
 * Invoice status semantics (verified against the codebase): nothing ever WRITES `OVERDUE` (no scheduler sets
 * it), so "overdue" is derived — an invoice is effectively OVERDUE when its stored status is OVERDUE, or it is
 * UNPAID/PARTIALLY_PAID with `dueDate < today` (UTC). This mirrors the payments-analytics `overdueInvoices` rule.
 * The same effective status drives the `/invoices` status filter, `counts` and the analytics `byStatus`.
 */
export const INVOICE_STATUSES: MemberInvoiceStatus[] = [
  'UNPAID',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
];
export const OPEN_INVOICE_STATUSES: MemberInvoiceStatus[] = ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'];
export const AGING_BUCKETS = ['Current', '1-30', '31-60', '61-90', '90+'] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

/** Remaining balance of one invoice: never negative (an over-paid invoice owes nothing). */
export const balanceOf = (total: number, paid: number): number => Math.max(total - paid, 0);

/** collected / invoiced as 0..1 — 0 when nothing was invoiced, clamped to 1 (payments may exceed the invoiced slice). */
export const collectionRate = (collected: number, invoiced: number): number =>
  invoiced > 0 ? Math.min(collected / invoiced, 1) : 0;

/** Aging bucket from whole days past the due date (day 0 = due today = still Current). */
export function agingBucket(daysPast: number): AgingBucket {
  if (daysPast <= 0) return 'Current';
  if (daysPast <= 30) return '1-30';
  if (daysPast <= 60) return '31-60';
  if (daysPast <= 90) return '61-90';
  return '90+';
}

export interface InvoiceDayRow {
  date: string;
  invoiced: number;
  count: number;
  collected: number;
}
export interface InvoiceStatusRow {
  status: MemberInvoiceStatus;
  count: number;
  amount: number;
}
/** Open invoices with a positive balance, grouped by whole days past due (+ whether the stored status is OVERDUE). */
export interface OpenAgingRow {
  daysPast: number;
  storedOverdue: boolean;
  balance: number;
  count: number;
}
export interface DebtorRow {
  memberId: string;
  memberCode: string;
  name: string;
  outstanding: number;
  invoiceCount: number;
}
export interface InvoiceBranchRow {
  branchId: string;
  name: string;
  invoiced: number;
  collected: number;
}
export interface InvoiceAnalyticsRaw {
  range: DateRange;
  previousRange: DateRange;
  /** Non-cancelled invoices grouped by invoiceDate across previousRange.from..range.to. */
  dayRows: InvoiceDayRow[];
  /** Invoices dated in `range`, by effective status (sparse). */
  statusRows: InvoiceStatusRow[];
  openRows: OpenAgingRow[];
  debtors: DebtorRow[];
  branches: InvoiceBranchRow[];
}

/** Every status always present, in a stable order; missing ones are zero. */
export function fillStatuses(rows: InvoiceStatusRow[]): InvoiceStatusRow[] {
  const by = new Map(rows.map((r) => [r.status, r]));
  return INVOICE_STATUSES.map((status) => ({
    status,
    count: by.get(status)?.count ?? 0,
    amount: by.get(status)?.amount ?? 0,
  }));
}

export function bucketAging(
  rows: OpenAgingRow[],
): Array<{ bucket: AgingBucket; count: number; amount: number }> {
  const acc = new Map<AgingBucket, { count: number; amount: number }>(
    AGING_BUCKETS.map((b) => [b, { count: 0, amount: 0 }]),
  );
  for (const r of rows) {
    const e = acc.get(agingBucket(r.daysPast))!;
    e.count += r.count;
    e.amount += r.balance;
  }
  return AGING_BUCKETS.map((bucket) => ({ bucket, ...acc.get(bucket)! }));
}

/** Biggest open balance first; ties broken by member code so the order is deterministic. */
export function rankDebtors(rows: DebtorRow[], limit = 5): DebtorRow[] {
  return rows
    .filter((r) => r.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding || a.memberCode.localeCompare(b.memberCode))
    .slice(0, limit);
}

/** Pure assembly of the grouped aggregates into the response contract — no I/O, unit-testable. */
export function assembleInvoiceAnalytics(raw: InvoiceAnalyticsRaw): InvoiceAnalyticsDto {
  const { range, previousRange } = raw;
  const byDay = new Map(raw.dayRows.map((r) => [r.date, r]));
  const sum = (r: DateRange) => {
    const t = { invoiced: 0, count: 0, collected: 0 };
    for (const row of raw.dayRows) {
      if (row.date >= r.from && row.date <= r.to) {
        t.invoiced += row.invoiced;
        t.count += row.count;
        t.collected += row.collected;
      }
    }
    return t;
  };
  const cur = sum(range);
  const prev = sum(previousRange);

  const length = daysInclusive(range.from, range.to);
  const daily: InvoiceAnalyticsDto['daily'] = [];
  for (let i = 0; i < length; i += 1) {
    const date = addDaysStr(range.from, i);
    const prevDate = addDaysStr(previousRange.from, i);
    daily.push({
      date,
      invoiced: money(byDay.get(date)?.invoiced ?? 0),
      count: byDay.get(date)?.count ?? 0,
      previousInvoiced: money(byDay.get(prevDate)?.invoiced ?? 0),
    });
  }

  const outstanding = { amount: 0, count: 0 };
  const overdue = { amount: 0, count: 0 };
  for (const r of raw.openRows) {
    outstanding.amount += r.balance;
    outstanding.count += r.count;
    if (r.storedOverdue || r.daysPast > 0) {
      overdue.amount += r.balance;
      overdue.count += r.count;
    }
  }

  return {
    range,
    previousRange,
    kpis: {
      invoiced: { value: money(cur.invoiced), previous: money(prev.invoiced) },
      count: { value: cur.count, previous: prev.count },
      collected: { value: money(cur.collected), previous: money(prev.collected) },
      avgInvoice: {
        value: money(cur.count > 0 ? cur.invoiced / cur.count : 0),
        previous: money(prev.count > 0 ? prev.invoiced / prev.count : 0),
      },
      collectionRate: {
        value: collectionRate(cur.collected, cur.invoiced),
        previous: collectionRate(prev.collected, prev.invoiced),
      },
      outstanding: { value: money(outstanding.amount), invoiceCount: outstanding.count },
      overdue: { value: money(overdue.amount), count: overdue.count },
    },
    daily,
    byStatus: fillStatuses(raw.statusRows).map((s) => ({
      status: s.status,
      count: s.count,
      amount: money(s.amount),
    })),
    aging: bucketAging(raw.openRows).map((b) => ({
      bucket: b.bucket,
      count: b.count,
      amount: money(b.amount),
    })),
    topDebtors: rankDebtors(raw.debtors).map((d) => ({
      memberId: d.memberId,
      memberCode: d.memberCode,
      name: d.name,
      outstanding: money(d.outstanding),
      invoiceCount: d.invoiceCount,
    })),
    branches: [...raw.branches]
      .sort((a, b) => b.invoiced - a.invoiced)
      .map((b) => ({
        branchId: b.branchId,
        name: b.name,
        invoiced: money(b.invoiced),
        collected: money(b.collected),
      })),
  };
}

/** Per-effective-status aggregate of the filtered list set (status filter NOT applied). */
export interface InvoiceListStatusAgg {
  status: MemberInvoiceStatus;
  count: number;
  total: number;
  paid: number;
  /** Sum of max(total - paid, 0) — only populated for open statuses. */
  balance: number;
}

/**
 * `counts` ignore the status filter (every status over the search/date/amount/branch-filtered set);
 * `summary` honours it: invoiced/collected exclude CANCELLED, outstanding = open balances, count = rows in the filtered set.
 */
export function buildListExtras(
  rows: InvoiceListStatusAgg[],
  statusFilter?: MemberInvoiceStatus,
): InvoiceListExtrasDto {
  const by = new Map(rows.map((r) => [r.status, r]));
  const n = (s: MemberInvoiceStatus) => by.get(s)?.count ?? 0;
  const counts = {
    all: INVOICE_STATUSES.reduce((a, s) => a + n(s), 0),
    unpaid: n('UNPAID'),
    partiallyPaid: n('PARTIALLY_PAID'),
    paid: n('PAID'),
    overdue: n('OVERDUE'),
    cancelled: n('CANCELLED'),
  };
  const scoped = rows.filter((r) => !statusFilter || r.status === statusFilter);
  let invoiced = 0;
  let collected = 0;
  let outstanding = 0;
  let count = 0;
  for (const r of scoped) {
    count += r.count;
    outstanding += r.balance;
    if (r.status !== 'CANCELLED') {
      invoiced += r.total;
      collected += r.paid;
    }
  }
  return {
    summary: {
      invoiced: money(invoiced),
      collected: money(collected),
      outstanding: money(outstanding),
      count,
    },
    counts,
  };
}
