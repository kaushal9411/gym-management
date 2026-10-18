import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/theme/app_colors.dart';
import 'package:gym_saas_mobile/features/reports/presentation/attendance_report_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/churn_report_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/expiring_memberships_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/kit/kit.dart';
import 'package:gym_saas_mobile/features/reports/presentation/member_progress_report_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/membership_report_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/people/people_ui.dart';
import 'package:gym_saas_mobile/features/reports/presentation/staff_performance_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/staff_report_screen.dart';
import 'package:gym_saas_mobile/models/active_vs_inactive_row.dart';
import 'package:gym_saas_mobile/models/attendance_report_row.dart';
import 'package:gym_saas_mobile/models/branch_option.dart';
import 'package:gym_saas_mobile/models/expiring_membership_row.dart';
import 'package:gym_saas_mobile/models/member_progress_row.dart';
import 'package:gym_saas_mobile/models/membership_plan.dart';
import 'package:gym_saas_mobile/models/membership_report_row.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/report_summary.dart';
import 'package:gym_saas_mobile/models/staff_report_row.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/trainer_performance_row.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';
import 'package:gym_saas_mobile/repositories/membership_plan_repository.dart';
import 'package:gym_saas_mobile/repositories/reports_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Reports extends Mock implements ReportsRepository {}

class _Branches extends Mock implements BranchRepository {}

class _Plans extends Mock implements MembershipPlanRepository {}

class _Session extends MockCubit<SessionState> implements SessionCubit {}

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

UserProfile _user(List<String> perms) => UserProfile(
      id: 'u',
      tenantId: 't',
      name: 'U',
      email: 'u@x.test',
      phone: null,
      status: 'ACTIVE',
      roles: const ['OWNER'],
      permissions: perms,
    );

PaginatedResult<T> _paged<T>(
  List<T> items, {
  int page = 1,
  int totalPages = 1,
  int? total,
}) =>
    PaginatedResult(
      items: items,
      total: total ?? items.length,
      page: page,
      limit: 20,
      totalPages: totalPages,
    );

Map<String, dynamic> _summary(String kind) {
  Map<String, dynamic> bd(
    String key,
    String title,
    String type,
    List<Object?> items,
  ) =>
      {'key': key, 'title': title, 'kind': type, 'items': items};
  switch (kind) {
    case 'membership':
      return {
        'kpis': [
          {
            'key': 'total',
            'label': 'Total members',
            'value': 120,
            'format': 'number',
          },
        ],
        'breakdowns': [
          bd('by-status', 'Members by status', 'donut', [
            {'label': 'ACTIVE', 'value': 90},
            {'label': 'FROZEN', 'value': 30},
          ]),
          bd('by-plan', 'Active memberships by plan', 'bar', [
            {'label': 'Gold', 'value': 60},
          ]),
        ],
        'series': null,
      };
    case 'attendance':
      return {
        'range': {'from': '2026-10-01', 'to': '2026-10-03'},
        'previousRange': {'from': '2026-09-28', 'to': '2026-09-30'},
        'kpis': [
          {
            'key': 'check-ins',
            'label': 'Total check-ins',
            'value': 340,
            'previous': 300,
            'format': 'number',
          },
          {
            'key': 'unique-members',
            'label': 'Unique members',
            'value': 80,
            'previous': 70,
            'format': 'number',
          },
          {
            'key': 'avg-per-day',
            'label': 'Avg check-ins / day',
            'value': 11.3,
            'previous': 10,
            'format': 'number',
          },
        ],
        'breakdowns': [
          bd('by-method', 'Check-ins by method', 'donut', [
            {'label': 'QR_CODE', 'value': 200},
            {'label': 'MANUAL', 'value': 140},
          ]),
        ],
        'series': {
          'title': 'Daily check-ins',
          'points': [
            {'date': '2026-10-01', 'value': 10, 'previous': 8},
            {'date': '2026-10-02', 'value': 14, 'previous': 9},
            {'date': '2026-10-03', 'value': 12, 'previous': 11},
          ],
        },
      };
    case 'member-progress':
      return {
        'kpis': [
          {
            'key': 'members',
            'label': 'Members',
            'value': 40,
            'format': 'number',
          },
          {
            'key': 'avg-workout',
            'label': 'Avg workout progress',
            'value': 62.5,
            'format': 'percent',
          },
        ],
        'breakdowns': [
          bd('workout-buckets', 'Members by workout progress %', 'bar', [
            {'label': '0-25%', 'value': 5},
            {'label': '76-100%', 'value': 20},
          ]),
        ],
        'series': null,
      };
    default:
      return {
        'kpis': [
          {'key': 'total', 'label': 'Total', 'value': 12, 'format': 'number'},
        ],
        'breakdowns': [
          bd('by-status', 'By status', 'donut', [
            {'label': 'ACTIVE', 'value': 12},
          ]),
        ],
        'series': null,
      };
  }
}

MembershipReportRow _member(
  int i, {
  String status = 'ACTIVE',
  String? plan = 'Gold',
}) =>
    MembershipReportRow.fromJson({
      'memberId': 'id$i',
      'memberCode': 'M-00$i',
      'name': 'Member $i',
      'branch': 'Main Branch',
      'plan': plan,
      'status': status,
      'startDate': plan == null ? null : '2026-01-01',
      'endDate': plan == null ? null : '2030-01-01',
    });

const _all = ['reports:view', 'memberships:view'];

Future<void> settle(WidgetTester t) async {
  // Skeletons loop forever: fixed pumps, never pumpAndSettle.
  await t.pump();
  await t.pump(const Duration(seconds: 3));
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    registerFallbackValue(const ReportSummaryFilters());
  });

  late _Reports reports;
  late _Branches branches;
  late _Plans plans;

  setUp(() {
    reports = _Reports();
    branches = _Branches();
    plans = _Plans();
    final g = GetIt.instance;
    void reg<T extends Object>(T v) {
      if (g.isRegistered<T>()) g.unregister<T>();
      g.registerSingleton<T>(v);
    }

    reg<ReportsRepository>(reports);
    reg<BranchRepository>(branches);
    reg<MembershipPlanRepository>(plans);
    when(() => branches.assignable()).thenAnswer(
      (_) async => [const BranchOption(id: 'b1', name: 'Main Branch')],
    );
    when(
      () => plans.list(
        limit: any(named: 'limit'),
        sortBy: any(named: 'sortBy'),
        sortDir: any(named: 'sortDir'),
      ),
    ).thenAnswer(
      (_) async => PaginatedResult(
        items: [
          MembershipPlan.fromJson({
            'id': 'p1',
            'name': 'Gold',
            'price': '1000',
            'durationType': 'MONTHS',
            'durationValue': 1,
          }),
        ],
        total: 1,
        page: 1,
        limit: 100,
        totalPages: 1,
      ),
    );
    when(() => reports.summary(any(), any())).thenAnswer((inv) async {
      final type = inv.positionalArguments.first as String;
      return ReportSummary.fromJson(_summary(type));
    });
    when(
      () => reports.membership(
        branchId: any(named: 'branchId'),
        memberStatus: any(named: 'memberStatus'),
        planId: any(named: 'planId'),
        page: any(named: 'page'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer((_) async => _paged([_member(1), _member(2, plan: null)]));
    when(
      () => reports.attendance(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
        page: any(named: 'page'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer(
      (_) async => _paged([
        AttendanceReportRow.fromJson({
          'date': '2026-10-18',
          'memberCode': 'M-001',
          'name': 'Asha Rao',
          'branch': 'Main Branch',
          'checkInTime': '2026-10-18T01:00:00.000Z',
          'checkOutTime': '2026-10-18T02:23:00.000Z',
          'method': 'QR_CODE',
        }),
        AttendanceReportRow.fromJson({
          'date': '2026-10-18',
          'memberCode': 'M-002',
          'name': 'Ravi Kumar',
          'branch': 'Main Branch',
          'checkInTime': '2026-10-18T03:00:00.000Z',
          'checkOutTime': null,
          'method': 'MANUAL',
        }),
      ]),
    );
    when(() => reports.activeVsInactive(branchId: any(named: 'branchId')))
        .thenAnswer(
      (_) async => const [
        ActiveVsInactiveRow(status: 'INACTIVE', count: 10),
        ActiveVsInactiveRow(status: 'ACTIVE', count: 90),
      ],
    );
    when(
      () => reports.expiringMemberships(
        branchId: any(named: 'branchId'),
        page: any(named: 'page'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer(
      (_) async => _paged([
        ExpiringMembershipRow.fromJson({
          'memberCode': 'M-001',
          'name': 'Asha Rao',
          'branch': 'Main Branch',
          'plan': 'Gold',
          'endDate': '2026-10-20',
          'daysRemaining': 2,
        }),
        ExpiringMembershipRow.fromJson({
          'memberCode': 'M-002',
          'name': 'Ravi Kumar',
          'branch': 'Main Branch',
          'plan': 'Silver',
          'endDate': '2026-11-10',
          'daysRemaining': 23,
        }),
      ]),
    );
    when(
      () => reports.memberProgress(
        branchId: any(named: 'branchId'),
        page: any(named: 'page'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer(
      (_) async => _paged([
        MemberProgressRow.fromJson({
          'memberCode': 'M-001',
          'name': 'Asha Rao',
          'workoutPlan': 'Push Pull',
          'workoutProgressPercent': 80,
          'dietPlan': null,
          'dietProgressPercent': null,
        }),
        MemberProgressRow.fromJson({
          'memberCode': 'M-002',
          'name': 'Ravi Kumar',
          'workoutPlan': 'Legs',
          'workoutProgressPercent': 20,
          'dietPlan': 'Cut',
          'dietProgressPercent': 50,
        }),
      ]),
    );
    when(
      () => reports.staff(
        branchId: any(named: 'branchId'),
        page: any(named: 'page'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer(
      (_) async => _paged([
        const StaffReportRow(
          name: 'Neha Shah',
          role: 'MANAGER',
          branch: 'Main Branch',
          status: 'ACTIVE',
          joiningDate: '2025-03-04',
        ),
        const StaffReportRow(
          name: 'Dev Patel',
          role: 'TRAINER',
          branch: null,
          status: 'SUSPENDED',
          joiningDate: null,
        ),
      ]),
    );
    when(() => reports.trainerPerformance(branchId: any(named: 'branchId')))
        .thenAnswer(
      (_) async => const [
        TrainerPerformanceRow(
          trainerId: 'a',
          name: 'Small Load',
          assignedMembers: 3,
          activeWorkoutPlans: 1,
          activeDietPlans: 0,
        ),
        TrainerPerformanceRow(
          trainerId: 'b',
          name: 'Big Load',
          assignedMembers: 12,
          activeWorkoutPlans: 4,
          activeDietPlans: 2,
        ),
      ],
    );
  });

  Future<void> pump(
    WidgetTester t,
    Widget screen, {
    List<String> perms = _all,
    Size size = const Size(360, 740),
  }) async {
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final session = _Session();
    when(() => session.state)
        .thenReturn(SessionAuthenticatedStaff(_user(perms), _tenant));
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp(home: screen),
      ),
    );
    await settle(t);
  }

  Future<void> reveal(WidgetTester t, Finder f) async {
    await t.scrollUntilVisible(
      f,
      300,
      scrollable: find.byType(Scrollable).first,
      maxScrolls: 80,
    );
    await t.pump();
  }

  final screens = <String, ({Widget screen, String title, String row})>{
    'membership': (
      screen: const MembershipReportScreen(),
      title: 'Membership Report',
      row: 'Member 1',
    ),
    'attendance': (
      screen: const AttendanceReportScreen(),
      title: 'Attendance Report',
      row: 'Asha Rao',
    ),
    'churn': (
      screen: const ChurnReportScreen(),
      title: 'Active vs Inactive',
      row: '90% of members',
    ),
    'expiring': (
      screen: const ExpiringMembershipsScreen(),
      title: 'Expiring Memberships',
      row: 'Asha Rao',
    ),
    'progress': (
      screen: const MemberProgressReportScreen(),
      title: 'Member Progress',
      row: 'Asha Rao',
    ),
    'staff': (
      screen: const StaffReportScreen(),
      title: 'Staff Report',
      row: 'Neha Shah',
    ),
    'performance': (
      screen: const StaffPerformanceScreen(),
      title: 'Trainer Performance',
      row: 'Big Load',
    ),
  };

  group('layout: phone 360x740 and tablet 1500x1300', () {
    for (final e in screens.entries) {
      testWidgets('${e.key} phone', (t) async {
        await pump(t, e.value.screen);
        expect(t.takeException(), isNull);
        expect(find.text(e.value.title), findsOneWidget);
        await reveal(t, find.text(e.value.row));
        expect(t.takeException(), isNull);
      });

      testWidgets('${e.key} tablet', (t) async {
        await pump(t, e.value.screen, size: const Size(1500, 1300));
        expect(t.takeException(), isNull);
        expect(find.text(e.value.title), findsOneWidget);
        await reveal(t, find.text(e.value.row));
        expect(t.takeException(), isNull);
      });
    }
  });

  group(
      'gating matrix (screens have no client gate; the summary needs '
      'reports:view; the plan picker needs memberships:view)', () {
    testWidgets('no permissions: summary is never requested, rows still are',
        (t) async {
      await pump(t, const MembershipReportScreen(), perms: const []);
      verifyNever(() => reports.summary(any(), any()));
      verifyNever(
        () => plans.list(
          limit: any(named: 'limit'),
          sortBy: any(named: 'sortBy'),
          sortDir: any(named: 'sortDir'),
        ),
      );
      verify(
        () => reports.membership(
          branchId: any(named: 'branchId'),
          memberStatus: any(named: 'memberStatus'),
          planId: any(named: 'planId'),
          page: 1,
          limit: any(named: 'limit'),
        ),
      ).called(1);
      expect(find.text('TOTAL MEMBERS'), findsNothing);
      expect(find.text('All plans'), findsNothing);
      expect(find.text('Member 1'), findsWidgets);
    });

    testWidgets('reports:view only: summary yes, plan picker no', (t) async {
      await pump(
        t,
        const MembershipReportScreen(),
        perms: const ['reports:view'],
      );
      verify(() => reports.summary('membership', any())).called(1);
      verifyNever(
        () => plans.list(
          limit: any(named: 'limit'),
          sortBy: any(named: 'sortBy'),
          sortDir: any(named: 'sortDir'),
        ),
      );
      expect(find.text('TOTAL MEMBERS'), findsOneWidget);
      expect(find.text('All plans'), findsNothing);
    });

    testWidgets('reports:view + memberships:view: plan picker shows',
        (t) async {
      await pump(t, const MembershipReportScreen());
      expect(find.text('All plans'), findsOneWidget);
    });

    testWidgets('each screen asks its own report type', (t) async {
      final types = {
        'attendance': const AttendanceReportScreen(),
        'active-vs-inactive': const ChurnReportScreen(),
        'expiring-memberships': const ExpiringMembershipsScreen(),
        'member-progress': const MemberProgressReportScreen(),
        'staff': const StaffReportScreen(),
        'trainer-performance': const StaffPerformanceScreen(),
      };
      for (final e in types.entries) {
        clearInteractions(reports);
        await pump(t, e.value, perms: const ['reports:view']);
        verify(() => reports.summary(e.key, any())).called(1);
      }
    });

    testWidgets('a 403 plan-gated module shows the error with Retry, no crash',
        (t) async {
      when(
        () => reports.staff(
          branchId: any(named: 'branchId'),
          page: any(named: 'page'),
          limit: any(named: 'limit'),
        ),
      ).thenThrow(
        const ApiException(message: 'Module unavailable', statusCode: 403),
      );
      when(() => reports.summary(any(), any())).thenThrow(
        const ApiException(message: 'Module unavailable', statusCode: 403),
      );
      await pump(t, const StaffReportScreen());
      expect(t.takeException(), isNull);
      expect(find.text('Module unavailable'), findsWidgets);
      expect(find.text('Try again'), findsWidgets);
    });
  });

  group('RptSummaryPanel hooks (additive kit params)', () {
    testWidgets('onLoaded fires with the summary; colorFor recolours items',
        (t) async {
      ReportSummary? got;
      await pump(
        t,
        Scaffold(
          body: SingleChildScrollView(
            child: RptSummaryPanel(
              type: 'membership',
              compare: false,
              onLoaded: (s) => got = s,
              labelFor: peopleBreakdownLabel,
              colorFor: peopleBreakdownColor,
            ),
          ),
        ),
        perms: const ['reports:view'],
      );
      expect(got, isNotNull);
      expect(got!.kpis.first.label, 'Total members');
      expect(find.text('Active'), findsWidgets); // ACTIVE -> Active
      expect(find.text('ACTIVE'), findsNothing);
    });

    testWidgets('without reports:view nothing loads and onLoaded is silent',
        (t) async {
      var calls = 0;
      await pump(
        t,
        Scaffold(
          body: RptSummaryPanel(
            type: 'membership',
            onLoaded: (_) => calls++,
          ),
        ),
        perms: const [],
      );
      expect(calls, 0);
      verifyNever(() => reports.summary(any(), any()));
    });
  });

  group('light theme', () {
    tearDown(() => AppColors.isLight = false);

    for (final e in screens.entries) {
      testWidgets('${e.key} paints in light mode', (t) async {
        AppColors.isLight = true;
        await pump(t, e.value.screen);
        await reveal(t, find.text(e.value.row));
        expect(t.takeException(), isNull);
      });
    }
  });

  group('behaviour', () {
    testWidgets('membership: status chip refilters list and summary',
        (t) async {
      await pump(t, const MembershipReportScreen());
      final frozen = find.descendant(
        of: find.byType(RptFilterChips<String>),
        matching: find.text('Frozen'),
      );
      await t.ensureVisible(frozen); // the chip row scrolls sideways
      await t.pump();
      await t.tap(frozen);
      await settle(t);
      verify(
        () => reports.membership(
          branchId: any(named: 'branchId'),
          memberStatus: 'FROZEN',
          planId: any(named: 'planId'),
          page: 1,
          limit: any(named: 'limit'),
        ),
      ).called(1);
      final captured = verify(
        () => reports.summary('membership', captureAny()),
      ).captured.cast<ReportSummaryFilters>();
      expect(captured.last.memberStatus, 'FROZEN');
    });

    testWidgets('membership: picking a plan sends planId', (t) async {
      await pump(t, const MembershipReportScreen());
      await t.tap(find.text('All plans'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 600));
      await t.tap(find.text('Gold').last);
      await settle(t);
      verify(
        () => reports.membership(
          branchId: any(named: 'branchId'),
          memberStatus: any(named: 'memberStatus'),
          planId: 'p1',
          page: 1,
          limit: any(named: 'limit'),
        ),
      ).called(1);
    });

    testWidgets('membership: load more appends page 2', (t) async {
      when(
        () => reports.membership(
          branchId: any(named: 'branchId'),
          memberStatus: any(named: 'memberStatus'),
          planId: any(named: 'planId'),
          page: 1,
          limit: any(named: 'limit'),
        ),
      ).thenAnswer(
        (_) async => _paged([_member(1)], totalPages: 2, total: 2),
      );
      when(
        () => reports.membership(
          branchId: any(named: 'branchId'),
          memberStatus: any(named: 'memberStatus'),
          planId: any(named: 'planId'),
          page: 2,
          limit: any(named: 'limit'),
        ),
      ).thenAnswer(
        (_) async => _paged([_member(7)], page: 2, totalPages: 2, total: 2),
      );
      await pump(t, const MembershipReportScreen());
      await reveal(t, find.text('Load more'));
      await t.tap(find.text('Load more'));
      await settle(t);
      expect(find.text('Member 7'), findsOneWidget);
      expect(find.text('Load more'), findsNothing);
    });

    testWidgets('membership: row tap opens the detail sheet', (t) async {
      await pump(t, const MembershipReportScreen());
      await reveal(t, find.text('Member 1'));
      await t.tap(find.text('Member 1'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 600));
      expect(find.text('MEMBER ID'), findsOneWidget);
      expect(find.text('Membership elapsed'), findsOneWidget);
    });

    testWidgets('attendance: period chip changes the requested range',
        (t) async {
      await pump(t, const AttendanceReportScreen());
      await t.tap(find.text('Today'));
      await settle(t);
      final calls = verify(
        () => reports.attendance(
          from: captureAny(named: 'from'),
          to: captureAny(named: 'to'),
          branchId: any(named: 'branchId'),
          page: 1,
          limit: any(named: 'limit'),
        ),
      ).captured;
      // last call = (from, to) of "Today": the same local day.
      expect(calls[calls.length - 2], calls.last);
      final s = verify(() => reports.summary('attendance', captureAny()))
          .captured
          .cast<ReportSummaryFilters>();
      expect(s.last.from, s.last.to);
    });

    testWidgets('attendance: rows show times, duration and a still-in state',
        (t) async {
      await pump(t, const AttendanceReportScreen());
      await reveal(t, find.text('Ravi Kumar'));
      expect(find.text('Still in'), findsOneWidget);
      expect(find.text('QR code'), findsWidgets);
      expect(find.text('1h 23m'), findsOneWidget);
    });

    testWidgets('churn: rows are sorted by count with shares', (t) async {
      await pump(t, const ChurnReportScreen());
      await reveal(t, find.text('90% of members'));
      expect(find.text('10% of members'), findsOneWidget);
      final active = t.getTopLeft(find.text('Active').last).dy;
      final inactive = t.getTopLeft(find.text('Inactive').last).dy;
      expect(active, lessThan(inactive));
    });

    testWidgets('trainer performance: busiest first with rank', (t) async {
      await pump(t, const StaffPerformanceScreen());
      await reveal(t, find.text('Big Load'));
      expect(find.text('Rank 1 · 12 assigned'), findsOneWidget);
      expect(
        t.getTopLeft(find.text('Big Load')).dy,
        lessThan(t.getTopLeft(find.text('Small Load')).dy),
      );
    });

    testWidgets('member progress: a missing plan reads as no active plan',
        (t) async {
      await pump(t, const MemberProgressReportScreen());
      await reveal(t, find.text('No active diet plan'));
      expect(find.text('80%'), findsOneWidget);
    });

    testWidgets('expiring: days-left ring and pill colours come from days',
        (t) async {
      await pump(t, const ExpiringMembershipsScreen());
      await reveal(t, find.text('Ends 20 Oct 2026'));
      expect(find.text('2'), findsWidgets);
      expect(find.text('23'), findsWidgets);
    });

    testWidgets('staff: unknown branch / joining date are explicit', (t) async {
      await pump(t, const StaffReportScreen());
      await reveal(t, find.text('No branch'));
      expect(find.text('Joining date not set'), findsOneWidget);
      expect(find.text('Joined 4 Mar 2025'), findsOneWidget);
    });

    testWidgets('empty list shows the empty state', (t) async {
      when(
        () => reports.expiringMemberships(
          branchId: any(named: 'branchId'),
          page: any(named: 'page'),
          limit: any(named: 'limit'),
        ),
      ).thenAnswer((_) async => _paged<ExpiringMembershipRow>([]));
      await pump(t, const ExpiringMembershipsScreen());
      await reveal(t, find.text('No memberships expiring soon'));
      expect(find.text('No memberships expiring soon'), findsOneWidget);
    });
  });
}
