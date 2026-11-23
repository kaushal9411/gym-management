import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AttendanceCalendar, DayDetail } from '@/features/hr/components/ui/attendance-calendar';
import { TodayBar } from '@/features/hr/components/overview/trend-bars';
import type { AttendanceDay, HrOverview } from '@/features/hr/types';

const day = (over: Partial<AttendanceDay>): AttendanceDay => ({
  date: '2026-11-10',
  userId: 'u1',
  status: 'ABSENT',
  recorded: false,
  id: null,
  checkInAt: null,
  checkOutAt: null,
  checkInTime: null,
  checkOutTime: null,
  workedMinutes: null,
  lateMinutes: 0,
  overtimeMinutes: 0,
  source: null,
  remark: null,
  markedBy: null,
  leaveRequestId: null,
  leaveType: null,
  leaveDayPart: null,
  holidayName: null,
  shift: null,
  ...over,
});

describe('derived vs manual ABSENT', () => {
  it('marks a computed absence with the auto hint in the calendar and day detail', () => {
    const html = renderToStaticMarkup(
      React.createElement(AttendanceCalendar, { month: '2026-11', days: [day({ date: '2026-11-10' }), day({ date: '2026-11-11', recorded: true, id: 'r1', source: 'MANUAL', remark: 'Called in sick' })] }),
    );
    expect(html).toContain('No check-in recorded');
    expect(html.match(/No check-in recorded/g)!.length).toBeGreaterThanOrEqual(2); // title + aria-label of the auto cell only
    expect(html.indexOf('Tue, 10 Nov')).toBeGreaterThan(-1);
    const detail = renderToStaticMarkup(React.createElement(DayDetail, { day: day({}) }));
    expect(detail).toContain('(auto)');
    const manual = renderToStaticMarkup(React.createElement(DayDetail, { day: day({ recorded: true, id: 'r1', source: 'MANUAL', remark: 'Called in sick', markedBy: { id: 'm', name: 'HR Boss' } }) }));
    expect(manual).not.toContain('(auto)');
    expect(manual).toContain('HR Boss');
  });
});

describe('TodayBar', () => {
  it('lists Absent and Yet to check in as separate segments', () => {
    const today: HrOverview['today'] = { present: 1, late: 0, halfDay: 0, onLeave: 0, absent: 2, weeklyOff: 0, holiday: 0, notMarked: 1, yetToCheckIn: 1, checkedInNow: 1 };
    const html = renderToStaticMarkup(React.createElement(TodayBar, { today }));
    expect(html).toContain('Absent 2');
    expect(html).toContain('Yet to check in 1');
  });
});
