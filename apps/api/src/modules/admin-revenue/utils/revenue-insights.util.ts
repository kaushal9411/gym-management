import {
  money,
  monthlyPrice,
  resolveOverviewRanges,
  type OverviewRange,
} from '../../admin-dashboard/utils/overview.util';
import { csvRow } from '../../admin-tenants/utils/tenant-list.util';
import { addDaysStr, type DateRange } from '../../finance/utils/payments-analytics.util';

export { money };

export const REVENUE_RANGES = ['30d', '90d', '12m'] as const;
export type RevenueRange = (typeof REVENUE_RANGES)[number];

const DAY_MS = 86_400_000;

/** Same range maths as the dashboard: UTC days inclusive, `12m` = 365 days, previous = preceding window of equal length. */
export const resolveRevenueRanges = (
  range: RevenueRange,
  now: Date = new Date(),
): { range: DateRange; previousRange: DateRange } =>
  resolveOverviewRanges(range satisfies OverviewRange, now);

export const dayStart = (d: string): Date => new Date(`${d}T00:00:00Z`);

/** Last `n` UTC calendar months (`YYYY-MM`), oldest first, ending with the current month. */
export function lastMonths(now: Date, n = 12): string[] {
  const out: string[] = [];
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${String(m + 1).padStart(2, '0')}`);
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return out;
}

// ── payment rows grouped by (day, status) ─────────────────────────────────
export interface DayStatusRow {
  d: string;
  status: string;
  /** PENDING and older than 24h. */
  stale: boolean;
  amt: number;
  n: number;
}

export interface WindowStats {
  succeededAmount: number;
  succeededCount: number;
  failedAmount: number;
  failedCount: number;
  pendingAmount: number;
  pendingCount: number;
  stalePendingAmount: number;
}

/** Totals over the days of `w` (inclusive). */
export function windowStats(rows: DayStatusRow[], w: DateRange): WindowStats {
  const s: WindowStats = {
    succeededAmount: 0,
    succeededCount: 0,
    failedAmount: 0,
    failedCount: 0,
    pendingAmount: 0,
    pendingCount: 0,
    stalePendingAmount: 0,
  };
  for (const r of rows) {
    if (r.d < w.from || r.d > w.to) continue;
    const amt = Number(r.amt);
    const n = Number(r.n);
    if (r.status === 'SUCCEEDED') {
      s.succeededAmount += amt;
      s.succeededCount += n;
    } else if (r.status === 'FAILED') {
      s.failedAmount += amt;
      s.failedCount += n;
    } else if (r.status === 'PENDING') {
      s.pendingAmount += amt;
      s.pendingCount += n;
      if (r.stale) s.stalePendingAmount += amt;
    }
  }
  return s;
}

/** Per-day map for one status. */
export function dayMap(
  rows: DayStatusRow[],
  status: string,
  field: 'amt' | 'n',
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows)
    if (r.status === status) m.set(r.d, (m.get(r.d) ?? 0) + Number(field === 'amt' ? r.amt : r.n));
  return m;
}

/** Every UTC day of `w` (missing = 0). */
export function fillDays(
  w: DateRange,
  m: Map<string, number>,
): Array<{ date: string; value: number }> {
  const out: Array<{ date: string; value: number }> = [];
  for (let d = w.from; d <= w.to; d = addDaysStr(d, 1)) out.push({ date: d, value: m.get(d) ?? 0 });
  return out;
}

/** SUCCEEDED ÷ (SUCCEEDED + FAILED + PENDING older than 24h), amounts, 0..1; 0 when there is nothing. */
export function collectionRate(succeeded: number, failed: number, stalePending: number): number {
  const den = succeeded + failed + stalePending;
  if (den <= 0) return 0;
  return Math.min(1, Math.round((succeeded / den) * 10_000) / 10_000);
}

/** SUCCEEDED ÷ (SUCCEEDED + FAILED) by count, 0..1; 0 when none. */
export function successRate(succeeded: number, failed: number): number {
  const den = succeeded + failed;
  return den > 0 ? Math.round((succeeded / den) * 10_000) / 10_000 : 0;
}

export const PAYMENT_STATUSES = [
  'SUCCEEDED',
  'PENDING',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const;

/** All five statuses, zero-filled, from grouped `{status,n,amt}` rows. */
export function statusMix(
  rows: Array<{ status: string; n: number; amt: number }>,
): Array<{ status: string; count: number; amount: string }> {
  return PAYMENT_STATUSES.map((status) => {
    const mine = rows.filter((r) => r.status === status);
    return {
      status,
      count: mine.reduce((a, r) => a + Number(r.n), 0),
      amount: money(mine.reduce((a, r) => a + Number(r.amt), 0)),
    };
  });
}

// ── MRR ────────────────────────────────────────────────────────────────────
export interface MrrRow {
  planId: string;
  planName: string;
  currency: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  status: string;
  count: number;
  priceMonthly: number;
  priceYearly: number;
}

export interface MrrAggregate {
  byCurrency: Array<{
    currency: string;
    mrr: number;
    mrrTrialing: number;
    activeSubscribers: number;
  }>;
  byPlan: Array<{
    planId: string;
    planName: string;
    currency: string;
    mrr: number;
    activeSubscribers: number;
  }>;
}

/** MRR counts ACTIVE subscriptions only (monthly-normalised); TRIALING is reported separately as pipeline. Other statuses are ignored. */
export function aggregateMrr(rows: MrrRow[]): MrrAggregate {
  const cur = new Map<string, MrrAggregate['byCurrency'][number]>();
  const plans = new Map<string, MrrAggregate['byPlan'][number]>();
  for (const r of rows) {
    if (r.status !== 'ACTIVE' && r.status !== 'TRIALING') continue;
    const value = r.count * monthlyPrice(r.billingCycle, r.priceMonthly, r.priceYearly);
    const c = cur.get(r.currency) ?? {
      currency: r.currency,
      mrr: 0,
      mrrTrialing: 0,
      activeSubscribers: 0,
    };
    if (r.status === 'ACTIVE') {
      c.mrr += value;
      c.activeSubscribers += r.count;
      const p = plans.get(r.planId) ?? {
        planId: r.planId,
        planName: r.planName,
        currency: r.currency,
        mrr: 0,
        activeSubscribers: 0,
      };
      p.mrr += value;
      p.activeSubscribers += r.count;
      plans.set(r.planId, p);
    } else {
      c.mrrTrialing += value;
    }
    cur.set(r.currency, c);
  }
  return {
    byCurrency: [...cur.values()].sort(
      (a, b) => b.mrr - a.mrr || a.currency.localeCompare(b.currency),
    ),
    byPlan: [...plans.values()].sort(
      (a, b) => b.mrr - a.mrr || a.planName.localeCompare(b.planName),
    ),
  };
}

/** Dominant currency = most collected in the window, then most MRR, then INR. `currencies` lists every currency seen (only when >1 it should be surfaced). */
export function pickDominantCurrency(
  collected: Array<{ currency: string; amount: number }>,
  mrr: Array<{ currency: string; mrr: number }>,
  seen: string[] = [],
): { currency: string; currencies: string[] } {
  const all = new Set<string>([
    ...seen,
    ...collected.map((c) => c.currency),
    ...mrr.map((m) => m.currency),
  ]);
  const byCollected = [...collected].sort((a, b) => b.amount - a.amount).find((c) => c.amount > 0);
  const byMrr = [...mrr].sort((a, b) => b.mrr - a.mrr).find((m) => m.mrr > 0);
  const currency = byCollected?.currency ?? byMrr?.currency ?? [...all].sort()[0] ?? 'INR';
  return { currency, currencies: [...all].sort() };
}

// ── Invoice aging ──────────────────────────────────────────────────────────
export const AGING_BUCKETS = ['Current', '1-30', '31-60', '61-90', '90+'] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

/** Whole UTC days past due (0 = due today / not yet due / no due date). */
export function daysOverdue(due: string | Date | null, today: string): number {
  if (!due) return 0;
  const d = typeof due === 'string' ? due.slice(0, 10) : due.toISOString().slice(0, 10);
  return Math.max(0, Math.round((dayStart(today).getTime() - dayStart(d).getTime()) / DAY_MS));
}

export function ageBucket(due: string | Date | null, today: string): AgingBucket {
  const n = daysOverdue(due, today);
  if (n <= 0) return 'Current';
  if (n <= 30) return '1-30';
  if (n <= 60) return '31-60';
  if (n <= 90) return '61-90';
  return '90+';
}

/** OPEN invoices grouped by due day -> the five buckets (always all five, zero-filled). */
export function bucketAging(
  rows: Array<{ due: string | null; count: number; amount: number }>,
  today: string,
): Array<{ bucket: AgingBucket; count: number; amount: string }> {
  const acc = new Map<AgingBucket, { count: number; amount: number }>(
    AGING_BUCKETS.map((b) => [b, { count: 0, amount: 0 }]),
  );
  for (const r of rows) {
    const e = acc.get(ageBucket(r.due, today))!;
    e.count += Number(r.count);
    e.amount += Number(r.amount);
  }
  return AGING_BUCKETS.map((bucket) => ({
    bucket,
    count: acc.get(bucket)!.count,
    amount: money(acc.get(bucket)!.amount),
  }));
}

// ── Dunning ────────────────────────────────────────────────────────────────
export interface DunningRow {
  graceEndsAt: Date | null;
  status: string;
}

/** Soonest grace end first; no grace end last; stable. */
export function sortDunning<T extends DunningRow>(rows: T[]): T[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const x = a.r.graceEndsAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const y = b.r.graceEndsAt?.getTime() ?? Number.POSITIVE_INFINITY;
      return x === y ? a.i - b.i : x - y;
    })
    .map((x) => x.r);
}

// ── CSV ────────────────────────────────────────────────────────────────────
export const REVENUE_CSV_HEADERS = [
  'Date',
  'Collected',
  'Failed payments',
  'Payments',
  'Currency',
] as const;

export function buildRevenueCsv(
  rows: Array<{ date: string; collected: string; failed: number; payments: number }>,
  currency: string,
): string {
  return (
    csvRow([...REVENUE_CSV_HEADERS]) +
    rows.map((r) => csvRow([r.date, r.collected, r.failed, r.payments, currency])).join('')
  );
}
