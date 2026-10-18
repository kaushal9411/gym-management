import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/features/reports/presentation/analytics_screen.dart';
import 'package:gym_saas_mobile/features/team/presentation/widgets/team_ui.dart';
import 'package:gym_saas_mobile/models/branch_comparison_row.dart';
import 'package:gym_saas_mobile/models/branch_option.dart';
import 'package:gym_saas_mobile/models/revenue_trend_point.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/trend_point.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/analytics_repository.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Analytics extends Mock implements AnalyticsRepository {}

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
      roles: const ['MANAGER'],
      permissions: perms,
    );

List<TrendPoint> _counts() => [
      for (var i = 1; i <= 10; i++)
        TrendPoint(
            date: '2026-10-${i.toString().padLeft(2, '0')}', value: i * 3,),
    ];

List<RevenueTrendPoint> _money() => [
      for (var i = 1; i <= 10; i++)
        RevenueTrendPoint(
          date: '2026-10-${i.toString().padLeft(2, '0')}',
          income: i * 1000.0,
          expenses: i * 400.0,
        ),
    ];

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    registerFallbackValue(DateTime(2026));
  });

  late _Analytics analytics;
  late _Branches branches;

  setUp(() {
    analytics = _Analytics();
    branches = _Branches();
    final g = GetIt.instance;
    if (g.isRegistered<AnalyticsRepository>()) {
      g.unregister<AnalyticsRepository>();
    }
    if (g.isRegistered<BranchRepository>()) g.unregister<BranchRepository>();
    g.registerSingleton<AnalyticsRepository>(analytics);
    g.registerSingleton<BranchRepository>(branches);
    when(() => branches.assignable()).thenAnswer(
      (_) async => [BranchOption(id: 'b1', name: 'Main')],
    );
    Future<List<TrendPoint>> counts(Invocation _) async => _counts();
    Future<List<RevenueTrendPoint>> money(Invocation _) async => _money();
    when(
      () => analytics.revenueTrends(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
      ),
    ).thenAnswer(money);
    when(
      () => analytics.paymentCollection(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
      ),
    ).thenAnswer(money);
    when(
      () => analytics.attendanceTrends(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
      ),
    ).thenAnswer(counts);
    when(
      () => analytics.membershipGrowth(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
      ),
    ).thenAnswer(counts);
    when(
      () => analytics.newMemberGrowth(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
      ),
    ).thenAnswer(counts);
    when(
      () => analytics.retention(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
      ),
    ).thenAnswer(counts);
    when(
      () => analytics.branchComparison(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
      ),
    ).thenAnswer(
      (_) async => const [
        BranchComparisonRow(
          branchId: 'b1',
          branch: 'Main Branch',
          members: 120,
          revenue: 90000,
          attendance: 800,
        ),
        BranchComparisonRow(
          branchId: 'b2',
          branch: 'Second Branch',
          members: 60,
          revenue: 30000,
          attendance: 300,
        ),
      ],
    );
  });

  Future<void> pump(WidgetTester t, List<String> perms, Size size) async {
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final session = _Session();
    when(() => session.state)
        .thenReturn(SessionAuthenticatedStaff(_user(perms), _tenant));
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: const MaterialApp(home: AnalyticsScreen()),
      ),
    );
  }

  // Looping hero animations: pumpAndSettle would hang.
  Future<void> settle(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  Finder tab(String label) => find.descendant(
        of: find.byType(TeamFilterChip),
        matching: find.text(label),
      );

  testWidgets('phone 360: overview shows all seven view cards, no overflow',
      (t) async {
    await pump(t, ['analytics:view'], const Size(360, 740));
    await settle(t);
    expect(t.takeException(), isNull);
    expect(find.text('Analytics'), findsWidgets);
    for (final title in [
      'Revenue Trends',
      'Attendance Trends',
      'Membership Growth',
      'New Member Growth',
      'Member Retention',
      'Payment Collection',
    ]) {
      expect(tab(title), findsOneWidget, reason: '$title tab');
    }
    // Compare is on by default (web), so previous ranges were requested too.
    verify(
      () => analytics.revenueTrends(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
      ),
    ).called(2);
  });

  testWidgets('tablet 1500x1300: overview renders without overflow', (t) async {
    await pump(t, ['analytics:view'], const Size(1500, 1300));
    await settle(t);
    expect(t.takeException(), isNull);
    expect(find.text('Revenue Trends'), findsWidgets);
  });

  testWidgets('without analytics:view: message, and nothing is requested',
      (t) async {
    await pump(t, ['reports:view'], const Size(360, 740));
    await settle(t);
    expect(find.text("You don't have access to analytics."), findsOneWidget);
    verifyNever(
      () => analytics.revenueTrends(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
      ),
    );
  });

  testWidgets('deep dive: Revenue Trends shows its four stat tiles', (t) async {
    await pump(t, ['analytics:view'], const Size(360, 740));
    await settle(t);
    await t.ensureVisible(tab('Revenue Trends'));
    await t.tap(tab('Revenue Trends'));
    await settle(t);
    expect(t.takeException(), isNull);
    expect(find.text('TOTAL INCOME'), findsOneWidget);
    expect(find.text('TOTAL EXPENSES'), findsOneWidget);
    expect(find.text('NET'), findsOneWidget);
    expect(find.text('PEAK INCOME DAY'), findsOneWidget);
  });

  testWidgets('deep dive: Branch Comparison ranks branches by revenue',
      (t) async {
    await pump(t, ['analytics:view'], const Size(360, 740));
    await settle(t);
    await t.ensureVisible(tab('Branch Comparison'));
    await t.tap(tab('Branch Comparison'));
    await settle(t);
    expect(t.takeException(), isNull);
    expect(find.text('Main Branch'), findsWidgets);
    expect(find.text('RANKING'), findsOneWidget);
  });

  testWidgets('a failing view shows Retry without breaking the others',
      (t) async {
    when(
      () => analytics.attendanceTrends(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
      ),
    ).thenAnswer((_) async => throw Exception('boom'));
    await pump(t, ['analytics:view'], const Size(360, 740));
    await settle(t);
    expect(find.text('Could not load this view.'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
    expect(t.takeException(), isNull);
  });
}
