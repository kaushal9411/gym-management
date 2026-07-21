/**
 * Calendar date (YYYY-MM-DD) for `at` (defaults to now) in the given IANA
 * timezone — zero-dependency (native `Intl`), used to stamp
 * `Attendance.attendanceDate` in the BRANCH's own timezone per the "store
 * all timestamps using tenant timezone" business rule.
 */
export function dateInTimezone(timezone: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

/** Hour-of-day (0-23) for `at` in the given IANA timezone — used to bucket the "peak check-in time" summary stat. */
export function hourInTimezone(timezone: string, at: Date): number {
  const value = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(at);
  // "24" is midnight in some ICU implementations — normalize to 0.
  const hour = Number(value.trim());
  return hour === 24 ? 0 : hour;
}
