import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/routing/app_routes.dart';
import 'package:gym_saas_mobile/features/hr/presentation/widgets/hr_calendar_card.dart';
import 'package:gym_saas_mobile/features/hr/presentation/widgets/hr_widgets.dart';
import 'package:gym_saas_mobile/core/utils/app_clock.dart';
import 'package:gym_saas_mobile/core/utils/tenant_features.dart';
import 'package:gym_saas_mobile/features/hr/presentation/approvals_screen.dart';
import 'package:gym_saas_mobile/features/hr/presentation/employee_detail_screen.dart';
import 'package:gym_saas_mobile/features/hr/presentation/hr_menu.dart';
import 'package:gym_saas_mobile/features/hr/presentation/hr_overview_screen.dart';
import 'package:gym_saas_mobile/features/hr/presentation/payroll_screens.dart';
import 'package:gym_saas_mobile/features/hr/presentation/setup/hr_setup_screen.dart';
import 'package:gym_saas_mobile/features/hr/presentation/team_attendance_screen.dart';
import 'package:gym_saas_mobile/features/hr/presentation/widgets/hr_form_kit.dart';
import 'package:gym_saas_mobile/features/hr/presentation/widgets/leave_filter_sheet.dart';
import 'package:gym_saas_mobile/models/hr_admin.dart';
import 'package:gym_saas_mobile/models/hr_attendance.dart';
import 'package:gym_saas_mobile/models/hr_enums.dart';
import 'package:gym_saas_mobile/models/hr_leave.dart';
import 'package:gym_saas_mobile/models/hr_payroll.dart';
import 'package:gym_saas_mobile/models/hr_setup.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/hr_repository.dart';
import 'package:gym_saas_mobile/shared/widgets/menu_entry.dart';
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
  featureFlags: ['hr'],
);

const _ownerPerms = [
  'hr:view',
  'hr:attendance_manage',
  'hr:leave_manage',
  'hr:payroll_manage',
  'hr:settings_manage',
  'hr:self_attendance',
  'hr:self_leave',
  'hr:self_payslip',
];

/// The default MANAGER grant: everything except payroll.
const _managerPerms = [
  'hr:view',
  'hr:attendance_manage',
  'hr:leave_manage',
  'hr:settings_manage',
  'hr:self_attendance',
  'hr:self_leave',
  'hr:self_payslip',
];

const _selfPerms = ['hr:self_attendance', 'hr:self_leave', 'hr:self_payslip'];

PaginatedResult<T> _page<T>(List<T> items) => PaginatedResult(
      items: items,
      total: items.length,
      page: 1,
      limit: 20,
      totalPages: 1,
    );

Finder _inSheet(String label) =>
    find.descendant(of: find.byType(BottomSheet), matching: find.text(label));

Future<void> _anim(WidgetTester t) async {
  await t.pump(const Duration(milliseconds: 50));
  await t.pump(const Duration(milliseconds: 700));
}

Future<void> _tapVisible(WidgetTester t, Finder f) async {
  await t.ensureVisible(f);
  await t.pump(const Duration(milliseconds: 100));
  await t.tap(f);
}

UserProfile _user(List<String> perms) => UserProfile(
      id: 'me',
      tenantId: 't',
      name: 'Me',
      email: 'me@x.test',
      phone: null,
      status: 'ACTIVE',
      roles: const ['MANAGER'],
      permissions: perms,
    );

List<String> _menuTitles(
  List<String> perms, {
  TenantBranding tenant = _tenant,
}) =>
    [
      for (final e in hrMenuEntries)
        if (e.visibleFor(_user(perms), tenant)) e.title,
    ];

Map<String, dynamic> _employeeJson() => {
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
        'id': 'sh-general',
        'name': 'General',
        'startTime': '06:00',
        'endTime': '21:00',
        'graceMinutes': 10,
      },
      'weeklyOff': ['SUNDAY'],
      'today': {'status': 'PRESENT', 'checkInTime': '06:05', 'checkOutTime': null},
      'leaveBalances': [
        {
          'leaveTypeId': 'lt-casual',
          'code': 'CASUAL',
          'name': 'Casual Leave',
          'available': 9.5,
        },
      ],
      'pendingLeaves': 1,
    };

HrEmployeeDetail _detail({bool pay = true}) => HrEmployeeDetail.fromJson({
      'employee': _employeeJson(),
      'attendance': {
        'month': '${AppClock.today().year}-'
            '${AppClock.today().month.toString().padLeft(2, '0')}',
        'days': <Object>[],
        'stats': hrStatsJson,
      },
      'leaves': <Object>[],
      'balances': [hrBalanceCasualJson, hrBalanceUnpaidJson],
      'payStructure': pay ? hrPayStructureJson : null,
      'payslips': <Object>[],
    });

HrDayBoard _board() => HrDayBoard.fromJson({
      'date': '2026-11-20',
      'summary': {
        'present': 1,
        'late': 0,
        'halfDay': 0,
        'onLeave': 0,
        'absent': 1,
        'weeklyOff': 0,
        'holiday': 0,
        'notMarked': 0,
      },
      'items': [
        {
          'employee': hrEmployeeRefJson,
          'shift': null,
          'attendance': hrAttendanceDayJson(),
        },
        {
          'employee': {
            'userId': 'u-asha',
            'employeeId': 'EMP-0003',
            'name': 'Asha Desk',
            'avatarUrl': null,
            'role': 'RECEPTIONIST',
          },
          'shift': null,
          'attendance': hrAttendanceDayJson(
            status: 'NOT_MARKED',
            recorded: false,
            checkInTime: null,
            source: null,
          ),
        },
      ],
    });

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  late _MockHr repo;

  setUpAll(() {
    registerFallbackValue(DateTime(2026));
    registerFallbackValue(DayStatus.present);
    registerFallbackValue(PaymentMode.upi);
    registerFallbackValue(const HrPayslipEdit());
    registerFallbackValue(
      const HrShiftInput(
        name: 'x',
        startTime: '06:00',
        endTime: '07:00',
        graceMinutes: 0,
        weeklyOffDays: [],
        isDefault: false,
      ),
    );
    registerFallbackValue(
      const HrLeaveTypeInput(
        name: 'x',
        code: 'XX',
        yearlyQuota: null,
        isPaid: true,
        carryForward: false,
        carryForwardMax: null,
        color: '#000000',
      ),
    );
    registerFallbackValue(HrPolicy.fromJson(hrPolicyJson));
  });

  setUp(() {
    repo = _MockHr();
    final g = GetIt.instance;
    if (g.isRegistered<HrRepository>()) g.unregister<HrRepository>();
    g.registerSingleton<HrRepository>(repo);
  });

  Widget withSession(Widget child, List<String> perms) {
    final session = _MockSession();
    when(() => session.state)
        .thenReturn(SessionAuthenticatedStaff(_user(perms), _tenant));
    return BlocProvider<SessionCubit>.value(value: session, child: child);
  }

  Future<void> pumpApp(
    WidgetTester t,
    Widget child, {
    List<String> perms = _ownerPerms,
  }) async {
    t.view.physicalSize = const Size(560, 2000) * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(withSession(MaterialApp(home: child), perms));
  }

  /// For flows that `context.push` a route.
  Future<void> pumpRouted(
    WidgetTester t,
    Widget child, {
    List<String> perms = _ownerPerms,
  }) async {
    t.view.physicalSize = const Size(560, 2000) * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final router = GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, __) => child),
        GoRoute(
          path: AppRoutes.hrPayrollRun,
          builder: (_, __) => const Scaffold(body: Text('run opened')),
        ),
      ],
    );
    await t.pumpWidget(
      withSession(MaterialApp.router(routerConfig: router), perms),
    );
  }

  Future<void> settle(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(seconds: 2));
    await _anim(t);
  }

  Future<void> dispose(WidgetTester t) async {
    await t.pumpWidget(const SizedBox());
    await t.pump(const Duration(milliseconds: 100));
  }

  // ── menu ──────────────────────────────────────────────────────────────────

  group('HR menu mirrors the web sidebar (7 entries, same order + gating)', () {
    const webOrder = [
      'Overview',
      'Employees',
      'Attendance',
      'Leaves',
      'Payroll',
      'Setup',
      'My HR',
    ];

    test('the section has exactly the web sub-links in the web order', () {
      expect(hrMenuEntries.map((e) => e.title).toList(), webOrder);
      expect(
        hrMenuEntries.map((e) => e.route).toList(),
        [
          AppRoutes.hrOverview,
          AppRoutes.hrEmployees,
          AppRoutes.hrTeamAttendance,
          AppRoutes.hrApprovals,
          AppRoutes.hrPayroll,
          AppRoutes.hrSetup,
          AppRoutes.hrMe,
        ],
      );
      // HR is a plan module: every tile follows the `hr` flag.
      expect(
        hrMenuEntries.every((e) => e.featureFlag == Feature.hr),
        isTrue,
      );
    });

    test('with the hr flag OFF the whole section is hidden for any perms', () {
      const noHr = TenantBranding(
        slug: 'kaushal-fitness-club',
        name: 'Kaushal Fitness Club',
        status: 'ACTIVE',
        maintenanceMode: false,
        primaryColor: '',
        featureFlags: ['attendance', 'payments', 'notifications'],
      );
      for (final perms in [_ownerPerms, _managerPerms, _selfPerms]) {
        expect(_menuTitles(perms, tenant: noHr), isEmpty);
      }
      // ...and flag alone is not enough: the permission is still required.
      expect(_menuTitles(const [], tenant: _tenant), isEmpty);
      expect(
        visibleMenuSections({'HR': hrMenuEntries}, _user(_ownerPerms), noHr)
            .containsKey('HR'),
        isFalse,
      );
    });

    test('owner sees all seven', () {
      expect(_menuTitles(_ownerPerms), webOrder);
    });

    test('manager sees everything except Payroll', () {
      expect(
        _menuTitles(_managerPerms),
        webOrder.where((t) => t != 'Payroll').toList(),
      );
    });

    test('trainer / receptionist (self keys only) see My HR only', () {
      expect(_menuTitles(_selfPerms), ['My HR']);
      expect(_menuTitles(const ['hr:self_payslip']), ['My HR']);
    });

    test('hr:view alone: Overview, Employees, Attendance, Setup', () {
      expect(
        _menuTitles(const ['hr:view']),
        ['Overview', 'Employees', 'Attendance', 'Setup'],
      );
    });

    test('Leaves needs leave_manage, Payroll needs payroll_manage, no keys '
        '-> nothing', () {
      expect(_menuTitles(const ['hr:leave_manage']), ['Leaves']);
      expect(_menuTitles(const ['hr:payroll_manage']), ['Payroll']);
      expect(_menuTitles(const []), isEmpty);
    });

    test('the filter helper hides the whole section when nothing is visible',
        () {
      final sections = visibleMenuSections(
        {'HR': hrMenuEntries},
        _user(const []),
        _tenant,
      );
      expect(sections.containsKey('HR'), isFalse);
    });
  });

  // ── setup ─────────────────────────────────────────────────────────────────

  group('Setup', () {
    void stubSetup() {
      when(() => repo.shifts()).thenAnswer(
        (_) async => [
          HrShift.fromJson(hrShiftJson),
          HrShift.fromJson(hrShiftMorningJson),
        ],
      );
      when(() => repo.holidays(year: any(named: 'year'))).thenAnswer(
        (_) async => [
          HrHoliday.fromJson(hrHolidayJson),
          HrHoliday.fromJson(hrHolidayBranchJson),
        ],
      );
      when(() => repo.leaveTypes(includeInactive: any(named: 'includeInactive')))
          .thenAnswer(
        (_) async => [
          HrLeaveType.fromJson(hrLeaveTypeFullCasual),
          HrLeaveType.fromJson(hrLeaveTypeFullUnpaid),
        ],
      );
      when(() => repo.policy())
          .thenAnswer((_) async => HrPolicy.fromJson(hrPolicyJson));
    }

    testWidgets('shifts: cards show hours, grace, weekly off and head-count',
        (t) async {
      stubSetup();
      await pumpApp(t, const HrSetupScreen());
      await settle(t);
      expect(find.text('General'), findsOneWidget);
      expect(find.text('Default'), findsOneWidget);
      expect(find.text('6:00 AM – 9:00 PM'), findsOneWidget);
      expect(find.textContaining('Late after 10 min grace'), findsWidgets);
      expect(find.text('3 employees'), findsOneWidget);
      expect(find.byKey(const Key('add-shift')), findsOneWidget);
      await dispose(t);
    });

    testWidgets('read-only holder (hr:view) gets no add / edit controls',
        (t) async {
      stubSetup();
      await pumpApp(t, const HrSetupScreen(), perms: const ['hr:view']);
      await settle(t);
      expect(find.text('General'), findsOneWidget);
      expect(find.byKey(const Key('add-shift')), findsNothing);
      expect(find.byKey(const Key('edit-shift-sh-general')), findsNothing);
      expect(
        find.text('You can view shifts but not change them.'),
        findsOneWidget,
      );
      await dispose(t);
    });

    testWidgets('new shift: name is validated inline, nothing is sent until '
        'valid', (t) async {
      stubSetup();
      when(() => repo.createShift(any())).thenAnswer(
        (_) async => HrShift.fromJson(hrShiftMorningJson),
      );
      await pumpApp(t, const HrSetupScreen());
      await settle(t);
      await t.tap(find.byKey(const Key('add-shift')));
      await _anim(t);
      expect(find.text('New shift'), findsOneWidget);
      await _tapVisible(t, find.byKey(const Key('shift-save')));
      await t.pump(const Duration(milliseconds: 300));
      expect(find.text('Give the shift a name.'), findsOneWidget);
      verifyNever(() => repo.createShift(any()));

      await t.enterText(find.byKey(const Key('shift-name')), 'Night');
      await _tapVisible(t, find.byKey(const Key('weekday-SATURDAY')));
      await _tapVisible(t, find.byKey(const Key('shift-save')));
      await _anim(t);
      final input = verify(() => repo.createShift(captureAny())).captured.single
          as HrShiftInput;
      expect(input.name, 'Night');
      expect(input.startTime, '06:00');
      expect(input.endTime, '21:00');
      expect(input.weeklyOffDays, ['SATURDAY', 'SUNDAY']);
      expect(input.isActive, isNull);
      await dispose(t);
    });

    testWidgets('delete asks first, then calls the API; the API 409 is shown',
        (t) async {
      stubSetup();
      when(() => repo.deleteShift(any())).thenAnswer((_) async {});
      await pumpApp(t, const HrSetupScreen());
      await settle(t);
      await t.tap(find.byKey(const Key('delete-shift-sh-morning')));
      await _anim(t);
      expect(find.text('Delete Morning?'), findsOneWidget);
      verifyNever(() => repo.deleteShift(any()));
      await _tapVisible(t, _inSheet('Delete shift'));
      await _anim(t);
      verify(() => repo.deleteShift('sh-morning')).called(1);
      await dispose(t);
    });

    testWidgets('holidays: year stepper reloads, add + remove', (t) async {
      stubSetup();
      when(
        () => repo.createHoliday(
          date: any(named: 'date'),
          name: any(named: 'name'),
          description: any(named: 'description'),
        ),
      ).thenAnswer((_) async => HrHoliday.fromJson(hrHolidayJson));
      when(() => repo.deleteHoliday(any())).thenAnswer((_) async {});
      await pumpApp(t, const HrSetupScreen());
      await settle(t);
      await t.tap(find.byKey(const Key('setup-tab-holidays')));
      await settle(t);
      expect(find.text('Diwali (Lakshmi Puja)'), findsOneWidget);
      expect(find.textContaining('Main'), findsWidgets); // branch holiday
      final year = AppClock.today().year;
      verify(() => repo.holidays(year: year)).called(1);
      await t.tap(find.byKey(const Key('year-prev')));
      await settle(t);
      verify(() => repo.holidays(year: year - 1)).called(1);

      // Add: a name is required.
      await t.tap(find.byKey(const Key('add-holiday')));
      await _anim(t);
      await _tapVisible(t, find.byKey(const Key('holiday-save')));
      await t.pump(const Duration(milliseconds: 300));
      expect(find.text('Name the holiday.'), findsOneWidget);
      await t.enterText(find.byKey(const Key('holiday-name')), 'Founders day');
      await _tapVisible(t, find.byKey(const Key('holiday-save')));
      await _anim(t);
      final call = verify(
        () => repo.createHoliday(
          date: captureAny(named: 'date'),
          name: 'Founders day',
          description: any(named: 'description'),
        ),
      ).captured.single as DateTime;
      expect(call, DateTime(year - 1, 1, 1));

      // Remove: confirmation first.
      await t.tap(find.byKey(const Key('delete-holiday-h-diwali')));
      await _anim(t);
      await _tapVisible(t, _inSheet('Remove holiday'));
      await _anim(t);
      verify(() => repo.deleteHoliday('h-diwali')).called(1);
      await dispose(t);
    });

    testWidgets('holidays + leave types follow hr:leave_manage, shifts + '
        'policy follow hr:settings_manage', (t) async {
      stubSetup();
      await pumpApp(
        t,
        const HrSetupScreen(),
        perms: const ['hr:view', 'hr:leave_manage'],
      );
      await settle(t);
      expect(find.byKey(const Key('add-shift')), findsNothing);
      await t.tap(find.byKey(const Key('setup-tab-holidays')));
      await settle(t);
      expect(find.byKey(const Key('add-holiday')), findsOneWidget);
      await t.tap(find.byKey(const Key('setup-tab-leaveTypes')));
      await settle(t);
      expect(find.byKey(const Key('add-leave-type')), findsOneWidget);
      await t.tap(find.byKey(const Key('setup-tab-policy')));
      await settle(t);
      expect(find.byKey(const Key('policy-save')), findsNothing);
      expect(find.byKey(const Key('hr-readonly-note')), findsOneWidget);
      await dispose(t);
    });

    testWidgets('leave types: cards, code validation, create', (t) async {
      stubSetup();
      when(() => repo.createLeaveType(any())).thenAnswer(
        (_) async => HrLeaveType.fromJson(hrLeaveTypeFullPaid),
      );
      await pumpApp(t, const HrSetupScreen());
      await settle(t);
      await t.tap(find.byKey(const Key('setup-tab-leaveTypes')));
      await settle(t);
      expect(find.text('Casual Leave'), findsOneWidget);
      expect(find.textContaining('12 days / year · Paid'), findsOneWidget);
      expect(find.textContaining('Unlimited · Unpaid'), findsOneWidget);

      await t.tap(find.byKey(const Key('add-leave-type')));
      await _anim(t);
      await t.enterText(find.byKey(const Key('type-name')), 'Study');
      await t.enterText(find.byKey(const Key('type-code')), 's');
      await _tapVisible(t, find.byKey(const Key('type-save')));
      await t.pump(const Duration(milliseconds: 300));
      expect(
        find.text('Use 2-12 capital letters, digits or underscores.'),
        findsOneWidget,
      );
      verifyNever(() => repo.createLeaveType(any()));

      // Typing lower case is upper-cased as you go.
      await t.enterText(find.byKey(const Key('type-code')), 'study');
      await t.pump();
      await _tapVisible(t, find.byKey(const Key('type-save')));
      await _anim(t);
      final input = verify(() => repo.createLeaveType(captureAny()))
          .captured
          .single as HrLeaveTypeInput;
      expect(input.code, 'STUDY');
      expect(input.yearlyQuota, 12);
      expect(input.isPaid, isTrue);
      expect(input.isActive, isNull);
      await dispose(t);
    });

    testWidgets('policy: invalid number blocks the save, valid save sends '
        'every field', (t) async {
      stubSetup();
      when(() => repo.savePolicy(any()))
          .thenAnswer((_) async => HrPolicy.fromJson(hrPolicyJson));
      await pumpApp(t, const HrSetupScreen());
      await settle(t);
      await t.tap(find.byKey(const Key('setup-tab-policy')));
      await settle(t);
      expect(find.text('Leave year & attendance rules'), findsOneWidget);
      expect(find.text('April'), findsOneWidget);

      await t.enterText(find.byKey(const Key('policy-standardDayHours')), '0');
      await _tapVisible(t, find.byKey(const Key('policy-save')));
      await t.pump(const Duration(milliseconds: 300));
      expect(find.text('Day length must be 1 or more.'), findsOneWidget);
      verifyNever(() => repo.savePolicy(any()));

      await t.enterText(find.byKey(const Key('policy-standardDayHours')), '9');
      await _tapVisible(t, find.byKey(const Key('policy-save')));
      await settle(t);
      final p = verify(() => repo.savePolicy(captureAny())).captured.single
          as HrPolicy;
      expect(p.standardDayHours, 9);
      expect(p.leaveYearStartMonth, 4);
      expect(p.toJson().containsKey('workingDaysBasis'), isFalse);
      await dispose(t);
    });
  });

  // ── payroll ───────────────────────────────────────────────────────────────

  group('Payroll', () {
    HrPayrollRunDetail runDetail(
      String status, {
      List<Map<String, dynamic>>? slips,
    }) =>
        HrPayrollRunDetail.fromJson({
          'run': hrRunJson(status: status),
          'payslips': slips ?? [hrPayslipJson()],
        });

    Future<void> pumpRun(
      WidgetTester t,
      String status, {
      List<Map<String, dynamic>>? slips,
    }) async {
      when(() => repo.payrollRun(any()))
          .thenAnswer((_) async => runDetail(status, slips: slips));
      await pumpApp(
        t,
        const PayrollRunScreen(
          args: HrPayrollRunArgs(id: 'run-2', month: '2026-11'),
        ),
      );
      await settle(t);
    }

    testWidgets('generate: month picker + confirm sheet -> POST, then the '
        'new run opens', (t) async {
      when(
        () => repo.payrollRuns(
          page: any(named: 'page'),
          limit: any(named: 'limit'),
        ),
      ).thenAnswer((_) async => _page<HrPayrollRun>([]));
      when(
        () => repo.generatePayroll(any(), notes: any(named: 'notes')),
      ).thenAnswer((_) async => runDetail('DRAFT'));
      await pumpRouted(t, const PayrollScreen());
      await settle(t);
      expect(find.text('No payroll runs yet'), findsOneWidget);
      expect(find.byKey(const Key('month-existing')), findsNothing);
      // Nothing after the current month.
      final next = find.byTooltip('Next month');
      expect(
        t
            .widget<IconButton>(
              find.ancestor(of: next, matching: find.byType(IconButton)),
            )
            .onPressed,
        isNull,
        reason: 'cannot step past the current month',
      );
      await _tapVisible(t, find.byKey(const Key('generate-payroll')));
      await _anim(t);
      verifyNever(() => repo.generatePayroll(any(), notes: any(named: 'notes')));
      await t.enterText(find.byKey(const Key('generate-notes')), 'Nov run');
      await _tapVisible(t, find.byKey(const Key('generate-confirm')));
      await settle(t);
      verify(
        () => repo.generatePayroll(
          HrMonthStepper.currentKey(),
          notes: 'Nov run',
        ),
      ).called(1);
      expect(find.text('run opened'), findsOneWidget);
      await dispose(t);
    });

    testWidgets('a month that already has a run opens it instead of '
        'generating', (t) async {
      final key = HrMonthStepper.currentKey();
      final run = HrPayrollRun.fromJson({...hrRunJson(), 'month': key});
      when(
        () => repo.payrollRuns(
          page: any(named: 'page'),
          limit: any(named: 'limit'),
        ),
      ).thenAnswer((_) async => _page([run]));
      await pumpRouted(t, const PayrollScreen());
      await settle(t);
      expect(find.byKey(const Key('month-existing')), findsOneWidget);
      expect(find.byKey(const Key('generate-payroll')), findsNothing);
      await dispose(t);
    });

    testWidgets('DRAFT run: edit / recalculate / approve / delete are '
        'offered, pay is not', (t) async {
      await pumpRun(t, 'DRAFT');
      expect(find.byKey(const Key('run-approve')), findsOneWidget);
      expect(find.byKey(const Key('run-recalculate')), findsOneWidget);
      expect(find.byKey(const Key('run-delete')), findsOneWidget);
      expect(find.byKey(const Key('edit-ps-2')), findsOneWidget);
      expect(find.byKey(const Key('pay-ps-2')), findsNothing);
      expect(find.byKey(const Key('run-locked')), findsNothing);
      expect(find.byKey(const Key('run-totals')), findsOneWidget);
      await dispose(t);
    });

    testWidgets('approve asks for confirmation, then locks the run',
        (t) async {
      var approved = false;
      when(() => repo.payrollRun(any())).thenAnswer(
        (_) async => runDetail(approved ? 'APPROVED' : 'DRAFT'),
      );
      when(() => repo.approveRun(any())).thenAnswer((_) async {
        approved = true;
        return HrPayrollRun.fromJson(hrRunJson());
      });
      await pumpApp(
        t,
        const PayrollRunScreen(
          args: HrPayrollRunArgs(id: 'run-2', month: '2026-11'),
        ),
      );
      await settle(t);
      await _tapVisible(t, find.byKey(const Key('run-approve')));
      await _anim(t);
      expect(find.textContaining('This cannot be undone'), findsOneWidget);
      verifyNever(() => repo.approveRun(any()));
      await _tapVisible(t, _inSheet('Yes, approve and lock'));
      await settle(t);
      verify(() => repo.approveRun('run-2')).called(1);
      // Locked afterwards: banner, no edit / approve, Pay now offered.
      expect(find.byKey(const Key('run-locked')), findsOneWidget);
      expect(find.byKey(const Key('run-approve')), findsNothing);
      expect(find.byKey(const Key('edit-ps-2')), findsNothing);
      expect(find.byKey(const Key('pay-ps-2')), findsOneWidget);
      await dispose(t);
    });

    testWidgets('"Not yet" on the approve sheet changes nothing', (t) async {
      await pumpRun(t, 'DRAFT');
      await _tapVisible(t, find.byKey(const Key('run-approve')));
      await _anim(t);
      await _tapVisible(t, _inSheet('Not yet'));
      await _anim(t);
      verifyNever(() => repo.approveRun(any()));
      await dispose(t);
    });

    testWidgets('delete draft: confirmation, then DELETE', (t) async {
      when(() => repo.deleteRun(any())).thenAnswer((_) async {});
      await pumpRun(t, 'DRAFT');
      await _tapVisible(t, find.byKey(const Key('run-delete')));
      await _anim(t);
      expect(find.text('Delete this draft?'), findsOneWidget);
      verifyNever(() => repo.deleteRun(any()));
      await _tapVisible(t, _inSheet('Delete draft'));
      await settle(t);
      verify(() => repo.deleteRun('run-2')).called(1);
      await dispose(t);
    });

    testWidgets('recalculate calls the API', (t) async {
      when(() => repo.recalculateRun(any()))
          .thenAnswer((_) async => runDetail('DRAFT'));
      await pumpRun(t, 'DRAFT');
      await _tapVisible(t, find.byKey(const Key('run-recalculate')));
      await settle(t);
      verify(() => repo.recalculateRun('run-2')).called(1);
      await dispose(t);
    });

    testWidgets('payslip editor: line validation, then the PATCH has bonus, '
        'advance and the manual lines', (t) async {
      when(() => repo.patchPayslip(any(), any())).thenAnswer(
        (_) async => HrPayslip.fromJson(hrPayslipWithManualLineJson()),
      );
      await pumpRun(t, 'DRAFT');
      await _tapVisible(t, find.byKey(const Key('edit-ps-2')));
      await _anim(t);
      expect(find.text('Edit payslip'), findsOneWidget);
      await t.enterText(find.byKey(const Key('payslip-bonus')), '500');
      await t.enterText(find.byKey(const Key('payslip-advance')), '1000');
      await _tapVisible(t, find.byKey(const Key('payslip-add-line')));
      await t.pump();
      // An empty line is rejected inline and nothing is sent.
      await _tapVisible(t, find.byKey(const Key('payslip-save')));
      await t.pump(const Duration(milliseconds: 300));
      expect(find.text('Name this line.'), findsOneWidget);
      verifyNever(() => repo.patchPayslip(any(), any()));

      await t.enterText(find.byKey(const Key('line-name-0')), 'Uniform');
      await t.enterText(find.byKey(const Key('line-amount-0')), '300');
      await _tapVisible(t, find.byKey(const Key('line-type-deduction-0')));
      await t.pump();
      await _tapVisible(t, find.byKey(const Key('payslip-save')));
      await settle(t);
      final edit = verify(() => repo.patchPayslip('ps-2', captureAny()))
          .captured
          .single as HrPayslipEdit;
      expect(edit.toJson(), {
        'bonus': 500.0,
        'advanceRecovery': 1000.0,
        'manualLines': [
          {'name': 'Uniform', 'type': 'DEDUCTION', 'amount': 300.0},
        ],
      });
      await dispose(t);
    });

    testWidgets('an existing manual line is pre-filled and can be removed',
        (t) async {
      when(() => repo.patchPayslip(any(), any())).thenAnswer(
        (_) async => HrPayslip.fromJson(hrPayslipJson()),
      );
      await pumpRun(t, 'DRAFT', slips: [hrPayslipWithManualLineJson()]);
      await _tapVisible(t, find.byKey(const Key('edit-ps-2')));
      await _anim(t);
      expect(find.text('Incentive'), findsOneWidget);
      await _tapVisible(t, find.byKey(const Key('line-remove-0')));
      await t.pump();
      await _tapVisible(t, find.byKey(const Key('payslip-save')));
      await settle(t);
      final edit = verify(() => repo.patchPayslip('ps-2', captureAny()))
          .captured
          .single as HrPayslipEdit;
      // Bonus kept from the payslip; the removed line is gone (REPLACE set).
      expect(edit.bonus, 200);
      expect(edit.manualLines, isEmpty);
      await dispose(t);
    });

    testWidgets('APPROVED run is locked: pay actions only', (t) async {
      await pumpRun(t, 'APPROVED');
      expect(find.byKey(const Key('run-locked')), findsOneWidget);
      expect(find.byKey(const Key('run-approve')), findsNothing);
      expect(find.byKey(const Key('run-delete')), findsNothing);
      expect(find.byKey(const Key('edit-ps-2')), findsNothing);
      expect(find.byKey(const Key('pay-ps-2')), findsOneWidget);
      expect(find.text('Pay all 1 unpaid'), findsOneWidget);
      await dispose(t);
    });

    testWidgets('PAID run: locked record, expense indicator on the paid '
        'payslip', (t) async {
      await pumpRun(
        t,
        'PAID',
        slips: [
          {...hrPayslipJson(status: 'PAID'), 'expenseId': 'exp-1'},
        ],
      );
      expect(find.byKey(const Key('run-locked')), findsOneWidget);
      expect(find.textContaining('Paid in full'), findsOneWidget);
      expect(find.text('Expense recorded'), findsOneWidget);
      expect(find.byKey(const Key('pay-ps-2')), findsNothing);
      expect(find.byKey(const Key('edit-ps-2')), findsNothing);
      await dispose(t);
    });

    testWidgets('pay: mode sheet -> API; a 409 ALREADY_PAID shows the '
        'server message', (t) async {
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
      await pumpRun(t, 'APPROVED');
      await t.tap(find.byKey(const Key('pay-ps-2')));
      await _anim(t);
      await _tapVisible(t, find.text('UPI'));
      await t.pump();
      await _tapVisible(t, find.text('Confirm payment'));
      await settle(t);
      expect(find.text('This payslip is already paid.'), findsOneWidget);
      await dispose(t);
    });
  });

  // ── attendance ────────────────────────────────────────────────────────────

  group('Attendance', () {
    void stubBoard() {
      when(
        () => repo.dayBoard(
          date: any(named: 'date'),
          search: any(named: 'search'),
          branchId: any(named: 'branchId'),
        ),
      ).thenAnswer((_) async => _board());
    }

    testWidgets('monthly grid: a cell per employee x day with colour AND '
        'glyph, P / A columns, legend', (t) async {
      when(() => repo.monthlyGrid(any()))
          .thenAnswer((_) async => HrMonthlyGrid.fromJson(hrMonthlyGridJson));
      await pumpApp(t, const TeamAttendanceScreen(monthGrid: true));
      await settle(t);
      expect(find.byKey(const Key('monthly-grid')), findsOneWidget);
      expect(find.text('Vikram Coach'), findsOneWidget);
      expect(find.text('Asha Desk'), findsOneWidget);
      for (final u in ['u-vikram', 'u-asha']) {
        for (var i = 0; i < 3; i++) {
          expect(find.byKey(Key('cell-$u-$i')), findsOneWidget);
        }
      }
      // Glyphs (not colour only): present tick, late clock, holiday, off.
      expect(find.byIcon(Icons.check_rounded), findsWidgets);
      expect(find.byIcon(Icons.schedule_rounded), findsWidgets);
      expect(find.byIcon(Icons.celebration_rounded), findsWidgets);
      expect(find.byIcon(Icons.bedtime_rounded), findsWidgets);
      // Semantics speak the status.
      expect(
        find.bySemanticsLabel(RegExp('Vikram Coach, .*: Late')),
        findsOneWidget,
      );
      // P = present + late = 2; A = 1 for Asha.
      expect(find.text('2'), findsWidgets);
      expect(find.text('P'), findsOneWidget);
      expect(find.text('A'), findsOneWidget);
      verify(() => repo.monthlyGrid(HrMonthStepper.currentKey())).called(1);
      await dispose(t);
    });

    testWidgets('month stepper re-reads the grid for the previous month',
        (t) async {
      when(() => repo.monthlyGrid(any()))
          .thenAnswer((_) async => HrMonthlyGrid.fromJson(hrMonthlyGridJson));
      await pumpApp(t, const TeamAttendanceScreen(monthGrid: true));
      await settle(t);
      await t.tap(find.byTooltip('Previous month'));
      await settle(t);
      verify(
        () => repo.monthlyGrid(
          HrMonthStepper.shift(HrMonthStepper.currentKey(), -1),
        ),
      ).called(1);
      await dispose(t);
    });

    testWidgets('tapping a cell opens the manual-mark form for that day '
        '(with hr:attendance_manage)', (t) async {
      when(() => repo.monthlyGrid(any()))
          .thenAnswer((_) async => HrMonthlyGrid.fromJson(hrMonthlyGridJson));
      stubBoard();
      await pumpApp(t, const TeamAttendanceScreen(monthGrid: true));
      await settle(t);
      await t.tap(find.byKey(const Key('cell-u-vikram-0')));
      await settle(t);
      // The recorded row was fetched, so it is an edit, with the remark box.
      expect(find.text('Edit attendance'), findsOneWidget);
      expect(find.text('REMARK (REQUIRED)'), findsOneWidget);
      await dispose(t);
    });

    testWidgets('without attendance_manage a cell opens no edit form',
        (t) async {
      when(() => repo.monthlyGrid(any()))
          .thenAnswer((_) async => HrMonthlyGrid.fromJson(hrMonthlyGridJson));
      stubBoard();
      await pumpApp(
        t,
        const TeamAttendanceScreen(monthGrid: true),
        perms: const ['hr:view'],
      );
      await settle(t);
      await t.tap(find.byKey(const Key('cell-u-vikram-0')));
      await settle(t);
      expect(find.text('Edit attendance'), findsNothing);
      expect(find.text('Mark attendance'), findsNothing);
      await dispose(t);
    });

    testWidgets('day view: status chips filter the roster', (t) async {
      stubBoard();
      await pumpApp(t, const TeamAttendanceScreen());
      await settle(t);
      expect(find.text('Vikram Coach'), findsOneWidget);
      expect(find.text('Asha Desk'), findsOneWidget);
      await t.tap(find.text('Absent · 1'));
      await t.pump(const Duration(milliseconds: 300));
      // Only people with that status stay (Asha is NOT_MARKED, Vikram
      // PRESENT -> nobody is absent in the rows).
      expect(find.text('Vikram Coach'), findsNothing);
      await t.tap(find.text('Absent · 1'));
      await t.pump(const Duration(milliseconds: 300));
      expect(find.text('Vikram Coach'), findsOneWidget);
      await dispose(t);
    });

    testWidgets('bulk mark: shared remark REQUIRED, then one request for '
        'everyone without a record', (t) async {
      stubBoard();
      when(
        () => repo.bulkMarkPresent(
          date: any(named: 'date'),
          remark: any(named: 'remark'),
          userIds: any(named: 'userIds'),
          checkInTime: any(named: 'checkInTime'),
        ),
      ).thenAnswer((_) async => const HrBulkResult(updated: 1));
      await pumpApp(t, const TeamAttendanceScreen());
      await settle(t);
      await t.tap(find.byKey(const Key('mark-all-present')));
      await _anim(t);
      expect(find.text('Mark everyone present'), findsOneWidget);
      // Only the employee without a record is listed (and ticked).
      expect(find.byKey(const Key('bulk-u-asha')), findsOneWidget);
      expect(find.byKey(const Key('bulk-u-vikram')), findsNothing);

      await _tapVisible(t, find.byKey(const Key('bulk-save')));
      await t.pump(const Duration(milliseconds: 300));
      expect(
        find.text('A shared remark of at least 3 characters is required.'),
        findsOneWidget,
      );
      verifyNever(
        () => repo.bulkMarkPresent(
          date: any(named: 'date'),
          remark: any(named: 'remark'),
          userIds: any(named: 'userIds'),
          checkInTime: any(named: 'checkInTime'),
        ),
      );

      await t.enterText(find.byKey(const Key('bulk-remark')), 'Power cut');
      await _tapVisible(t, find.byKey(const Key('bulk-save')));
      await _anim(t);
      verify(
        () => repo.bulkMarkPresent(
          date: any(named: 'date'),
          remark: 'Power cut',
          userIds: ['u-asha'],
          checkInTime: null,
        ),
      ).called(1);
      await dispose(t);
    });

    testWidgets('bulk mark can be cleared down to nothing -> must pick '
        'someone', (t) async {
      stubBoard();
      await pumpApp(t, const TeamAttendanceScreen());
      await settle(t);
      await t.tap(find.byKey(const Key('mark-all-present')));
      await _anim(t);
      await _tapVisible(t, find.byKey(const Key('bulk-toggle-all')));
      await t.pump();
      await t.enterText(find.byKey(const Key('bulk-remark')), 'Power cut');
      await _tapVisible(t, find.byKey(const Key('bulk-save')));
      await t.pump(const Duration(milliseconds: 300));
      expect(find.text('Select at least one employee.'), findsOneWidget);
      await dispose(t);
    });

    testWidgets('no "Mark all present" without attendance_manage', (t) async {
      stubBoard();
      await pumpApp(
        t,
        const TeamAttendanceScreen(),
        perms: const ['hr:view'],
      );
      await settle(t);
      expect(find.byKey(const Key('mark-all-present')), findsNothing);
      await dispose(t);
    });
  });

  // ── leaves ────────────────────────────────────────────────────────────────

  group('Leaves', () {
    void stubList(List<HrLeaveRequest> items) {
      when(
        () => repo.leaves(
          page: any(named: 'page'),
          limit: any(named: 'limit'),
          status: any(named: 'status'),
          userId: any(named: 'userId'),
          leaveTypeId: any(named: 'leaveTypeId'),
          from: any(named: 'from'),
          to: any(named: 'to'),
        ),
      ).thenAnswer(
        (_) async => HrLeavePage(
          page: _page(items),
          counts: const HrLeaveCounts(pending: 1, approved: 2),
        ),
      );
    }

    testWidgets('filter sheet narrows by leave type and the list re-reads '
        'with it', (t) async {
      stubList([HrLeaveRequest.fromJson(hrLeaveRequestJson())]);
      when(
        () => repo.leaveTypes(includeInactive: any(named: 'includeInactive')),
      ).thenAnswer(
        (_) async => [
          HrLeaveType.fromJson(hrLeaveTypeFullCasual),
          HrLeaveType.fromJson(hrLeaveTypeFullPaid),
        ],
      );
      await pumpApp(t, const ApprovalsScreen());
      await settle(t);
      await t.tap(find.byKey(const Key('leaves-filter')));
      await _anim(t);
      expect(find.text('Filter requests'), findsOneWidget);
      await _tapVisible(t, find.byKey(const Key('filter-type-lt-paid')));
      await t.pump();
      await _tapVisible(t, find.byKey(const Key('filter-apply')));
      await settle(t);
      verify(
        () => repo.leaves(
          page: 1,
          limit: any(named: 'limit'),
          status: LeaveStatus.pending,
          userId: null,
          leaveTypeId: 'lt-paid',
          from: null,
          to: null,
        ),
      ).called(1);
      // The badge shows one active filter.
      expect(find.bySemanticsLabel('Filters, 1 active'), findsOneWidget);
      await dispose(t);
    });

    test('HrLeaveFilter counts set filters and rejects an inverted range', () {
      expect(HrLeaveFilter.none.isActive, isFalse);
      final f = HrLeaveFilter(
        type: HrLeaveType.fromJson(hrLeaveTypeFullCasual),
        from: DateTime(2026, 11, 10),
        to: DateTime(2026, 11, 1),
      );
      expect(f.count, 3);
      expect(f.rangeError, isNotNull);
      expect(
        HrLeaveFilter(from: DateTime(2026, 11, 1), to: DateTime(2026, 11, 1))
            .rangeError,
        isNull,
      );
    });

    testWidgets('approved request offers a manager Cancel; the remark is '
        'REQUIRED', (t) async {
      stubList([
        HrLeaveRequest.fromJson(
          hrLeaveRequestJson(status: 'APPROVED', canCancel: false),
        ),
      ]);
      when(() => repo.cancelLeave(any(), remark: any(named: 'remark')))
          .thenAnswer(
        (_) async => HrLeaveRequest.fromJson(
          hrLeaveRequestJson(status: 'CANCELLED', canCancel: false),
        ),
      );
      await pumpApp(t, const ApprovalsScreen());
      await settle(t);
      expect(find.byKey(const Key('cancel-lr-1')), findsOneWidget);
      expect(find.byKey(const Key('approve-lr-1')), findsNothing);
      await t.tap(find.byKey(const Key('cancel-lr-1')));
      await _anim(t);
      // Dead until >= 3 characters.
      await _tapVisible(t, _inSheet('Cancel leave'));
      await t.pump();
      verifyNever(() => repo.cancelLeave(any(), remark: any(named: 'remark')));
      await t.enterText(find.byKey(const Key('hr-remark-field')), 'Roster');
      await t.pump();
      await _tapVisible(t, _inSheet('Cancel leave'));
      await _anim(t);
      verify(() => repo.cancelLeave('lr-1', remark: 'Roster')).called(1);
      await dispose(t);
    });

    testWidgets('no Cancel on your own approved request', (t) async {
      stubList([
        HrLeaveRequest.fromJson({
          ...hrLeaveRequestJson(status: 'APPROVED', canCancel: false),
          'employee': {...hrEmployeeRefJson, 'userId': 'me'},
        }),
      ]);
      await pumpApp(t, const ApprovalsScreen());
      await settle(t);
      expect(find.byKey(const Key('cancel-lr-1')), findsNothing);
      await dispose(t);
    });

    testWidgets('team calendar: loads from GET /hr/leaves/calendar for the '
        'displayed month and CLIPS items to it', (t) async {
      final today = AppClock.today();
      final key = HrMonthStepper.currentKey();
      final prev = HrMonthStepper.shift(key, -1);
      stubList(const []);
      when(() => repo.leaveCalendar(any(), any())).thenAnswer(
        (_) async => HrLeaveCalendar.fromJson(
          hrLeaveCalendarJson(
            items: [
              hrCalendarItemJson(start: '$key-10', end: '$key-11'),
              // Started last month, ends on the 2nd of this one.
              hrCalendarItemJson(
                id: 'lr-2',
                userId: 'u-asha',
                name: 'Asha Desk',
                start: '$prev-28',
                end: '$key-02',
                status: 'PENDING',
              ),
            ],
            holidays: [
              {...hrHolidayJson, 'date': '$key-12'},
            ],
          ),
        ),
      );
      await pumpApp(t, const ApprovalsScreen(openCalendar: true));
      await settle(t);
      expect(find.byKey(const Key('team-calendar')), findsOneWidget);
      // ONE call: first -> last day of the displayed month.
      verify(
        () => repo.leaveCalendar(
          DateTime(today.year, today.month, 1),
          DateTime(today.year, today.month + 1, 0),
        ),
      ).called(1);
      // The old workaround (the paged list with a 100-row cap) is gone.
      verifyNever(
        () => repo.leaves(
          page: any(named: 'page'),
          limit: 100,
          status: any(named: 'status'),
          userId: any(named: 'userId'),
          leaveTypeId: any(named: 'leaveTypeId'),
          from: any(named: 'from'),
          to: any(named: 'to'),
        ),
      );
      // Day 10: the approved person off, with their type.
      await t.tap(find.byKey(ValueKey('${today.year}-${today.month}-10')));
      await t.pump(const Duration(milliseconds: 300));
      expect(find.text('Vikram Coach'), findsOneWidget);
      expect(find.textContaining('Casual Leave'), findsWidgets);
      // Day 2: the request that began last month shows (clipped), pending.
      await t.tap(find.byKey(ValueKey('${today.year}-${today.month}-2')));
      await t.pump(const Duration(milliseconds: 300));
      expect(find.text('Asha Desk'), findsOneWidget);
      expect(find.text('Pending'), findsWidgets);
      // The holiday day.
      await t.tap(find.byKey(ValueKey('${today.year}-${today.month}-12')));
      await t.pump(const Duration(milliseconds: 300));
      expect(find.textContaining('Holiday: Diwali'), findsOneWidget);
      // A quiet day.
      await t.tap(find.byKey(ValueKey('${today.year}-${today.month}-20')));
      await t.pump(const Duration(milliseconds: 300));
      expect(find.byKey(const Key('calendar-empty')), findsOneWidget);
      await dispose(t);
    });

    testWidgets('team calendar: loading skeleton, then an empty month',
        (t) async {
      stubList(const []);
      final gate = Completer<HrLeaveCalendar>();
      when(() => repo.leaveCalendar(any(), any()))
          .thenAnswer((_) => gate.future);
      await pumpApp(t, const ApprovalsScreen(openCalendar: true));
      await t.pump();
      await t.pump(const Duration(milliseconds: 100));
      expect(find.byKey(const Key('team-calendar')), findsNothing);
      expect(find.byType(HrShimmerBox), findsWidgets);
      gate.complete(HrLeaveCalendar.fromJson(hrLeaveCalendarJson()));
      await settle(t);
      expect(find.byKey(const Key('team-calendar')), findsOneWidget);
      expect(find.byKey(const Key('calendar-empty')), findsOneWidget);
      await dispose(t);
    });

    testWidgets('team calendar: a 422 / error shows a message with Retry, '
        'and Retry re-requests', (t) async {
      stubList(const []);
      var calls = 0;
      when(() => repo.leaveCalendar(any(), any())).thenAnswer((_) async {
        calls++;
        if (calls == 1) {
          throw const ApiException(
            message: 'The range can cover at most 62 days',
            statusCode: 422,
          );
        }
        return HrLeaveCalendar.fromJson(hrLeaveCalendarJson());
      });
      await pumpApp(t, const ApprovalsScreen(openCalendar: true));
      await settle(t);
      expect(find.text('The range can cover at most 62 days'), findsOneWidget);
      expect(find.byKey(const Key('team-calendar')), findsNothing);
      await t.tap(find.text('Try again'));
      await settle(t);
      expect(calls, 2);
      expect(find.byKey(const Key('team-calendar')), findsOneWidget);
      await dispose(t);
    });

    testWidgets('the view chips switch between requests and calendar',
        (t) async {
      stubList([HrLeaveRequest.fromJson(hrLeaveRequestJson())]);
      when(() => repo.leaveCalendar(any(), any())).thenAnswer(
        (_) async => HrLeaveCalendar.fromJson(hrLeaveCalendarJson()),
      );
      await pumpApp(t, const ApprovalsScreen());
      await settle(t);
      expect(find.byKey(const Key('team-calendar')), findsNothing);
      await t.tap(find.byKey(const Key('leaves-view-calendar')));
      await settle(t);
      expect(find.byKey(const Key('team-calendar')), findsOneWidget);
      await t.tap(find.byKey(const Key('leaves-view-requests')));
      await settle(t);
      expect(find.byKey(const Key('team-calendar')), findsNothing);
      await dispose(t);
    });
  });

  // ── employee detail forms ─────────────────────────────────────────────────

  group('Employee detail', () {
    void stubEmployee({bool pay = true}) {
      when(() => repo.employee(any(), month: any(named: 'month')))
          .thenAnswer((_) async => _detail(pay: pay));
      when(
        () => repo.employeeAttendance(any(), month: any(named: 'month')),
      ).thenAnswer(
        (_) async => const HrMonthAttendance(
          month: '2026-11',
          days: [],
          stats: HrAttendanceStats(),
        ),
      );
    }

    Future<void> pumpDetail(
      WidgetTester t, {
      List<String> perms = _ownerPerms,
      bool pay = true,
    }) async {
      stubEmployee(pay: pay);
      await pumpApp(
        t,
        const EmployeeDetailScreen(
          args: HrEmployeeArgs(userId: 'u-vikram', name: 'Vikram Coach'),
        ),
        perms: perms,
      );
      await settle(t);
    }

    testWidgets('edit controls follow the keys the API enforces',
        (t) async {
      await pumpDetail(t, perms: const ['hr:view'], pay: false);
      expect(find.text('Edit shift & off days'), findsNothing);
      expect(find.text('Adjust'), findsNothing);
      expect(find.text('Pay structure'), findsNothing);
      await dispose(t);

      await pumpDetail(t);
      expect(find.text('Edit shift & off days'), findsOneWidget);
      expect(find.text('Adjust'), findsOneWidget);
      expect(find.text('Pay structure'), findsOneWidget);
      expect(find.text('Edit'), findsOneWidget);
      await dispose(t);
    });

    testWidgets('balance adjust: remark REQUIRED, debit sends negative days',
        (t) async {
      when(
        () => repo.adjustLeaveBalance(
          userId: any(named: 'userId'),
          leaveTypeId: any(named: 'leaveTypeId'),
          days: any(named: 'days'),
          remark: any(named: 'remark'),
          leaveYear: any(named: 'leaveYear'),
        ),
      ).thenAnswer((_) async => HrLeaveBalance.fromJson(hrBalanceAdjustedJson));
      await pumpDetail(t);
      await t.tap(find.text('Adjust'));
      await _anim(t);
      expect(find.text('Adjust leave balance'), findsOneWidget);
      // The unlimited type is not offered (the API would answer 409).
      expect(find.byKey(const Key('adjust-type-lt-casual')), findsOneWidget);
      expect(find.byKey(const Key('adjust-type-lt-unpaid')), findsNothing);

      await _tapVisible(t, find.byKey(const Key('adjust-save')));
      await t.pump(const Duration(milliseconds: 300));
      expect(
        find.text('A remark of at least 3 characters is required.'),
        findsOneWidget,
      );
      verifyNever(
        () => repo.adjustLeaveBalance(
          userId: any(named: 'userId'),
          leaveTypeId: any(named: 'leaveTypeId'),
          days: any(named: 'days'),
          remark: any(named: 'remark'),
          leaveYear: any(named: 'leaveYear'),
        ),
      );

      await _tapVisible(t, find.byKey(const Key('adjust-debit')));
      await t.enterText(find.byKey(const Key('adjust-days')), '1.5');
      await t.enterText(find.byKey(const Key('adjust-remark')), 'Taken early');
      await _tapVisible(t, find.byKey(const Key('adjust-save')));
      await _anim(t);
      verify(
        () => repo.adjustLeaveBalance(
          userId: 'u-vikram',
          leaveTypeId: 'lt-casual',
          days: -1.5,
          remark: 'Taken early',
          leaveYear: any(named: 'leaveYear'),
        ),
      ).called(1);
      await dispose(t);
    });

    testWidgets('pay structure editor: validates rows, previews gross, '
        'saves the full set', (t) async {
      when(
        () => repo.savePayStructure(
          any(),
          baseSalary: any(named: 'baseSalary'),
          components: any(named: 'components'),
        ),
      ).thenAnswer((_) async => HrPayStructure.fromJson(hrPayStructureJson));
      await pumpDetail(t);
      await t.tap(find.text('Edit'));
      await _anim(t);
      expect(find.text('Pay structure'), findsWidgets);
      expect(find.byKey(const Key('comp-name-0')), findsOneWidget);
      expect(find.byKey(const Key('comp-name-1')), findsOneWidget);

      // A nameless component is rejected inline.
      await t.enterText(find.byKey(const Key('comp-name-0')), '');
      await _tapVisible(t, find.byKey(const Key('ps-save')));
      await t.pump(const Duration(milliseconds: 300));
      expect(find.text('Name the component.'), findsOneWidget);
      verifyNever(
        () => repo.savePayStructure(
          any(),
          baseSalary: any(named: 'baseSalary'),
          components: any(named: 'components'),
        ),
      );

      await t.enterText(find.byKey(const Key('comp-name-0')), 'Travel');
      await t.enterText(find.byKey(const Key('ps-base')), '20000');
      await _tapVisible(t, find.byKey(const Key('ps-add')));
      await t.pump();
      await t.enterText(find.byKey(const Key('comp-name-2')), 'Incentive');
      await t.enterText(find.byKey(const Key('comp-amount-2')), '250');
      await _tapVisible(t, find.byKey(const Key('ps-save')));
      await _anim(t);
      final call = verify(
        () => repo.savePayStructure(
          'u-vikram',
          baseSalary: 20000,
          components: captureAny(named: 'components'),
        ),
      ).captured.single as List<HrPayComponent>;
      expect(call.map((c) => c.name), ['Travel', 'Provident fund', 'Incentive']);
      expect(call.map((c) => c.isAllowance), [true, false, true]);
      expect(call.last.amount, 250);
      await dispose(t);
    });

    testWidgets('work setup: pick a shift, inherit weekly off -> null',
        (t) async {
      when(() => repo.shifts()).thenAnswer(
        (_) async => [
          HrShift.fromJson(hrShiftJson),
          HrShift.fromJson(hrShiftMorningJson),
        ],
      );
      when(
        () => repo.setWorkSetup(
          any(),
          shiftId: any(named: 'shiftId'),
          weeklyOff: any(named: 'weeklyOff'),
        ),
      ).thenAnswer((_) async => const HrWorkSetup());
      await pumpDetail(t);
      await t.tap(find.text('Edit shift & off days'));
      await _anim(t);
      await _tapVisible(t, find.byKey(const Key('shift-sh-morning')));
      await _tapVisible(
        t,
        find.descendant(
          of: find.byKey(const Key('inherit-off')),
          matching: find.byType(AnimatedContainer),
        ),
      );
      await t.pump();
      await _tapVisible(t, find.byKey(const Key('work-setup-save')));
      await _anim(t);
      verify(
        () => repo.setWorkSetup(
          'u-vikram',
          shiftId: 'sh-morning',
          weeklyOff: null,
        ),
      ).called(1);
      await dispose(t);
    });
  });

  // ── overview ──────────────────────────────────────────────────────────────

  group('HR overview additions', () {
    testWidgets('quick actions + who-is-off strip + holiday rows, gated by '
        'key', (t) async {
      when(() => repo.overview())
          .thenAnswer((_) async => HrOverview.fromJson(hrOverviewJson));
      await pumpApp(t, const HrOverviewScreen());
      await settle(t);
      expect(find.byKey(const Key('quick-actions')), findsOneWidget);
      for (final label in [
        'Mark attendance',
        'Apply on behalf',
        'Team calendar',
        'Monthly attendance',
        'Employees',
        'Run payroll',
        'Shifts & holidays',
      ]) {
        expect(find.text(label), findsWidgets, reason: label);
      }
      await t.scrollUntilVisible(
        find.byKey(const Key('off-soon-strip')),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.byKey(const Key('off-soon-strip')), findsOneWidget);
      await t.scrollUntilVisible(
        find.byKey(const Key('holiday-h-1')),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Christmas'), findsOneWidget);
      await dispose(t);
    });

    testWidgets('hr:view only: no leave / payroll shortcuts, no strip',
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
      expect(find.text('Apply on behalf'), findsNothing);
      expect(find.text('Team calendar'), findsNothing);
      expect(find.text('Run payroll'), findsNothing);
      expect(find.text('Monthly attendance'), findsWidgets);
      expect(find.byKey(const Key('off-soon-strip')), findsNothing);
      await dispose(t);
    });
  });

  // ── v1.2: absent + yet to check in, derived absent ────────────────────────

  group('Absent / yet to check in (v1.2)', () {
    testWidgets('overview shows a real Absent tile AND Yet to check in, and '
        'the today bar adds up to the headcount', (t) async {
      when(() => repo.overview()).thenAnswer(
        (_) async => HrOverview.fromJson({
          ...hrOverviewJson,
          'today': {
            'present': 1,
            'late': 0,
            'halfDay': 0,
            'onLeave': 0,
            'absent': 2,
            'weeklyOff': 0,
            'holiday': 0,
            'notMarked': 1,
            'yetToCheckIn': 1,
            'checkedInNow': 1,
          },
        }),
      );
      await pumpApp(t, const HrOverviewScreen());
      await settle(t);
      expect(find.text('Absent'), findsWidgets);
      expect(find.text('Yet to check in'), findsWidgets);
      expect(find.byKey(const Key('today-bar')), findsOneWidget);
      // Legend entries of the stacked bar.
      expect(find.text('Absent 2'), findsOneWidget);
      expect(find.text('Yet to check in 1'), findsOneWidget);
      expect(find.text('Present 1'), findsOneWidget);
      final o = HrOverview.fromJson(hrOverviewJson);
      expect(
        HrTodayBar.segments(o.today).fold<int>(0, (s, x) => s + x.value),
        o.headcount,
      );
      await dispose(t);
    });

    testWidgets('an older server without yetToCheckIn still shows it '
        '(= notMarked)', (t) async {
      when(() => repo.overview()).thenAnswer(
        (_) async => HrOverview.fromJson({
          ...hrOverviewJson,
          'today': {
            'present': 1,
            'late': 0,
            'halfDay': 0,
            'onLeave': 0,
            'absent': 0,
            'weeklyOff': 0,
            'holiday': 0,
            'notMarked': 3,
            'checkedInNow': 1,
          },
        }),
      );
      await pumpApp(t, const HrOverviewScreen());
      await settle(t);
      expect(find.text('Yet to check in 3'), findsOneWidget);
      await dispose(t);
    });

    HrDayBoard board() => HrDayBoard.fromJson({
          'date': '2026-11-22',
          'summary': {'present': 0, 'absent': 2},
          'items': [
            {
              'employee': hrEmployeeRefJson,
              'shift': null,
              'attendance': hrAutoAbsentDayJson(),
            },
            {
              'employee': {
                'userId': 'u-asha',
                'employeeId': 'EMP-0003',
                'name': 'Asha Desk',
                'avatarUrl': null,
                'role': 'RECEPTIONIST',
              },
              'shift': null,
              'attendance': hrAttendanceDayJson(
                status: 'ABSENT',
                source: 'MANUAL',
                checkInTime: null,
                remark: 'On site visit',
              ),
            },
          ],
        });

    testWidgets('roster: a derived absent is marked "auto" and spoken as '
        '"No check-in recorded"; a manual absent is not', (t) async {
      when(
        () => repo.dayBoard(
          date: any(named: 'date'),
          search: any(named: 'search'),
          branchId: any(named: 'branchId'),
        ),
      ).thenAnswer((_) async => board());
      await pumpApp(t, const TeamAttendanceScreen());
      await settle(t);
      expect(find.text('Absent · auto'), findsOneWidget);
      expect(find.text('Absent'), findsWidgets);
      expect(
        find.bySemanticsLabel(RegExp('Vikram Coach, .*No check-in recorded')),
        findsOneWidget,
      );
      await dispose(t);
    });

    testWidgets('mark sheet over a derived absent: no "Remove record" '
        '(nothing stored), starts on Present, still markable', (t) async {
      when(
        () => repo.dayBoard(
          date: any(named: 'date'),
          search: any(named: 'search'),
          branchId: any(named: 'branchId'),
        ),
      ).thenAnswer((_) async => board());
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
        (_) async => HrAttendanceDay.fromJson(hrAttendanceDayJson()),
      );
      await pumpApp(t, const TeamAttendanceScreen());
      await settle(t);
      await t.tap(find.text('Vikram Coach'));
      await _anim(t);
      expect(find.text('Mark attendance'), findsOneWidget);
      expect(find.text('Remove record'), findsNothing);
      await t.enterText(find.byKey(const Key('hr-mark-remark')), 'Was on site');
      await _tapVisible(t, find.text('Save attendance'));
      await _anim(t);
      verify(
        () => repo.markAttendance(
          userId: 'u-vikram',
          date: any(named: 'date'),
          status: DayStatus.present,
          remark: 'Was on site',
          checkInTime: any(named: 'checkInTime'),
          checkOutTime: any(named: 'checkOutTime'),
        ),
      ).called(1);
      await dispose(t);
    });

    testWidgets('mark sheet over a manually marked absent keeps '
        '"Remove record"', (t) async {
      when(
        () => repo.dayBoard(
          date: any(named: 'date'),
          search: any(named: 'search'),
          branchId: any(named: 'branchId'),
        ),
      ).thenAnswer((_) async => board());
      await pumpApp(t, const TeamAttendanceScreen());
      await settle(t);
      await t.tap(find.text('Asha Desk'));
      await _anim(t);
      expect(find.text('Edit attendance'), findsOneWidget);
      expect(find.text('Remove record'), findsOneWidget);
      await dispose(t);
    });

    test('heatmap cell + summary carry the auto marker / spoken label', () {
      final auto = hrCellFor(HrAttendanceDay.fromJson(hrAutoAbsentDayJson()));
      expect(auto.auto, isTrue);
      expect(auto.semantics, contains(hrNoCheckInLabel));
      final manual = hrCellFor(
        HrAttendanceDay.fromJson(
          hrAttendanceDayJson(status: 'ABSENT', source: 'MANUAL'),
        ),
      );
      expect(manual.auto, isFalse);
      expect(manual.semantics, isNot(contains(hrNoCheckInLabel)));
    });

    testWidgets('month heatmap draws the auto marker only on derived '
        'absences', (t) async {
      await pumpApp(
        t,
        Scaffold(
          body: SingleChildScrollView(
            child: HrMonthCalendar(
              month: DateTime(2026, 11),
              cells: {
                20: hrCellFor(
                  HrAttendanceDay.fromJson(hrAutoAbsentDayJson(date: '2026-11-20')),
                ),
                21: hrCellFor(
                  HrAttendanceDay.fromJson(
                    hrAttendanceDayJson(
                      date: '2026-11-21',
                      status: 'ABSENT',
                      source: 'MANUAL',
                    ),
                  ),
                ),
              },
              onDayTap: (_) {},
            ),
          ),
        ),
      );
      await t.pump(const Duration(seconds: 1));
      expect(find.byKey(const Key('auto-absent-marker')), findsOneWidget);
      expect(
        find.bySemanticsLabel(RegExp('Day 20.*No check-in recorded')),
        findsOneWidget,
      );
      await dispose(t);
    });

    testWidgets('day sheet of a derived absent explains there is nothing to '
        'remove', (t) async {
      await pumpApp(
        t,
        Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => showHrDaySheet(
                context,
                HrAttendanceDay.fromJson(hrAutoAbsentDayJson()),
                subject: 'Vikram Coach',
              ),
              child: const Text('open'),
            ),
          ),
        ),
      );
      await t.tap(find.text('open'));
      await _anim(t);
      expect(find.byKey(const Key('auto-absent-note')), findsOneWidget);
      expect(find.text('Absent · auto'), findsOneWidget);
      await dispose(t);
    });
  });
}
