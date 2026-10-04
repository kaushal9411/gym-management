import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/features/finance/presentation/widgets/invoice_insights_header.dart';
import 'package:gym_saas_mobile/models/invoice_analytics.dart';
import 'package:gym_saas_mobile/repositories/invoice_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockRepo extends Mock implements InvoiceRepository {}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  Future<void> pump(WidgetTester t, InvoiceStatsCubit cubit) async {
    t.view.physicalSize = const Size(360 * 3, 800 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BlocProvider<InvoiceStatsCubit>.value(
            value: cubit,
            child: const SingleChildScrollView(child: InvoiceInsightsHeader()),
          ),
        ),
      ),
    );
  }

  testWidgets('renders at 360px without overflow', (t) async {
    final repo = _MockRepo();
    when(
      () => repo.analytics(
        dateFrom: any(named: 'dateFrom'),
        dateTo: any(named: 'dateTo'),
      ),
    ).thenAnswer(
      (_) async => InvoiceAnalytics.fromJson({
        'range': {'from': '2026-10-01', 'to': '2026-10-02'},
        'previousRange': {'from': '2026-09-29', 'to': '2026-09-30'},
        'kpis': {
          'invoiced': {'value': '5000.00', 'previous': '2500.00'},
          'count': {'value': 4, 'previous': 2},
          'collected': {'value': '3000.00', 'previous': '1000.00'},
          'avgInvoice': {'value': '1250.00', 'previous': '1250.00'},
          'collectionRate': {'value': 0.6, 'previous': 0.4},
          'outstanding': {'value': '2000.00', 'invoiceCount': 3},
          'overdue': {'value': '800.00', 'count': 1},
        },
        'daily': [
          {
            'date': '2026-10-01',
            'invoiced': '3000.00',
            'count': 2,
            'previousInvoiced': '1000.00',
          },
          {
            'date': '2026-10-02',
            'invoiced': '2000.00',
            'count': 2,
            'previousInvoiced': '1500.00',
          },
        ],
        'byStatus': [
          {'status': 'PARTIALLY_PAID', 'count': 2, 'amount': '3000.00'},
        ],
        'aging': [
          {'bucket': 'Current', 'count': 2, 'amount': '1200.00'},
          {'bucket': '90+', 'count': 1, 'amount': '800.00'},
        ],
        'topDebtors': [
          {
            'memberId': 'm1',
            'memberCode': 'M-001',
            'name': 'Asha Verma',
            'outstanding': '800.00',
            'invoiceCount': 1,
          },
        ],
        'branches': [
          {
            'branchId': 'b1',
            'name': 'Main',
            'invoiced': '3000.00',
            'collected': '2000.00',
          },
          {
            'branchId': 'b2',
            'name': 'East',
            'invoiced': '2000.00',
            'collected': '1000.00',
          },
        ],
      }),
    );
    final cubit = InvoiceStatsCubit(repo.analytics);
    addTearDown(cubit.close);
    await pump(t, cubit);
    await cubit.load();
    await t.pump();
    await t.pump(const Duration(seconds: 2));
    expect(find.text('Invoiced'), findsOneWidget);
    expect(find.text('Collection rate'), findsOneWidget);
    expect(find.text('Overdue'), findsOneWidget);
    expect(find.text('Invoiced over time'), findsOneWidget);
    expect(find.text('Receivables ageing'), findsOneWidget);
    expect(find.text('Asha Verma'), findsOneWidget);
    expect(find.text('Branch comparison'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('forbidden state renders nothing', (t) async {
    final cubit = InvoiceStatsCubit(
      ({required String dateFrom, required String dateTo}) =>
          throw UnimplementedError(),
    )..hide();
    addTearDown(cubit.close);
    await pump(t, cubit);
    expect(find.text('Insights'), findsNothing);
  });
}
