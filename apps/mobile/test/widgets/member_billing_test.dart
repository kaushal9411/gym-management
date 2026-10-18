import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/core/export/export_sink.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_invoice_detail_screen.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_invoice_logic.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_invoices_screen.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_notifications_screen.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_payments_screen.dart';
import 'package:gym_saas_mobile/models/member_invoice.dart';
import 'package:gym_saas_mobile/models/member_invoice_detail.dart';
import 'package:gym_saas_mobile/models/member_overview.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/portal_payment.dart';
import 'package:gym_saas_mobile/models/report_export.dart';
import 'package:gym_saas_mobile/models/tenant_notification.dart';
import 'package:gym_saas_mobile/repositories/member_notification_repository.dart';
import 'package:gym_saas_mobile/repositories/member_portal_repository.dart';
import 'package:mocktail/mocktail.dart';

import '../models/member_overview_test.dart' show fullFixture;

class _Repo extends Mock implements MemberPortalRepository {}

class _Notifs extends Mock implements MemberNotificationRepository {}

class _Sink extends Mock implements ExportSink {}

PaginatedResult<T> _page<T>(List<T> items, {int? total}) => PaginatedResult<T>(
      items: items,
      total: total ?? items.length,
      page: 1,
      limit: 20,
      totalPages: 1,
    );

MemberInvoice _inv(String id, String status, {int dueInDays = 5}) =>
    MemberInvoice(
      id: id,
      invoiceNumber: 'INV-$id',
      member: const InvoiceMemberSummary(
        id: 'm',
        memberId: 'MEM-1',
        name: 'Asha',
      ),
      invoiceDate: DateTime(2026, 10, 1),
      dueDate: DateTime.now().add(Duration(days: dueInDays)),
      subtotal: 1000,
      taxAmount: 0,
      totalAmount: 1000,
      status: status,
    );

TenantNotification _n(
  String id,
  String cat, {
  bool unread = true,
  int hoursAgo = 1,
}) =>
    TenantNotification(
      id: id,
      category: cat,
      title: 'Title $id',
      body: 'Body of $id',
      readAt: unread ? null : DateTime.now(),
      createdAt: DateTime.now().subtract(Duration(hours: hoursAgo)),
    );

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    registerFallbackValue(
      ReportExportFile(
        bytes: Uint8List(1),
        filename: 'x.pdf',
        format: ReportExportFormat.pdf,
      ),
    );
  });

  late _Repo repo;
  late _Notifs notifs;
  late _Sink sink;

  setUp(() {
    repo = _Repo();
    notifs = _Notifs();
    sink = _Sink();
    final g = GetIt.instance;
    for (final t in [
      MemberPortalRepository,
      MemberNotificationRepository,
      ExportSink,
    ]) {
      if (t == MemberPortalRepository &&
          g.isRegistered<MemberPortalRepository>()) {
        g.unregister<MemberPortalRepository>();
      }
      if (t == MemberNotificationRepository &&
          g.isRegistered<MemberNotificationRepository>()) {
        g.unregister<MemberNotificationRepository>();
      }
      if (t == ExportSink && g.isRegistered<ExportSink>()) {
        g.unregister<ExportSink>();
      }
    }
    g.registerSingleton<MemberPortalRepository>(repo);
    g.registerSingleton<MemberNotificationRepository>(notifs);
    g.registerSingleton<ExportSink>(sink);

    when(() => repo.overview())
        .thenAnswer((_) async => MemberOverview.fromJson(fullFixture()));
    when(() => repo.invoices(limit: any(named: 'limit'))).thenAnswer(
      (_) async => _page([
        _inv('1', 'PAID'),
        _inv('2', 'UNPAID'),
        _inv('3', 'OVERDUE', dueInDays: -4),
      ]),
    );
    when(() => repo.invoiceDetail(any())).thenAnswer(
      (_) async => MemberInvoiceDetail.fromJson({
        'id': 'i1',
        'invoiceNumber': 'INV-1',
        'invoiceDate': '2026-10-03',
        'dueDate': '2026-10-10',
        'status': 'PARTIALLY_PAID',
        'subtotal': '100.00',
        'taxAmount': '5.00',
        'discountAmount': '10.00',
        'totalAmount': '95.00',
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
        'balance': '55.00',
        'branch': {'name': 'Main'},
      }),
    );
    when(() => repo.downloadInvoice(any(), any())).thenAnswer(
      (_) async => ReportExportFile(
        bytes: Uint8List.fromList([1, 2, 3]),
        filename: 'INV-2.pdf',
        format: ReportExportFormat.pdf,
      ),
    );
    when(() => sink.share(any(), origin: any(named: 'origin')))
        .thenAnswer((_) async => true);
    when(
      () => repo.payments(
        page: any(named: 'page'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer(
      (_) async => _page([
        PortalPayment.fromJson({
          'id': '1',
          'paymentNumber': 'PAY-0002',
          'amount': '2200.00',
          'method': 'ONLINE_GATEWAY',
          'status': 'PARTIALLY_REFUNDED',
          'paymentDate': '2026-10-03',
          'invoiceId': 'i1',
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
      ]),
    );
    when(() => notifs.unreadCount()).thenAnswer((_) async => 2);
    when(
      () => notifs.list(
        page: any(named: 'page'),
        unreadOnly: any(named: 'unreadOnly'),
        category: any(named: 'category'),
      ),
    ).thenAnswer(
      (_) async => _page([
        _n('1', 'PAYMENT'),
        _n('2', 'ANNOUNCEMENT', unread: false, hoursAgo: 30),
      ]),
    );
    when(() => notifs.markRead(any())).thenAnswer((_) async {});
    when(() => notifs.markAllRead()).thenAnswer((_) async {});
  });

  Future<void> pump(
    WidgetTester t,
    Widget child, {
    Size size = const Size(360, 740),
  }) async {
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final router = GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, __) => const SizedBox()),
        GoRoute(path: '/x', builder: (_, __) => child),
        GoRoute(
          path: '/member/invoices/detail',
          builder: (_, s) => s.extra is String
              ? MemberInvoiceDetailScreen(invoiceId: s.extra! as String)
              : MemberInvoiceDetailScreen(invoice: s.extra! as MemberInvoice),
        ),
        GoRoute(
          path: '/member/payments',
          builder: (_, __) => const Text('PAYS'),
        ),
      ],
    );
    await t.pumpWidget(MaterialApp.router(routerConfig: router));
    router.push('/x');
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  Future<void> show(WidgetTester t, Finder f) async {
    for (var i = 0; i < 40 && f.evaluate().isEmpty; i++) {
      await t.drag(find.byType(Scrollable).first, const Offset(0, -300));
      await t.pump();
    }
    await t.ensureVisible(f.first);
    await t.pump();
  }

  test('invoice due chip and status helpers', () {
    final now = DateTime(2026, 10, 18);
    expect(invoiceDueChip('PAID', now, now), isNull);
    expect(
      invoiceDueChip('UNPAID', DateTime(2026, 10, 14), now)!.label,
      'Overdue by 4 days',
    );
    expect(invoiceDueChip('UNPAID', now, now)!.label, 'Due today');
    expect(
      invoiceDueChip('UNPAID', DateTime(2026, 10, 19), now)!.label,
      'Due in 1 day',
    );
    expect(isOpenInvoice('PARTIALLY_PAID'), isTrue);
    expect(isOpenInvoice('CANCELLED'), isFalse);
  });

  group('invoices', () {
    testWidgets('hero, filters with counts, cards at 360', (t) async {
      await pump(t, const MemberInvoicesScreen());
      expect(t.takeException(), isNull);
      for (final l in [
        'My invoices',
        'Payment history',
        'INV-1',
        'INV-2',
        'INV-3',
        'Overdue by 4 days',
      ]) {
        await show(t, find.text(l));
        expect(find.text(l), findsWidgets, reason: l);
      }
      expect(find.text('All · 3'), findsOneWidget);
      expect(find.text('Unpaid · 1'), findsOneWidget);
    });

    testWidgets('a filter narrows the list', (t) async {
      await pump(t, const MemberInvoicesScreen());
      await show(t, find.byKey(const ValueKey('inv-filter-PAID')));
      await t.tap(find.byKey(const ValueKey('inv-filter-PAID')));
      await t.pump();
      expect(find.text('INV-1'), findsOneWidget);
      expect(find.text('INV-2'), findsNothing);
    });

    testWidgets('Pay only on open invoices; PDF shares the file', (t) async {
      await pump(t, const MemberInvoicesScreen());
      expect(find.byKey(const ValueKey('inv-pay-1')), findsNothing);
      await show(t, find.byKey(const ValueKey('inv-pay-2')));
      expect(find.byKey(const ValueKey('inv-pay-2')), findsOneWidget);
      await show(t, find.byKey(const ValueKey('inv-pdf-2')));
      await t.tap(find.byKey(const ValueKey('inv-pdf-2')));
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      verify(() => repo.downloadInvoice('2', 'INV-2')).called(1);
      verify(() => sink.share(any(), origin: any(named: 'origin'))).called(1);
    });

    testWidgets('a failed download shows no crash', (t) async {
      when(() => repo.downloadInvoice(any(), any()))
          .thenAnswer((_) async => throw ApiException.network());
      await pump(t, const MemberInvoicesScreen());
      await show(t, find.byKey(const ValueKey('inv-pdf-2')));
      await t.tap(find.byKey(const ValueKey('inv-pdf-2')));
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      verifyNever(() => sink.share(any(), origin: any(named: 'origin')));
      expect(t.takeException(), isNull);
    });

    testWidgets('a share sheet failure falls back to the PDF preview',
        (t) async {
      when(() => sink.share(any(), origin: any(named: 'origin')))
          .thenAnswer((_) async => throw StateError('no share'));
      when(() => sink.printPdf(any(), jobName: any(named: 'jobName')))
          .thenAnswer((_) async => true);
      await pump(t, const MemberInvoicesScreen());
      await show(t, find.byKey(const ValueKey('inv-pdf-2')));
      await t.tap(find.byKey(const ValueKey('inv-pdf-2')));
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      verify(() => sink.printPdf(any(), jobName: 'INV-2')).called(1);
      expect(find.textContaining('Could not'), findsNothing);
    });

    testWidgets('both failing shows the real reason', (t) async {
      when(() => sink.share(any(), origin: any(named: 'origin')))
          .thenAnswer((_) async => throw StateError('no share'));
      when(() => sink.printPdf(any(), jobName: any(named: 'jobName')))
          .thenAnswer((_) async => throw StateError('no print'));
      await pump(t, const MemberInvoicesScreen());
      await show(t, find.byKey(const ValueKey('inv-pdf-2')));
      await t.tap(find.byKey(const ValueKey('inv-pdf-2')));
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      expect(find.textContaining('no print'), findsOneWidget);
    });

    testWidgets('a server error message is shown', (t) async {
      when(() => repo.downloadInvoice(any(), any())).thenAnswer(
        (_) async => throw const ApiException(message: 'Invoice not found'),
      );
      await pump(t, const MemberInvoicesScreen());
      await show(t, find.byKey(const ValueKey('inv-pdf-2')));
      await t.tap(find.byKey(const ValueKey('inv-pdf-2')));
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      expect(find.textContaining('Invoice not found'), findsOneWidget);
    });

    testWidgets('empty and error states', (t) async {
      when(() => repo.invoices(limit: any(named: 'limit')))
          .thenAnswer((_) async => _page(<MemberInvoice>[]));
      await pump(t, const MemberInvoicesScreen());
      await show(t, find.text('No invoices yet'));
      expect(find.text('No invoices yet'), findsWidgets);

      when(() => repo.invoices(limit: any(named: 'limit')))
          .thenAnswer((_) async => throw ApiException.network());
      await pump(t, const MemberInvoicesScreen());
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('Load more shows what is left', (t) async {
      when(() => repo.invoices(limit: any(named: 'limit'))).thenAnswer(
        (_) async => _page([_inv('1', 'PAID')], total: 25),
      );
      await pump(t, const MemberInvoicesScreen());
      await show(t, find.text('Load more (24 left)'));
      await t.tap(find.text('Load more (24 left)'));
      await t.pump();
      verify(() => repo.invoices(limit: 40)).called(1);
    });

    testWidgets('tablet 1500x1300', (t) async {
      await pump(t, const MemberInvoicesScreen(), size: const Size(1500, 1300));
      await show(t, find.text('INV-3'));
      expect(t.takeException(), isNull);
    });
  });

  group('invoice detail', () {
    testWidgets('items, totals, payments and actions', (t) async {
      await pump(
        t,
        MemberInvoiceDetailScreen(invoice: _inv('i1', 'PARTIALLY_PAID')),
      );
      expect(t.takeException(), isNull);
      for (final l in [
        'INV-1',
        'Pay now',
        'Download PDF',
        'Items',
        'Membership',
        'Discount',
        'Balance due',
        'PAY-9',
      ]) {
        await show(t, find.text(l));
        expect(find.text(l), findsWidgets, reason: l);
      }
    });

    testWidgets('opened by id only (from a payment)', (t) async {
      await pump(t, const MemberInvoiceDetailScreen(invoiceId: 'i1'));
      expect(find.text('INV-1'), findsWidgets);
      await show(t, find.text('PAY-9'));
      expect(t.takeException(), isNull);
    });

    testWidgets('id-only load failure shows retry', (t) async {
      when(() => repo.invoiceDetail(any()))
          .thenAnswer((_) async => throw ApiException.network());
      await pump(t, const MemberInvoiceDetailScreen(invoiceId: 'i1'));
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('a paid invoice has no Pay now', (t) async {
      when(() => repo.invoiceDetail(any())).thenAnswer(
        (_) async => MemberInvoiceDetail.fromJson({
          'id': 'i1',
          'invoiceNumber': 'INV-1',
          'status': 'PAID',
          'subtotal': '100',
          'taxAmount': '0',
          'discountAmount': '0',
          'totalAmount': '100',
          'items': <dynamic>[],
          'payments': <dynamic>[],
          'paid': '100',
          'balance': '0',
          'branch': {'name': 'Main'},
        }),
      );
      await pump(t, MemberInvoiceDetailScreen(invoice: _inv('i1', 'PAID')));
      expect(find.text('Pay now'), findsNothing);
      expect(find.text('Download PDF'), findsOneWidget);
    });

    testWidgets('tablet 1500x1300', (t) async {
      await pump(
        t,
        MemberInvoiceDetailScreen(invoice: _inv('i1', 'UNPAID')),
        size: const Size(1500, 1300),
      );
      expect(t.takeException(), isNull);
    });
  });

  group('payments', () {
    testWidgets('rows, refund note, method and invoice link at 360', (t) async {
      await pump(t, const MemberPaymentsScreen());
      expect(t.takeException(), isNull);
      expect(find.text('Payment history'), findsOneWidget);
      await show(t, find.text('PAY-0002'));
      expect(find.textContaining('₹200 refunded'), findsOneWidget);
      expect(find.text('Part refunded'), findsOneWidget);
      expect(find.textContaining('Cash'), findsOneWidget);
      expect(find.text('Full history'), findsOneWidget);
    });

    testWidgets('a payment with an invoice opens it', (t) async {
      await pump(t, const MemberPaymentsScreen());
      await show(t, find.text('PAY-0002'));
      await t.tap(find.text('PAY-0002'));
      await t.pump();
      await t.pump(const Duration(seconds: 2));
      expect(find.text('Items'), findsWidgets);
    });

    testWidgets('empty and error', (t) async {
      when(
        () => repo.payments(
          page: any(named: 'page'),
          limit: any(named: 'limit'),
        ),
      ).thenAnswer((_) async => _page(<PortalPayment>[]));
      await pump(t, const MemberPaymentsScreen());
      await show(t, find.text('No payments yet'));
      expect(find.text('No payments yet'), findsWidgets);
      when(
        () => repo.payments(
          page: any(named: 'page'),
          limit: any(named: 'limit'),
        ),
      ).thenAnswer((_) async => throw ApiException.network());
      await pump(t, const MemberPaymentsScreen());
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('tablet 1500x1300', (t) async {
      await pump(t, const MemberPaymentsScreen(), size: const Size(1500, 1300));
      await show(t, find.text('PAY-0001'));
      expect(t.takeException(), isNull);
    });
  });

  group('notifications', () {
    testWidgets('hero, filters, day groups, tags at 360', (t) async {
      await pump(t, const MemberNotificationsScreen());
      expect(t.takeException(), isNull);
      for (final l in [
        'Notifications',
        '2 unread updates',
        'Mark all read',
        'Everything',
        'From staff',
        'Title 1',
        'Body of 1',
        'Payments',
      ]) {
        await show(t, find.text(l));
        expect(find.text(l), findsWidgets, reason: l);
      }
      // Near midnight "1 hour ago" is already yesterday.
      expect(
        find.byWidgetPredicate(
          (w) =>
              w is Text &&
              RegExp(r'^(TODAY|YESTERDAY)$').hasMatch(w.data ?? ''),
        ),
        findsWidgets,
      );
    });

    testWidgets('tapping an unread one marks it read', (t) async {
      await pump(t, const MemberNotificationsScreen());
      await show(t, find.text('Title 1'));
      await t.tap(find.text('Title 1'));
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      verify(() => notifs.markRead('1')).called(1);
    });

    testWidgets('read ones do not call markRead', (t) async {
      await pump(t, const MemberNotificationsScreen());
      await show(t, find.text('Title 2'));
      await t.tap(find.text('Title 2'));
      await t.pump();
      verifyNever(() => notifs.markRead('2'));
    });

    testWidgets('Mark all read calls the API', (t) async {
      await pump(t, const MemberNotificationsScreen());
      await t.tap(find.text('Mark all read'));
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      verify(() => notifs.markAllRead()).called(1);
    });

    testWidgets('Unread switch and a category use the server params',
        (t) async {
      await pump(t, const MemberNotificationsScreen());
      await t.tap(find.byKey(const ValueKey('notif-read-true')));
      await t.pump();
      verify(
        () => notifs.list(
          page: 1,
          unreadOnly: true,
          category: null,
        ),
      ).called(greaterThan(0));
      await show(t, find.byKey(const ValueKey('notif-cat-STAFF')));
      await t.tap(find.byKey(const ValueKey('notif-cat-STAFF')));
      await t.pump();
      verify(
        () => notifs.list(
          page: 1,
          unreadOnly: true,
          category: 'STAFF',
        ),
      ).called(1);
    });

    testWidgets('all read + empty + error', (t) async {
      when(() => notifs.unreadCount()).thenAnswer((_) async => 0);
      when(
        () => notifs.list(
          page: any(named: 'page'),
          unreadOnly: any(named: 'unreadOnly'),
          category: any(named: 'category'),
        ),
      ).thenAnswer((_) async => _page(<TenantNotification>[]));
      await pump(t, const MemberNotificationsScreen());
      expect(find.text("You're all caught up"), findsOneWidget);
      await show(t, find.text('Nothing here yet'));
      expect(find.text('Nothing here yet'), findsWidgets);

      when(
        () => notifs.list(
          page: any(named: 'page'),
          unreadOnly: any(named: 'unreadOnly'),
          category: any(named: 'category'),
        ),
      ).thenAnswer((_) async => throw ApiException.network());
      await pump(t, const MemberNotificationsScreen());
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('tablet 1500x1300', (t) async {
      await pump(
        t,
        const MemberNotificationsScreen(),
        size: const Size(1500, 1300),
      );
      await show(t, find.text('Title 2'));
      expect(t.takeException(), isNull);
    });
  });
}
