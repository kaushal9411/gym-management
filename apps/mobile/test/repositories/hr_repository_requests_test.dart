import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/models/hr_enums.dart';
import 'package:gym_saas_mobile/models/hr_payroll.dart';
import 'package:gym_saas_mobile/models/hr_setup.dart';
import 'package:gym_saas_mobile/repositories/hr_repository.dart';

import '../fixtures/hr_fixtures.dart';

/// Records the last request and answers with a canned envelope.
class _Adapter implements HttpClientAdapter {
  _Adapter(this.data, {this.status = 200, this.errors});

  Object? data;
  int status;
  List<Map<String, Object?>>? errors;
  RequestOptions? last;
  Object? body;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    last = options;
    body = null;
    if (requestStream != null) {
      final chunks = await requestStream.toList();
      final text = utf8.decode(chunks.expand((c) => c).toList());
      if (text.isNotEmpty) body = jsonDecode(text);
    }
    final ok = status < 400;
    return ResponseBody.fromBytes(
      utf8.encode(
        jsonEncode({
          'success': ok,
          'message': ok ? 'OK' : 'Failed',
          'data': ok ? data : null,
          'errors': ok ? null : errors,
        }),
      ),
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json; charset=utf-8'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late _Adapter adapter;
  late HrRepository repo;

  void answer(Object? data, {int status = 200, List<Map<String, Object?>>? errors}) {
    adapter = _Adapter(data, status: status, errors: errors);
    final dio = Dio(BaseOptions(baseUrl: 'http://x/api/v1'))
      ..httpClientAdapter = adapter;
    repo = HrRepository(dio);
  }

  setUp(() => answer(null));

  Map<String, dynamic> run() => hrRunJson(status: 'DRAFT');

  group('enrolment (POST /hr/me/enroll)', () {
    test('POST, no body, parses the summary shape', () async {
      answer(hrSummaryJson());
      final s = await repo.enrollMe();
      expect(adapter.last!.method, 'POST');
      expect(adapter.last!.path, '/hr/me/enroll');
      expect(adapter.body, isNull);
      expect(s.employee.ref.employeeId, 'EMP-0002');
      expect(s.today.canCheckIn, isTrue);
    });

    test('409 ALREADY_EMPLOYEE is recognised, other errors are not', () async {
      answer(
        null,
        status: 409,
        errors: [
          {'code': 'ALREADY_EMPLOYEE', 'message': 'You are already on the roster'},
        ],
      );
      final e = await repo.enrollMe().then<Object>((_) => 'ok').catchError(
            (Object e) => e,
          );
      expect(HrRepository.isAlreadyEmployee(e), isTrue);
      expect(HrRepository.isNotAnEmployee(e), isFalse);
      answer(
        null,
        status: 403,
        errors: [
          {'code': 'NOT_AN_EMPLOYEE', 'message': 'No profile'},
        ],
      );
      final f = await repo.meSummary().then<Object>((_) => 'ok').catchError(
            (Object e) => e,
          );
      expect(HrRepository.isNotAnEmployee(f), isTrue);
      expect(HrRepository.isAlreadyEmployee(f), isFalse);
    });
  });

  group('payroll requests', () {
    test('generate: POST /hr/payroll/runs { month, notes }', () async {
      answer({'run': run(), 'payslips': [hrPayslipJson()]});
      final d = await repo.generatePayroll('2026-11', notes: ' TEST ');
      expect(adapter.last!.method, 'POST');
      expect(adapter.last!.path, '/hr/payroll/runs');
      expect(adapter.body, {'month': '2026-11', 'notes': 'TEST'});
      expect(d.run.employeeCount, 4);
      await repo.generatePayroll('2026-11');
      expect(adapter.body, {'month': '2026-11'});
    });

    test('recalculate / approve / delete hit the run endpoints', () async {
      answer({'run': run(), 'payslips': <Object>[]});
      await repo.recalculateRun('r1');
      expect(adapter.last!.method, 'POST');
      expect(adapter.last!.path, '/hr/payroll/runs/r1/recalculate');
      answer(hrRunJson());
      await repo.approveRun('r1');
      expect(adapter.last!.path, '/hr/payroll/runs/r1/approve');
      answer(null);
      await repo.deleteRun('r1');
      expect(adapter.last!.method, 'DELETE');
      expect(adapter.last!.path, '/hr/payroll/runs/r1');
    });

    test('payslip edit: PATCH with bonus, advance and the manual-line '
        'array', () async {
      answer(hrPayslipWithManualLineJson());
      await repo.patchPayslip(
        'ps-2',
        const HrPayslipEdit(
          bonus: 500,
          advanceRecovery: 1000,
          manualLines: [
            HrManualLine(name: 'Incentive', isAllowance: true, amount: 750),
            HrManualLine(name: 'Uniform', isAllowance: false, amount: 300),
          ],
        ),
      );
      expect(adapter.last!.method, 'PATCH');
      expect(adapter.last!.path, '/hr/payroll/payslips/ps-2');
      expect(adapter.body, {
        'bonus': 500,
        'advanceRecovery': 1000,
        'manualLines': [
          {'name': 'Incentive', 'type': 'ALLOWANCE', 'amount': 750},
          {'name': 'Uniform', 'type': 'DEDUCTION', 'amount': 300},
        ],
      });
    });

    test('409 ALREADY_PAID maps to an ApiException with the code', () async {
      answer(
        null,
        status: 409,
        errors: [
          {'code': 'ALREADY_PAID', 'message': 'Already paid'},
        ],
      );
      await expectLater(
        repo.payPayslip('ps-2', mode: PaymentMode.upi),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'status', 409)
              .having((e) => e.code, 'code', 'ALREADY_PAID'),
        ),
      );
    });
  });

  group('employee setup requests', () {
    test('work setup: null shift / null weeklyOff are sent as null', () async {
      answer({'shift': null, 'weeklyOff': <String>[]});
      await repo.setWorkSetup('u1');
      expect(adapter.last!.method, 'PUT');
      expect(adapter.last!.path, '/hr/employees/u1/work-setup');
      expect(adapter.body, {'shiftId': null, 'weeklyOff': null});
      await repo.setWorkSetup(
        'u1',
        shiftId: 'sh-1',
        weeklyOff: ['SUNDAY', 'MONDAY'],
      );
      expect(adapter.body, {
        'shiftId': 'sh-1',
        'weeklyOff': ['MONDAY', 'SUNDAY'],
      });
    });

    test('pay structure: PUT replaces the whole component set', () async {
      answer(hrPayStructureJson);
      await repo.savePayStructure(
        'u1',
        baseSalary: 18000,
        components: const [
          HrPayComponent(name: ' Travel ', isAllowance: true, amount: 1500),
          HrPayComponent(
            name: 'PF',
            isAllowance: false,
            amount: 500,
            isActive: false,
          ),
        ],
      );
      expect(adapter.last!.method, 'PUT');
      expect(adapter.last!.path, '/hr/employees/u1/pay-structure');
      expect(adapter.body, {
        'baseSalary': 18000,
        'components': [
          {'name': 'Travel', 'type': 'ALLOWANCE', 'amount': 1500, 'isActive': true},
          {'name': 'PF', 'type': 'DEDUCTION', 'amount': 500, 'isActive': false},
        ],
      });
      await repo.savePayStructure('u1', components: const []);
      expect((adapter.body! as Map).containsKey('baseSalary'), isFalse);
    });

    test('balance adjust: debit is a negative number, remark trimmed', () async {
      answer(hrBalanceAdjustedJson);
      await repo.adjustLeaveBalance(
        userId: 'u1',
        leaveTypeId: 'lt-casual',
        days: -1.5,
        remark: '  Taken on Diwali ',
      );
      expect(adapter.last!.method, 'POST');
      expect(adapter.last!.path, '/hr/leave-balances/adjust');
      expect(adapter.body, {
        'userId': 'u1',
        'leaveTypeId': 'lt-casual',
        'days': -1.5,
        'remark': 'Taken on Diwali',
      });
    });
  });

  group('attendance + leave requests', () {
    test('monthly grid: GET ?month=', () async {
      answer(hrMonthlyGridJson);
      final g = await repo.monthlyGrid('2026-11');
      expect(adapter.last!.path, '/hr/attendance/monthly');
      expect(adapter.last!.queryParameters, {'month': '2026-11'});
      expect(g.rows.length, 2);
    });

    test('bulk mark: shared remark, one PRESENT entry per user, optional '
        'check-in', () async {
      answer({'date': '2026-11-20', 'updated': 2, 'items': <Object>[]});
      await repo.bulkMarkPresent(
        date: '2026-11-20',
        remark: ' Power cut ',
        userIds: ['u1', 'u2'],
        checkInTime: '06:00',
      );
      expect(adapter.last!.method, 'POST');
      expect(adapter.last!.path, '/hr/attendance/bulk');
      expect(adapter.body, {
        'date': '2026-11-20',
        'remark': 'Power cut',
        'entries': [
          {'userId': 'u1', 'status': 'PRESENT', 'checkInTime': '06:00'},
          {'userId': 'u2', 'status': 'PRESENT', 'checkInTime': '06:00'},
        ],
      });
      await repo.bulkMarkPresent(
        date: '2026-11-20',
        remark: 'x y z',
        userIds: ['u1'],
      );
      expect(
        ((adapter.body! as Map)['entries'] as List).single,
        {'userId': 'u1', 'status': 'PRESENT'},
      );
    });

    test('leaves list carries every filter', () async {
      answer({
        'items': <Object>[],
        'total': 0,
        'page': 1,
        'limit': 20,
        'totalPages': 1,
        'counts': {'pending': 0, 'approved': 0, 'rejected': 0, 'cancelled': 0},
      });
      await repo.leaves(
        status: LeaveStatus.approved,
        userId: 'u1',
        leaveTypeId: 'lt-1',
        from: DateTime(2026, 11, 1),
        to: DateTime(2026, 11, 30),
      );
      expect(adapter.last!.path, '/hr/leaves');
      expect(adapter.last!.queryParameters, {
        'page': 1,
        'limit': 20,
        'status': 'APPROVED',
        'userId': 'u1',
        'leaveTypeId': 'lt-1',
        'from': '2026-11-01',
        'to': '2026-11-30',
      });
      await repo.leaves(limit: 100);
      expect(adapter.last!.queryParameters, {'page': 1, 'limit': 100});
    });

    test('team calendar: GET /hr/leaves/calendar?from&to (ISO dates)',
        () async {
      answer(
        hrLeaveCalendarJson(
          items: [hrCalendarItemJson()],
          holidays: [hrHolidayJson],
        ),
      );
      final c = await repo.leaveCalendar(
        DateTime(2026, 11, 1),
        DateTime(2026, 11, 30),
      );
      expect(adapter.last!.method, 'GET');
      expect(adapter.last!.path, '/hr/leaves/calendar');
      expect(adapter.last!.queryParameters, {
        'from': '2026-11-01',
        'to': '2026-11-30',
      });
      expect(c.items.single.employeeName, 'Vikram Coach');
      expect(c.holidays.length, 1);
    });

    test('team calendar: a window over 62 days is a 422 with the field',
        () async {
      answer(
        null,
        status: 422,
        errors: [
          {
            'field': 'to',
            'code': 'VALIDATION_ERROR',
            'message': 'The range can cover at most 62 days',
          },
        ],
      );
      await expectLater(
        repo.leaveCalendar(DateTime(2026, 1, 1), DateTime(2026, 12, 31)),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'status', 422)
              .having((e) => e.errorFor('to'), 'to', contains('62 days')),
        ),
      );
    });

    test('manager cancel sends the remark', () async {
      answer(hrLeaveRequestJson(status: 'CANCELLED'));
      await repo.cancelLeave('lr-1', remark: ' Plans changed ');
      expect(adapter.last!.path, '/hr/leaves/lr-1/cancel');
      expect(adapter.body, {'remark': 'Plans changed'});
    });
  });

  group('setup requests', () {
    test('shifts CRUD', () async {
      answer([hrShiftJson]);
      final list = await repo.shifts();
      expect(list.single.name, 'General');
      answer(hrShiftMorningJson);
      await repo.createShift(
        const HrShiftInput(
          name: 'Morning',
          startTime: '06:00',
          endTime: '14:00',
          graceMinutes: 5,
          weeklyOffDays: ['SATURDAY', 'SUNDAY'],
          isDefault: false,
        ),
      );
      expect(adapter.last!.method, 'POST');
      expect(adapter.last!.path, '/hr/shifts');
      await repo.updateShift(
        'sh-morning',
        const HrShiftInput(
          name: 'Morning',
          startTime: '06:00',
          endTime: '14:00',
          graceMinutes: 5,
          weeklyOffDays: [],
          isDefault: false,
          isActive: false,
        ),
      );
      expect(adapter.last!.method, 'PATCH');
      expect(adapter.last!.path, '/hr/shifts/sh-morning');
      expect((adapter.body! as Map)['isActive'], false);
      answer(null);
      await repo.deleteShift('sh-morning');
      expect(adapter.last!.method, 'DELETE');
    });

    test('holidays: ?year=, create sends the ISO date, delete by id', () async {
      answer([hrHolidayJson]);
      final h = await repo.holidays(year: 2026);
      expect(adapter.last!.queryParameters, {'year': 2026});
      expect(h.single.name, 'Diwali (Lakshmi Puja)');
      answer(hrHolidayJson);
      await repo.createHoliday(
        date: DateTime(2026, 12, 25),
        name: ' Christmas ',
        description: '',
      );
      expect(adapter.body, {'date': '2026-12-25', 'name': 'Christmas'});
      answer(null);
      await repo.deleteHoliday('h1');
      expect(adapter.last!.path, '/hr/holidays/h1');
    });

    test('leave types: includeInactive flag, create / patch / delete',
        () async {
      answer([hrLeaveTypeFullCasual]);
      await repo.leaveTypes(includeInactive: true);
      expect(adapter.last!.queryParameters, {'includeInactive': true});
      await repo.leaveTypes();
      expect(adapter.last!.queryParameters, isEmpty);
      answer(hrLeaveTypeFullPaid);
      await repo.createLeaveType(
        const HrLeaveTypeInput(
          name: 'Paid Leave',
          code: 'PAID',
          yearlyQuota: 15,
          isPaid: true,
          carryForward: true,
          carryForwardMax: 15,
          color: '#10b981',
        ),
      );
      expect(adapter.last!.path, '/hr/leave-types');
      expect((adapter.body! as Map)['carryForwardMax'], 15);
      await repo.updateLeaveType(
        'lt-paid',
        const HrLeaveTypeInput(
          name: 'Paid Leave',
          code: 'PAID',
          yearlyQuota: null,
          isPaid: true,
          carryForward: false,
          carryForwardMax: null,
          color: '#10b981',
          isActive: false,
        ),
      );
      expect(adapter.last!.method, 'PATCH');
      expect((adapter.body! as Map)['yearlyQuota'], isNull);
      expect((adapter.body! as Map)['isActive'], false);
      answer(null);
      await repo.deleteLeaveType('lt-paid');
      expect(adapter.last!.method, 'DELETE');
    });

    test('policy: PUT never includes workingDaysBasis', () async {
      answer(hrPolicyJson);
      final p = await repo.policy();
      await repo.savePolicy(p);
      expect(adapter.last!.method, 'PUT');
      expect(adapter.last!.path, '/hr/policy');
      final body = adapter.body! as Map;
      expect(body.containsKey('workingDaysBasis'), isFalse);
      expect(body['leaveYearStartMonth'], 4);
      expect(body['overtimeMultiplier'], 1.5);
    });
  });
}
