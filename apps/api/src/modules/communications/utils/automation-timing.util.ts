export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;

/** UTC midnight of the instant's calendar day. */
export function utcDayStart(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Whole UTC calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((utcDayStart(to).getTime() - utcDayStart(from).getTime()) / DAY_MS);
}

/**
 * "N days before" rules (expiring, due soon). Picks the TIGHTEST offset that already applies
 * (the smallest N with `daysLeft <= N`) so a member first seen with 5 days left gets the "7" message
 * once, then "3" and "1" as time passes — never three messages at once. `null` = nothing due yet
 * (still further out than the largest offset) or already past (daysLeft < 0).
 */
export function pickBeforeOffset(daysLeft: number, offsets: readonly number[]): number | null {
  if (daysLeft < 0) return null;
  const applicable = offsets.filter((n) => daysLeft <= n).sort((a, b) => a - b);
  return applicable.length ? applicable[0]! : null;
}

/** Extra days past the largest "after" offset during which a first-time catch-up message may still go out. */
export const AFTER_LOOKBACK_DAYS = 14;

/**
 * "N days after" rules (expired, overdue, payment failed). Picks the MOST ADVANCED offset reached
 * (the largest N with `daysSince >= N`), and gives up once the event is older than the largest offset
 * plus the catch-up window, so a rule switched on later never blasts very old history.
 */
export function pickAfterOffset(daysSince: number, offsets: readonly number[], lookback = AFTER_LOOKBACK_DAYS): number | null {
  if (!offsets.length) return null;
  const max = Math.max(...offsets);
  if (daysSince > max + lookback) return null;
  const reached = offsets.filter((n) => daysSince >= n).sort((a, b) => b - a);
  return reached.length ? reached[0]! : null;
}

/**
 * "N hours before" rules (class reminders). An offset H matches while the class starts within the
 * last hour of that countdown: `H - 1 < hoursUntil <= H`. The reminder job runs every 15 minutes, so
 * every offset is caught at least once; the dedupe ledger keeps it to one send.
 */
export function pickHoursBeforeOffset(hoursUntil: number, offsets: readonly number[], windowHours = 1): number | null {
  if (hoursUntil <= 0) return null;
  const matches = offsets.filter((h) => hoursUntil <= h && hoursUntil > h - windowHours).sort((a, b) => a - b);
  return matches.length ? matches[0]! : null;
}

/** True when `dob`'s month/day falls within today..today+`days-1` (UTC calendar, leap-day births celebrated on 28 Feb in common years). */
export function isBirthdayWithin(dob: Date, today: Date, days: number): boolean {
  const start = utcDayStart(today);
  for (let i = 0; i < days; i += 1) {
    const d = addDays(start, i);
    if (matchesBirthday(dob, d)) return true;
  }
  return false;
}

/** Month/day match for one day; a 29 Feb birthday matches 28 Feb in non-leap years. */
export function matchesBirthday(dob: Date, day: Date): boolean {
  const dm = dob.getUTCMonth();
  const dd = dob.getUTCDate();
  if (dm === day.getUTCMonth() && dd === day.getUTCDate()) return true;
  if (dm === 1 && dd === 29 && day.getUTCMonth() === 1 && day.getUTCDate() === 28 && !isLeapYear(day.getUTCFullYear())) return true;
  return false;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
