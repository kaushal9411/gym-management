import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/hr/presentation/widgets/team_leave_calendar.dart';
import 'package:gym_saas_mobile/models/hr_admin.dart';
import 'package:gym_saas_mobile/models/hr_attendance.dart';
import 'package:gym_saas_mobile/models/hr_enums.dart';
import 'package:gym_saas_mobile/models/hr_leave.dart';
import 'package:gym_saas_mobile/models/hr_payroll.dart';
import 'package:gym_saas_mobile/models/hr_setup.dart';

import '../fixtures/hr_fixtures.dart';

void main() {
  group('setup models (real API shapes)', () {
    test('HrShift parses the shift row', () {
      final s = HrShift.fromJson(hrShiftJson);
      expect(s.name, 'General');
      expect(s.startTime, '06:00');
      expect(s.graceMinutes, 10);
      expect(s.weeklyOffDays, ['SUNDAY']);
      expect(s.isDefault, isTrue);
      expect(s.employeeCount, 3);
    });

    test('HrShiftInput body: trimmed, Monday-first weekdays, isActive only '
        'when editing', () {
      const create = HrShiftInput(
        name: '  Morning ',
        startTime: '06:00',
        endTime: '14:00',
        graceMinutes: 5,
        weeklyOffDays: ['SUNDAY', 'SATURDAY', 'BOGUS'],
        isDefault: false,
      );
      expect(create.toJson(), {
        'name': 'Morning',
        'startTime': '06:00',
        'endTime': '14:00',
        'graceMinutes': 5,
        'weeklyOffDays': ['SATURDAY', 'SUNDAY'],
        'isDefault': false,
      });
      const edit = HrShiftInput(
        name: 'Morning',
        startTime: '06:00',
        endTime: '14:00',
        graceMinutes: 5,
        weeklyOffDays: [],
        isDefault: false,
        isActive: false,
      );
      expect(edit.toJson()['isActive'], false);
    });

    test('HrPolicy parses, and toJson never sends workingDaysBasis', () {
      final p = HrPolicy.fromJson(hrPolicyJson);
      expect(p.leaveYearStartMonth, 4);
      expect(p.halfDayThresholdHours, 4);
      expect(p.overtimeMultiplier, 1.5);
      expect(p.workingDaysBasis, 'CALENDAR_MINUS_WEEKLY_OFFS');
      final body = p.toJson();
      expect(body.containsKey('workingDaysBasis'), isFalse);
      expect(body['defaultWeeklyOff'], ['SUNDAY']);
      expect(body['backdateLeaveDays'], 30);
    });

    test('HrLeaveType keeps carry-forward + sortOrder, null quota = '
        'unlimited', () {
      final paid = HrLeaveType.fromJson(hrLeaveTypeFullPaid);
      expect(paid.carryForward, isTrue);
      expect(paid.carryForwardMax, 15);
      expect(paid.sortOrder, 3);
      final unpaid = HrLeaveType.fromJson(hrLeaveTypeFullUnpaid);
      expect(unpaid.yearlyQuota, isNull);
      expect(unpaid.isPaid, isFalse);
    });

    test('HrLeaveTypeInput: carry-forward cap only sent with carry-forward, '
        'unlimited = null quota', () {
      const a = HrLeaveTypeInput(
        name: ' Casual ',
        code: 'CASUAL',
        yearlyQuota: null,
        isPaid: true,
        carryForward: false,
        carryForwardMax: 10,
        color: '#6366f1',
      );
      final j = a.toJson();
      expect(j['name'], 'Casual');
      expect(j['yearlyQuota'], isNull);
      expect(j['carryForwardMax'], isNull);
      expect(j.containsKey('isActive'), isFalse);
      const b = HrLeaveTypeInput(
        name: 'Paid',
        code: 'PAID',
        yearlyQuota: 15,
        isPaid: true,
        carryForward: true,
        carryForwardMax: 15,
        color: '#10b981',
        isActive: false,
      );
      expect(b.toJson()['carryForwardMax'], 15);
      expect(b.toJson()['isActive'], false);
    });

    test('HrHoliday keeps the branch id + name', () {
      final h = HrHoliday.fromJson(hrHolidayBranchJson);
      expect(h.branchName, 'Main');
      expect(h.branchId, 'b-1');
      expect(HrHoliday.fromJson(hrHolidayJson).branchName, isNull);
    });

    test('HrMonthlyGrid: cells line up with days, P column = attended', () {
      final g = HrMonthlyGrid.fromJson(hrMonthlyGridJson);
      expect(g.days.length, 3);
      expect(g.days.first, DateTime(2026, 11, 20));
      expect(g.rows.length, 2);
      final vikram = g.rows.first;
      expect(vikram.cells, [
        DayStatus.present,
        DayStatus.late,
        DayStatus.notMarked,
      ]);
      expect(vikram.attended, 2); // present + late
      expect(g.rows.last.cells.last, DayStatus.holiday);
      expect(g.rows.last.stats.absent, 1);
    });

    test('HrBulkResult + HrWorkSetup', () {
      final r = HrBulkResult.fromJson({
        'date': '2026-11-20',
        'updated': 2,
        'items': [hrAttendanceDayJson()],
      });
      expect(r.updated, 2);
      expect(r.items.length, 1);
      final w = HrWorkSetup.fromJson({
        'shift': {
          'id': 'sh-general',
          'name': 'General',
          'startTime': '06:00',
          'endTime': '21:00',
          'graceMinutes': 10,
        },
        'weeklyOff': ['SUNDAY'],
      });
      expect(w.shift!.name, 'General');
      expect(w.weeklyOff, ['SUNDAY']);
    });

    test('HrWeekday helpers', () {
      expect(
        HrWeekday.normalise(['SUNDAY', 'MONDAY', 'x']),
        ['MONDAY', 'SUNDAY'],
      );
      expect(HrWeekday.shortList(['SATURDAY', 'SUNDAY']), 'Sat, Sun');
      expect(HrWeekday.shortList([]), 'None');
    });
  });

  group('payroll models', () {
    test('payslip exposes expenseId + only its MANUAL lines', () {
      final p = HrPayslip.fromJson(hrPayslipWithManualLineJson());
      expect(p.expenseId, isNull);
      expect(p.manualLines.map((l) => l.name), ['Incentive']);
      expect(p.bonus, 200);
      final paid = HrPayslip.fromJson({
        ...hrPayslipJson(status: 'PAID'),
        'expenseId': 'exp-1',
      });
      expect(paid.expenseId, 'exp-1');
    });

    test('run keeps who approved it and when', () {
      final r = HrPayrollRun.fromJson(hrRunJson());
      expect(r.approvedByName, 'Kaushal Chauhan');
      expect(r.approvedAt, isNotNull);
      expect(r.createdByName, 'Kaushal Chauhan');
      final draft = HrPayrollRun.fromJson({
        ...hrRunJson(status: 'DRAFT'),
        'approvedBy': null,
        'approvedAt': null,
      });
      expect(draft.approvedByName, isNull);
    });

    test('HrPayslipEdit body = the PATCH contract (manualLines REPLACE)', () {
      const e = HrPayslipEdit(
        bonus: 500,
        advanceRecovery: 1000,
        manualLines: [
          HrManualLine(name: ' Incentive ', isAllowance: true, amount: 750),
          HrManualLine(name: 'Uniform', isAllowance: false, amount: 300),
        ],
        remark: ' fixed ',
      );
      expect(e.toJson(), {
        'bonus': 500.0,
        'advanceRecovery': 1000.0,
        'manualLines': [
          {'name': 'Incentive', 'type': 'ALLOWANCE', 'amount': 750.0},
          {'name': 'Uniform', 'type': 'DEDUCTION', 'amount': 300.0},
        ],
        'remark': 'fixed',
      });
      // No remark -> key omitted; no lines -> an empty array (clears them).
      expect(const HrPayslipEdit().toJson(), {
        'bonus': 0.0,
        'advanceRecovery': 0.0,
        'manualLines': <Object>[],
      });
    });

    test('pay structure parses ids and serialises components', () {
      final s = HrPayStructure.fromJson(hrPayStructureJson);
      expect(s.baseSalary, 18000);
      expect(s.components.first.id, 'c1');
      expect(s.monthlyGross, 19500);
      expect(s.components.last.toJson(), {
        'name': 'Provident fund',
        'type': 'DEDUCTION',
        'amount': 500.0,
        'isActive': true,
      });
    });

    test('HrRunTotals: additions / deductions follow the web footer', () {
      final slips = [
        HrPayslip.fromJson(hrPayslipJson()),
        HrPayslip.fromJson(hrPayslipWithManualLineJson()),
      ];
      final t = HrRunTotals.of(slips);
      expect(t.base, 36000);
      // fixed 1500 + (1500 + extra 750 + bonus 200)
      expect(t.additions, 1500 + 1500 + 750 + 200);
      // (1125 + 500) x 2
      expect(t.deductions, 3250);
      expect(t.net, 17875 * 2);
      expect(HrRunTotals.of(const []).net, 0);
    });
  });

  group('team calendar (GET /hr/leaves/calendar)', () {
    HrCalendarLeave leave(
      String id,
      String start,
      String end, {
      String status = 'APPROVED',
    }) =>
        HrCalendarLeave.fromJson(
          hrCalendarItemJson(id: id, start: start, end: end, status: status),
        );

    test('parses the slim item + holidays of the envelope data', () {
      final c = HrLeaveCalendar.fromJson(
        hrLeaveCalendarJson(
          from: '2026-11-01',
          to: '2026-12-31',
          items: [hrCalendarItemJson(dayPart: 'HALF_DAY_MORNING', days: 0.5)],
          holidays: [hrHolidayJson],
        ),
      );
      expect(c.from, DateTime(2026, 11, 1));
      expect(c.to, DateTime(2026, 12, 31));
      final i = c.items.single;
      expect(i.employeeName, 'Vikram Coach');
      expect(i.userId, 'u-vikram');
      expect(i.leaveType.code, 'CASUAL');
      expect(i.dayPart, DayPart.halfMorning);
      expect(i.days, 0.5);
      expect(i.status, LeaveStatus.approved);
      expect(i.employee.name, 'Vikram Coach');
      expect(c.holidays.single.name, 'Diwali (Lakshmi Puja)');
    });

    test('tolerates a bare payload (older / empty)', () {
      final c = HrLeaveCalendar.fromJson(const {});
      expect(c.items, isEmpty);
      expect(c.holidays, isEmpty);
    });

    test('a request is spread over every day it covers, CLIPPED to the '
        'displayed month', () {
      final m = hrLeavesByDay(
        [
          leave('a', '2026-11-25', '2026-11-27'),
          leave('b', '2026-10-30', '2026-11-02'),
          leave('c', '2026-11-26', '2026-12-03'),
        ],
        '2026-11',
      );
      expect(m[25]!.map((l) => l.id), ['a']);
      expect(m[26]!.map((l) => l.id), ['a', 'c']);
      expect(m[1]!.map((l) => l.id), ['b']);
      expect(m[2]!.map((l) => l.id), ['b']);
      expect(m[3], isNull);
      expect(m[30]!.map((l) => l.id), ['c']);
      // Nothing leaks into days outside the month (no key 0 / 31).
      expect(m.keys.every((d) => d >= 1 && d <= 30), isTrue);
    });

    test('a rejected / cancelled row (never sent by the API) is ignored', () {
      final m = hrLeavesByDay(
        [
          leave('r', '2026-11-10', '2026-11-10', status: 'REJECTED'),
          leave('x', '2026-11-11', '2026-11-11', status: 'CANCELLED'),
          leave('p', '2026-11-12', '2026-11-12', status: 'PENDING'),
        ],
        '2026-11',
      );
      expect(m.keys, [12]);
    });
  });

  group('v1.2 absent / yet-to-check-in', () {
    test('yetToCheckIn is parsed; older servers default it to notMarked', () {
      final v12 = HrTodayBuckets.fromJson({
        'present': 1,
        'absent': 2,
        'notMarked': 3,
        'yetToCheckIn': 3,
      });
      expect(v12.absent, 2);
      expect(v12.yetToCheckIn, 3);
      final old = HrTodayBuckets.fromJson({'present': 1, 'notMarked': 4});
      expect(old.yetToCheckIn, 4);
      expect(old.absent, 0);
      expect(const HrTodayBuckets(notMarked: 2).yetToCheckIn, 2);
    });

    test('an unrecorded ABSENT is "auto"; a marked one is not', () {
      final auto = HrAttendanceDay.fromJson(hrAutoAbsentDayJson());
      expect(auto.status, DayStatus.absent);
      expect(auto.recorded, isFalse);
      expect(auto.isAutoAbsent, isTrue);
      final marked = HrAttendanceDay.fromJson(
        hrAttendanceDayJson(status: 'ABSENT', source: 'MANUAL'),
      );
      expect(marked.isAutoAbsent, isFalse);
      // A day with no status of absent is never auto-absent.
      expect(
        HrAttendanceDay.fromJson(hrAttendanceDayJson(recorded: false))
            .isAutoAbsent,
        isFalse,
      );
    });
  });
}
