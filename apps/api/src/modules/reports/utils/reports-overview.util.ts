import {
  addDaysStr,
  daysInclusive,
  money,
  resolveRanges,
  type DateRange,
} from '../../finance/utils/payments-analytics.util';

export { addDaysStr, daysInclusive, money, resolveRanges };
export type { DateRange };

export interface DayCount {
  date: string;
  count: number;
}
export interface DayAmount {
  date: string;
  amount: number;
}

export const EXPIRING_BUCKET_LABELS = ['0-7d', '8-14d', '15-30d'] as const;

/** 0 = Sunday … 6 = Saturday, on the UTC calendar day. */
export const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Sum a per-day series into a Map keyed by date, restricted to a range. */
export function sumByDay<T extends { date: string }>(
  rows: T[],
  pick: (r: T) => number,
  range: DateRange,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.date < range.from || r.date > range.to) continue;
    out.set(r.date, (out.get(r.date) ?? 0) + pick(r));
  }
  return out;
}

export function totalOf(byDay: Map<string, number>): number {
  let t = 0;
  for (const v of byDay.values()) t += v;
  return t;
}

/** Always 7 rows (Sunday first). `count` = current range, `previousCount` = previous range, bucketed by UTC weekday. */
export function bucketWeekdays(
  attendance: DayCount[],
  range: DateRange,
  previousRange: DateRange,
): Array<{ weekday: number; count: number; previousCount: number }> {
  const rows = Array.from({ length: 7 }, (_, weekday) => ({ weekday, count: 0, previousCount: 0 }));
  for (const r of attendance) {
    const row = rows[weekdayOf(r.date)];
    if (!row) continue;
    if (r.date >= range.from && r.date <= range.to) row.count += r.count;
    else if (r.date >= previousRange.from && r.date <= previousRange.to)
      row.previousCount += r.count;
  }
  return rows;
}

/** Always 24 rows (UTC hour of check-in). Out-of-range hours are ignored. */
export function bucketHours(
  rows: Array<{ hour: number; count: number }>,
): Array<{ hour: number; count: number }> {
  const out = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const r of rows) {
    const slot = out[r.hour];
    if (slot) slot.count += r.count;
  }
  return out;
}

/** Bucket index for days-until-expiry (0-7, 8-14, 15-30); null when outside 0..30. */
export function expiringBucketIndex(daysRemaining: number): 0 | 1 | 2 | null {
  if (daysRemaining < 0 || daysRemaining > 30) return null;
  if (daysRemaining <= 7) return 0;
  if (daysRemaining <= 14) return 1;
  return 2;
}

/** Group membership end dates (with counts) into the three expiry buckets, relative to `today` (YYYY-MM-DD). */
export function bucketExpiring(
  endDates: DayCount[],
  today: string,
): Array<{ label: string; count: number }> {
  const out = EXPIRING_BUCKET_LABELS.map((label) => ({ label, count: 0 }));
  for (const e of endDates) {
    const idx = expiringBucketIndex(daysInclusive(today, e.date) - 1);
    const bucket = idx === null ? undefined : out[idx];
    if (bucket) bucket.count += e.count;
  }
  return out;
}

/** Member-progress percent buckets used by the member-progress summary. */
export const PROGRESS_BUCKET_LABELS = ['0-25', '26-50', '51-75', '76-100'] as const;
export function progressBucketIndex(percent: number): 0 | 1 | 2 | 3 {
  if (percent <= 25) return 0;
  if (percent <= 50) return 1;
  if (percent <= 75) return 2;
  return 3;
}

/**
 * Churn definition (one membership counts once): the membership is EXPIRED
 * with its `endDate` inside the range, OR it is CANCELLED with its last
 * update (the cancel action; there is no dedicated cancelledAt column)
 * inside the range. Days are UTC calendar days. The DB query in
 * `ReportsOverviewService` is the same predicate expressed as a Prisma where.
 */
export function isChurnedInRange(
  m: { status: string; endDate: string; updatedAt: string },
  range: DateRange,
): boolean {
  const inRange = (d: string) => d >= range.from && d <= range.to;
  if (m.status === 'EXPIRED') return inRange(m.endDate);
  if (m.status === 'CANCELLED') return inRange(m.updatedAt.slice(0, 10));
  return false;
}

export const MEMBER_STATUSES = ['ACTIVE', 'INACTIVE', 'FROZEN'] as const;

export interface OverviewRaw {
  range: DateRange;
  previousRange: DateRange;
  today: string;
  /** Per-day series over previousRange.from..range.to. */
  revenueByDay: DayAmount[];
  expensesByDay: DayAmount[];
  attendanceByDay: DayCount[];
  newMembersByDay: DayCount[];
  activeMembers: number;
  /** ACTIVE memberships ending today..today+30d, grouped by end date. */
  expiringByEndDate: DayCount[];
  churned: { value: number; previous: number };
  memberStatus: Array<{ status: string; count: number }>;
  plans: Array<{ planName: string; activeCount: number; revenue: number }>;
  methods: Array<{ method: string; amount: number; count: number }>;
  branches: Array<{
    branchId: string;
    name: string;
    revenue: number;
    previousRevenue: number;
    newMembers: number;
    checkIns: number;
    activeMembers: number;
  }>;
  hourly: Array<{ hour: number; count: number }>;
  topTrainers: Array<{ trainerId: string; name: string; assignedMembers: number }>;
}

/** Pure assembly of the grouped aggregates into the `/reports/overview` contract — no I/O. */
export function assembleOverview(raw: OverviewRaw) {
  const { range, previousRange } = raw;
  const length = daysInclusive(range.from, range.to);

  const rev = {
    cur: sumByDay(raw.revenueByDay, (r) => r.amount, range),
    prev: sumByDay(raw.revenueByDay, (r) => r.amount, previousRange),
  };
  const exp = {
    cur: sumByDay(raw.expensesByDay, (r) => r.amount, range),
    prev: sumByDay(raw.expensesByDay, (r) => r.amount, previousRange),
  };
  const chk = {
    cur: sumByDay(raw.attendanceByDay, (r) => r.count, range),
    prev: sumByDay(raw.attendanceByDay, (r) => r.count, previousRange),
  };
  const mem = {
    cur: sumByDay(raw.newMembersByDay, (r) => r.count, range),
    prev: sumByDay(raw.newMembersByDay, (r) => r.count, previousRange),
  };

  const daily = Array.from({ length }, (_, i) => {
    const date = addDaysStr(range.from, i);
    const prevDate = addDaysStr(previousRange.from, i);
    return {
      date,
      revenue: money(rev.cur.get(date) ?? 0),
      expenses: money(exp.cur.get(date) ?? 0),
      checkIns: chk.cur.get(date) ?? 0,
      newMembers: mem.cur.get(date) ?? 0,
      prevRevenue: money(rev.prev.get(prevDate) ?? 0),
      prevExpenses: money(exp.prev.get(prevDate) ?? 0),
      prevCheckIns: chk.prev.get(prevDate) ?? 0,
      prevNewMembers: mem.prev.get(prevDate) ?? 0,
    };
  });

  // The previous range is aligned by index; weekday bucketing needs real previous dates, which the per-day series already carries.
  const revenueCur = totalOf(rev.cur);
  const revenuePrev = totalOf(rev.prev);
  const expensesCur = totalOf(exp.cur);
  const expensesPrev = totalOf(exp.prev);
  const checkInsCur = totalOf(chk.cur);
  const checkInsPrev = totalOf(chk.prev);

  const statusCounts = new Map(raw.memberStatus.map((s) => [s.status, s.count]));
  const expiring = bucketExpiring(raw.expiringByEndDate, raw.today);

  return {
    range,
    previousRange,
    kpis: {
      revenue: { value: money(revenueCur), previous: money(revenuePrev) },
      expenses: { value: money(expensesCur), previous: money(expensesPrev) },
      netProfit: {
        value: money(revenueCur - expensesCur),
        previous: money(revenuePrev - expensesPrev),
      },
      newMembers: { value: totalOf(mem.cur), previous: totalOf(mem.prev) },
      activeMembers: { value: raw.activeMembers },
      checkIns: { value: checkInsCur, previous: checkInsPrev },
      avgDailyCheckIns: {
        value: round2(checkInsCur / length),
        previous: round2(checkInsPrev / length),
      },
      expiringIn30d: { value: expiring.reduce((s, b) => s + b.count, 0) },
      churned: raw.churned,
    },
    daily,
    weekdayAttendance: bucketWeekdays(raw.attendanceByDay, range, previousRange),
    hourlyAttendance: bucketHours(raw.hourly),
    memberStatus: MEMBER_STATUSES.map((status) => ({
      status,
      count: statusCounts.get(status) ?? 0,
    })),
    planDistribution: [...raw.plans]
      .sort((a, b) => b.activeCount - a.activeCount || b.revenue - a.revenue)
      .slice(0, 6)
      .map((p) => ({
        planName: p.planName,
        activeCount: p.activeCount,
        revenue: money(p.revenue),
      })),
    paymentMethods: raw.methods.map((m) => ({
      method: m.method,
      amount: money(m.amount),
      count: m.count,
    })),
    branches: [...raw.branches]
      .sort((a, b) => b.revenue - a.revenue)
      .map((b) => ({ ...b, revenue: money(b.revenue), previousRevenue: money(b.previousRevenue) })),
    topTrainers: [...raw.topTrainers]
      .sort((a, b) => b.assignedMembers - a.assignedMembers)
      .slice(0, 5),
    expiringBuckets: expiring,
  };
}

export type OverviewDto = ReturnType<typeof assembleOverview>;
