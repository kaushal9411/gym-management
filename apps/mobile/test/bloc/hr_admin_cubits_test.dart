import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/bloc/hr/hr_forms.dart';
import 'package:gym_saas_mobile/bloc/hr/hr_load_cubit.dart';
import 'package:gym_saas_mobile/bloc/hr/payroll_run_cubit.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/models/hr_enums.dart';
import 'package:gym_saas_mobile/models/hr_payroll.dart';
import 'package:gym_saas_mobile/repositories/hr_repository.dart';
import 'package:mocktail/mocktail.dart';

import '../fixtures/hr_fixtures.dart';

class _MockHr extends Mock implements HrRepository {}

HrPayrollRunDetail _detail({
  String status = 'DRAFT',
  List<Map<String, dynamic>>? slips,
}) =>
    HrPayrollRunDetail.fromJson({
      'run': hrRunJson(status: status),
      'payslips': slips ?? [hrPayslipJson()],
    });

void main() {
  setUpAll(() {
    registerFallbackValue(PaymentMode.upi);
    registerFallbackValue(const HrPayslipEdit());
  });

  group('form validators (mirror the API / web rules)', () {
    test('remark rule: trimmed, >= 3, <= max', () {
      expect(validateHrRemark('  ab '), isNotNull);
      expect(validateHrRemark('abc'), isNull);
      expect(validateHrRemark('x' * 301), isNotNull);
      expect(validateHrRemark('x' * 301, max: 500), isNull);
    });

    test('shift: name, end after start, grace 0-240 whole minutes', () {
      expect(
        validateShiftForm(
          name: 'Morning',
          startTime: '06:00',
          endTime: '14:00',
          graceText: '10',
        ),
        isEmpty,
      );
      final e = validateShiftForm(
        name: ' ',
        startTime: '14:00',
        endTime: '06:00',
        graceText: '999',
      );
      expect(e.keys, containsAll(['name', 'endTime', 'graceMinutes']));
      expect(
        validateShiftForm(
          name: 'x',
          startTime: '06:00',
          endTime: '06:00',
          graceText: '1.5',
        ).keys,
        containsAll(['endTime', 'graceMinutes']),
      );
    });

    test('leave type: code is 2-12 capitals / digits / underscore', () {
      Map<String, String> v(String code, {bool unlimited = false}) =>
          validateLeaveTypeForm(
            name: 'Casual',
            code: code,
            unlimited: unlimited,
            quotaText: '12',
            carryForward: false,
            carryMaxText: '',
          );
      expect(v('CASUAL'), isEmpty);
      expect(v('A_1'), isEmpty);
      expect(v('casual').containsKey('code'), isTrue);
      expect(v('A').containsKey('code'), isTrue);
      expect(v('TOOLONGCODE123').containsKey('code'), isTrue);
    });

    test('leave type: quota required unless unlimited; cap must be a number',
        () {
      expect(
        validateLeaveTypeForm(
          name: 'n',
          code: 'AB',
          unlimited: false,
          quotaText: '',
          carryForward: false,
          carryMaxText: '',
        ).keys,
        ['yearlyQuota'],
      );
      expect(
        validateLeaveTypeForm(
          name: 'n',
          code: 'AB',
          unlimited: true,
          quotaText: '',
          carryForward: true,
          carryMaxText: 'abc',
        ).keys,
        ['carryForwardMax'],
      );
    });

    test('holiday needs a date and a name', () {
      expect(
        validateHolidayForm(date: null, name: '').keys,
        containsAll(['date', 'name']),
      );
      expect(
        validateHolidayForm(date: DateTime(2026, 12, 25), name: 'X'),
        isEmpty,
      );
    });

    test('policy: standard day >= 1, multiplier >= 1, lates per unit >= 1',
        () {
      HrPolicyDraft d({String std = '8', String otm = '1.5', String lpu = '3'}) =>
          HrPolicyDraft(
            lateGraceMinutes: '10',
            halfDayThresholdHours: '4',
            standardDayHours: std,
            latePenaltyLatesPerUnit: lpu,
            latePenaltyDays: '0.5',
            overtimeMultiplier: otm,
            backdateLeaveDays: '30',
          );
      expect(validatePolicyForm(d()), isEmpty);
      expect(validatePolicyForm(d(std: '0')).keys, ['standardDayHours']);
      expect(validatePolicyForm(d(otm: '0.5')).keys, ['overtimeMultiplier']);
      expect(
        validatePolicyForm(d(lpu: '0')).keys,
        ['latePenaltyLatesPerUnit'],
      );
    });

    test('payslip edit: bonus / advance >= 0, lines named with amount > 0',
        () {
      expect(
        validatePayslipEdit(
          bonusText: '',
          advanceText: '',
          lines: const [],
        ),
        isEmpty,
      );
      final e = validatePayslipEdit(
        bonusText: '-1',
        advanceText: 'abc',
        lines: const [
          HrLineDraft(name: '', amountText: '10'),
          HrLineDraft(name: 'Incentive', amountText: '0'),
          HrLineDraft(name: 'Uniform', amountText: '300'),
        ],
      );
      expect(e.keys, containsAll(['bonus', 'advanceRecovery', 'line0', 'line1']));
      expect(e.containsKey('line2'), isFalse);
      expect(
        validatePayslipEdit(
          bonusText: '',
          advanceText: '',
          lines: [
            for (var i = 0; i < 21; i++)
              const HrLineDraft(name: 'n', amountText: '1'),
          ],
        ).containsKey('lines'),
        isTrue,
      );
    });

    test('pay structure: base >= 0 or blank, each row named with amount', () {
      expect(validatePayStructure(baseText: '', rows: const []), isEmpty);
      expect(
        validatePayStructure(baseText: '-5', rows: const []).keys,
        ['baseSalary'],
      );
      final e = validatePayStructure(
        baseText: '18000',
        rows: const [
          HrLineDraft(name: '', amountText: '5'),
          HrLineDraft(name: 'Travel', amountText: ''),
        ],
      );
      expect(e.keys, ['row0', 'row1']);
    });

    test('balance adjust: remark is REQUIRED', () {
      expect(
        validateBalanceAdjust(
          leaveTypeId: 'lt-casual',
          daysText: '1',
          remark: 'ab',
        ).keys,
        ['remark'],
      );
      expect(
        validateBalanceAdjust(
          leaveTypeId: 'lt-casual',
          daysText: '1',
          remark: 'Comp-off',
        ),
        isEmpty,
      );
      expect(
        validateBalanceAdjust(
          leaveTypeId: null,
          daysText: '0',
          remark: 'Comp-off',
        ).keys,
        containsAll(['leaveTypeId', 'days']),
      );
    });

    test('bulk mark: shared remark REQUIRED, 1-200 people', () {
      expect(validateBulkMark(remark: '', selected: 3).keys, ['remark']);
      expect(
        validateBulkMark(remark: 'Power cut', selected: 0).keys,
        ['entries'],
      );
      expect(
        validateBulkMark(remark: 'Power cut', selected: 201).keys,
        ['entries'],
      );
      expect(validateBulkMark(remark: 'Power cut', selected: 5), isEmpty);
    });

    test('paid-on cannot be in the future', () {
      final today = DateTime(2026, 11, 22);
      expect(validatePaidOn(DateTime(2026, 11, 23), today), isNotNull);
      expect(validatePaidOn(DateTime(2026, 11, 22), today), isNull);
    });

    test('server field errors are keyed by field', () {
      const e = ApiException(
        message: 'Validation',
        statusCode: 422,
        fieldErrors: [FieldError(field: 'remark', message: 'Too short')],
      );
      expect(hrServerFieldErrors(e), {'remark': 'Too short'});
    });
  });

  group('HrLoadCubit', () {
    blocTest<HrLoadCubit<int>, HrLoadState<int>>(
      'load -> loading -> loaded',
      build: () => HrLoadCubit(() async => 7),
      act: (c) => c.load(),
      expect: () => [isA<HrLoadLoading<int>>(), isA<HrLoadLoaded<int>>()],
    );

    blocTest<HrLoadCubit<int>, HrLoadState<int>>(
      'a failed first load is an error',
      build: () => HrLoadCubit(
        () async => throw const ApiException(message: 'boom'),
      ),
      act: (c) => c.load(),
      expect: () => [isA<HrLoadLoading<int>>(), isA<HrLoadError<int>>()],
    );

    test('a failed silent refresh keeps what is on screen', () async {
      var n = 0;
      final c = HrLoadCubit<int>(() async {
        if (++n == 2) throw const ApiException(message: 'boom');
        return n;
      });
      await c.load();
      await c.load(silent: true);
      expect(c.state, isA<HrLoadLoaded<int>>());
      await c.close();
    });

    test('a stale reply is dropped when a newer load starts', () async {
      final gates = <int, Future<int> Function()>{};
      var call = 0;
      final c = HrLoadCubit<int>(() {
        final id = ++call;
        return Future<int>.delayed(
          Duration(milliseconds: id == 1 ? 40 : 5),
          () => id,
        );
      });
      final first = c.load();
      final second = c.load();
      await Future.wait([first, second]);
      expect((c.state as HrLoadLoaded<int>).data, 2);
      expect(gates, isEmpty);
      await c.close();
    });
  });

  group('PayrollRunCubit', () {
    late _MockHr repo;
    setUp(() => repo = _MockHr());

    test('load -> loaded draft', () async {
      when(() => repo.payrollRun('run-2')).thenAnswer((_) async => _detail());
      final c = PayrollRunCubit(repo, 'run-2');
      await c.load();
      final s = c.state as PayrollRunLoaded;
      expect(s.isDraft, isTrue);
      expect(s.unpaid.length, 1);
      expect(s.unpaidTotal, 17875);
      await c.close();
    });

    test('payslip line edit sends the PATCH body, then re-reads the run '
        '(totals come from the server)', () async {
      var reads = 0;
      when(() => repo.payrollRun('run-2')).thenAnswer((_) async {
        reads++;
        return _detail(
          slips: [if (reads > 1) hrPayslipWithManualLineJson() else hrPayslipJson()],
        );
      });
      when(() => repo.patchPayslip(any(), any())).thenAnswer(
        (_) async => HrPayslip.fromJson(hrPayslipWithManualLineJson()),
      );
      final c = PayrollRunCubit(repo, 'run-2');
      await c.load();
      const edit = HrPayslipEdit(
        bonus: 200,
        advanceRecovery: 0,
        manualLines: [
          HrManualLine(name: 'Incentive', isAllowance: true, amount: 750),
        ],
      );
      final ok = await c.savePayslip('ps-2', edit);
      expect(ok, isTrue);
      final captured =
          verify(() => repo.patchPayslip('ps-2', captureAny())).captured.single
              as HrPayslipEdit;
      expect(captured.toJson()['manualLines'], [
        {'name': 'Incentive', 'type': 'ALLOWANCE', 'amount': 750.0},
      ]);
      expect(captured.toJson()['bonus'], 200.0);
      final s = c.state as PayrollRunLoaded;
      expect(s.busy, isNull);
      expect(s.detail.payslips.first.manualLines.length, 1);
      expect(reads, 2);
      await c.close();
    });

    test('approve locks the run (re-read as APPROVED)', () async {
      var approved = false;
      when(() => repo.payrollRun('run-2')).thenAnswer(
        (_) async => _detail(status: approved ? 'APPROVED' : 'DRAFT'),
      );
      when(() => repo.approveRun('run-2')).thenAnswer((_) async {
        approved = true;
        return HrPayrollRun.fromJson(hrRunJson());
      });
      final c = PayrollRunCubit(repo, 'run-2');
      await c.load();
      expect(await c.approve(), isTrue);
      final s = c.state as PayrollRunLoaded;
      expect(s.isApproved, isTrue);
      expect(s.notice, contains('approved'));
      await c.close();
    });

    test('recalculate swaps in the server detail', () async {
      when(() => repo.payrollRun('run-2')).thenAnswer((_) async => _detail());
      when(() => repo.recalculateRun('run-2')).thenAnswer(
        (_) async => _detail(
          slips: [hrPayslipJson(), {...hrPayslipJson(), 'id': 'ps-9'}],
        ),
      );
      final c = PayrollRunCubit(repo, 'run-2');
      await c.load();
      await c.recalculate();
      expect((c.state as PayrollRunLoaded).detail.payslips.length, 2);
      await c.close();
    });

    test('deleting a draft flips to deleted; INVALID_STATE shows the server '
        'message and reloads', () async {
      when(() => repo.payrollRun('run-2')).thenAnswer((_) async => _detail());
      when(() => repo.deleteRun('run-2')).thenAnswer((_) async {});
      final c = PayrollRunCubit(repo, 'run-2');
      await c.load();
      expect(await c.deleteDraft(), isTrue);
      expect((c.state as PayrollRunLoaded).deleted, isTrue);
      await c.close();

      when(() => repo.deleteRun('run-2')).thenThrow(
        const ApiException(
          message: 'Only a draft run can be deleted.',
          statusCode: 409,
          code: 'INVALID_STATE',
        ),
      );
      final c2 = PayrollRunCubit(repo, 'run-2');
      await c2.load();
      expect(await c2.deleteDraft(), isFalse);
      final s = c2.state as PayrollRunLoaded;
      expect(s.deleted, isFalse);
      expect(s.noticeIsError, isTrue);
      expect(s.notice, 'Only a draft run can be deleted.');
      verify(() => repo.payrollRun('run-2')).called(greaterThan(2));
      await c2.close();
    });

    test('409 ALREADY_PAID on pay: server message, run reloaded', () async {
      when(() => repo.payrollRun('run-2')).thenAnswer(
        (_) async => _detail(status: 'APPROVED'),
      );
      when(
        () => repo.payPayslip(
          any(),
          mode: any(named: 'mode'),
          paidOn: any(named: 'paidOn'),
          remark: any(named: 'remark'),
        ),
      ).thenThrow(
        const ApiException(
          message: 'This payslip is already paid.',
          statusCode: 409,
          code: 'ALREADY_PAID',
        ),
      );
      final c = PayrollRunCubit(repo, 'run-2');
      await c.load();
      final slip = (c.state as PayrollRunLoaded).detail.payslips.first;
      final ok = await c.pay(slip, mode: PaymentMode.upi, paidOn: '2026-11-22');
      expect(ok, isFalse);
      final s = c.state as PayrollRunLoaded;
      expect(s.notice, 'This payslip is already paid.');
      expect(s.noticeIsError, isTrue);
      expect(s.busy, isNull);
      verify(() => repo.payrollRun('run-2')).called(2);
      await c.close();
    });

    test('pay all keeps the summary for the result sheet', () async {
      when(() => repo.payrollRun('run-2')).thenAnswer(
        (_) async => _detail(status: 'APPROVED'),
      );
      when(
        () => repo.payAll(
          'run-2',
          mode: any(named: 'mode'),
          paidOn: any(named: 'paidOn'),
          remark: any(named: 'remark'),
        ),
      ).thenAnswer(
        (_) async => HrPayAllResult.fromJson({
          'paid': 1,
          'skipped': 0,
          'failed': <Object>[],
          'run': hrRunJson(status: 'PAID'),
        }),
      );
      final c = PayrollRunCubit(repo, 'run-2');
      await c.load();
      await c.payAll(mode: PaymentMode.bankTransfer, paidOn: '2026-11-22');
      final s = c.state as PayrollRunLoaded;
      expect(s.payAllResult!.paid, 1);
      expect(s.notice, '1 payslip paid.');
      await c.close();
    });

    test('a second action is ignored while one is running', () async {
      when(() => repo.payrollRun('run-2')).thenAnswer((_) async => _detail());
      when(() => repo.recalculateRun('run-2')).thenAnswer((_) async {
        await Future<void>.delayed(const Duration(milliseconds: 30));
        return _detail();
      });
      final c = PayrollRunCubit(repo, 'run-2');
      await c.load();
      final a = c.recalculate();
      final b = c.recalculate();
      expect(await b, isFalse);
      await a;
      verify(() => repo.recalculateRun('run-2')).called(1);
      await c.close();
    });
  });
}
