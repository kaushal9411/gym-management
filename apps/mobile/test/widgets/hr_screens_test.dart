import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/features/hr/presentation/apply_leave_screen.dart';
import 'package:gym_saas_mobile/features/hr/presentation/approvals_screen.dart';
import 'package:gym_saas_mobile/features/hr/presentation/hr_overview_screen.dart';
import 'package:gym_saas_mobile/features/hr/presentation/my_hr_screen.dart';
import 'package:gym_saas_mobile/features/hr/presentation/my_leaves_screen.dart';
import 'package:gym_saas_mobile/features/hr/presentation/my_payslips_screen.dart';
import 'package:gym_saas_mobile/features/hr/presentation/payroll_screens.dart';
import 'package:gym_saas_mobile/features/hr/presentation/widgets/hr_sheets.dart';
import 'package:gym_saas_mobile/features/hr/presentation/widgets/hr_widgets.dart';
import 'package:gym_saas_mobile/models/hr_admin.dart';
import 'package:gym_saas_mobile/models/hr_attendance.dart';
import 'package:gym_saas_mobile/models/hr_enums.dart';
import 'package:gym_saas_mobile/models/hr_leave.dart';
import 'package:gym_saas_mobile/models/hr_payroll.dart';
import 'package:gym_saas_mobile/models/hr_summary.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/hr_repository.dart';
import 'package:mocktail/mocktail.dart';

import '../fixtures/hr_fixtures.dart';

class _MockSession extends MockCubit<SessionState> implements SessionCubit {}

class _MockHr extends Mock implements HrRepository {}

const _tenant = TenantBranding(
  slug: 'kaushal-fitness-club',
  name: 'Kaushal Fitness Club',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

const _selfPerms = [
  'hr:self_attendance',
  'hr:self_leave',
  'hr:self_payslip',
];

const _adminPerms = [
  'hr:view',
  'hr:attendance_manage',
  'hr:leave_manage',
  'hr:payroll_manage',
  'hr:settings_manage',
];

PaginatedResult<T> _page<T>(List<T> items) => PaginatedResult(
      items: items,
      total: items.length,
      page: 1,
      limit: 20,
      totalPages: 1,
    );

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

HrMonthAttendance _month() => HrMonthAttendance.fromJson({
      'month': '2026-11',
      'days': [
        for (var d = 1; d <= 30; d++)
          hrAttendanceDayJson(
            date: '2026-11-${d.toString().padLeft(2, '0')}',
            status: d == 1
                ? 'WEEKLY_OFF'
                : d == 2
                    ? 'LATE'
                    : d < 22
                        ? 'PRESENT'
                        : 'NOT_MARKED',
            recorded: d < 22,
            checkInTime: d < 22 ? '06:05' : null,
            source: d == 3 ? 'MANUAL' : 'SELF',
            remark: d == 3 ? 'Forgot to punch in' : null,
          ),
      ],
      'stats': hrStatsJson,
    });

Finder _inSheet(String label) =>
    find.descendant(of: find.byType(BottomSheet), matching: find.text(label));

/// Sheets are taller than the 85% cap with the wide Ahem test font, so the
/// button can sit in the sheet's own scroll view - scroll it in first.
/// Route / sheet animations start on the first frame after the tap: two pumps.
Future<void> _anim(WidgetTester t) async {
  await t.pump(const Duration(milliseconds: 50));
  await t.pump(const Duration(milliseconds: 700));
}

Future<void> _tapVisible(WidgetTester t, Finder f) async {
  await t.ensureVisible(f);
  await t.pump(const Duration(milliseconds: 100));
  await t.tap(f);
}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  late _MockHr repo;

  setUpAll(() {
    registerFallbackValue(DateTime(2026));
    registerFallbackValue(DayPart.fullDay);
    registerFallbackValue(DayStatus.present);
    registerFallbackValue(PaymentMode.upi);
  });

  setUp(() {
    repo = _MockHr();
    final g = GetIt.instance;
    if (g.isRegistered<HrRepository>()) g.unregister<HrRepository>();
    g.registerSingleton<HrRepository>(repo);
  });

  Future<void> pumpApp(
    WidgetTester t,
    Widget child, {
    List<String> perms = _selfPerms,
    String userId = 'me',
    Size size = const Size(560, 2000),
  }) async {
    t.view.physicalSize = size * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final session = _MockSession();
    when(() => session.state).thenReturn(
      SessionAuthenticatedStaff(
        UserProfile(
          id: userId,
          tenantId: 't',
          name: 'Me',
          email: 'me@x.test',
          phone: null,
          status: 'ACTIVE',
          roles: const ['MANAGER'],
          permissions: perms,
        ),
        _tenant,
      ),
    );
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp(home: child),
      ),
    );
  }

  // The hero mesh, pulse button, live clock and skeleton shimmer loop forever,
  // so pumpAndSettle would never return - pump fixed time instead.
  Future<void> settle(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(seconds: 2));
    await _anim(t);
  }

  // Dispose the tree so the live clock's periodic timer is cancelled.
  Future<void> dispose(WidgetTester t) async {
    await t.pumpWidget(const SizedBox());
    await t.pump(const Duration(milliseconds: 100));
  }

  group('calendar heatmap', () {
    testWidgets(
        'renders every day, taps report the day, glyphs not colour only',
        (t) async {
      int? tapped;
      await pumpApp(
        t,
        Scaffold(
          body: SingleChildScrollView(
            child: HrMonthCalendar(
              month: DateTime(2026, 11),
              todayDay: 22,
              selectedDay: 5,
              cells: {
                1: const HrCalendarCell(
                  color: Color(0xFF64748B),
                  glyph: Icons.bedtime_rounded,
                  semantics: 'Weekly off',
                ),
                2: const HrCalendarCell(
                  color: Color(0xFF10B981),
                  glyph: Icons.check_rounded,
                  semantics: 'Present, in 6:05 AM',
                ),
              },
              onDayTap: (d) => tapped = d,
            ),
          ),
        ),
      );
      await settle(t);
      for (final d in [1, 15, 30]) {
        expect(find.text('$d'), findsOneWidget);
      }
      expect(find.byIcon(Icons.check_rounded), findsOneWidget);
      expect(find.byIcon(Icons.bedtime_rounded), findsOneWidget);
      await t.tap(find.text('2'));
      expect(tapped, 2);
      // 1 Nov 2026 is a Sunday => the first row starts with 6 blanks.
      expect(HrMonthCalendar.daysInMonth(DateTime(2026, 11)), 30);
      expect(t.takeException(), isNull);
    });

    testWidgets('reduced motion shows cells immediately', (t) async {
      t.view.physicalSize = const Size(560, 900) * 3;
      t.view.devicePixelRatio = 3;
      addTearDown(t.view.reset);
      await t.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(disableAnimations: true),
            child: Scaffold(
              body: HrMonthCalendar(
                month: DateTime(2026, 11),
                cells: const {},
                onDayTap: (_) {},
              ),
            ),
          ),
        ),
      );
      await t.pump();
      expect(find.text('30'), findsOneWidget);
    });
  });

  group('My HR', () {
    testWidgets('check in -> server response -> Check out', (t) async {
      var calls = 0;
      when(() => repo.meSummary()).thenAnswer((_) async {
        calls++;
        return calls == 1
            ? _summary()
            : _summary(
                canIn: false,
                canOut: true,
                checkIn: '06:05',
                status: 'PRESENT',
              );
      });
      when(() => repo.myAttendance(month: any(named: 'month')))
          .thenAnswer((_) async => _month());
      when(() => repo.checkIn()).thenAnswer(
        (_) async => HrAttendanceDay.fromJson(
          hrAttendanceDayJson(checkInTime: '06:05'),
        ),
      );
      await pumpApp(t, const MyHrScreen());
      await settle(t);

      expect(find.text('Check in'), findsOneWidget);
      expect(find.textContaining('General'), findsWidgets);
      expect(find.text('Apply leave'), findsWidgets);
      await t.tap(find.byKey(const Key('hr-punch-button')));
      await settle(t);
      verify(() => repo.checkIn()).called(1);
      expect(find.text('Check out'), findsOneWidget);
      expect(find.textContaining('In 6:05 AM'), findsOneWidget);
      expect(t.takeException(), isNull);
      await dispose(t);
    });

    testWidgets('month stats, heatmap legend, balance rings and payslip',
        (t) async {
      when(() => repo.meSummary()).thenAnswer((_) async => _summary());
      when(() => repo.myAttendance(month: any(named: 'month')))
          .thenAnswer((_) async => _month());
      await pumpApp(t, const MyHrScreen());
      await settle(t);
      final scrollable = find.byType(Scrollable).first;
      await t.scrollUntilVisible(
        find.text('Leave balance'),
        400,
        scrollable: scrollable,
      );
      expect(find.text('Casual Leave'), findsWidgets);
      expect(find.text('Unpaid Leave'), findsWidgets);
      await t.scrollUntilVisible(
        find.text('Latest payslip'),
        400,
        scrollable: scrollable,
      );
      await t.drag(scrollable, const Offset(0, -400));
      await t.pump(const Duration(milliseconds: 300));
      expect(find.text('October 2026'), findsOneWidget);
      expect(t.takeException(), isNull);
      await dispose(t);
    });

    testWidgets('tapping a manually marked day shows who marked it and why',
        (t) async {
      when(() => repo.meSummary()).thenAnswer((_) async => _summary());
      when(() => repo.myAttendance(month: any(named: 'month')))
          .thenAnswer((_) async => _month());
      await pumpApp(t, const MyHrScreen());
      await settle(t);
      final scrollable = find.byType(Scrollable).first;
      await t.scrollUntilVisible(
        find.text('Attendance'),
        400,
        scrollable: scrollable,
      );
      await t.drag(scrollable, const Offset(0, -150));
      await _anim(t);
      await t.tap(find.text('3').first);
      await _anim(t);
      expect(find.text('Forgot to punch in'), findsOneWidget);
      expect(find.textContaining('Marked by Kaushal Chauhan'), findsOneWidget);
      await dispose(t);
    });

    testWidgets('an owner without a staff profile gets an explanation',
        (t) async {
      when(() => repo.meSummary()).thenThrow(
        const ApiException(
          message: 'You do not have an employee profile',
          statusCode: 403,
          code: 'NOT_AN_EMPLOYEE',
        ),
      );
      await pumpApp(t, const MyHrScreen());
      await settle(t);
      expect(find.text('No employee profile'), findsOneWidget);
      expect(find.text('Try again'), findsNothing);
      await dispose(t);
    });

    testWidgets('a failed punch shows the server message', (t) async {
      when(() => repo.meSummary()).thenAnswer((_) async => _summary());
      when(() => repo.myAttendance(month: any(named: 'month')))
          .thenAnswer((_) async => _month());
      when(() => repo.checkIn()).thenThrow(
        const ApiException(
          message: 'You are on approved leave today',
          statusCode: 409,
          code: 'INVALID_STATE',
        ),
      );
      await pumpApp(t, const MyHrScreen());
      await settle(t);
      await t.tap(find.byKey(const Key('hr-punch-button')));
      await settle(t);
      expect(find.text('You are on approved leave today'), findsOneWidget);
      await dispose(t);
    });
  });

  group('Apply leave', () {
    void stubTypes() {
      when(() => repo.myLeaveTypes()).thenAnswer(
        (_) async => [
          HrLeaveType.fromJson({...hrLeaveTypeCasual, 'yearlyQuota': 12}),
          HrLeaveType.fromJson({...hrLeaveTypeUnpaid, 'yearlyQuota': null}),
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
        (_) async => HrLeavePreview.fromJson({
          'days': 1,
          'excluded': [
            {'date': '2026-11-29', 'reason': 'WEEKLY_OFF'},
          ],
          'available': 8.5,
          'sufficient': true,
        }),
      );
    }

    testWidgets('types, day-part chips, live preview and reason validation',
        (t) async {
      stubTypes();
      await pumpApp(t, const ApplyLeaveScreen());
      await settle(t);
      expect(find.text('Casual Leave'), findsWidgets);
      expect(find.text('Unpaid Leave'), findsOneWidget);
      expect(find.text('Full day'), findsOneWidget);
      expect(find.text('Half day'), findsNWidgets(2));
      expect(find.text('morning'), findsOneWidget);
      expect(find.text('evening'), findsOneWidget);
      expect(find.text('LIVE PREVIEW'), findsOneWidget);
      expect(find.text('working day'), findsOneWidget);
      expect(find.textContaining('7.5 left after'), findsOneWidget);

      // Submit with no reason: inline error, no request.
      final scrollable = find.byType(Scrollable).first;
      await t.scrollUntilVisible(
        find.text('Submit request'),
        300,
        scrollable: scrollable,
      );
      await t.tap(find.text('Submit request'));
      await t.pump(const Duration(milliseconds: 300));
      expect(find.textContaining('Add a reason'), findsOneWidget);
      verifyNever(
        () => repo.applyLeave(
          leaveTypeId: any(named: 'leaveTypeId'),
          startDate: any(named: 'startDate'),
          endDate: any(named: 'endDate'),
          dayPart: any(named: 'dayPart'),
          reason: any(named: 'reason'),
        ),
      );
      expect(t.takeException(), isNull);
      await dispose(t);
    });

    testWidgets('choosing half day hides the To date', (t) async {
      stubTypes();
      await pumpApp(t, const ApplyLeaveScreen());
      await settle(t);
      expect(find.text('To'), findsOneWidget);
      await t.tap(find.text('morning'));
      await _anim(t);
      expect(find.text('To'), findsNothing);
      expect(find.text('Date'), findsWidgets);
      await dispose(t);
    });

    testWidgets('HR on behalf: names the employee, offers auto-approve',
        (t) async {
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
      await pumpApp(
        t,
        ApplyLeaveScreen(
          args: HrApplyLeaveArgs(
            onBehalfOf: HrEmployeeRef.fromJson(hrEmployeeRefJson),
          ),
        ),
        perms: _adminPerms,
      );
      await settle(t);
      expect(find.text('Apply for Vikram Coach'), findsOneWidget);
      final scrollable = find.byType(Scrollable).first;
      await t.scrollUntilVisible(
        find.text('Approve immediately'),
        300,
        scrollable: scrollable,
      );
      expect(find.text('Approve immediately'), findsOneWidget);
      await dispose(t);
    });
  });

  group('My leaves', () {
    testWidgets('status chip, approver remark and cancel for a pending request',
        (t) async {
      when(
        () => repo.myLeaves(
          page: any(named: 'page'),
          limit: any(named: 'limit'),
          status: any(named: 'status'),
        ),
      ).thenAnswer(
        (_) async => _page([
          HrLeaveRequest.fromJson(hrLeaveRequestJson()),
          HrLeaveRequest.fromJson(
            hrLeaveRequestJson(
              id: 'lr-2',
              status: 'REJECTED',
              decisionRemark: 'Busy week - please move it',
              canCancel: false,
            ),
          ),
        ]),
      );
      await pumpApp(t, const MyLeavesScreen());
      await settle(t);
      expect(find.text('Pending'), findsWidgets);
      expect(find.text('Rejected'), findsWidgets);
      expect(find.text('Busy week - please move it'), findsOneWidget);
      expect(find.text('Cancel request'), findsOneWidget);
      expect(find.text('Apply leave'), findsOneWidget);
      await dispose(t);
    });
  });

  group('Approvals', () {
    HrLeavePage leavesPage({String userId = 'u-vikram'}) => HrLeavePage(
          page: _page([
            HrLeaveRequest.fromJson({
              ...hrLeaveRequestJson(canCancel: false),
              'employee': {...hrEmployeeRefJson, 'userId': userId},
            }),
          ]),
          counts: const HrLeaveCounts(pending: 1, approved: 4),
        );

    void stubList({String userId = 'u-vikram'}) {
      when(
        () => repo.leaves(
          page: any(named: 'page'),
          limit: any(named: 'limit'),
          status: any(named: 'status'),
          userId: any(named: 'userId'),
        ),
      ).thenAnswer((_) async => leavesPage(userId: userId));
    }

    testWidgets('reject REQUIRES a remark; approve sends it as optional',
        (t) async {
      stubList();
      when(() => repo.rejectLeave(any(), remark: any(named: 'remark')))
          .thenAnswer(
        (_) async => HrLeaveRequest.fromJson(
          hrLeaveRequestJson(status: 'REJECTED', decisionRemark: 'No cover'),
        ),
      );
      await pumpApp(t, const ApprovalsScreen(), perms: _adminPerms);
      await settle(t);
      expect(find.text('Vikram Coach'), findsWidgets);
      expect(find.text('Pending · 1'), findsOneWidget);
      await t.tap(find.byKey(const Key('reject-lr-1')));
      await _anim(t);
      expect(find.text('Reject leave?'), findsOneWidget);

      // Confirm is dead until the remark is long enough.
      await _tapVisible(t, _inSheet('Reject'));
      await t.pump();
      verifyNever(() => repo.rejectLeave(any(), remark: any(named: 'remark')));

      await t.enterText(find.byKey(const Key('hr-remark-field')), 'No cover');
      await t.pump();
      await _tapVisible(t, _inSheet('Reject'));
      await _anim(t);
      verify(() => repo.rejectLeave('lr-1', remark: 'No cover')).called(1);
      await dispose(t);
    });

    testWidgets('approve works without a remark', (t) async {
      stubList();
      when(() => repo.approveLeave(any(), remark: any(named: 'remark')))
          .thenAnswer(
        (_) async => HrLeaveRequest.fromJson(
          hrLeaveRequestJson(status: 'APPROVED'),
        ),
      );
      await pumpApp(t, const ApprovalsScreen(), perms: _adminPerms);
      await settle(t);
      await t.tap(find.byKey(const Key('approve-lr-1')));
      await _anim(t);
      await _tapVisible(t, _inSheet('Approve'));
      await _anim(t);
      verify(() => repo.approveLeave('lr-1')).called(1);
      await dispose(t);
    });

    testWidgets('your own request has no approve / reject buttons', (t) async {
      stubList(userId: 'me');
      await pumpApp(t, const ApprovalsScreen(), perms: _adminPerms);
      await settle(t);
      expect(find.byKey(const Key('approve-lr-1')), findsNothing);
      expect(find.byKey(const Key('reject-lr-1')), findsNothing);
      expect(find.textContaining('another approver decides'), findsOneWidget);
      await dispose(t);
    });

    testWidgets('all-clear state', (t) async {
      when(
        () => repo.leaves(
          page: any(named: 'page'),
          limit: any(named: 'limit'),
          status: any(named: 'status'),
          userId: any(named: 'userId'),
        ),
      ).thenAnswer(
        (_) async => HrLeavePage(
          page: _page(<HrLeaveRequest>[]),
          counts: const HrLeaveCounts(),
        ),
      );
      await pumpApp(t, const ApprovalsScreen(), perms: _adminPerms);
      await settle(t);
      expect(find.text('All caught up'), findsOneWidget);
      await dispose(t);
    });
  });

  group('Manual attendance mark', () {
    Future<void> openSheet(WidgetTester t) async {
      await pumpApp(
        t,
        Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: TextButton(
                onPressed: () => showMarkAttendanceSheet(
                  context,
                  employee: HrEmployeeRef.fromJson(hrEmployeeRefJson),
                  date: DateTime(2026, 11, 20),
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
        perms: _adminPerms,
      );
      await t.tap(find.text('open'));
      await _anim(t);
    }

    testWidgets('a remark is REQUIRED before anything is sent', (t) async {
      await openSheet(t);
      expect(find.text('Mark attendance'), findsOneWidget);
      expect(find.text('REMARK (REQUIRED)'), findsOneWidget);
      await _tapVisible(t, find.text('Save attendance'));
      await t.pump(const Duration(milliseconds: 300));
      expect(find.textContaining('remark is required'), findsOneWidget);
      verifyNever(
        () => repo.markAttendance(
          userId: any(named: 'userId'),
          date: any(named: 'date'),
          status: any(named: 'status'),
          remark: any(named: 'remark'),
          checkInTime: any(named: 'checkInTime'),
          checkOutTime: any(named: 'checkOutTime'),
        ),
      );
      await dispose(t);
    });

    testWidgets('saves status + remark', (t) async {
      when(
        () => repo.markAttendance(
          userId: any(named: 'userId'),
          date: any(named: 'date'),
          status: any(named: 'status'),
          remark: any(named: 'remark'),
          checkInTime: any(named: 'checkInTime'),
          checkOutTime: any(named: 'checkOutTime'),
        ),
      ).thenAnswer(
        (_) async => HrAttendanceDay.fromJson(
          hrAttendanceDayJson(status: 'ABSENT', source: 'MANUAL'),
        ),
      );
      await openSheet(t);
      await _tapVisible(t, find.text('Absent'));
      await t.pump(const Duration(milliseconds: 300));
      // Times are only offered for present / late / half-day.
      expect(find.text('TIMES (OPTIONAL)'), findsNothing);
      await t.enterText(
        find.byKey(const Key('hr-mark-remark')),
        'Did not report',
      );
      await _tapVisible(t, find.text('Save attendance'));
      await _anim(t);
      verify(
        () => repo.markAttendance(
          userId: 'u-vikram',
          date: '2026-11-20',
          status: DayStatus.absent,
          remark: 'Did not report',
        ),
      ).called(1);
      await dispose(t);
    });
  });

  group('HR overview', () {
    testWidgets('today tiles, approvals banner and payroll card', (t) async {
      when(() => repo.overview())
          .thenAnswer((_) async => HrOverview.fromJson(hrOverviewJson));
      await pumpApp(t, const HrOverviewScreen(), perms: _adminPerms);
      await settle(t);
      expect(find.text('Present'), findsWidgets);
      expect(find.text('Not marked yet'), findsOneWidget);
      expect(
        find.textContaining('3 leave requests need a decision'),
        findsOneWidget,
      );
      expect(find.text('Approvals'), findsWidgets);
      expect(find.text('Payroll'), findsWidgets);
      await t.scrollUntilVisible(
        find.text('Last 7 days'),
        400,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Last 7 days'), findsOneWidget);
      expect(t.takeException(), isNull);
      await dispose(t);
    });

    testWidgets('without payroll / leave keys those blocks are absent',
        (t) async {
      when(() => repo.overview()).thenAnswer(
        (_) async => HrOverview.fromJson({
          ...hrOverviewJson,
          'payroll': null,
          'upcomingLeaves': <dynamic>[],
        }),
      );
      await pumpApp(t, const HrOverviewScreen(), perms: const ['hr:view']);
      await settle(t);
      expect(find.textContaining('need a decision'), findsNothing);
      expect(find.text('Approvals'), findsNothing);
      expect(find.text('Team attendance'), findsWidgets);
      expect(find.text('Payroll'), findsNothing);
      await dispose(t);
    });
  });

  group('Payslips + payroll', () {
    testWidgets('payslip detail shows the formula, lines and net pay',
        (t) async {
      when(() => repo.myPayslip(any())).thenAnswer(
        (_) async => HrPayslip.fromJson(hrPayslipJson(status: 'PAID')),
      );
      await pumpApp(
        t,
        const PayslipDetailScreen(
          args: HrPayslipArgs(id: 'ps-2', month: '2026-11'),
        ),
      );
      await settle(t);
      expect(find.text('NET PAY'), findsOneWidget);
      await t.scrollUntilVisible(
        find.text('Travel allowance'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Travel allowance'), findsOneWidget);
      await t.scrollUntilVisible(
        find.text('Provident fund'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Provident fund'), findsOneWidget);
      await t.scrollUntilVisible(
        find.text('Download PDF'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Txn ref 123'), findsOneWidget);
      await dispose(t);
    });

    testWidgets('run screen: Pay buttons while approved, Pay all total',
        (t) async {
      when(() => repo.payrollRun(any())).thenAnswer(
        (_) async => HrPayrollRunDetail.fromJson({
          'run': hrRunJson(),
          'payslips': [
            hrPayslipJson(),
            {
              ...hrPayslipJson(status: 'PAID'),
              'id': 'ps-3',
              'employee': {...hrEmployeeRefJson, 'name': 'Asha Desk'},
            },
          ],
        }),
      );
      await pumpApp(
        t,
        const PayrollRunScreen(
          args: HrPayrollRunArgs(id: 'run-2', month: '2026-11'),
        ),
        perms: _adminPerms,
      );
      await settle(t);
      expect(find.text('November 2026'), findsWidgets);
      expect(find.text('Pay all 1 unpaid'), findsOneWidget);
      expect(find.byKey(const Key('pay-ps-2')), findsOneWidget);
      expect(find.byKey(const Key('pay-ps-3')), findsNothing);
      await dispose(t);
    });

    testWidgets('a draft run is read-only with a pointer to the web',
        (t) async {
      when(() => repo.payrollRun(any())).thenAnswer(
        (_) async => HrPayrollRunDetail.fromJson({
          'run': hrRunJson(status: 'DRAFT'),
          'payslips': [hrPayslipJson()],
        }),
      );
      await pumpApp(
        t,
        const PayrollRunScreen(
          args: HrPayrollRunArgs(id: 'run-2', month: '2026-11'),
        ),
        perms: _adminPerms,
      );
      await settle(t);
      expect(find.textContaining('still a draft'), findsOneWidget);
      expect(find.byKey(const Key('pay-ps-2')), findsNothing);
      await dispose(t);
    });

    testWidgets('marking a payslip paid collects the mode and calls the API',
        (t) async {
      when(() => repo.payrollRun(any())).thenAnswer(
        (_) async => HrPayrollRunDetail.fromJson({
          'run': hrRunJson(),
          'payslips': [hrPayslipJson()],
        }),
      );
      when(
        () => repo.payPayslip(
          any(),
          mode: any(named: 'mode'),
          paidOn: any(named: 'paidOn'),
          remark: any(named: 'remark'),
        ),
      ).thenAnswer(
        (_) async => HrPayslip.fromJson(hrPayslipJson(status: 'PAID')),
      );
      await pumpApp(
        t,
        const PayrollRunScreen(
          args: HrPayrollRunArgs(id: 'run-2', month: '2026-11'),
        ),
        perms: _adminPerms,
      );
      await settle(t);
      await t.tap(find.byKey(const Key('pay-ps-2')));
      await _anim(t);
      expect(find.text('PAYMENT MODE'), findsOneWidget);
      await _tapVisible(t, find.text('UPI'));
      await t.pump();
      await _tapVisible(t, find.text('Confirm payment'));
      await _anim(t);
      verify(
        () => repo.payPayslip(
          'ps-2',
          mode: PaymentMode.upi,
          paidOn: any(named: 'paidOn'),
          remark: any(named: 'remark'),
        ),
      ).called(1);
      await dispose(t);
    });
  });
}
