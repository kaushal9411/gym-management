/**
 * FitCloud runs on Indian Standard Time. Every "what is today / this month"
 * decision — dashboards, analytics windows, export file names, default
 * dates, fallbacks for a missing gym/branch timezone — goes through here
 * instead of `new Date().toISOString().slice(0, 10)`, which is the UTC date
 * and rolls over 5h30m after an Indian gym's actual midnight.
 *
 * Timestamps are still STORED as instants (UTC under the hood, as Postgres and
 * JWTs require) — this is only about which calendar day an instant falls on.
 * Date-only columns are `Date`s at UTC-midnight of the calendar date, so
 * `businessDate()` returns the `YYYY-MM-DD` string to build them from.
 */
export const BUSINESS_TIMEZONE = 'Asia/Kolkata';
export const BUSINESS_COUNTRY = 'India';
export const BUSINESS_CURRENCY = 'INR';
export const BUSINESS_CURRENCY_SYMBOL = '₹';

const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** The calendar date (`YYYY-MM-DD`) of `instant` in India — "today" by default. */
export function businessDate(instant: Date = new Date()): string {
  return formatter.format(instant);
}

/** UTC-midnight `Date` for India's calendar day of `instant` — what a Postgres DATE column comparison against "today" needs. */
export function businessDay(instant: Date = new Date()): Date {
  return new Date(`${businessDate(instant)}T00:00:00.000Z`);
}
