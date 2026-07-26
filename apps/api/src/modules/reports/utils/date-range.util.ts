/**
 * Shared date-range/trend helpers — the same "YYYY-MM-DD string math +
 * gap-filled daily series" shape used ad hoc in `attendance.service.ts` and
 * `finance-dashboard.service.ts`; extracted here since Reports & Analytics
 * needs it across many endpoints instead of just one.
 */

/** Add `days` (may be negative) to a YYYY-MM-DD string, UTC-safe. */
export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Resolves an optional (dateFrom, dateTo) filter pair to a concrete [from, to] string range, defaulting to the last `defaultDays` days ending today. */
export function resolveDateRange(dateFrom: string | undefined, dateTo: string | undefined, defaultDays: number): { from: string; to: string } {
  const to = dateTo ?? todayStr();
  const from = dateFrom ?? addDaysStr(to, -(defaultDays - 1));
  return { from, to };
}

/** Zero-fills days in [from, to] that have no data, so a trend chart doesn't show gaps as missing vs. genuinely zero. */
export function fillDailyTrend<T extends Record<string, number>>(
  from: string,
  to: string,
  rows: Array<{ date: string } & T>,
  zeroValue: T,
): Array<{ date: string } & T> {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out: Array<{ date: string } & T> = [];
  for (let d = from; d <= to; d = addDaysStr(d, 1)) {
    out.push(byDate.get(d) ?? { date: d, ...zeroValue });
  }
  return out;
}
