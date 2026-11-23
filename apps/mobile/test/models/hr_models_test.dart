import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/core/routing/app_routes.dart';
import 'package:gym_saas_mobile/core/routing/hr_notification_routes.dart';
import 'package:gym_saas_mobile/features/hr/presentation/hr_palette.dart';
import 'package:gym_saas_mobile/features/hr/presentation/widgets/hr_widgets.dart';
import 'package:gym_saas_mobile/models/hr_admin.dart';
import 'package:gym_saas_mobile/models/hr_attendance.dart';
import 'package:gym_saas_mobile/models/hr_enums.dart';
import 'package:gym_saas_mobile/models/hr_leave.dart';
import 'package:gym_saas_mobile/models/hr_payroll.dart';
import 'package:gym_saas_mobile/models/hr_summary.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';

import '../fixtures/hr_fixtures.dart';

void main() {
  group('self summary', () {
    test('parses the whole My HR payload', () {
      final s = HrMeSummary.fromJson(hrSummaryJson());
      expect(s.employee.ref.name, 'Vikram Coach');
      expect(s.employee.shift!.name, 'General');
      expect(s.employee.shift!.lengthMinutes, 15 * 60);
      expect(s.employee.weeklyOff, ['SUNDAY']);
      expect(s.today.canCheckIn, isTrue);
      expect(s.today.canCheckOut, isFalse);
      expect(s.today.attendance.status, DayStatus.notMarked);
      expect(s.month, '2026-11');
      expect(s.monthStats.present, 18);
      expect(s.monthStats.attended, 21);
      expect(s.monthStats.workedMinutes, 9120);
      expect(s.leaveBalances, hasLength(2));
      expect(s.pendingLeaves.single.status, LeaveStatus.pending);
      expect(s.upcomingHolidays.single.name, 'Christmas');
      expect(s.latestPayslip!.isPaid, isTrue);
      expect(s.latestPayslip!.paymentMode, PaymentMode.upi);
      expect(s.unreadNotifications, 2);
    });

    test('a checked-in day carries its punches', () {
      final s = HrMeSummary.fromJson(
        hrSummaryJson(
          canCheckIn: false,
          canCheckOut: true,
          checkInTime: '06:05',
          status: 'PRESENT',
        ),
      );
      final a = s.today.attendance;
      expect(a.hasCheckedIn, isTrue);
      expect(a.hasCheckedOut, isFalse);
      expect(a.checkInTime, '06:05');
      expect(a.recorded, isTrue);
      expect(s.today.isDone, isFalse);
    });

    test('withAttendance bridges until the summary is refetched', () {
      final s = HrMeSummary.fromJson(hrSummaryJson());
      final punched = HrAttendanceDay.fromJson(
        hrAttendanceDayJson(checkInTime: '06:05'),
      );
      final t = s.today.withAttendance(punched);
      expect(t.canCheckIn, isFalse);
      expect(t.canCheckOut, isTrue);
    });
  });

  group('attendance', () {
    test('manual mark exposes who, why and the source', () {
      final d = HrAttendanceDay.fromJson(
        hrAttendanceDayJson(
          source: 'MANUAL',
          remark: 'Forgot to punch in',
          checkInTime: '06:10',
          checkOutTime: '15:30',
          status: 'PRESENT',
        ),
      );
      expect(d.isManual, isTrue);
      expect(d.markedBy!.name, 'Kaushal Chauhan');
      expect(d.remark, 'Forgot to punch in');
      expect(d.workedMinutes, 565);
      expect(d.date, DateTime(2026, 11, 22));
    });

    test('computed day (no row) and unknown status are safe', () {
      final d = HrAttendanceDay.fromJson(
        hrAttendanceDayJson(
          recorded: false,
          status: 'SOMETHING_NEW',
          checkInTime: null,
          source: null,
        ),
      );
      expect(d.recorded, isFalse);
      expect(d.status, DayStatus.notMarked);
      expect(d.hasCheckedIn, isFalse);
      expect(d.id, isNull);
    });

    test('month attendance indexes days by day-of-month', () {
      final m = HrMonthAttendance.fromJson({
        'month': '2026-11',
        'days': [
          hrAttendanceDayJson(date: '2026-11-01', status: 'WEEKLY_OFF'),
          hrAttendanceDayJson(date: '2026-11-02', status: 'LATE'),
        ],
        'stats': hrStatsJson,
      });
      expect(m.byDay[1]!.status, DayStatus.weeklyOff);
      expect(m.byDay[2]!.status, DayStatus.late);
      expect(m.stats.holiday, 1);
    });

    test('day board rows', () {
      final b = HrDayBoard.fromJson({
        'date': '2026-11-22',
        'summary': {'present': 1, 'late': 1, 'notMarked': 1},
        'items': [
          {
            'employee': hrEmployeeRefJson,
            'shift': {
              'id': 's',
              'name': 'General',
              'startTime': '06:00',
              'endTime': '21:00',
              'graceMinutes': 10,
            },
            'attendance': hrAttendanceDayJson(status: 'LATE', lateMinutes: 12),
          },
        ],
      });
      expect(b.rows.single.attendance.lateMinutes, 12);
      expect(b.rows.single.employee.roleLabel, 'Trainer');
      expect(b.summary.notMarked, 1);
    });
  });

  group('leave', () {
    test('request with a remark and half-day part', () {
      final r = HrLeaveRequest.fromJson(
        hrLeaveRequestJson(
          status: 'REJECTED',
          dayPart: 'HALF_DAY_EVENING',
          days: 0.5,
          start: '2026-11-25',
          end: '2026-11-25',
          decisionRemark: 'Busy week',
          canCancel: false,
        ),
      );
      expect(r.status, LeaveStatus.rejected);
      expect(r.dayPart, DayPart.halfEvening);
      expect(r.days, 0.5);
      expect(r.isSingleDay, isTrue);
      expect(r.decisionRemark, 'Busy week');
      expect(r.decidedBy!.name, 'Kaushal Chauhan');
      expect(r.canCancel, isFalse);
      expect(r.leaveType.isPaid, isTrue);
    });

    test('balance: finite and unlimited', () {
      final c = HrLeaveBalance.fromJson(hrBalanceCasualJson);
      expect(c.unlimited, isFalse);
      expect(c.available, 8.5);
      expect(c.entitled, 12);
      final u = HrLeaveBalance.fromJson(hrBalanceUnpaidJson);
      expect(u.unlimited, isTrue);
      expect(u.available, isNull);
      expect(u.leaveType.isPaid, isFalse);
    });

    test('preview with excluded days', () {
      final p = HrLeavePreview.fromJson({
        'days': 2,
        'excluded': [
          {'date': '2026-11-29', 'reason': 'WEEKLY_OFF'},
          {'date': '2026-12-25', 'reason': 'HOLIDAY', 'name': 'Christmas'},
        ],
        'available': 8.5,
        'sufficient': true,
      });
      expect(p.days, 2);
      expect(p.excluded.last.name, 'Christmas');
      expect(p.sufficient, isTrue);
      final unlimited = HrLeavePreview.fromJson({
        'days': 3,
        'excluded': <dynamic>[],
        'available': null,
        'sufficient': true,
      });
      expect(unlimited.available, isNull);
    });

    test('admin page keeps counts; decision detail keeps conflicts', () {
      final page = HrLeavePage.fromJson({
        'items': [hrLeaveRequestJson()],
        'total': 9,
        'page': 1,
        'limit': 20,
        'totalPages': 1,
        'counts': {'pending': 3, 'approved': 4, 'rejected': 1, 'cancelled': 1},
      });
      expect(page.page.total, 9);
      expect(page.counts!.pending, 3);
      expect(page.counts!.all, 9);
      expect(page.counts!.of(LeaveStatus.approved), 4);

      final d = HrLeaveDetail.fromJson({
        ...hrLeaveRequestJson(),
        'balance': hrBalanceCasualJson,
        'conflicts': [
          {
            'employee': {...hrEmployeeRefJson, 'name': 'Asha Desk'},
            'leaveRequestId': 'lr-7',
            'startDate': '2026-11-25',
            'endDate': '2026-11-25',
          },
        ],
      });
      expect(d.balance!.available, 8.5);
      expect(d.conflicts.single.employee.name, 'Asha Desk');
    });

    test('notifications page', () {
      final p = HrNotificationPage.fromJson({
        'items': [
          {
            'id': 'n1',
            'type': 'LEAVE_APPROVED',
            'title': 'Leave approved',
            'body': 'Your casual leave 25-26 Nov was approved. Remark: Enjoy',
            'entityType': 'leave_request',
            'entityId': 'lr-1',
            'readAt': null,
            'createdAt': '2026-11-21T04:00:00.000Z',
          },
        ],
        'unreadCount': 2,
        'total': 7,
        'page': 1,
        'limit': 20,
        'totalPages': 1,
      });
      expect(p.unreadCount, 2);
      expect(p.page.items.single.isUnread, isTrue);
      expect(p.page.items.single.entityId, 'lr-1');
    });
  });

  group('payroll', () {
    test('full payslip + paid block', () {
      final p = HrPayslip.fromJson(hrPayslipJson(status: 'PAID'));
      expect(p.netPay, 17875);
      expect(p.monthlyGross, 19500);
      expect(p.attendanceDeduction, 1125);
      expect(p.unpaidDays, 1.5);
      expect(p.lines.first.isAllowance, isTrue);
      expect(p.lines.last.isAllowance, isFalse);
      expect(p.status, PayslipStatus.paid);
      expect(p.summary.paymentMode, PaymentMode.upi);
      expect(p.paidOn, DateTime(2026, 12, 1));
      expect(p.paidBy!.name, 'Kaushal Chauhan');
      expect(p.paidRemark, 'Txn ref 123');
    });

    test('run + detail + pay-all result', () {
      final r = HrPayrollRun.fromJson(hrRunJson());
      expect(r.status, PayrollRunStatus.approved);
      expect(r.unpaidCount, 3);
      expect(r.paidFraction, closeTo(0.25, 1e-9));
      final d = HrPayrollRunDetail.fromJson({
        'run': hrRunJson(),
        'payslips': [hrPayslipJson()],
      });
      expect(d.payslips.single.summary.employee!.name, 'Vikram Coach');
      final all = HrPayAllResult.fromJson({
        'paid': 3,
        'skipped': 1,
        'failed': [
          {'payslipId': 'ps-9', 'message': 'Run not approved'},
        ],
        'run': hrRunJson(status: 'PAID'),
      });
      expect(all.paid, 3);
      expect(all.failed.single.$2, 'Run not approved');
      expect(all.run.status, PayrollRunStatus.paid);
    });

    test('money tolerates stringified decimals', () {
      expect(hrNum('1500.50'), 1500.5);
      expect(hrNum(null), 0);
      expect(hrNumOrNull('x'), isNull);
    });
  });

  group('admin', () {
    test('overview', () {
      final o = HrOverview.fromJson(hrOverviewJson);
      expect(o.headcount, 4);
      expect(o.today.checkedInNow, 1);
      expect(o.today.absent, 1);
      expect(o.today.yetToCheckIn, 1);
      // The buckets add up to the headcount.
      expect(o.today.bucketTotal, o.headcount);
      expect(o.pendingLeaves, 3);
      expect(o.payroll!.status, 'APPROVED');
      expect(o.payroll!.unpaidPayslips, 3);
      expect(o.upcomingLeaves.single.days, 2);
      expect(o.trend, hasLength(2));
      expect(o.trend.first.total, 4);
      expect(o.upcomingHolidays.single.date, DateTime(2026, 12, 25));
    });

    test('overview without payroll permission', () {
      final o = HrOverview.fromJson({...hrOverviewJson, 'payroll': null});
      expect(o.payroll, isNull);
    });

    test('employee list item + detail with / without salary access', () {
      final item = {
        ...hrEmployeeRefJson,
        'email': 'vikram@x.test',
        'phone': null,
        'accountStatus': 'ACTIVE',
        'workStatus': 'WORKING',
        'employmentType': 'FULL_TIME',
        'joiningDate': '2026-11-01',
        'branches': [
          {'id': 'b1', 'name': 'Main'},
        ],
        'shift': {
          'id': 's',
          'name': 'General',
          'startTime': '06:00',
          'endTime': '21:00',
          'graceMinutes': 10,
        },
        'weeklyOff': ['SUNDAY'],
        'today': {
          'status': 'PRESENT',
          'checkInTime': '06:05',
          'checkOutTime': null,
        },
        'leaveBalances': [
          {
            'leaveTypeId': 'lt-casual',
            'code': 'CASUAL',
            'name': 'Casual Leave',
            'available': 9.5,
          },
          {
            'leaveTypeId': 'lt-unpaid',
            'code': 'UNPAID',
            'name': 'Unpaid Leave',
            'available': null,
          },
        ],
        'pendingLeaves': 1,
      };
      final e = HrEmployee.fromJson(item);
      expect(e.todayStatus, DayStatus.present);
      expect(e.todayCheckIn, '06:05');
      expect(e.leaveBalances.first.available, 9.5);
      expect(e.leaveBalances.last.available, isNull);
      expect(e.branches.single.name, 'Main');
      expect(e.pendingLeaves, 1);

      final d = HrEmployeeDetail.fromJson({
        'employee': item,
        'attendance': {
          'month': '2026-11',
          'days': [hrAttendanceDayJson()],
          'stats': hrStatsJson,
        },
        'leaves': <dynamic>[],
        'balances': [hrBalanceCasualJson],
        'payStructure': null,
        'payslips': <dynamic>[],
      });
      expect(d.payStructure, isNull);
      expect(d.payslips, isEmpty);
      expect(d.balances.single.used, 1.5);

      final withPay = HrEmployeeDetail.fromJson({
        'employee': item,
        'attendance': {'month': '2026-11', 'days': <dynamic>[], 'stats': null},
        'leaves': <dynamic>[],
        'balances': <dynamic>[],
        'payStructure': {
          'userId': 'u-vikram',
          'salaryType': 'MONTHLY',
          'baseSalary': 18000,
          'components': [
            {
              'id': 'c1',
              'name': 'Travel allowance',
              'type': 'ALLOWANCE',
              'amount': 1500,
              'isActive': true,
            },
          ],
          'monthlyGross': 19500,
          'fixedDeductions': 500,
        },
        'payslips': [
          {
            'id': 'ps-1',
            'runId': 'run-1',
            'month': '2026-10',
            'status': 'PAID',
            'employee': hrEmployeeRefJson,
            'netPay': 17875,
            'grossEarnings': 18375,
            'totalDeductions': 500,
          },
        ],
      });
      expect(withPay.payStructure!.monthlyGross, 19500);
      expect(withPay.payStructure!.components.single.isAllowance, isTrue);
      expect(withPay.payslips.single.isPaid, isTrue);
    });

    test('paginated wrapper works with HR rows', () {
      final p = PaginatedResult.fromJson(
        {
          'items': [hrRunJson()],
          'total': 1,
          'page': 1,
          'limit': 20,
          'totalPages': 1,
        },
        HrPayrollRun.fromJson,
      );
      expect(p.items.single.month, '2026-11');
    });
  });

  group('palette + formatting helpers', () {
    test('leave type hex -> colour, with fallback', () {
      expect(HrPalette.leaveType('#6366f1'), const Color(0xFF6366F1));
      expect(HrPalette.leaveType('#abc'), const Color(0xFFAABBCC));
      expect(HrPalette.leaveType(''), HrPalette.onLeave);
      expect(HrPalette.leaveType('nonsense', fallback: Colors.red), Colors.red);
    });

    test('every status has a colour + glyph', () {
      for (final s in DayStatus.values) {
        expect(HrPalette.status(s), isA<Color>());
        expect(HrPalette.glyph(s), isA<IconData>());
      }
    });

    test('days / durations / dates', () {
      expect(hrDays(1), '1');
      expect(hrDays(0.5), '0.5');
      expect(hrDays(2.5), '2.5');
      expect(hrDuration(0), '0m');
      expect(hrDuration(45), '45m');
      expect(hrDuration(120), '2h');
      expect(hrDuration(565), '9h 25m');
      expect(hrIso(DateTime(2026, 11, 2)), '2026-11-02');
      expect(hrDate(DateTime(2026, 11, 22)), '22 Nov');
      expect(hrDateWd(DateTime(2026, 11, 22)), 'Sun, 22 Nov');
      expect(hrMonthLabelFromKey('2026-11'), 'November 2026');
      expect(hrTime(DateTime(2026, 1, 1, 15, 5)), '3:05 PM');
      expect(hrTime(DateTime(2026, 1, 1, 0, 30)), '12:30 AM');
      // 04:30 UTC is 10:00 India.
      expect(hrToIst(DateTime.utc(2026, 11, 22, 4, 30)).hour, 10);
    });

    test('hr:<type> push payloads deep-link', () {
      expect(
        pushTapPayload({'type': 'hr', 'hrType': 'LEAVE_APPROVED'}),
        'hr:LEAVE_APPROVED',
      );
      expect(pushTapPayload({'type': 'payment'}), isNull);
      expect(
        routeForPushPayload('hr:LEAVE_APPROVED'),
        AppRoutes.hrMyLeaves,
      );
      expect(routeForPushPayload('hr:LEAVE_REJECTED'), AppRoutes.hrMyLeaves);
      expect(routeForPushPayload('hr:LEAVE_APPLIED'), AppRoutes.hrApprovals);
      expect(routeForPushPayload('hr:PAYSLIP_PAID'), AppRoutes.hrPayslips);
      expect(routeForPushPayload(null), isNull);
      expect(routeForPushPayload('other'), isNull);
    });
  });
}
