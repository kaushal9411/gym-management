import { addDaysStr, daysInclusive } from '../../finance/utils/payments-analytics.util';

/** All dates are 'YYYY-MM-DD' UTC calendar days (same convention as the finance analytics utils). */
export interface DayCount {
  date: string;
  visits: number;
}

export const DAILY_WINDOW_DAYS = 84;

const WEEKDAY_NAMES = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

/** 0 = Sunday ... 6 = Saturday (UTC). */
export const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

/**
 * Current streak = consecutive calendar days with >=1 visit ending today OR yesterday (a member who has not
 * visited yet today keeps their streak alive until the day is over). Best = longest consecutive run ever.
 * `visitDates` may contain duplicates / be unsorted.
 */
export function computeStreaks(
  visitDates: string[],
  today: string,
): { current: number; best: number } {
  const days = [...new Set(visitDates)].sort();
  if (days.length === 0) return { current: 0, best: 0 };

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = daysInclusive(days[i - 1]!, days[i]!) === 2 ? run + 1 : 1;
    if (run > best) best = run;
  }

  const set = new Set(days);
  const yesterday = addDaysStr(today, -1);
  let cursor = set.has(today) ? today : set.has(yesterday) ? yesterday : null;
  let current = 0;
  while (cursor && set.has(cursor)) {
    current += 1;
    cursor = addDaysStr(cursor, -1);
  }
  return { current, best };
}

/** Exactly `days` rows, oldest -> today, zero-filled where the member did not visit. */
export function fillDailySeries(
  rows: DayCount[],
  today: string,
  days: number = DAILY_WINDOW_DAYS,
): DayCount[] {
  const byDate = new Map(rows.map((r) => [r.date, r.visits]));
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDaysStr(today, -i);
    out.push({ date, visits: byDate.get(date) ?? 0 });
  }
  return out;
}

/** Always 7 rows (0 = Sunday ... 6 = Saturday); rows outside the optional [from, to] window are ignored. */
export function fillWeekdayCounts(
  rows: DayCount[],
  range?: { from: string; to: string },
): { weekday: number; count: number }[] {
  const counts = new Array<number>(7).fill(0);
  for (const r of rows) {
    if (range && (r.date < range.from || r.date > range.to)) continue;
    counts[weekdayOf(r.date)]! += r.visits;
  }
  return counts.map((count, weekday) => ({ weekday, count }));
}

/**
 * Month-to-date window and its comparison window: the previous calendar month from its 1st to the SAME day
 * number as today (clamped to that month's length — e.g. 31 Mar compares with 1-28 Feb).
 */
export function monthComparisonWindows(today: string): {
  current: { from: string; to: string };
  previous: { from: string; to: string };
} {
  const current = { from: `${today.slice(0, 7)}-01`, to: today };
  const prevLast = addDaysStr(current.from, -1);
  const prevFrom = `${prevLast.slice(0, 7)}-01`;
  const day = Math.min(Number(today.slice(8, 10)), Number(prevLast.slice(8, 10)));
  return {
    current,
    previous: { from: prevFrom, to: `${prevLast.slice(0, 7)}-${String(day).padStart(2, '0')}` },
  };
}

export function sumVisits(rows: DayCount[], range: { from: string; to: string }): number {
  return rows.reduce(
    (sum, r) => (r.date >= range.from && r.date <= range.to ? sum + r.visits : sum),
    0,
  );
}

/** Whole days from today to `endDate`; negative differences clamp to 0 and flip `expired` (end date strictly before today). */
export function membershipCountdown(
  endDate: string,
  today: string,
): { daysLeft: number; expired: boolean } {
  const diff = daysInclusive(today, endDate) - 1;
  return { daysLeft: Math.max(diff, 0), expired: diff < 0 };
}

export function progressPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

/** Monday (UTC) of the week containing `today`. */
export function weekStartMonday(today: string): string {
  const dow = weekdayOf(today);
  return addDaysStr(today, -((dow + 6) % 7));
}

export interface PublicBusinessHour {
  day: string;
  open: string | null;
  close: string | null;
  closed: boolean;
}

/** Stored `{monday: {open, close, closed}}` map -> ordered Monday..Sunday array; days never configured are omitted. Null when nothing is configured. */
export function flattenBusinessHours(raw: unknown): PublicBusinessHour[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const map = raw as Record<
    string,
    { open?: string | null; close?: string | null; closed?: boolean } | undefined
  >;
  const rows: PublicBusinessHour[] = [];
  for (const day of WEEKDAY_NAMES) {
    const d = map[day];
    if (!d || typeof d !== 'object') continue;
    rows.push({ day, open: d.open ?? null, close: d.close ?? null, closed: d.closed === true });
  }
  return rows.length ? rows : null;
}

const SOCIAL_KEYS = ['facebook', 'instagram', 'twitter', 'youtube', 'linkedin'] as const;

/** Whitelist: only known social keys with string values pass through. */
export function pickSocialLinks(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of SOCIAL_KEYS)
    if (typeof src[k] === 'string' && (src[k] as string).trim()) out[k] = src[k] as string;
  return Object.keys(out).length ? out : null;
}
