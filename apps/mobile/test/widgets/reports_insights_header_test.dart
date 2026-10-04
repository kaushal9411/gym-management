import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/reports/reports_overview_cubit.dart';
import 'package:gym_saas_mobile/features/reports/presentation/widgets/reports_insights_header.dart';
import 'package:gym_saas_mobile/models/reports_overview.dart';
import 'package:gym_saas_mobile/repositories/reports_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockRepo extends Mock implements ReportsRepository {}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  Future<void> pump(WidgetTester t, ReportsOverviewCubit cubit) async {
    t.view.physicalSize = const Size(360 * 3, 800 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BlocProvider.value(
            value: cubit,
            child: const SingleChildScrollView(child: ReportsInsightsHeader()),
          ),
        ),
      ),
    );
  }

  testWidgets('renders KPI cards + blocks at phone width without overflow',
      (t) async {
    final repo = _MockRepo();
    when(
      () => repo.overview(
        dateFrom: any(named: 'dateFrom'),
        dateTo: any(named: 'dateTo'),
        branchId: any(named: 'branchId'),
      ),
    ).thenAnswer(
      (_) async => ReportsOverview.fromJson({
        'range': {'from': '2026-10-01', 'to': '2026-10-02'},
        'previousRange': {'from': '2026-09-29', 'to': '2026-09-30'},
        'kpis': {
          'revenue': {'value': '1500.00', 'previous': '1000.00'},
          'activeMembers': {'value': 120},
        },
        'daily': [
          {'date': '2026-10-01', 'revenue': '1000.00', 'prevRevenue': '400'},
          {'date': '2026-10-02', 'revenue': '500.00', 'prevRevenue': '0'},
        ],
        'weekdayAttendance': [
          {'weekday': 0, 'count': 3, 'previousCount': 1},
        ],
        'memberStatus': [
          {'status': 'ACTIVE', 'count': 100},
        ],
      }),
    );
    final cubit = ReportsOverviewCubit(repo);
    addTearDown(cubit.close);
    await pump(t, cubit);
    await cubit.load();
    await t.pump();
    await t.pump(const Duration(seconds: 2));
    expect(find.text('Revenue'), findsOneWidget);
    expect(find.text('Active members'), findsOneWidget);
    expect(find.text('Revenue over time'), findsOneWidget);
    expect(find.text('Attendance by weekday'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('forbidden state renders nothing', (t) async {
    final cubit = ReportsOverviewCubit(_MockRepo())..hide();
    addTearDown(cubit.close);
    await pump(t, cubit);
    expect(find.text('Insights'), findsNothing);
  });
}
