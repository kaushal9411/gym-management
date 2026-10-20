/** Wall-clock parts of an instant in an IANA timezone (invalid zones fall back to UTC). */
export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
}

export function safeTimezone(timezone: string | null | undefined): string {
  if (!timezone) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch {
    return 'UTC';
  }
}

export function zonedParts(at: Date, timezone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimezone(timezone),
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') };
}

/** Offset (ms) of the zone from UTC at the given instant — positive east of Greenwich. */
function offsetMs(at: Date, timezone: string): number {
  const p = zonedParts(at, timezone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Converts a wall-clock time in `timezone` to the UTC instant (handles DST edges by re-checking the offset). */
export function wallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timezone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const first = offsetMs(new Date(guess), timezone);
  let utc = guess - first;
  const second = offsetMs(new Date(utc), timezone);
  if (second !== first) utc = guess - second;
  return new Date(utc);
}

/** Calendar date (`YYYY-MM-DD`) of an instant in the zone. */
export function zonedDay(at: Date, timezone: string): string {
  const p = zonedParts(at, timezone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
