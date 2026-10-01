import type { DurationType } from '@prisma/client';

/** Calendar-aware — adds real months/years (handles month-end/leap-year rollover via JS Date), not a flat day count. */
export function addDuration(date: Date, value: number, type: DurationType): Date {
  const result = new Date(date);
  if (type === 'DAYS') result.setDate(result.getDate() + value);
  else if (type === 'WEEKS') result.setDate(result.getDate() + value * 7);
  else if (type === 'MONTHS') result.setMonth(result.getMonth() + value);
  else result.setFullYear(result.getFullYear() + value);
  return result;
}

/** Fixed-length approximation for the `durationDays` display cache only — never used for real date math (see `addDuration`). */
export function approximateDurationDays(value: number, type: DurationType): number {
  if (type === 'DAYS') return value;
  if (type === 'WEEKS') return value * 7;
  if (type === 'MONTHS') return value * 30;
  return value * 365;
}
