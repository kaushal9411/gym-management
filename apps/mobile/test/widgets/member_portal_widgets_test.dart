import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/common/paginated_list_cubit.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_gym_info_screen.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_invoice_detail_screen.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_payments_screen.dart';
import 'package:gym_saas_mobile/features/member/presentation/widgets/member_insights.dart';
import 'package:gym_saas_mobile/models/gym_info.dart';
import 'package:gym_saas_mobile/models/member_invoice.dart';
import 'package:gym_saas_mobile/models/member_invoice_detail.dart';
import 'package:gym_saas_mobile/models/member_overview.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/portal_payment.dart';
import 'package:gym_saas_mobile/repositories/member_portal_repository.dart';
import 'package:mocktail/mocktail.dart';

import '../models/member_overview_test.dart' show fullFixture, realFixture;

class _MockRepo extends Mock implements MemberPortalRepository {}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  Future<void> pump(WidgetTester t, Widget child) async {
    t.view.physicalSize = const Size(360 * 3, 800 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(MaterialApp(home: Scaffold(body: child)));
  }

  testWidgets('insights: full overview at 360px, no overflow', (t) async {
    await pump(
      t,
      SingleChildScrollView(
        child: MemberInsightsBody(
          overview: MemberOverview.fromJson(fullFixture()),
        ),
      ),
    );
    await t.pump(const Duration(seconds: 2));
    expect(find.text('Insights'), findsOneWidget);
    expect(find.text('Membership'), findsOneWidget);
    expect(find.text('Visits this month'), findsOneWidget);
    expect(find.text('Streak 3d'), findsOneWidget);
    expect(find.text('Best 9d'), findsOneWidget);
    expect(find.text('Busiest: Sat'), findsOneWidget);
    expect(find.text('Workout progress'), findsOneWidget);
    expect(find.text('Diet'), findsOneWidget);
    expect(find.text('Next booked classes'), findsOneWidget);
    expect(find.text('Yoga'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('insights: real-shaped overview hides workout/diet/classes',
      (t) async {
    await pump(
      t,
      SingleChildScrollView(
        child: MemberInsightsBody(
          overview: MemberOverview.fromJson(realFixture()),
        ),
      ),
    );
    await t.pump(const Duration(seconds: 2));
    expect(find.text('Workout progress'), findsNothing);
    expect(find.text('Diet'), findsNothing);
    expect(find.text('Next booked classes'), findsNothing);
    expect(find.text('All paid'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('insights: expired membership shows warning state', (t) async {
    final j = fullFixture();
    (j['membership'] as Map<String, dynamic>)
      ..['expired'] = true
      ..['daysLeft'] = -4;
    await pump(
      t,
      SingleChildScrollView(
        child: MemberInsightsBody(overview: MemberOverview.fromJson(j)),
      ),
    );
    await t.pump(const Duration(seconds: 2));
    expect(find.text('Expired 1 Dec'), findsOneWidget);
    expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('payments list: rows, refunded note, 360px', (t) async {
    final cubit = PaginatedListCubit<PortalPayment>(
      (page) async => PaginatedResult<PortalPayment>(
        items: [
          PortalPayment.fromJson({
            'id': '1',
            'paymentNumber': 'PAY-0002',
            'amount': '2200.00',
            'method': 'ONLINE_GATEWAY',
            'status': 'PARTIALLY_REFUNDED',
            'paymentDate': '2026-10-03',
            'invoiceNumber': 'INV-0002',
            'totalRefunded': '200.00',
          }),
          PortalPayment.fromJson({
            'id': '2',
            'paymentNumber': 'PAY-0001',
            'amount': '100.00',
            'method': 'CASH',
            'status': 'SUCCESS',
            'paymentDate': '2026-10-03',
            'totalRefunded': '0.00',
          }),
        ],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      ),
    )..load();
    addTearDown(cubit.close);
    await pump(
      t,
      BlocProvider<PaginatedListCubit<PortalPayment>>.value(
        value: cubit,
        child: const MemberPaymentsView(),
      ),
    );
    await t.pump();
    await t.pump(const Duration(seconds: 2));
    expect(find.text('PAY-0002'), findsOneWidget);
    expect(find.text('-₹200.00 refunded'), findsOneWidget);
    expect(find.text('Success'), findsOneWidget);
    expect(find.textContaining('Cash'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('gym info: shows only filled fields; all-null shows empty state',
      (t) async {
    await pump(
      t,
      GymInfoBody(
        info: GymInfo.fromJson({
          'name': 'Gym',
          'address': {'line1': '1 Road', 'city': 'Pune'},
          'phone': '+911234567890',
          'businessHours': [
            {'day': 'monday', 'open': '06:00', 'close': '22:00'},
            {'day': 'sunday', 'closed': true},
          ],
          'branch': {'name': 'Main'},
        }),
      ),
    );
    await t.pump(const Duration(seconds: 2));
    expect(find.text('1 Road, Pune'), findsOneWidget);
    expect(find.text('+911234567890'), findsOneWidget);
    expect(find.text('06:00 – 22:00'), findsOneWidget);
    expect(find.text('Closed'), findsOneWidget);
    expect(find.text('Social'), findsNothing);
    expect(t.takeException(), isNull);

    await pump(
      t,
      GymInfoBody(info: GymInfo.fromJson({'name': 'Gym', 'branch': null})),
    );
    await t.pump(const Duration(seconds: 2));
    expect(find.text('No details shared yet'), findsOneWidget);
  });

  testWidgets('invoice detail: items, paid/balance and linked payments',
      (t) async {
    final repo = _MockRepo();
    when(() => repo.invoiceDetail('i1')).thenAnswer(
      (_) async => MemberInvoiceDetail.fromJson({
        'id': 'i1',
        'invoiceNumber': 'INV-1',
        'status': 'PARTIALLY_PAID',
        'subtotal': '100.00',
        'taxAmount': '0.00',
        'discountAmount': '10.00',
        'totalAmount': '90.00',
        'items': [
          {
            'description': 'Membership',
            'quantity': 1,
            'unitPrice': '100.00',
            'amount': '100.00',
          },
        ],
        'payments': [
          {
            'paymentNumber': 'PAY-9',
            'finalAmount': '40.00',
            'status': 'SUCCESS',
            'paymentDate': '2026-10-03',
          },
        ],
        'paid': '40.00',
        'balance': '50.00',
        'branch': {'name': 'Main'},
      }),
    );
    GetIt.I.registerSingleton<MemberPortalRepository>(repo);
    addTearDown(GetIt.I.reset);
    final invoice = MemberInvoice.fromJson({
      'id': 'i1',
      'invoiceNumber': 'INV-1',
      'member': {'id': 'm', 'memberId': 'MEM-1', 'name': 'A'},
      'invoiceDate': '2026-10-03',
      'dueDate': '2026-10-10',
      'subtotal': '100.00',
      'taxAmount': '0.00',
      'totalAmount': '90.00',
      'status': 'PARTIALLY_PAID',
    });
    t.view.physicalSize = const Size(360 * 3, 800 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      MaterialApp(home: MemberInvoiceDetailScreen(invoice: invoice)),
    );
    await t.pump();
    await t.pump(const Duration(seconds: 2));
    expect(find.text('Balance'), findsOneWidget);
    expect(find.text('₹50.00'), findsWidgets);
    expect(find.text('Discount'), findsOneWidget);
    expect(find.text('PAY-9'), findsOneWidget);
    expect(find.text('Payments'), findsOneWidget);
    expect(t.takeException(), isNull);
  });
}
