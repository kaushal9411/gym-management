import { businessDate, BUSINESS_TIMEZONE } from '@/lib/business-time';

/**
 * Calendar maths for the HR module. All dates travel as `YYYY-MM-DD` strings on
 * India's calendar and months as `YYYY-MM`; arithmetic goes through UTC dates so
 * the browser's own timezone can never shift a day.
 */

export const todayYmd = (): string => businessDate();
export const currentMonth = (): string => businessDate().slice(0, 7);

const toUtc = (ymd: string): Date => {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUtc = (d: Date): string => d.toISOString().slice(0, 10);

export function addDays(ymd: string, n: number): string {
  const d = toUtc(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export const monthOf = (ymd: string): string => ymd.slice(0, 7);
export const monthStart = (ym: string): string => `${ym}-01`;

export function monthEnd(ym: string): string {
  return addDays(monthStart(addMonths(ym, 1)), -1);
}

export function daysInMonth(ym: string): number {
  return Number(monthEnd(ym).slice(8, 10));
}

/** Every `YYYY-MM-DD` of the month. */
export function monthDates(ym: string): string[] {
  return Array.from({ length: daysInMonth(ym) }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
}

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(ymd: string): number {
  return (toUtc(ymd).getUTCDay() + 6) % 7;
}

/** Inclusive list of dates between two ymd strings (max 400 as a safety stop). */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to && out.length < 400) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatMonth(ym: string, short = false): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const name = MONTHS[m - 1]!;
  return `${short ? name.slice(0, 3) : name} ${y}`;
}

export function formatDay(ymd: string, style: 'short' | 'long' | 'weekday' = 'short'): string {
  const d = toUtc(ymd);
  const day = d.getUTCDate();
  const mon = MONTHS[d.getUTCMonth()]!.slice(0, 3);
  const wd = WEEKDAYS_SHORT[weekdayIndex(ymd)]!;
  if (style === 'weekday') return `${wd}, ${day} ${mon}`;
  if (style === 'long') return `${WEEKDAYS_LONG[weekdayIndex(ymd)]}, ${day} ${mon} ${d.getUTCFullYear()}`;
  return `${day} ${mon}`;
}

export function formatRange(from: string, to: string): string {
  if (from === to) return formatDay(from);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${formatDay(from)}${sameYear ? '' : ` ${from.slice(0, 4)}`} – ${formatDay(to)} ${to.slice(0, 4)}`;
}

const timeFmt = new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIMEZONE, hour: 'numeric', minute: '2-digit', hour12: true });
const timeSecFmt = new Intl.DateTimeFormat('en-GB', { timeZone: BUSINESS_TIMEZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TIMEZONE, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

/** "9:05 am" in IST from an ISO instant; "--" when missing. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '--' : timeFmt.format(d).toLowerCase();
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '--' : dateTimeFmt.format(d).replace(',', '');
}

/** HH:MM:SS of "now" in IST (for the live clock). */
export function clockParts(now: Date): { hh: string; mm: string; ss: string } {
  const [hh, mm, ss] = timeSecFmt.format(now).split(':') as [string, string, string];
  return { hh, mm, ss };
}

/** `HH:mm` (24h) of an ISO instant in IST — for `<input type="time">`. */
export function isoToTimeInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const { hh, mm } = clockParts(d);
  return `${hh}:${mm}`;
}

/** Combine an IST calendar day and `HH:mm` into an ISO instant (India has no DST: +05:30). */
export function istToIso(ymd: string, hhmm: string): string {
  return new Date(`${ymd}T${hhmm}:00+05:30`).toISOString();
}

export function formatMinutes(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return '--';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function greeting(now = new Date()): string {
  const h = Number(clockParts(now).hh);
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
