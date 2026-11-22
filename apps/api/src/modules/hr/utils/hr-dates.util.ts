/**
 * Calendar helpers for the HR module. Every "which day" decision is an IST
 * business date string (`YYYY-MM-DD`) — see `core/utils/business-time.ts`.
 * DATE columns are `Date`s at UTC-midnight of that calendar date.
 */
import { businessDate } from '../../../core/utils/business-time';

export const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const IST_OFFSET_MINUTES = 330;

export const toDateCol = (day: string): Date => new Date(`${day}T00:00:00.000Z`);
export const fromDateCol = (d: Date): string => d.toISOString().slice(0, 10);

export function addDays(day: string, n: number): string {
  const d = toDateCol(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDateCol(d);
}

/** Inclusive list of dates from..to (empty when to < from). */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function weekdayOf(day: string): Weekday {
  return WEEKDAYS[toDateCol(day).getUTCDay()]!;
}

export const monthOf = (day: string): string => day.slice(0, 7);

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export const monthStart = (month: string): string => `${month}-01`;
export const monthEnd = (month: string): string => `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;

export const currentMonth = (now: Date = new Date()): string => monthOf(businessDate(now));

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Minutes since IST midnight of an instant. */
export function istMinuteOfDay(instant: Date): number {
  const ist = new Date(instant.getTime() + IST_OFFSET_MINUTES * 60_000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

/** `HH:mm` (IST wall clock) of an instant. */
export function istTimeOf(instant: Date): string {
  const m = istMinuteOfDay(instant);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

/** The instant for IST wall-clock `HH:mm` on IST business date `day`. */
export function istInstant(day: string, hm: string): Date {
  return new Date(toDateCol(day).getTime() + (parseHm(hm) - IST_OFFSET_MINUTES) * 60_000);
}

/** Leave years are keyed by the calendar year in which they START. */
export function leaveYearOf(day: string, startMonth: number): number {
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  return m >= startMonth ? y : y - 1;
}

export function leaveYearBounds(leaveYear: number, startMonth: number): { start: string; end: string } {
  const start = `${leaveYear}-${String(startMonth).padStart(2, '0')}-01`;
  const endMonthFirst = new Date(Date.UTC(leaveYear + 1, startMonth - 1, 1));
  endMonthFirst.setUTCDate(0);
  // startMonth = 1 => year ends 31 Dec of the SAME year.
  const end = startMonth === 1 ? `${leaveYear}-12-31` : fromDateCol(endMonthFirst);
  return { start, end };
}

export function leaveYearLabel(leaveYear: number, startMonth: number): string {
  return startMonth === 1 ? String(leaveYear) : `${leaveYear}-${String((leaveYear + 1) % 100).padStart(2, '0')}`;
}

export function parseWeekdayList(csv: string | null | undefined): Weekday[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is Weekday => (WEEKDAYS as readonly string[]).includes(s));
}

export const serializeWeekdayList = (list: readonly string[]): string => [...new Set(list.map((s) => s.toUpperCase()))].join(',');

/** Money/day rounding: 2 decimals, half away from zero. */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
export const round1 = (n: number): number => Math.round((n + Number.EPSILON) * 10) / 10;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-11" -> "Nov 2026". */
export const monthLabel = (month: string): string => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
