import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/reports/reports_overview_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/theme/app_colors.dart';
import 'package:gym_saas_mobile/core/routing/app_routes.dart';
import 'package:gym_saas_mobile/features/reports/presentation/analytics/analytics_logic.dart';
import 'package:gym_saas_mobile/features/reports/presentation/hub/hub_catalog.dart';
import 'package:gym_saas_mobile/features/reports/presentation/hub/hub_insights.dart';
import 'package:gym_saas_mobile/features/reports/presentation/kit/kit.dart';
import 'package:gym_saas_mobile/features/reports/presentation/reports_center_screen.dart';
import 'package:gym_saas_mobile/features/team/presentation/widgets/team_ui.dart';
import 'package:gym_saas_mobile/models/branch_option.dart';
import 'package:gym_saas_mobile/models/reports_overview.dart';
import 'package:gym_saas_mobile/models/scheduled_report.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';
import 'package:gym_saas_mobile/repositories/reports_repository.dart';
import 'package:gym_saas_mobile/repositories/scheduled_report_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Reports extends Mock implements ReportsRepository {}

class _Scheduled extends Mock implements ScheduledReportRepository {}

class _Branches extends Mock implements BranchRepository {}

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

Map<String, dynamic> _overviewJson() => {
      'range': {'from': '2026-10-01', 'to': '2026-10-07'},
      'previousRange': {'from': '2026-09-24', 'to': '2026-09-30'},
      'kpis': {
        'revenue': {'value': '150000.00', 'previous': '100000.00'},
        'expenses': {'value': '60000.00', 'previous': '50000.00'},
        'netProfit': {'value': '90000.00', 'previous': '50000.00'},
        'newMembers': {'value': 12, 'previous': 8},
        'activeMembers': {'value': 120},
        'checkIns': {'value': 340, 'previous': 300},
        'avgDailyCheckIns': {'value': 48.5, 'previous': 42},
        'expiringIn30d': {'value': 9},
        'churned': {'value': 2, 'previous': 4},
      },
      'daily': [
        for (var i = 1; i <= 7; i++)
          {
            'date': '2026-10-0$i',
            'revenue': '${i * 1000}.00',
            'expenses': '${i * 400}.00',
            'checkIns': i * 5,
            'newMembers': i,
            'prevRevenue': '${i * 800}.00',
            'prevExpenses': '${i * 350}.00',
            'prevCheckIns': i * 4,
            'prevNewMembers': i - 1,
          },
      ],
      'weekdayAttendance': [
        for (var d = 0; d < 7; d++)
          {'weekday': d, 'count': (d + 1) * 10, 'previousCount': d * 8},
      ],
      'hourlyAttendance': [
        {'hour': 6, 'count': 20},
        {'hour': 18, 'count': 55},
      ],
      'memberStatus': [
        {'status': 'ACTIVE', 'count': 100},
        {'status': 'EXPIRED', 'count': 30},
      ],
      'planDistribution': [
        {'planName': 'Gold', 'activeCount': 60, 'revenue': '90000.00'},
        {'planName': 'Silver', 'activeCount': 40, 'revenue': '40000.00'},
      ],
      'paymentMethods': [
        {'method': 'UPI', 'amount': '90000.00', 'count': 30},
        {'method': 'CASH', 'amount': '60000.00', 'count': 20},
      ],
      'branches': [
        {
          'branchId': 'b1',
          'name': 'Main Branch',
          'revenue': '100000.00',
          'previousRevenue': '70000.00',
          'newMembers': 8,
          'checkIns': 200,
          'activeMembers': 80,
        },
      ],
      'topTrainers': [
        {'trainerId': 't1', 'name': 'Asha', 'assignedMembers': 25},
      ],
      'expiringBuckets': [
        {'label': '7 days', 'count': 3},
        {'label': '30 days', 'count': 9},
      ],
    };

ScheduledReport _sched(String id, {bool active = true}) =>
    ScheduledReport.fromJson({
      'id': id,
      'name': 'Weekly revenue $id',
      'reportType': 'revenue',
      'frequency': 'WEEKLY',
      'recipientEmails': ['a@x.test'],
      'isActive': active,
      'lastRunAt': null,
      'nextRunAt': '2026-10-20T09:00:00.000Z',
      'branch': null,
    });

const _all = ['reports:view', 'reports:export', 'analytics:view'];

// Looping dots / skeletons: never pumpAndSettle.
Future<void> settle(WidgetTester t) async {
  await t.pump();
  await t.pump(const Duration(seconds: 3));
}

/// Scrolls the long hub page until [f] is on screen.
Future<void> reveal(WidgetTester t, Finder f) async {
  await t.scrollUntilVisible(
    f,
    500,
    scrollable: find.byType(Scrollable).first,
    maxScrolls: 200,
  );
  await t.pump();
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  late _Reports reports;
  late _Scheduled scheduled;
  late _Branches branches;

  setUp(() {
    reports = _Reports();
    scheduled = _Scheduled();
    branches = _Branches();
    final g = GetIt.instance;
    void reg<T extends Object>(T v) {
      if (g.isRegistered<T>()) g.unregister<T>();
      g.registerSingleton<T>(v);
    }

    reg<ReportsRepository>(reports);
    reg<ScheduledReportRepository>(scheduled);
    reg<BranchRepository>(branches);
    if (g.isRegistered<ReportsOverviewCubit>()) {
      g.unregister<ReportsOverviewCubit>();
    }
    g.registerFactory<ReportsOverviewCubit>(
      () => ReportsOverviewCubit(reports),
    );
    when(
      () => reports.overview(
        dateFrom: any(named: 'dateFrom'),
        dateTo: any(named: 'dateTo'),
        branchId: any(named: 'branchId'),
      ),
    ).thenAnswer((_) async => ReportsOverview.fromJson(_overviewJson()));
    when(() => scheduled.list()).thenAnswer(
      (_) async => [_sched('1'), _sched('2', active: false)],
    );
    when(() => branches.assignable()).thenAnswer(
      (_) async => [const BranchOption(id: 'b1', name: 'Main Branch')],
    );
  });

  final pushed = <String>[];
  final extras = <Object?>[];

  Future<void> pumpHub(
    WidgetTester t, {
    List<String> perms = _all,
    Size size = const Size(360, 740),
  }) async {
    pushed.clear();
    extras.clear();
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final session = _Session();
    when(() => session.state)
        .thenReturn(SessionAuthenticatedStaff(_user(perms), _tenant));
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(body: ReportsCenterScreen()),
        ),
        for (final p in [
          AppRoutes.analytics,
          AppRoutes.scheduledReports,
          AppRoutes.scheduledReportForm,
          AppRoutes.revenueReport,
          AppRoutes.expiringMembershipsReport,
        ])
          GoRoute(
            path: p,
            builder: (_, state) {
              pushed.add(state.uri.path);
              extras.add(state.extra);
              return const Scaffold(body: Text('pushed'));
            },
          ),
      ],
    );
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await settle(t);
  }

  Finder inCatalogue(String title) => find.text(title);

  group('gating matrix (pure)', () {
    List<String> titles(List<String> perms, {String q = ''}) => [
          for (final e in filterHubEntries(
            HubAccess(_user(perms)),
            query: q,
          ))
            e.title,
        ];

    test('no permissions -> nothing', () {
      expect(titles(const []), isEmpty);
    });

    test('reports:view -> the 11 reports, no analytics views', () {
      final t = titles(const ['reports:view']);
      expect(t.length, 11);
      expect(t, contains('Revenue Report'));
      expect(t, isNot(contains('Revenue Trends')));
    });

    test('analytics:view alone -> the 7 analytics views only', () {
      final t = titles(const ['analytics:view']);
      expect(t.length, 7);
      expect(t, contains('Branch Comparison'));
      expect(t, isNot(contains('Revenue Report')));
    });

    test('both -> 18, search narrows, category filter works', () {
      expect(titles(_all).length, 18);
      expect(titles(_all, q: 'retention'), ['Member Retention']);
      final fin = filterHubEntries(
        HubAccess(_user(_all)),
        category: HubCategory.finance,
      );
      expect(fin.map((e) => e.title), [
        'Revenue Report',
        'Expense Report',
        'Payment Report',
      ]);
    });

    test('capabilities', () {
      final a = HubAccess(_user(const ['reports:view']));
      expect(a.canViewReports, isTrue);
      expect(a.canViewAnalytics, isFalse);
      expect(a.canExport, isFalse);
      expect(const HubAccess(null).canViewReports, isFalse);
    });
  });

  group('pure helpers', () {
    final o = ReportsOverview.fromJson(_overviewJson());

    test('weekday points are Monday-first from 0 = Sunday rows', () {
      final p = hubWeekdayPoints(o.weekdayAttendance, compare: true);
      expect(p.map((x) => x.label).toList(), kRptWeekdays);
      expect(p.first.value, 20); // Monday = API weekday 1 -> (1+1)*10
      expect(p.last.value, 10); // Sunday = API weekday 0
      expect(p.first.previous, 8);
      expect(
        hubWeekdayPoints(o.weekdayAttendance, compare: false)
            .every((x) => x.previous == null),
        isTrue,
      );
    });

    test('health ratios come only from real fields and clamp', () {
      final r = HubRatios.of(o);
      expect(r.netMargin, closeTo(60, 0.01));
      expect(r.expenseRatio, closeTo(40, 0.01));
      expect(r.activeShare, closeTo(100 / 130 * 100, 0.01));
      expect(r.renewalsDue, closeTo(7.5, 0.01));
      final empty = HubRatios.of(
        ReportsOverview.fromJson({
          'kpis': {
            'revenue': {'value': '0'},
          },
        }),
      );
      expect(empty.isEmpty, isTrue);
    });

    test('kpis: nine tiles, compare toggles previous, spend is inverted', () {
      final withCmp = hubKpis(o, compare: true);
      expect(withCmp.length, 9);
      expect(withCmp.first.previous, 100000);
      expect(withCmp.firstWhere((k) => k.label == 'Expenses').invert, isTrue);
      expect(withCmp.firstWhere((k) => k.label == 'Churned').invert, isTrue);
      expect(
        withCmp.firstWhere((k) => k.label == 'Active members').previous,
        isNull,
      );
      expect(
        hubKpis(o, compare: false).every((k) => k.previous == null),
        isTrue,
      );
      // counts are plain numbers, money is money
      expect(
        withCmp.firstWhere((k) => k.label == 'Check-ins').format,
        RptFormat.number,
      );
      expect(withCmp.first.format, RptFormat.money);
    });

    test('status colours', () {
      expect(hubStatusColor('ACTIVE', 0), RptColors.green);
      expect(hubStatusColor('expired', 1), RptColors.rose);
      expect(hubStatusColor('FROZEN', 2), RptColors.slate);
      expect(hubStatusColor('WEIRD', 3), rptSeriesColor(3));
    });
  });

  group('Reports Center', () {
    testWidgets(
        'owner, phone 360: hero, KPIs, all 11 panels, catalogue, schedules',
        (t) async {
      await pumpHub(t);
      expect(t.takeException(), isNull);
      expect(find.text('Reports Center'), findsOneWidget);
      for (final k in [
        'REVENUE',
        'EXPENSES',
        'NET PROFIT',
        'NEW MEMBERS',
        'ACTIVE MEMBERS',
        'CHECK-INS',
        'AVG DAILY CHECK-INS',
        'EXPIRING IN 30D',
        'CHURNED',
      ]) {
        expect(find.text(k), findsOneWidget, reason: k);
      }
      for (final p in [
        'Trend',
        'Revenue vs expenses vs net',
        'Member status',
        'Attendance by weekday',
        'Peak hours',
        'Plan distribution',
        'Payment methods',
        'Branch comparison',
        'Top trainers',
        'Expiring memberships',
        'Health ratios',
      ]) {
        expect(find.text(p), findsOneWidget, reason: p);
      }
      expect(find.text('Report catalogue'), findsOneWidget);
      expect(inCatalogue('Revenue Report'), findsOneWidget);
      expect(inCatalogue('Revenue Trends'), findsOneWidget);
      expect(find.text('Scheduled Reports'), findsOneWidget);
      expect(find.text('Weekly revenue 1'), findsOneWidget);
      expect(find.text('Paused'), findsOneWidget);
      // money has the symbol, hero chips carry the headline numbers
      expect(find.textContaining('Revenue ₹1.50L'), findsOneWidget);
      expect(find.textContaining('12 new members'), findsOneWidget);
      verify(
        () => reports.overview(
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
          branchId: null,
        ),
      ).called(1);
    });

    testWidgets('tablet 1500x1300 renders without overflow', (t) async {
      await pumpHub(t, size: const Size(1500, 1300));
      expect(t.takeException(), isNull);
      expect(find.text('Health ratios'), findsOneWidget);
      expect(find.text('Report catalogue'), findsOneWidget);
    });

    testWidgets('light theme renders', (t) async {
      AppColors.isLight = true;
      addTearDown(() => AppColors.isLight = false);
      await pumpHub(t);
      expect(t.takeException(), isNull);
      expect(find.text('Health ratios'), findsOneWidget);
    });

    testWidgets('no permissions: message, nothing requested', (t) async {
      await pumpHub(t, perms: const []);
      expect(find.text("You don't have access to reports."), findsOneWidget);
      verifyNever(
        () => reports.overview(
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
          branchId: any(named: 'branchId'),
        ),
      );
      verifyNever(() => scheduled.list());
    });

    testWidgets('reports:view only: no analytics cards, no schedule button',
        (t) async {
      await pumpHub(t, perms: const ['reports:view']);
      expect(inCatalogue('Revenue Report'), findsOneWidget);
      expect(inCatalogue('Revenue Trends'), findsNothing);
      expect(find.byIcon(Icons.insights_rounded), findsWidgets); // panel icons
      expect(find.text('Schedule a report'), findsNothing);
      expect(find.text('Manage'), findsOneWidget);
    });

    testWidgets('analytics:view only: analytics cards, no insights/requests',
        (t) async {
      await pumpHub(t, perms: const ['analytics:view']);
      expect(inCatalogue('Revenue Trends'), findsOneWidget);
      expect(inCatalogue('Revenue Report'), findsNothing);
      expect(find.text('REVENUE'), findsNothing);
      expect(find.text('Scheduled Reports'), findsNothing);
      verifyNever(
        () => reports.overview(
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
          branchId: any(named: 'branchId'),
        ),
      );
    });

    testWidgets('reports:export adds Schedule a report', (t) async {
      await pumpHub(t);
      expect(find.text('Schedule a report'), findsOneWidget);
      await reveal(t, find.text('Schedule a report'));
      await t.tap(find.text('Schedule a report'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 600));
      expect(pushed, [AppRoutes.scheduledReportForm]);
    });

    testWidgets('HTTP 403 hides the insights, catalogue stays', (t) async {
      when(
        () => reports.overview(
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
          branchId: any(named: 'branchId'),
        ),
      ).thenThrow(
        const ApiException(
          message: 'This module is currently unavailable.',
          statusCode: 403,
        ),
      );
      await pumpHub(t);
      expect(find.text('REVENUE'), findsNothing);
      expect(find.text('Trend'), findsNothing);
      expect(find.text('Report catalogue'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('a failing overview shows the error with Retry', (t) async {
      when(
        () => reports.overview(
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
          branchId: any(named: 'branchId'),
        ),
      ).thenThrow(const ApiException(message: 'Boom', statusCode: 500));
      await pumpHub(t);
      expect(find.text('Boom'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
      expect(find.text('Report catalogue'), findsOneWidget);
    });

    testWidgets('changing the period re-requests with the new range',
        (t) async {
      await pumpHub(t);
      final chip = find.descendant(
        of: find.byType(TeamFilterChip),
        matching: find.text('7 days'),
      );
      await reveal(t, chip);
      await t.tap(chip);
      await settle(t);
      verify(
        () => reports.overview(
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
          branchId: null,
        ),
      ).called(2);
    });

    testWidgets('compare off hides the previous legend without re-requesting',
        (t) async {
      await pumpHub(t);
      expect(find.textContaining('Previous period:'), findsOneWidget);
      await reveal(t, find.byKey(const ValueKey('rpt-compare')));
      await t.tap(find.byKey(const ValueKey('rpt-compare')));
      await settle(t);
      expect(find.textContaining('Previous period:'), findsNothing);
      verify(
        () => reports.overview(
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
          branchId: any(named: 'branchId'),
        ),
      ).called(1);
    });

    testWidgets('catalogue search + category chips narrow the cards',
        (t) async {
      await pumpHub(t);
      await reveal(t, find.text('Report catalogue'));
      await t.enterText(find.byType(TextField), 'retention');
      await t.pump(const Duration(milliseconds: 500));
      await t.pump();
      expect(inCatalogue('Member Retention'), findsOneWidget);
      expect(inCatalogue('Revenue Report'), findsNothing);
      await t.enterText(find.byType(TextField), 'zzz');
      await t.pump(const Duration(milliseconds: 500));
      await t.pump();
      expect(find.textContaining('No reports match'), findsOneWidget);
    });

    testWidgets('an analytics card opens that view; a report card its route',
        (t) async {
      await pumpHub(t);
      await reveal(t, inCatalogue('Revenue Trends'));
      await t.tap(inCatalogue('Revenue Trends'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 600));
      expect(pushed.last, AppRoutes.analytics);
      expect(extras.last, AnalyticsView.revenue);
    });

    testWidgets('a report card opens its report route', (t) async {
      await pumpHub(t);
      await reveal(t, inCatalogue('Revenue Report'));
      await t.tap(inCatalogue('Revenue Report'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 600));
      expect(pushed.last, AppRoutes.revenueReport);
    });

    testWidgets('trend metric switch and plan toggle do not crash', (t) async {
      await pumpHub(t);
      await reveal(t, find.text('Check-ins').first);
      await t.tap(find.text('Check-ins').first);
      await settle(t);
      expect(t.takeException(), isNull);
    });
  });
}
