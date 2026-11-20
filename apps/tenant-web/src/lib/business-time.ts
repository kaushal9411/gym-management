/**
 * FitCloud runs on Indian Standard Time. "Today" in a form default, an export
 * file name or a date filter is India's calendar day — never
 * `new Date().toISOString().slice(0, 10)`, which is the UTC date and is a day
 * behind for the first 5½ hours of every Indian morning.
 *
 * Mirror of `apps/api/src/core/utils/business-time.ts` — keep the two in step.
 */
export const BUSINESS_TIMEZONE = 'Asia/Kolkata';
export const BUSINESS_COUNTRY = 'India';

const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** `YYYY-MM-DD` of `instant` (default: now) on India's calendar. */
export function businessDate(instant: Date = new Date()): string {
  return formatter.format(instant);
}
