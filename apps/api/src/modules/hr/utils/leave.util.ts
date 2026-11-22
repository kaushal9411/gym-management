/**
 * Pure leave logic (no I/O): day counting, overlap rules, balance maths.
 */
import { eachDate, round1, weekdayOf, type Weekday } from './hr-dates.util';

export type DayPart = 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_EVENING';

export interface LeaveDaysInput {
  startDate: string;
  endDate: string;
  dayPart: DayPart;
  /** Employee's weekly-off weekdays. */
  weeklyOff: ReadonlySet<string>;
  /** date -> holiday name (already filtered to the employee's branches). */
  holidays: ReadonlyMap<string, string>;
}

export interface ExcludedDay {
  date: string;
  reason: 'WEEKLY_OFF' | 'HOLIDAY';
  name?: string;
}

export interface LeaveDaysResult {
  /** Working days counted (half day = 0.5). */
  days: number;
  /** The working dates covered (attendance rows are written for these). */
  workingDates: string[];
  excluded: ExcludedDay[];
}

/**
 * Days a leave request consumes: every date in [start, end] that is neither a
 * weekly off nor a holiday counts 1; a single-day half-day request counts 0.5
 * (and only when that date is a working day). Callers validate that half-day
 * requests have start == end.
 */
export function computeLeaveDays(input: LeaveDaysInput): LeaveDaysResult {
  const workingDates: string[] = [];
  const excluded: ExcludedDay[] = [];
  for (const date of eachDate(input.startDate, input.endDate)) {
    if (input.weeklyOff.has(weekdayOf(date))) {
      excluded.push({ date, reason: 'WEEKLY_OFF' });
      continue;
    }
    const holiday = input.holidays.get(date);
    if (holiday !== undefined) {
      excluded.push({ date, reason: 'HOLIDAY', name: holiday });
      continue;
    }
    workingDates.push(date);
  }
  const perDay = input.dayPart === 'FULL_DAY' ? 1 : 0.5;
  return { days: round1(workingDates.length * perDay), workingDates, excluded };
}

export interface LeaveSpan {
  startDate: string;
  endDate: string;
  dayPart: DayPart;
}

/**
 * Do two leave spans clash? Date ranges must intersect; two single-day
 * half-day requests of OPPOSITE parts on the same date (morning + evening) do
 * not clash. Anything involving a full day, or the same part, does.
 */
export function leaveSpansOverlap(a: LeaveSpan, b: LeaveSpan): boolean {
  if (a.endDate < b.startDate || b.endDate < a.startDate) return false;
  const aHalf = a.dayPart !== 'FULL_DAY';
  const bHalf = b.dayPart !== 'FULL_DAY';
  if (aHalf && bHalf && a.dayPart !== b.dayPart) return false;
  return true;
}

export interface BalanceInput {
  /** null = unlimited type. */
  quota: number | null;
  carriedForward: number;
  adjustment: number;
  used: number;
  pending: number;
}

export interface BalanceFigures {
  entitled: number | null;
  used: number;
  pending: number;
  available: number | null;
}

export function balanceFigures(b: BalanceInput): BalanceFigures {
  if (b.quota === null) return { entitled: null, used: round1(b.used), pending: round1(b.pending), available: null };
  const entitled = round1(b.quota + b.carriedForward + b.adjustment);
  return { entitled, used: round1(b.used), pending: round1(b.pending), available: round1(entitled - b.used - b.pending) };
}

/** Carry-forward into a new leave year: remaining of the previous year, capped by the type's max (when set). */
export function carryForwardAmount(previousRemaining: number, max: number | null): number {
  const remaining = Math.max(0, previousRemaining);
  return round1(max === null ? remaining : Math.min(remaining, max));
}

export const isWeekday = (value: string): value is Weekday => ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].includes(value);
