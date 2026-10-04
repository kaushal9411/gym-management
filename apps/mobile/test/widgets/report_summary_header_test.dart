import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/features/reports/presentation/widgets/report_summary_header.dart';
import 'package:gym_saas_mobile/models/report_summary.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/reports_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockRepo extends Mock implements ReportsRepository {}

class _MockSession extends MockCubit<SessionState> implements SessionCubit {}

class _FakeTenant extends Fake implements TenantBranding {}

class _FakeFilters extends Fake implements ReportSummaryFilters {}

UserProfile _user(List<String> perms) => UserProfile(
      id: 'u1',
      tenantId: 't',
      name: 'N',
      email: 'e@x.io',
      phone: null,
      status: 'ACTIVE',
      roles: const ['OWNER'],
      permissions: perms,
    );

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    registerFallbackValue(_FakeFilters());
  });
  tearDown(() => GetIt.instance.reset());

  Future<_MockRepo> pump(WidgetTester t, List<String> perms) async {
    final repo = _MockRepo();
    when(() => repo.summary(any(), any())).thenAnswer(
      (_) async => ReportSummary.fromJson({
        'range': {'from': '2026-10-01', 'to': '2026-10-02'},
        'previousRange': {'from': '2026-09-29', 'to': '2026-09-30'},
        'kpis': [
          {
            'key': 'total',
            'label': 'Total revenue',
            'value': '1500.00',
            'previous': '1000.00',
            'format': 'money',
          },
          {
            'key': 'payments',
            'label': 'Payments',
            'value': 3,
            'format': 'number',
          },
        ],
        'breakdowns': [
          {
            'key': 'by-method',
            'title': 'Revenue by method',
            'kind': 'donut',
            'items': [
              {'label': 'UPI', 'value': 1200.5},
              {'label': 'CASH', 'value': 299.5},
            ],
          },
        ],
        'series': {
          'title': 'Daily revenue',
          'points': [
            {'date': '2026-10-01', 'value': 1000, 'previous': 400},
            {'date': '2026-10-02', 'value': 500, 'previous': 0},
          ],
        },
      }),
    );
    GetIt.instance.registerSingleton<ReportsRepository>(repo);
    final session = _MockSession();
    when(() => session.state).thenReturn(
      SessionAuthenticatedStaff(_user(perms), _FakeTenant()),
    );
    t.view.physicalSize = const Size(360 * 3, 800 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BlocProvider<SessionCubit>.value(
            value: session,
            child: const SingleChildScrollView(
              child: ReportSummaryHeader(type: 'revenue'),
            ),
          ),
        ),
      ),
    );
    await t.pump();
    await t.pump(const Duration(seconds: 2));
    return repo;
  }

  testWidgets('shows KPI chips, expands to breakdown + series, no overflow',
      (t) async {
    await pump(t, ['reports:view']);
    expect(find.text('Total revenue'), findsOneWidget);
    expect(find.text('Details'), findsOneWidget);
    await t.tap(find.text('Details'));
    await t.pump(const Duration(seconds: 2));
    expect(find.text('Revenue by method'), findsOneWidget);
    expect(find.text('Daily revenue'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('without reports:view it renders nothing and never calls API',
      (t) async {
    final repo = await pump(t, ['finance:view']);
    expect(find.text('Total revenue'), findsNothing);
    verifyNever(() => repo.summary(any(), any()));
  });
}
