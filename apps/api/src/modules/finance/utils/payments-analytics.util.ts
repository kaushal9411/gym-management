import type { MemberPaymentMethod, MemberPaymentStatus } from '@prisma/client';

import type { PaymentsAnalyticsDto } from '../dto/finance.dto';

/** Statuses that count as money actually collected (gross — refunds are reported separately). */
export const COLLECTED_STATUSES: MemberPaymentStatus[] = ['SUCCESS', 'PARTIALLY_REFUNDED'];
/** Statuses whose attempt reached a successful charge at some point — numerator of the success rate. */
export const SUCCESSISH_STATUSES: MemberPaymentStatus[] = ['SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED'];

const DAY_MS = 86_400_000;

export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysInclusive(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS) + 1;
}

export interface DateRange {
  from: string;
  to: string;
}

/** Default = current (UTC, as elsewhere in finance) calendar month to today. Previous = the immediately preceding range of identical length. */
export function resolveRanges(dateFrom?: string, dateTo?: string, now: Date = new Date()): { range: DateRange; previousRange: DateRange; today: string } {
  const today = now.toISOString().slice(0, 10);
  const to = dateTo ?? today;
  const from = dateFrom ?? `${to.slice(0, 7)}-01`;
  const length = daysInclusive(from, to);
  const prevTo = addDaysStr(from, -1);
  return {
    range: { from, to },
    previousRange: { from: addDaysStr(prevTo, -(length - 1)), to: prevTo },
    today,
  };
}

export const money = (n: number): string => n.toFixed(2);
const ratio = (num: number, den: number): number => (den > 0 ? num / den : 0);

export interface DayStatusRow {
  date: string;
  status: MemberPaymentStatus;
  amount: number;
  count: number;
}
export interface AnalyticsRaw {
  range: DateRange;
  previousRange: DateRange;
  /** Grouped by (day, status) across previousRange.from..range.to. */
  dayStatus: DayStatusRow[];
  /** Refunds grouped by day across previousRange.from..range.to. */
  refundsByDay: Array<{ date: string; amount: number; count: number }>;
  today: { amount: number; count: number };
  outstanding: { amount: number; count: number };
  methods: Array<{ method: MemberPaymentMethod; amount: number; count: number }>;
  branches: Array<{ branchId: string; name: string; revenue: number; previousRevenue: number }>;
  topPlans: Array<{ planName: string; revenue: number; count: number }>;
  pendingOver24h: number;
  overdue: { amount: number; count: number };
}

/** Pure assembly of the grouped aggregates into the response contract — no I/O, unit-testable. */
export function assembleAnalytics(raw: AnalyticsRaw): PaymentsAnalyticsDto {
  const { range, previousRange } = raw;
  const inRange = (d: string, r: DateRange) => d >= r.from && d <= r.to;
  const collected = new Set<string>(COLLECTED_STATUSES);
  const successish = new Set<string>(SUCCESSISH_STATUSES);

  const collectedByDay = new Map<string, { amount: number; count: number }>();
  const stats = {
    cur: { collected: 0, collectedCount: 0, attempts: 0, success: 0 },
    prev: { collected: 0, collectedCount: 0, attempts: 0, success: 0 },
  };
  const statusCounts = new Map<MemberPaymentStatus, number>();

  for (const row of raw.dayStatus) {
    const bucket = inRange(row.date, range) ? stats.cur : inRange(row.date, previousRange) ? stats.prev : null;
    if (!bucket) continue;
    bucket.attempts += row.count;
    if (successish.has(row.status)) bucket.success += row.count;
    if (collected.has(row.status)) {
      bucket.collected += row.amount;
      bucket.collectedCount += row.count;
      const e = collectedByDay.get(row.date) ?? { amount: 0, count: 0 };
      e.amount += row.amount;
      e.count += row.count;
      collectedByDay.set(row.date, e);
    }
    if (bucket === stats.cur) statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + row.count);
  }

  const refundByDay = new Map(raw.refundsByDay.map((r) => [r.date, r]));
  let refundedCur = 0;
  let refundedPrev = 0;
  let refundCount = 0;
  for (const r of raw.refundsByDay) {
    if (inRange(r.date, range)) {
      refundedCur += r.amount;
      refundCount += r.count;
    } else if (inRange(r.date, previousRange)) refundedPrev += r.amount;
  }

  const length = daysInclusive(range.from, range.to);
  const attemptsByDay = new Map<string, number>();
  for (const row of raw.dayStatus) attemptsByDay.set(row.date, (attemptsByDay.get(row.date) ?? 0) + row.count);
  const daily: PaymentsAnalyticsDto['daily'] = [];
  for (let i = 0; i < length; i += 1) {
    const date = addDaysStr(range.from, i);
    const prevDate = addDaysStr(previousRange.from, i);
    daily.push({
      date,
      collected: money(collectedByDay.get(date)?.amount ?? 0),
      refunded: money(refundByDay.get(date)?.amount ?? 0),
      count: attemptsByDay.get(date) ?? 0,
      previousCollected: money(collectedByDay.get(prevDate)?.amount ?? 0),
    });
  }

  return {
    range,
    previousRange,
    kpis: {
      collected: { value: money(stats.cur.collected), previous: money(stats.prev.collected) },
      todayCollected: { value: money(raw.today.amount), count: raw.today.count },
      outstanding: { value: money(raw.outstanding.amount), invoiceCount: raw.outstanding.count },
      refunded: {
        value: money(refundedCur),
        previous: money(refundedPrev),
        count: refundCount,
        rate: ratio(refundedCur, stats.cur.collected),
      },
      avgPayment: {
        value: money(ratio(stats.cur.collected, stats.cur.collectedCount)),
        previous: money(ratio(stats.prev.collected, stats.prev.collectedCount)),
      },
      paymentCount: { value: stats.cur.attempts, previous: stats.prev.attempts },
      successRate: {
        value: ratio(stats.cur.success, stats.cur.attempts),
        previous: ratio(stats.prev.success, stats.prev.attempts),
      },
    },
    daily,
    methods: raw.methods.map((m) => ({
      method: m.method,
      amount: money(m.amount),
      count: m.count,
    })),
    statuses: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
    branches: [...raw.branches]
      .sort((a, b) => b.revenue - a.revenue)
      .map((b) => ({
        branchId: b.branchId,
        name: b.name,
        revenue: money(b.revenue),
        previousRevenue: money(b.previousRevenue),
      })),
    topPlans: raw.topPlans.map((p) => ({
      planName: p.planName,
      revenue: money(p.revenue),
      count: p.count,
    })),
    attention: {
      pendingOver24h: raw.pendingOver24h,
      failed: statusCounts.get('FAILED') ?? 0,
      overdueInvoices: { count: raw.overdue.count, amount: money(raw.overdue.amount) },
    },
  };
}
