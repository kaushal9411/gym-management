import { eachDate } from './dates';
import type { AttendanceDay, HrOverview, LeaveCalendarItem } from '../types';
import type { HrTone } from './hr-palette';

/** An ABSENT the API computed (no row stored: nothing was recorded) as opposed to one HR marked by hand. */
export function isAutoAbsent(day: Pick<AttendanceDay, 'status' | 'recorded'> | null | undefined): boolean {
  return !!day && day.status === 'ABSENT' && !day.recorded;
}

export const AUTO_ABSENT_HINT = 'No check-in recorded';

/**
 * Buckets leave-calendar items by day. Item dates are the request's own and may extend outside the requested
 * window, so every item is clipped to `[from, to]` here.
 */
export function groupLeavesByDay(items: LeaveCalendarItem[], from: string, to: string): Map<string, LeaveCalendarItem[]> {
  const map = new Map<string, LeaveCalendarItem[]>();
  for (const item of items) {
    if (item.endDate < from || item.startDate > to) continue;
    for (const date of eachDate(item.startDate < from ? from : item.startDate, item.endDate > to ? to : item.endDate)) {
      const list = map.get(date);
      if (list) list.push(item);
      else map.set(date, [item]);
    }
  }
  return map;
}

export interface TodaySegment {
  tone: HrTone;
  value: number;
  label: string;
}

/** Segments of the "today at a glance" bar. Together they add up to the headcount of employees who have joined. */
export function todaySegments(today: HrOverview['today']): TodaySegment[] {
  const yet = today.yetToCheckIn ?? today.notMarked;
  return [
    { tone: 'present', value: today.present, label: 'Present' },
    { tone: 'late', value: today.late, label: 'Late' },
    { tone: 'half', value: today.halfDay, label: 'Half day' },
    { tone: 'leave', value: today.onLeave, label: 'On leave' },
    { tone: 'absent', value: today.absent, label: 'Absent' },
    { tone: 'off', value: today.weeklyOff + today.holiday, label: 'Off / holiday' },
    { tone: 'none', value: yet, label: 'Yet to check in' },
  ];
}
