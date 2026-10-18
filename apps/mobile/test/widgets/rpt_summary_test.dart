import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/features/reports/presentation/kit/kit.dart';
import 'package:gym_saas_mobile/models/report_summary.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/reports_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Reports extends Mock implements ReportsRepository {}

class _Session extends MockCubit<SessionState> implements SessionCubit {}

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

Map<String, dynamic> _revenue() => {
      'range': {'from': '2026-10-01', 'to': '2026-10-03'},
      'previousRange': {'from': '2026-09-28', 'to': '2026-09-30'},
      'kpis': [
        {
          'key': 'total',
          'label': 'Total revenue',
          'value': '150000.00',
          'previous': '100000.00',
          'format': 'money',
        },
        {
          'key': 'payments',
          'label': 'Payments',
          'value': 30,
          'previous': 20,
          'format': 'number',
        },
        {
          'key': 'success-rate',
          'label': 'Success rate',
          'value': 0.915,
          'format': 'percent',
        },
      ],
      'breakdowns': [
        {
          'key': 'by-method',
          'title': 'Revenue by method',
          'kind': 'donut',
          'items': [
            {'label': 'UPI', 'value': '90000'},
            {'label': 'Cash', 'value': '60000'},
          ],
        },
        {
          'key': 'by-plan',
          'title': 'Members by plan',
          'kind': 'bar',
          'items': [
            {'label': 'Gold', 'value': 12, 'previous': 8},
          ],
        },
      ],
      'series': {
        'title': 'Revenue per day',
        'points': [
          {'date': '2026-10-01', 'value': '1000', 'previous': '800'},
          {'date': '2026-10-02', 'value': '2000', 'previous': '900'},
          {'date': '2026-10-03', 'value': '1500', 'previous': '700'},
        ],
      },
    };

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

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    registerFallbackValue(const ReportSummaryFilters());
  });

  late _Reports repo;

  setUp(() {
    repo = _Reports();
    final g = GetIt.instance;
    if (g.isRegistered<ReportsRepository>()) g.unregister<ReportsRepository>();
    g.registerSingleton<ReportsRepository>(repo);
    when(() => repo.summary(any(), any()))
        .thenAnswer((_) async => ReportSummary.fromJson(_revenue()));
  });

  Future<void> pump(
    WidgetTester t, {
    List<String> perms = const ['reports:view'],
    Size size = const Size(360, 1400),
    String type = 'revenue',
    bool compare = true,
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
        child: MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(18),
              child: RptSummaryPanel(
                type: type,
                compare: compare,
                accent: RptAccent.finance,
              ),
            ),
          ),
        ),
      ),
    );
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  testWidgets('KPIs, series and breakdowns render with correct units',
      (t) async {
    await pump(t);
    expect(t.takeException(), isNull);
    expect(find.text('TOTAL REVENUE'), findsOneWidget);
    expect(find.text('₹1.50L'), findsWidgets); // money (KPI + donut centre)
    expect(find.text('30'), findsOneWidget); // count: no symbol
    expect(find.text('91.5%'), findsOneWidget); // 0..1 ratio scaled
    expect(find.text('Revenue per day'), findsOneWidget);
    expect(find.text('Revenue by method'), findsOneWidget);
    expect(find.text('Members by plan'), findsOneWidget);
    // revenue/by-method is money, members-by-plan is a count
    expect(find.textContaining('₹90k'), findsWidgets);
    expect(find.text('12'), findsOneWidget);
  });

  testWidgets('tablet renders without overflow', (t) async {
    await pump(t, size: const Size(1500, 1300));
    expect(t.takeException(), isNull);
  });

  testWidgets('compare off drops the previous series note', (t) async {
    await pump(t, compare: false);
    expect(find.text('This period vs previous period'), findsNothing);
    await pump(t);
    expect(find.text('This period vs previous period'), findsOneWidget);
  });

  testWidgets('without reports:view: hidden and no request', (t) async {
    await pump(t, perms: const []);
    expect(find.text('TOTAL REVENUE'), findsNothing);
    verifyNever(() => repo.summary(any(), any()));
  });

  testWidgets('HTTP 403 hides the panel quietly', (t) async {
    when(() => repo.summary(any(), any())).thenThrow(
      const ApiException(message: 'unavailable', statusCode: 403),
    );
    await pump(t);
    expect(find.text('Insights'), findsNothing);
    expect(find.text('TOTAL REVENUE'), findsNothing);
  });

  testWidgets('an error shows a retry card that reloads', (t) async {
    when(() => repo.summary(any(), any())).thenThrow(
      const ApiException(message: 'boom', statusCode: 500),
    );
    await pump(t);
    expect(find.textContaining('Insights unavailable'), findsOneWidget);
    when(() => repo.summary(any(), any()))
        .thenAnswer((_) async => ReportSummary.fromJson(_revenue()));
    await t.tap(find.text('Retry'));
    await t.pump();
    await t.pump(const Duration(seconds: 3));
    expect(find.text('TOTAL REVENUE'), findsOneWidget);
  });
}
