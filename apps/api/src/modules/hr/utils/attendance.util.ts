/**
 * Pure attendance logic (no I/O): lateness, half-day thresholds, computed day
 * status and stats.
 */
import { istInstant, istMinuteOfDay, parseHm, weekdayOf } from './hr-dates.util';

export type StoredStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'ON_LEAVE' | 'WEEKLY_OFF' | 'HOLIDAY';
export type DayStatus = StoredStatus | 'NOT_MARKED' | 'NOT_JOINED';

export interface ShiftTiming {
  startTime: string; // HH:mm
  endTime: string;
  graceMinutes: number;
}

export interface PunchPolicy {
  halfDayThresholdHours: number;
  standardDayHours: number;
}

/** Minutes late beyond shift start + grace (0 when on time or no shift to compare). */
export function lateMinutesFor(checkIn: Date, shift: ShiftTiming | null): number {
  if (!shift) return 0;
  return Math.max(0, istMinuteOfDay(checkIn) - (parseHm(shift.startTime) + shift.graceMinutes));
}

export function checkInStatus(lateMinutes: number): 'PRESENT' | 'LATE' {
  return lateMinutes > 0 ? 'LATE' : 'PRESENT';
}

export interface CheckOutResult {
  workedMinutes: number;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY';
  overtimeMinutes: number;
}

/** Status after a check-out: short days become HALF_DAY, otherwise lateness decides. */
export function evaluateCheckOut(checkIn: Date, checkOut: Date, lateMinutes: number, policy: PunchPolicy): CheckOutResult {
  const workedMinutes = Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60_000));
  const status = workedMinutes < policy.halfDayThresholdHours * 60 ? 'HALF_DAY' : lateMinutes > 0 ? 'LATE' : 'PRESENT';
  const overtimeMinutes = Math.max(0, workedMinutes - Math.round(policy.standardDayHours * 60));
  return { workedMinutes, status, overtimeMinutes };
}

export interface ComputedDayInput {
  date: string;
  today: string;
  joiningDate: string;
  weeklyOff: ReadonlySet<string>;
  holidayName: string | null;
  /** The employee's effective shift end (`HH:mm`, IST); null/undefined = no shift. Only used for TODAY. */
  shiftEndTime?: string | null;
  /** The current instant. Only used for TODAY together with `shiftEndTime`. */
  now?: Date;
}

/** True once `now` is strictly after the IST wall-clock `endTime` of business date `date` (exactly at the end is NOT past). */
export function isPastShiftEnd(now: Date, date: string, endTime: string): boolean {
  return now.getTime() > istInstant(date, endTime).getTime();
}

/**
 * Status of a day with NO attendance row. Absent is computed on read (never
 * stored): a working day strictly before today with no row is ABSENT. TODAY
 * is NOT_MARKED ("yet to check in") until the employee's shift end has
 * passed (strictly), after which it is ABSENT too; with no shift, today is
 * always NOT_MARKED. Leave / half-day leave / manual marks are real rows, so
 * they never reach this function.
 */
export function computedStatus(i: ComputedDayInput): DayStatus {
  if (i.date < i.joiningDate) return 'NOT_JOINED';
  if (i.weeklyOff.has(weekdayOf(i.date))) return 'WEEKLY_OFF';
  if (i.holidayName !== null) return 'HOLIDAY';
  if (i.date < i.today) return 'ABSENT';
  if (i.date === i.today && i.now && i.shiftEndTime && isPastShiftEnd(i.now, i.date, i.shiftEndTime)) return 'ABSENT';
  return 'NOT_MARKED';
}

export interface AttendanceStats {
  present: number;
  late: number;
  halfDay: number;
  onLeave: number;
  absent: number;
  weeklyOff: number;
  holiday: number;
  notMarked: number;
  workedMinutes: number;
  lateCount: number;
  overtimeMinutes: number;
}

export const emptyStats = (): AttendanceStats => ({
  present: 0,
  late: 0,
  halfDay: 0,
  onLeave: 0,
  absent: 0,
  weeklyOff: 0,
  holiday: 0,
  notMarked: 0,
  workedMinutes: 0,
  lateCount: 0,
  overtimeMinutes: 0,
});

export interface StatDay {
  status: DayStatus;
  workedMinutes?: number | null;
  lateMinutes?: number;
  overtimeMinutes?: number;
}

export function summarizeDays(days: StatDay[]): AttendanceStats {
  const s = emptyStats();
  for (const d of days) {
    switch (d.status) {
      case 'PRESENT': s.present += 1; break;
      case 'LATE': s.late += 1; s.lateCount += 1; break;
      case 'HALF_DAY': s.halfDay += 1; break;
      case 'ON_LEAVE': s.onLeave += 1; break;
      case 'ABSENT': s.absent += 1; break;
      case 'WEEKLY_OFF': s.weeklyOff += 1; break;
      case 'HOLIDAY': s.holiday += 1; break;
      case 'NOT_MARKED': s.notMarked += 1; break;
      default: break; // NOT_JOINED counts nowhere
    }
    s.workedMinutes += d.workedMinutes ?? 0;
    s.overtimeMinutes += d.overtimeMinutes ?? 0;
  }
  return s;
}
