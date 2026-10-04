import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/features/support/presentation/widgets/support_insights_header.dart';
import 'package:gym_saas_mobile/models/support_ticket_stats.dart';
import 'package:gym_saas_mobile/repositories/support_ticket_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockRepo extends Mock implements SupportTicketRepository {}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  Future<void> pump(WidgetTester t, SupportStatsCubit cubit) async {
    t.view.physicalSize = const Size(360 * 3, 800 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BlocProvider<SupportStatsCubit>.value(
            value: cubit,
            child: const SingleChildScrollView(child: SupportInsightsHeader()),
          ),
        ),
      ),
    );
  }

  testWidgets('renders at 360px without overflow', (t) async {
    final repo = _MockRepo();
    when(
      () => repo.stats(
        dateFrom: any(named: 'dateFrom'),
        dateTo: any(named: 'dateTo'),
      ),
    ).thenAnswer(
      (_) async => SupportTicketStats.fromJson({
        'range': {'from': '2026-10-01', 'to': '2026-10-02'},
        'previousRange': {'from': '2026-09-29', 'to': '2026-09-30'},
        'kpis': {
          'created': {'value': 5, 'previous': 2},
          'open': {'value': 3},
          'inProgress': {'value': 1},
          'resolved': {'value': 2},
          'closed': {'value': 7},
          'unresolved': {'value': 4},
          'oldestOpenDays': {'value': 9},
        },
        'daily': [
          {'date': '2026-10-01', 'created': 3, 'previousCreated': 1},
          {'date': '2026-10-02', 'created': 2, 'previousCreated': 1},
        ],
        'byStatus': [
          {'status': 'OPEN', 'count': 3},
          {'status': 'IN_PROGRESS', 'count': 1},
        ],
        'byPriority': [
          {'priority': 'HIGH', 'count': 4, 'previousCount': 2},
        ],
      }),
    );
    final cubit = SupportStatsCubit(repo.stats);
    addTearDown(cubit.close);
    await pump(t, cubit);
    await cubit.load();
    await t.pump();
    await t.pump(const Duration(seconds: 2));
    expect(find.text('Created'), findsOneWidget);
    expect(find.text('Unresolved'), findsOneWidget);
    expect(find.text('Oldest open'), findsOneWidget);
    expect(find.text('9d'), findsOneWidget);
    expect(find.text('Created over time'), findsOneWidget);
    expect(find.text('In progress'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('forbidden state renders nothing', (t) async {
    final cubit = SupportStatsCubit(
      ({required String dateFrom, required String dateTo}) =>
          throw UnimplementedError(),
    )..hide();
    addTearDown(cubit.close);
    await pump(t, cubit);
    expect(find.text('Insights'), findsNothing);
  });
}
