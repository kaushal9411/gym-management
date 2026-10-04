/** Pure helpers for the tenant Reports tab. Everything is UTC. */

const DAY_MS = 86_400_000;

export const REPORT_RANGES = ['30d', '90d', '6m', '12m'] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

const RANGE_DEF: Record<ReportRange, { days: number; months: number }> = {
  '30d': { days: 30, months: 2 },
  '90d': { days: 90, months: 4 },
  '6m': { days: 182, months: 6 },
  '12m': { days: 365, months: 12 },
};

export interface ResolvedReportRange {
  range: ReportRange;
  days: number;
  /** Month-series length (calendar months ending with the current month). */
  months: number;
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
}

export function resolveReportRange(
  range: ReportRange,
  now: Date = new Date(),
): ResolvedReportRange {
  const { days, months } = RANGE_DEF[range];
  const to = now;
  const from = new Date(to.getTime() - days * DAY_MS);
  const prevTo = from;
  const prevFrom = new Date(prevTo.getTime() - days * DAY_MS);
  return { range, days, months, from, to, prevFrom, prevTo };
}

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Last `n` calendar months (oldest first) ending with the month of `now`. */
export function monthKeys(now: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    out.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return out;
}

/** First instant (UTC) of the oldest month in the series. */
export function monthSeriesStart(now: Date, n: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1), 1));
}

/** Zero-fills a sparse `{month, ...}` result so every month key has a row. */
export function zeroFillMonths<T extends { month: string }>(
  keys: string[],
  rows: T[],
  empty: (month: string) => T,
): T[] {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return keys.map((k) => byMonth.get(k) ?? empty(k));
}

/** Monday-start UTC week keys (`YYYY-MM-DD`), oldest first, ending with the current week. */
export function weekKeys(now: Date, n: number): string[] {
  const dow = (now.getUTCDay() + 6) % 7; // Monday = 0
  const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1)
    out.push(new Date(monday - i * 7 * DAY_MS).toISOString().slice(0, 10));
  return out;
}

/** `YYYY-MM-DD` for each of the last `days` days (oldest first), ending today. */
export function dayKeys(now: Date, days: number): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1)
    out.push(new Date(today - i * DAY_MS).toISOString().slice(0, 10));
  return out;
}

export function toMoney(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

/** Dense 7x24 heatmap; `weekday` 0 = Monday … 6 = Sunday, `hour` 0-23 (UTC). */
export function buildHeatmap(
  rows: Array<{ weekday: number; hour: number; count: number }>,
): Array<{ weekday: number; hour: number; count: number }> {
  const grid = new Map<number, number>();
  for (const r of rows) {
    if (r.weekday < 0 || r.weekday > 6 || r.hour < 0 || r.hour > 23) continue;
    const k = r.weekday * 24 + r.hour;
    grid.set(k, (grid.get(k) ?? 0) + r.count);
  }
  const out: Array<{ weekday: number; hour: number; count: number }> = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    for (let hour = 0; hour < 24; hour += 1)
      out.push({ weekday, hour, count: grid.get(weekday * 24 + hour) ?? 0 });
  }
  return out;
}

/** % (0-100, integer) of active members that used a feature; 0 when there are no active members. */
export function adoptionShare(users: number, activeMembers: number): number {
  if (activeMembers <= 0 || users <= 0) return 0;
  return Math.min(100, Math.round((users / activeMembers) * 100));
}

export function percent(part: number, whole: number, digits = 1): number | null {
  if (whole <= 0) return null;
  const f = 10 ** digits;
  return Math.round((part / whole) * 100 * f) / f;
}

/** Revenue share by method; shares sum to ~100, largest first. */
export function buildMethodShares(
  rows: Array<{ method: string; amount: number }>,
): Array<{ method: string; share: number }> {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (total <= 0) return [];
  return rows
    .filter((r) => r.amount > 0)
    .map((r) => ({ method: r.method, share: Math.round((r.amount / total) * 1000) / 10 }))
    .sort((a, b) => b.share - a.share);
}

export const COHORT_COLUMNS = 6;

export interface CohortSqlRow {
  cohort: string;
  /** Months after the join month (0..5) — SQL only emits k whose month is not in the future. */
  k: number;
  size: number;
  active: number;
}

/**
 * Cohort table: one row per join month (oldest first), `values[k]` = % of the cohort still active in month cohort+k.
 * M0 is 100 by definition (they just joined); `null` = future month or empty cohort.
 */
export function buildRetentionCohorts(
  cohortKeys: string[],
  rows: CohortSqlRow[],
): Array<{ cohort: string; values: Array<number | null> }> {
  return cohortKeys.map((cohort) => {
    const values: Array<number | null> = Array.from({ length: COHORT_COLUMNS }, () => null);
    for (const r of rows) {
      if (r.cohort !== cohort || r.k < 0 || r.k >= COHORT_COLUMNS || r.size <= 0) continue;
      values[r.k] = r.k === 0 ? 100 : Math.min(100, Math.round((r.active / r.size) * 100));
    }
    return { cohort, values };
  });
}

/**
 * Months until members reach 80% of the limit, extrapolating the average monthly gain over the last (up to) 3 months.
 * 0 if already there; null when there is no limit, no growth, or it is > 120 months away.
 */
export function projectMonthsTo80(memberTotals: number[], limit: number | null): number | null {
  if (!limit || limit <= 0 || memberTotals.length === 0) return null;
  const target = limit * 0.8;
  const current = memberTotals[memberTotals.length - 1]!;
  if (current >= target) return 0;
  if (memberTotals.length < 2) return null;
  const window = memberTotals.slice(-4);
  const gain = (window[window.length - 1]! - window[0]!) / (window.length - 1);
  if (gain <= 0) return null;
  const months = Math.ceil((target - current) / gain);
  return months > 120 ? null : months;
}

export function churnRiskLabel(healthScore: number): 'Low' | 'Medium' | 'High' {
  if (healthScore >= 75) return 'Low';
  if (healthScore >= 50) return 'Medium';
  return 'High';
}
