import { QUIET_END_HOUR, QUIET_START_HOUR } from '../constants/limits';

import { wallTimeToUtc, zonedParts } from './zoned-time.util';

/** True when the local clock in `timezone` is inside the quiet window (21:00 <= t < 08:00 by default). */
export function isQuietTime(at: Date, timezone: string, startHour = QUIET_START_HOUR, endHour = QUIET_END_HOUR): boolean {
  const { hour } = zonedParts(at, timezone);
  return hour >= startHour || hour < endHour;
}

/**
 * When a message due at `at` must wait for quiet hours to end: `null` if it can go now,
 * otherwise the UTC instant of the next local `endHour`:00 in `timezone`.
 */
export function quietHoldUntil(at: Date, timezone: string, startHour = QUIET_START_HOUR, endHour = QUIET_END_HOUR): Date | null {
  const p = zonedParts(at, timezone);
  if (!(p.hour >= startHour || p.hour < endHour)) return null;
  // After the start hour the release is tomorrow morning, before the end hour it is this morning.
  const dayOffset = p.hour >= startHour ? 1 : 0;
  const nextDay = new Date(Date.UTC(p.year, p.month - 1, p.day + dayOffset));
  return wallTimeToUtc(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate(), endHour, 0, timezone);
}
