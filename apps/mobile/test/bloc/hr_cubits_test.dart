import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/bloc/hr/hr_me_cubit.dart';
import 'package:gym_saas_mobile/bloc/hr/leave_apply_cubit.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/models/hr_attendance.dart';
import 'package:gym_saas_mobile/models/hr_enums.dart';
import 'package:gym_saas_mobile/models/hr_leave.dart';
import 'package:gym_saas_mobile/models/hr_summary.dart';
import 'package:gym_saas_mobile/repositories/hr_repository.dart';
import 'package:mocktail/mocktail.dart';

import '../fixtures/hr_fixtures.dart';

class _MockHr extends Mock implements HrRepository {}

HrMeSummary _summary({
  bool canIn = true,
  bool canOut = false,
  String? checkIn,
  String? checkOut,
  String status = 'NOT_MARKED',
}) =>
    HrMeSummary.fromJson(
      hrSummaryJson(
        canCheckIn: canIn,
        canCheckOut: canOut,
        checkInTime: checkIn,
        checkOutTime: checkOut,
        status: status,
      ),
    );

void main() {
  setUpAll(() {
    registerFallbackValue(DateTime(2026));
    registerFallbackValue(DayPart.fullDay);
  });

  group('HrMeCubit - check in / out transitions', () {
    late _MockHr repo;
    setUp(() => repo = _MockHr());

    blocTest<HrMeCubit, HrMeState>(
      'load -> loaded',
      build: () {
        when(() => repo.meSummary()).thenAnswer((_) async => _summary());
        return HrMeCubit(repo);
      },
      act: (c) => c.load(),
      expect: () => [isA<HrMeLoading>(), isA<HrMeLoaded>()],
    );

    blocTest<HrMeCubit, HrMeState>(
      '403 NOT_AN_EMPLOYEE is an explanation, not a failure',
      build: () {
        when(() => repo.meSummary()).thenThrow(
          const ApiException(
            message: 'No staff profile',
            statusCode: 403,
            code: 'NOT_AN_EMPLOYEE',
          ),
        );
        return HrMeCubit(repo);
      },
      act: (c) => c.load(),
      expect: () => [
        isA<HrMeLoading>(),
        isA<HrMeError>().having((e) => e.notAnEmployee, 'notAnEmployee', true),
      ],
    );

    group('opt-in enrolment (owner without a staff profile)', () {
      const notEmployee = ApiException(
        message: 'No staff profile',
        statusCode: 403,
        code: 'NOT_AN_EMPLOYEE',
      );

      Future<HrMeCubit> onTheCard() async {
        when(() => repo.meSummary()).thenThrow(notEmployee);
        final c = HrMeCubit(repo);
        await c.load();
        expect((c.state as HrMeError).notAnEmployee, isTrue);
        return c;
      }

      test('success: spinner, then the normal screen (welcome once), then '
          'a silent reload', () async {
        final c = await onTheCard();
        when(() => repo.enrollMe()).thenAnswer((_) async => _summary());
        // After enrolling the summary endpoint works.
        when(() => repo.meSummary()).thenAnswer((_) async => _summary());
        final seen = <HrMeState>[];
        final sub = c.stream.listen(seen.add);
        await c.enroll();
        await sub.cancel();
        expect(seen.first, isA<HrMeError>().having((e) => e.enrolling, 'enrolling', true));
        expect(seen[1], isA<HrMeLoaded>().having((s) => s.welcome, 'welcome', true));
        expect(c.state, isA<HrMeLoaded>());
        verify(() => repo.enrollMe()).called(1);
        c.welcomed();
        expect((c.state as HrMeLoaded).welcome, isFalse);
        await c.close();
      });

      test('409 ALREADY_EMPLOYEE just reloads', () async {
        final c = await onTheCard();
        when(() => repo.enrollMe()).thenThrow(
          const ApiException(
            message: 'Already on the roster',
            statusCode: 409,
            code: 'ALREADY_EMPLOYEE',
          ),
        );
        when(() => repo.meSummary()).thenAnswer((_) async => _summary());
        await c.enroll();
        expect(c.state, isA<HrMeLoaded>());
        expect((c.state as HrMeLoaded).welcome, isFalse);
        await c.close();
      });

      test('another error keeps the card with the message; a retry works',
          () async {
        final c = await onTheCard();
        when(() => repo.enrollMe()).thenThrow(
          const ApiException(message: 'Server hiccup', statusCode: 500),
        );
        await c.enroll();
        final s = c.state as HrMeError;
        expect(s.notAnEmployee, isTrue);
        expect(s.enrolling, isFalse);
        expect(s.enrollError, 'Server hiccup');
        when(() => repo.enrollMe()).thenAnswer((_) async => _summary());
        when(() => repo.meSummary()).thenAnswer((_) async => _summary());
        await c.enroll();
        expect(c.state, isA<HrMeLoaded>());
        verify(() => repo.enrollMe()).called(2);
        await c.close();
      });

      test('ignored while enrolling and outside the not-an-employee card',
          () async {
        // Loaded -> no-op.
        when(() => repo.meSummary()).thenAnswer((_) async => _summary());
        final loaded = HrMeCubit(repo);
        await loaded.load();
        await loaded.enroll();
        verifyNever(() => repo.enrollMe());
        await loaded.close();

        // A second tap while the first is in flight -> one request.
        final c = await onTheCard();
        when(() => repo.enrollMe()).thenAnswer((_) async {
          await Future<void>.delayed(const Duration(milliseconds: 30));
          return _summary();
        });
        when(() => repo.meSummary()).thenAnswer((_) async => _summary());
        final a = c.enroll();
        final b = c.enroll();
        await Future.wait([a, b]);
        verify(() => repo.enrollMe()).called(1);
        await c.close();
      });

      test('a generic (non-403) load error is not the enrolment card', () async {
        when(() => repo.meSummary()).thenThrow(
          const ApiException(message: 'boom', statusCode: 500),
        );
        final c = HrMeCubit(repo);
        await c.load();
        await c.enroll();
        verifyNever(() => repo.enrollMe());
        await c.close();
      });
    });

    test('check in: spinner, then the response becomes today, then resync',
        () async {
      var calls = 0;
      when(() => repo.meSummary()).thenAnswer((_) async {
        calls++;
        // The resync after the punch returns what the server now says.
        return calls == 1
            ? _summary()
            : _summary(
                canIn: false,
                canOut: true,
                checkIn: '06:05',
                status: 'PRESENT',
              );
      });
      when(() => repo.checkIn()).thenAnswer(
        (_) async => HrAttendanceDay.fromJson(
          hrAttendanceDayJson(checkInTime: '06:05'),
        ),
      );
      final c = HrMeCubit(repo);
      await c.load();

      final states = <HrMeState>[];
      final sub = c.stream.listen(states.add);
      await c.checkIn();
      await Future<void>.delayed(Duration.zero);
      await sub.cancel();

      // 1. punching spinner, 2. response applied + celebrate, 3. resynced.
      final loaded = states.whereType<HrMeLoaded>().toList();
      expect(loaded.first.punching, HrPunch.checkIn);
      expect(loaded[1].punching, isNull);
      expect(loaded[1].celebrate, HrPunch.checkIn);
      expect(loaded[1].summary.today.canCheckOut, isTrue);
      final last = c.state as HrMeLoaded;
      expect(last.summary.today.canCheckIn, isFalse);
      expect(last.summary.today.canCheckOut, isTrue);
      expect(last.summary.today.attendance.checkInTime, '06:05');
      verify(() => repo.checkIn()).called(1);
      await c.close();
    });

    test('check out when checked in; second tap while done is a no-op',
        () async {
      when(() => repo.meSummary()).thenAnswer(
        (_) async => _summary(
          canIn: false,
          canOut: true,
          checkIn: '06:05',
          status: 'PRESENT',
        ),
      );
      when(() => repo.checkOut()).thenAnswer(
        (_) async => HrAttendanceDay.fromJson(
          hrAttendanceDayJson(checkInTime: '06:05', checkOutTime: '15:30'),
        ),
      );
      final c = HrMeCubit(repo);
      await c.load();
      await c.checkOut();

      // The summary now (mock) still says canOut, but the bridge state said
      // canCheckOut false right after the response; a cubit never fires a
      // request the latest summary forbids.
      when(() => repo.meSummary()).thenAnswer(
        (_) async => _summary(
          canIn: false,
          canOut: false,
          checkIn: '06:05',
          status: 'PRESENT',
        ),
      );
      await c.load(silent: true);
      await c.checkOut();
      verifyNever(() => repo.checkIn());
      verify(() => repo.checkOut()).called(1); // only the first tap went out
      await c.close();
    });

    test('never fires a punch the server said is not allowed', () async {
      when(() => repo.meSummary())
          .thenAnswer((_) async => _summary(canIn: false));
      final c = HrMeCubit(repo);
      await c.load();
      await c.checkIn();
      verifyNever(() => repo.checkIn());
      await c.close();
    });

    test('409 -> notice + silent resync, spinner cleared', () async {
      var summaryCalls = 0;
      when(() => repo.meSummary()).thenAnswer((_) async {
        summaryCalls++;
        return summaryCalls == 1
            ? _summary()
            : _summary(
                canIn: false,
                canOut: true,
                checkIn: '06:05',
                status: 'PRESENT',
              );
      });
      when(() => repo.checkIn()).thenThrow(
        const ApiException(
          message: 'You are already checked in.',
          statusCode: 409,
          code: 'ALREADY_CHECKED_IN',
        ),
      );
      final c = HrMeCubit(repo);
      await c.load();
      await c.checkIn();
      final s = c.state as HrMeLoaded;
      expect(s.punching, isNull);
      expect(summaryCalls, 2, reason: 'a 409 means our view is stale: resync');
      expect(s.summary.today.canCheckOut, isTrue);
      c.dismissNotice();
      expect((c.state as HrMeLoaded).notice, isNull);
      await c.close();
    });

    test('silent refresh failure keeps the data on screen', () async {
      when(() => repo.meSummary()).thenAnswer((_) async => _summary());
      final c = HrMeCubit(repo);
      await c.load();
      when(() => repo.meSummary()).thenThrow(
        const ApiException(message: 'offline'),
      );
      await c.load(silent: true);
      expect(c.state, isA<HrMeLoaded>());
      await c.close();
    });
  });

  group('validateLeaveForm', () {
    final today = DateTime(2026, 11, 22);

    LeaveFormErrors v({
      String? type = 'lt-casual',
      DateTime? start,
      DateTime? end,
      DayPart part = DayPart.fullDay,
      String reason = 'Family function',
      HrLeavePreview? preview,
    }) =>
        validateLeaveForm(
          leaveTypeId: type,
          start: start ?? today,
          end: end ?? today,
          dayPart: part,
          reason: reason,
          today: today,
          preview: preview,
        );

    test('a valid form has no errors', () => expect(v().any, isFalse));

    test('type, reason and dates are validated', () {
      expect(v(type: null).type, isNotNull);
      expect(v(reason: ' a ').reason, isNotNull);
      expect(v(reason: 'x' * 501).reason, isNotNull);
      expect(
        v(start: DateTime(2026, 11, 26), end: DateTime(2026, 11, 25)).dates,
        isNotNull,
      );
      expect(
        v(end: today.add(const Duration(days: 121))).dates,
        contains('120'),
      );
      expect(
        v(
          start: today.add(const Duration(days: 400)),
          end: today.add(const Duration(days: 400)),
        ).dates,
        isNotNull,
      );
    });

    test('a half day must be a single date', () {
      expect(
        v(
          part: DayPart.halfMorning,
          end: today.add(const Duration(days: 1)),
        ).dates,
        contains('single'),
      );
      expect(v(part: DayPart.halfEvening).any, isFalse);
    });

    test('an insufficient balance preview blocks submit', () {
      final bad = HrLeavePreview.fromJson({
        'days': 5,
        'excluded': <dynamic>[],
        'available': 2,
        'sufficient': false,
      });
      expect(v(preview: bad).balance, isNotNull);
      expect(v(preview: bad).any, isTrue);
    });
  });

  group('LeaveApplyCubit', () {
    late _MockHr repo;
    final today = DateTime(2026, 11, 22);

    setUp(() {
      repo = _MockHr();
      when(() => repo.myLeaveTypes()).thenAnswer(
        (_) async => [
          HrLeaveType.fromJson({
            ...hrLeaveTypeCasual,
            'yearlyQuota': 12,
            'isActive': true,
          }),
          HrLeaveType.fromJson({
            ...hrLeaveTypeUnpaid,
            'yearlyQuota': null,
            'isActive': false,
          }),
        ],
      );
      when(
        () => repo.previewMyLeave(
          leaveTypeId: any(named: 'leaveTypeId'),
          startDate: any(named: 'startDate'),
          endDate: any(named: 'endDate'),
          dayPart: any(named: 'dayPart'),
        ),
      ).thenAnswer(
        (_) async =>
            const HrLeavePreview(days: 1, sufficient: true, available: 8.5),
      );
    });

    LeaveApplyCubit make() => LeaveApplyCubit(
          repo,
          today: () => today,
          previewDelay: Duration.zero,
        );

    test('init loads active types only, defaults to today + first type',
        () async {
      final c = make();
      await c.init();
      expect(c.state.types.map((t) => t.code), ['CASUAL']);
      expect(c.state.leaveTypeId, 'lt-casual');
      expect(c.state.start, today);
      expect(c.state.end, today);
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(c.state.preview!.days, 1);
      await c.close();
    });

    test('half day collapses the range to one date', () async {
      final c = make();
      await c.init();
      c.setDates(today, today.add(const Duration(days: 2)));
      expect(c.state.end, today.add(const Duration(days: 2)));
      c.setDayPart(DayPart.halfMorning);
      expect(c.state.end, today);
      c.setDates(
        today.add(const Duration(days: 1)),
        today.add(const Duration(days: 3)),
      );
      expect(c.state.end, today.add(const Duration(days: 1)));
      await c.close();
    });

    test('submit refuses an empty reason without touching the API', () async {
      final c = make();
      await c.init();
      final r = await c.submit();
      expect(r, isNull);
      expect(c.state.showErrors, isTrue);
      expect(c.errors.reason, isNotNull);
      verifyNever(
        () => repo.applyLeave(
          leaveTypeId: any(named: 'leaveTypeId'),
          startDate: any(named: 'startDate'),
          endDate: any(named: 'endDate'),
          dayPart: any(named: 'dayPart'),
          reason: any(named: 'reason'),
        ),
      );
      await c.close();
    });

    test('submit sends the form and exposes the created request', () async {
      when(
        () => repo.applyLeave(
          leaveTypeId: any(named: 'leaveTypeId'),
          startDate: any(named: 'startDate'),
          endDate: any(named: 'endDate'),
          dayPart: any(named: 'dayPart'),
          reason: any(named: 'reason'),
        ),
      ).thenAnswer(
        (_) async => HrLeaveRequest.fromJson(hrLeaveRequestJson()),
      );
      final c = make();
      await c.init();
      await Future<void>.delayed(const Duration(milliseconds: 10));
      c.setReason('Family function');
      final r = await c.submit();
      expect(r!.status, LeaveStatus.pending);
      expect(c.state.submitted, isNotNull);
      expect(c.state.submitting, isFalse);
      verify(
        () => repo.applyLeave(
          leaveTypeId: 'lt-casual',
          startDate: today,
          endDate: today,
          dayPart: DayPart.fullDay,
          reason: 'Family function',
        ),
      ).called(1);
      await c.close();
    });

    test('server rejection (overlap) lands as a form error', () async {
      when(
        () => repo.applyLeave(
          leaveTypeId: any(named: 'leaveTypeId'),
          startDate: any(named: 'startDate'),
          endDate: any(named: 'endDate'),
          dayPart: any(named: 'dayPart'),
          reason: any(named: 'reason'),
        ),
      ).thenThrow(
        const ApiException(
          message: 'Overlaps an existing leave request.',
          statusCode: 409,
          code: 'LEAVE_OVERLAP',
        ),
      );
      final c = make();
      await c.init();
      await Future<void>.delayed(const Duration(milliseconds: 10));
      c.setReason('Trip');
      final r = await c.submit();
      expect(r, isNull);
      expect(c.state.submitError, contains('Overlaps'));
      expect(c.state.submitting, isFalse);
      await c.close();
    });

    test('an insufficient-balance preview blocks the submit', () async {
      when(
        () => repo.previewMyLeave(
          leaveTypeId: any(named: 'leaveTypeId'),
          startDate: any(named: 'startDate'),
          endDate: any(named: 'endDate'),
          dayPart: any(named: 'dayPart'),
        ),
      ).thenAnswer(
        (_) async => const HrLeavePreview(
          days: 5,
          sufficient: false,
          available: 2,
        ),
      );
      final c = make();
      await c.init();
      await Future<void>.delayed(const Duration(milliseconds: 10));
      c.setReason('Long trip');
      expect(await c.submit(), isNull);
      expect(c.errors.balance, isNotNull);
      await c.close();
    });

    test('on-behalf uses the HR endpoints and the auto-approve flag', () async {
      final vikram = HrEmployeeRef.fromJson(hrEmployeeRefJson);
      when(() => repo.leaveTypes()).thenAnswer(
        (_) async => [
          HrLeaveType.fromJson({...hrLeaveTypeCasual, 'yearlyQuota': 12}),
        ],
      );
      when(
        () => repo.previewLeaveFor(
          userId: any(named: 'userId'),
          leaveTypeId: any(named: 'leaveTypeId'),
          startDate: any(named: 'startDate'),
          endDate: any(named: 'endDate'),
          dayPart: any(named: 'dayPart'),
        ),
      ).thenAnswer(
        (_) async => const HrLeavePreview(days: 1, sufficient: true),
      );
      when(
        () => repo.applyLeaveFor(
          userId: any(named: 'userId'),
          leaveTypeId: any(named: 'leaveTypeId'),
          startDate: any(named: 'startDate'),
          endDate: any(named: 'endDate'),
          dayPart: any(named: 'dayPart'),
          reason: any(named: 'reason'),
          autoApprove: any(named: 'autoApprove'),
        ),
      ).thenAnswer(
        (_) async =>
            HrLeaveRequest.fromJson(hrLeaveRequestJson(status: 'APPROVED')),
      );
      final c = LeaveApplyCubit(
        repo,
        today: () => today,
        onBehalfOf: vikram,
        previewDelay: Duration.zero,
      );
      await c.init();
      await Future<void>.delayed(const Duration(milliseconds: 10));
      c.setReason('Medical appointment');
      c.setAutoApprove(true);
      final r = await c.submit();
      expect(r!.status, LeaveStatus.approved);
      verify(
        () => repo.applyLeaveFor(
          userId: 'u-vikram',
          leaveTypeId: 'lt-casual',
          startDate: today,
          endDate: today,
          dayPart: DayPart.fullDay,
          reason: 'Medical appointment',
          autoApprove: true,
        ),
      ).called(1);
      verifyNever(() => repo.myLeaveTypes());
      await c.close();
    });
  });
}
