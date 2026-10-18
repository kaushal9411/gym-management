import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/finance/payments_analytics_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/routing/app_routes.dart';
import 'package:gym_saas_mobile/features/finance/presentation/payment_detail_screen.dart';
import 'package:gym_saas_mobile/features/finance/presentation/payments_screen.dart';
import 'package:gym_saas_mobile/features/finance/presentation/record_payment_screen.dart';
import 'package:gym_saas_mobile/models/branch_option.dart';
import 'package:gym_saas_mobile/models/member_payment.dart';
import 'package:gym_saas_mobile/models/member_summary.dart';
import 'package:gym_saas_mobile/models/membership_plan.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/payable_invoice.dart';
import 'package:gym_saas_mobile/models/payment_link_result.dart';
import 'package:gym_saas_mobile/models/payments_analytics.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';
import 'package:gym_saas_mobile/repositories/finance_repository.dart';
import 'package:gym_saas_mobile/repositories/membership_plan_repository.dart';
import 'package:gym_saas_mobile/repositories/payment_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockSession extends MockCubit<SessionState> implements SessionCubit {}

Map<String, dynamic> _raw({
  String id = 'p3',
  String number = 'PAY-0003',
  String status = 'SUCCESS',
  String method = 'UPI',
  String name = 'Riya Shah',
  String finalAmount = '1180.00',
  String totalRefunded = '0.00',
  String? invoiceId = 'inv1',
  bool detail = false,
  List<Map<String, dynamic>> refunds = const [],
}) =>
    {
      'id': id,
      'paymentNumber': number,
      'member': {'id': 'm-$id', 'memberId': 'MEM-000$id', 'name': name},
      'branch': {'id': 'b1', 'name': 'Bandra'},
      'membership': {'id': 'ms1', 'planName': 'Gold'},
      'invoiceId': invoiceId,
      'amount': '1000.00',
      'discount': '0.00',
      'tax': '180.00',
      'finalAmount': finalAmount,
      'method': method,
      'paymentDate': '2026-10-03',
      'transactionReference': 'UTR1',
      'status': status,
      'createdAt': '2026-10-03T10:15:00.000Z',
      'totalRefunded': totalRefunded,
      if (detail) ...{
        'notes': 'Walk-in',
        'updatedAt': '2026-10-03T10:15:00.000Z',
        'recordedBy': {'id': 'u1', 'name': 'Asha Rao'},
        'refunds': refunds,
      },
    };

MemberPayment _p([Map<String, dynamic>? raw]) =>
    MemberPayment.fromJson(raw ?? _raw());

PaymentsAnalytics _analytics() => PaymentsAnalytics.fromJson({
      'range': {'from': '2026-10-01', 'to': '2026-10-03'},
      'previousRange': {'from': '2026-09-28', 'to': '2026-09-30'},
      'kpis': {
        'collected': {'value': '2500.00', 'previous': '2000.00'},
        'todayCollected': {'value': '500.00', 'count': 2},
        'outstanding': {'value': '300.00', 'invoiceCount': 3},
        'refunded': {
          'value': '200.00',
          'previous': '100.00',
          'count': 1,
          'rate': 0.08,
        },
        'avgPayment': {'value': '833.00', 'previous': '1000.00'},
        'paymentCount': {'value': 6, 'previous': 4},
        'successRate': {'value': 0.5, 'previous': 1},
      },
      'daily': [
        {
          'date': '2026-10-01',
          'collected': '1000.00',
          'refunded': '0.00',
          'count': 2,
          'previousCollected': '800.00',
        },
        {
          'date': '2026-10-02',
          'collected': '0.00',
          'refunded': '200.00',
          'count': 0,
          'previousCollected': '600.00',
        },
        {
          'date': '2026-10-03',
          'collected': '1500.00',
          'refunded': '0.00',
          'count': 3,
          'previousCollected': '600.00',
        },
      ],
      'methods': [
        {'method': 'UPI', 'amount': '1500.00', 'count': 3},
        {'method': 'CASH', 'amount': '1000.00', 'count': 2},
      ],
      'statuses': [
        {'status': 'SUCCESS', 'count': 3},
        {'status': 'PENDING', 'count': 1},
        {'status': 'PARTIALLY_REFUNDED', 'count': 1},
        {'status': 'FAILED', 'count': 1},
      ],
      'branches': [
        {
          'branchId': 'b1',
          'name': 'Bandra',
          'revenue': '2500.00',
          'previousRevenue': '2000.00',
        },
      ],
      'topPlans': [
        {'planName': 'Gold', 'revenue': '2000.00', 'count': 2},
      ],
      'attention': {
        'pendingOver24h': 1,
        'failed': 1,
        'overdueInvoices': {'count': 3, 'amount': '300.00'},
      },
    });

class _PayRepo extends Fake implements PaymentRepository {
  _PayRepo() {
    rows = [
      _p(),
      _p(
        _raw(
          id: 'p2',
          number: 'PAY-0002',
          status: 'PENDING',
          method: 'ONLINE_GATEWAY',
          name: 'Karan Mehta',
          finalAmount: '500.00',
          invoiceId: null,
        ),
      ),
      _p(
        _raw(
          id: 'p1',
          number: 'PAY-0001',
          status: 'PARTIALLY_REFUNDED',
          method: 'CASH',
          name: 'Asha Rao',
          finalAmount: '1000.00',
          totalRefunded: '200.00',
        ),
      ),
    ];
  }

  late List<MemberPayment> rows;
  MemberPayment? detail;
  final calls = <String>[];
  final listCalls = <Map<String, Object?>>[];
  final analyticsCalls = <Map<String, Object?>>[];
  Map<String, Object?>? refundArgs;
  String verifyStatus = 'SUCCESS';
  List<PayableInvoice> invoices = const [];
  InvoiceDue due = const InvoiceDue(number: 'INV-1', total: 1000, paid: 400);
  bool failAnalytics = false;

  @override
  Future<PaymentsAnalytics> analytics({
    String? dateFrom,
    String? dateTo,
    String? branchId,
  }) async {
    analyticsCalls.add({'from': dateFrom, 'to': dateTo, 'branch': branchId});
    if (failAnalytics) {
      throw const ApiException(message: 'nope', statusCode: 403);
    }
    return _analytics();
  }

  @override
  Future<({PaginatedResult<MemberPayment> page, PaymentListSummary? summary})>
      listWithSummary({
    int page = 1,
    String? search,
    String? status,
    String? method,
    String? planId,
    String? branchId,
    double? minAmount,
    double? maxAmount,
    String? dateFrom,
    String? dateTo,
    String? sortBy,
    String? sortDir,
  }) async {
    listCalls.add({
      'page': page,
      'search': search,
      'status': status,
      'method': method,
      'planId': planId,
      'branchId': branchId,
      'min': minAmount,
      'max': maxAmount,
      'from': dateFrom,
      'to': dateTo,
      'sortBy': sortBy,
      'sortDir': sortDir,
    });
    return (
      page: PaginatedResult(
        items: rows,
        total: rows.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      ),
      summary: const PaymentListSummary(
        collectedTotal: 2180,
        refundedTotal: 200,
      ),
    );
  }

  @override
  Future<PaginatedResult<MemberPayment>> list({
    int page = 1,
    String? search,
    String? status,
    String? memberId,
    int limit = 20,
  }) async {
    calls.add('list:$memberId:${status ?? ''}:$limit');
    return PaginatedResult(
      items: [
        _p(_raw(id: 'o1', number: 'PAY-0099', finalAmount: '70.00')),
      ],
      total: 1,
      page: 1,
      limit: limit,
      totalPages: 1,
    );
  }

  @override
  Future<MemberPayment> getById(String paymentId) async =>
      detail ?? rows.firstWhere((p) => p.id == paymentId);

  @override
  Future<MemberPayment> refund(
    String paymentId, {
    double? amount,
    String? reason,
  }) async {
    refundArgs = {'amount': amount, 'reason': reason};
    final d = detail!;
    detail = _p(
      _raw(
        id: d.id,
        number: d.paymentNumber,
        status: 'REFUNDED',
        totalRefunded: d.finalAmount.toStringAsFixed(2),
        finalAmount: d.finalAmount.toStringAsFixed(2),
        detail: true,
        refunds: [
          {
            'id': 'r1',
            'amount': d.finalAmount.toStringAsFixed(2),
            'reason': reason,
            'refundedAt': '2026-10-04T09:00:00.000Z',
          },
        ],
      ),
    );
    return detail!;
  }

  @override
  Future<void> cancel(String paymentId) async {
    calls.add('cancel:$paymentId');
    final d = detail!;
    detail = _p(
      _raw(
        id: d.id,
        number: d.paymentNumber,
        status: 'CANCELLED',
        detail: true,
      ),
    );
  }

  @override
  Future<String> verify(String paymentId) async {
    calls.add('verify:$paymentId');
    return verifyStatus;
  }

  @override
  Future<void> resendLink(String paymentId, String medium) async =>
      calls.add('resend:$paymentId:$medium');

  @override
  Future<List<PayableInvoice>> outstandingInvoices(String memberId) async {
    calls.add('invoices:$memberId');
    return invoices;
  }

  @override
  Future<InvoiceDue> invoiceDue(String invoiceId) async {
    calls.add('due:$invoiceId');
    return due;
  }
}

class _FinRepo extends Fake implements FinanceRepository {
  MemberSummary member = MemberSummary.fromJson({
    'id': 'm1',
    'memberId': 'MEM-0001',
    'name': 'Riya Shah',
    'email': 'riya@x.test',
    'phone': '9999999999',
    'outstandingAmount': '250.00',
    'currentMembership': {
      'planName': 'Gold',
      'endDate': '2026-12-01T00:00:00.000Z',
    },
  });
  Map<String, Object?>? recorded;
  Map<String, Object?>? linked;

  @override
  Future<List<MemberSummary>> searchMembers(String query) async => [member];

  @override
  Future<MemberPayment> recordPayment({
    required String memberId,
    required double amount,
    required String method,
    String? membershipId,
    double? discount,
    double? tax,
    String? status,
    String? invoiceId,
    String? paymentDate,
    String? transactionReference,
    String? notes,
  }) async {
    recorded = {
      'memberId': memberId,
      'amount': amount,
      'method': method,
      'discount': discount,
      'tax': tax,
      'invoiceId': invoiceId,
      'paymentDate': paymentDate,
      'reference': transactionReference,
      'notes': notes,
      'membershipId': membershipId,
    };
    return _p(_raw(id: 'new', number: 'PAY-0100', finalAmount: '500.00'));
  }

  @override
  Future<PaymentLinkResult> createPaymentLink({
    required String memberId,
    required double amount,
    bool? notifyEmail,
    bool? notifySms,
    String? invoiceId,
    double? discount,
    double? tax,
    String? notes,
  }) async {
    linked = {
      'memberId': memberId,
      'amount': amount,
      'email': notifyEmail,
      'sms': notifySms,
      'invoiceId': invoiceId,
      'discount': discount,
      'tax': tax,
      'notes': notes,
    };
    return PaymentLinkResult(
      payment: _p(
        _raw(
          id: 'lnk',
          number: 'PAY-0101',
          status: 'PENDING',
          method: 'ONLINE_GATEWAY',
          finalAmount: '500.00',
        ),
      ),
      shortUrl: 'https://rzp.io/abc',
      notifiedEmail: notifyEmail ?? false,
      notifiedSms: notifySms ?? false,
    );
  }
}

class _BranchRepo extends Fake implements BranchRepository {
  @override
  Future<List<BranchOption>> assignable() async => const [
        BranchOption(id: 'b1', name: 'Bandra'),
        BranchOption(id: 'b2', name: 'Andheri'),
      ];
}

class _PlanRepo extends Fake implements MembershipPlanRepository {
  @override
  Future<PaginatedResult<MembershipPlan>> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? isActive,
    bool includeDeleted = false,
    String? sortBy,
    String? sortDir,
  }) async =>
      PaginatedResult(
        items: const [],
        total: 0,
        page: 1,
        limit: limit,
        totalPages: 1,
      );
}

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

const _view = ['finance:view'];
const _create = ['finance:view', 'finance:payment-create'];
const _refund = ['finance:view', 'finance:payment-refund'];
const _all = [
  'finance:view',
  'finance:payment-create',
  'finance:payment-refund',
  'finance:invoice-view',
];

late _PayRepo _pay;
late _FinRepo _fin;

Future<void> settle(WidgetTester t) async {
  await t.pump();
  await t.pump(const Duration(seconds: 3));
}

Future<void> scrollTo(WidgetTester t, Finder f) async {
  await t.scrollUntilVisible(
    f,
    300,
    scrollable: find.byType(Scrollable).first,
  );
  await t.pump();
}

/// Scrolls [f] into view, then away from the transparent app bar of the hero
/// pages.
Future<void> reveal(WidgetTester t, Finder f) async {
  await scrollTo(t, f);
  final dy = t.getCenter(f.first).dy;
  if (dy < 200) {
    await t.drag(find.byType(Scrollable).first, const Offset(0, 260));
  } else if (dy > 650) {
    await t.drag(find.byType(Scrollable).first, const Offset(0, -260));
  }
  await t.pump();
}

Future<void> tapText(WidgetTester t, String text) async {
  await t.pump(); // flush a setState from a preceding enterText
  final f = find.text(text);
  await t.ensureVisible(f.first);
  await t.pump();
  await t.pump(const Duration(milliseconds: 400));
  if (f.hitTestable().evaluate().isEmpty) {
    // ensureVisible can leave the page ignoring pointers; a nudge wakes it.
    await t.drag(find.byType(Scrollable).first, const Offset(0, 2));
    await t.pump(const Duration(milliseconds: 400));
  }
  await t.tap(f.first);
  await settle(t);
}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  setUp(() {
    final g = GetIt.instance;
    _pay = _PayRepo();
    _fin = _FinRepo();
    void reg<T extends Object>(T v) {
      if (g.isRegistered<T>()) g.unregister<T>();
      g.registerSingleton<T>(v);
    }

    reg<PaymentRepository>(_pay);
    reg<FinanceRepository>(_fin);
    reg<BranchRepository>(_BranchRepo());
    reg<MembershipPlanRepository>(_PlanRepo());
    if (g.isRegistered<PaymentsAnalyticsCubit>()) {
      g.unregister<PaymentsAnalyticsCubit>();
    }
    g.registerFactory<PaymentsAnalyticsCubit>(
      () => PaymentsAnalyticsCubit(_pay),
    );
  });

  SessionCubit sessionWith(List<String> perms) {
    final session = _MockSession();
    when(() => session.state).thenReturn(
      SessionAuthenticatedStaff(
        UserProfile(
          id: 'me',
          tenantId: 't',
          name: 'Me',
          email: 'me@x.test',
          phone: null,
          status: 'ACTIVE',
          roles: const ['OWNER'],
          permissions: perms,
        ),
        _tenant,
      ),
    );
    return session;
  }

  const phone = Size(560, 900);
  const tablet = Size(1500, 1300);

  void setSize(WidgetTester t, Size size) {
    t.view.physicalSize = size * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
  }

  /// Routed so `context.push` / `pop` work; the screen under test is at /x.
  Future<void> pumpRouted(
    WidgetTester t,
    Widget screen, {
    List<String> perms = _all,
    Size size = phone,
  }) async {
    setSize(t, size);
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(body: Text('home')),
        ),
        GoRoute(path: '/x', builder: (_, __) => screen),
        GoRoute(
          path: AppRoutes.paymentDetail,
          builder: (_, state) =>
              Scaffold(body: Text('detail-route:${state.extra}')),
        ),
        GoRoute(
          path: AppRoutes.recordPayment,
          builder: (_, __) => const Scaffold(body: Text('record-route')),
        ),
        GoRoute(
          path: AppRoutes.invoiceDetail,
          builder: (_, state) =>
              Scaffold(body: Text('invoice-route:${state.extra}')),
        ),
      ],
    );
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: sessionWith(perms),
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    router.push('/x');
    await settle(t);
  }

  /// No router: how the Receptionist shell hosts the Record payment tab.
  Future<void> pumpTab(
    WidgetTester t, {
    List<String> perms = _all,
    Size size = phone,
  }) async {
    setSize(t, size);
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: sessionWith(perms),
        child: const MaterialApp(home: RecordPaymentScreen()),
      ),
    );
    await settle(t);
  }

  group('payments list', () {
    testWidgets('hero chips with counts, KPIs, panels, cards, summary', (
      t,
    ) async {
      await pumpRouted(t, const PaymentsScreen(), perms: _view);
      expect(find.text('Payments'), findsOneWidget);
      expect(find.text('All · 6'), findsOneWidget);
      expect(find.text('Success · 3'), findsOneWidget);
      expect(find.text('Pending · 1'), findsOneWidget);
      expect(find.textContaining('collected this month'), findsOneWidget);
      expect(find.text('COLLECTED'), findsOneWidget);
      expect(find.text('REFUNDED'), findsOneWidget);
      expect(find.text('Collections over time'), findsOneWidget);
      expect(find.text('Payment methods'), findsOneWidget);
      expect(find.text('Needs attention'), findsOneWidget);
      await scrollTo(t, find.text('PAY-0003'));
      expect(find.text('PAY-0003'), findsOneWidget);
      expect(find.text('Riya Shah'), findsWidgets);
      expect(find.textContaining('3 results'), findsOneWidget);
      expect(find.textContaining('₹2,180 collected'), findsOneWidget);
    });

    testWidgets('period and list both use full UTC instants', (t) async {
      await pumpRouted(t, const PaymentsScreen(), perms: _view);
      final first = _pay.listCalls.first;
      expect(first['from'], endsWith('T00:00:00.000Z'));
      expect(first['to'], endsWith('T23:59:59.999Z'));
      expect(first['sortBy'], 'paymentDate');
      expect(first['sortDir'], 'desc');
      expect(
        (first['from'] as String).substring(0, 10),
        _pay.analyticsCalls.first['from'],
      );

      await tapText(t, 'Last month');
      expect(_pay.analyticsCalls.last['from'], isNot(first['from']));
      expect(_pay.listCalls.last['from'], isNot(first['from']));
      expect(
        (_pay.listCalls.last['to'] as String).substring(0, 10),
        _pay.analyticsCalls.last['to'],
      );
    });

    testWidgets('branch picker scopes analytics and list', (t) async {
      await pumpRouted(t, const PaymentsScreen(), perms: _view);
      await tapText(t, 'All branches');
      await t.tap(find.text('Andheri').last);
      await settle(t);
      expect(_pay.analyticsCalls.last['branch'], 'b2');
      expect(_pay.listCalls.last['branchId'], 'b2');
    });

    testWidgets('status chip, method chip, sort, amount filter, reset', (
      t,
    ) async {
      await pumpRouted(t, const PaymentsScreen(), perms: _view);
      await tapText(t, 'Pending · 1');
      expect(_pay.listCalls.last['status'], 'PENDING');
      await tapText(t, 'Pending · 1'); // toggles off
      expect(_pay.listCalls.last['status'], isNull);

      await tapText(t, 'UPI');
      expect(_pay.listCalls.last['method'], 'UPI');

      await tapText(t, 'Date · newest first');
      await t.tap(find.text('Amount · high to low').last);
      await settle(t);
      expect(_pay.listCalls.last['sortBy'], 'finalAmount');
      expect(_pay.listCalls.last['sortDir'], 'desc');

      await tapText(t, 'Plan & amount');
      await t.enterText(find.widgetWithText(TextField, 'Min'), '100');
      await t.tap(find.text('Apply'));
      await settle(t);
      expect(_pay.listCalls.last['min'], 100.0);

      await t.scrollUntilVisible(
        find.byTooltip('Reset filters'),
        -300,
        scrollable: find.byType(Scrollable).first,
      );
      await t.tap(find.byTooltip('Reset filters'));
      await settle(t);
      expect(_pay.listCalls.last['method'], isNull);
      expect(_pay.listCalls.last['min'], isNull);
      expect(_pay.listCalls.last['sortBy'], 'finalAmount'); // sort stays
    });

    testWidgets('attention row jumps to that status in the list', (t) async {
      await pumpRouted(t, const PaymentsScreen(), perms: _view);
      await reveal(t, find.text('Payments pending over 24h'));
      await t.tap(find.text('Payments pending over 24h'));
      await settle(t);
      expect(_pay.listCalls.last['status'], 'PENDING');
    });

    testWidgets('a 403 on analytics hides the insights, list still works', (
      t,
    ) async {
      _pay.failAnalytics = true;
      await pumpRouted(t, const PaymentsScreen(), perms: _view);
      expect(find.text('Collections over time'), findsNothing);
      await scrollTo(t, find.text('PAY-0003'));
      expect(find.text('PAY-0003'), findsOneWidget);
    });

    testWidgets('without finance:view no analytics request is made', (t) async {
      await pumpRouted(t, const PaymentsScreen(), perms: const []);
      expect(_pay.analyticsCalls, isEmpty);
      expect(find.text('Collections over time'), findsNothing);
    });

    group('gating matrix', () {
      testWidgets('view only: no record shortcut, no verify, no invoice', (
        t,
      ) async {
        await pumpRouted(t, const PaymentsScreen(), perms: _view);
        expect(find.byIcon(Icons.add_rounded), findsNothing);
        await scrollTo(t, find.text('PAY-0002'));
        await t.tap(find.byTooltip('Actions for PAY-0002'));
        await settle(t);
        expect(find.text('View details'), findsOneWidget);
        expect(find.text('Copy number'), findsOneWidget);
        expect(find.text('Verify status'), findsNothing);
        expect(find.text('View invoice'), findsNothing);
      });

      testWidgets('payment-create adds Record + Verify (PENDING rows only)', (
        t,
      ) async {
        await pumpRouted(t, const PaymentsScreen(), perms: _create);
        expect(find.byIcon(Icons.add_rounded), findsOneWidget);
        await scrollTo(t, find.text('PAY-0002'));
        await t.tap(find.byTooltip('Actions for PAY-0002'));
        await settle(t);
        expect(find.text('Verify status'), findsOneWidget);
        await t.tap(find.text('Verify status'));
        await settle(t);
        expect(_pay.calls, contains('verify:p2'));
        expect(find.text('Status verified: SUCCESS'), findsOneWidget);
        // Not offered on a SUCCESS row.
        await t.tap(find.byTooltip('Actions for PAY-0003'));
        await settle(t);
        expect(find.text('Verify status'), findsNothing);
      });

      testWidgets('invoice-view adds View invoice for linked payments', (
        t,
      ) async {
        await pumpRouted(
          t,
          const PaymentsScreen(),
          perms: const ['finance:view', 'finance:invoice-view'],
        );
        await scrollTo(t, find.text('PAY-0003'));
        await t.tap(find.byTooltip('Actions for PAY-0003'));
        await settle(t);
        await t.tap(find.text('View invoice'));
        await settle(t);
        expect(find.text('invoice-route:inv1'), findsOneWidget);
      });

      testWidgets('tapping a card opens the detail route with the id', (
        t,
      ) async {
        await pumpRouted(t, const PaymentsScreen(), perms: _view);
        await scrollTo(t, find.text('PAY-0003'));
        await t.tap(find.text('PAY-0003'));
        await settle(t);
        expect(find.text('detail-route:p3'), findsOneWidget);
      });
    });

    testWidgets('tablet: heroes full width, cards two-up, no overflow', (
      t,
    ) async {
      await pumpRouted(
        t,
        const PaymentsScreen(),
        perms: _all,
        size: tablet,
      );
      expect(t.takeException(), isNull);
      await scrollTo(t, find.text('PAY-0003'));
      final a = t.getTopLeft(find.text('PAY-0003')).dy;
      final b = t.getTopLeft(find.text('PAY-0002')).dy;
      expect((a - b).abs() < 10, isTrue, reason: 'two cards share a row');
      expect(t.takeException(), isNull);
    });
  });

  group('payment detail', () {
    MemberPayment detailOf(String status, {String total = '0.00'}) => _p(
          _raw(
            id: 'd1',
            number: 'PAY-0010',
            status: status,
            totalRefunded: total,
            detail: true,
            refunds: total == '0.00'
                ? const []
                : [
                    {
                      'id': 'r',
                      'amount': total,
                      'reason': 'Duplicate charge',
                      'refundedBy': {'id': 'u', 'name': 'Asha Rao'},
                      'refundedAt': '2026-10-04T09:00:00.000Z',
                    },
                  ],
          ),
        );

    testWidgets('hero, summary tiles, details, timeline, split, others', (
      t,
    ) async {
      _pay.detail = detailOf('PARTIALLY_REFUNDED', total: '180.00');
      await pumpRouted(
        t,
        const PaymentDetailScreen(paymentId: 'd1'),
        perms: _view,
      );
      expect(find.text('PAY-0010'), findsOneWidget);
      expect(find.text('Amount paid'.toUpperCase()), findsOneWidget);
      expect(find.text('REFUNDABLE BALANCE'), findsOneWidget);
      expect(find.text('NET RECEIVED'), findsOneWidget);
      await reveal(t, find.text('Payment details'));
      expect(find.text('Walk-in'), findsOneWidget);
      expect(find.text('UTR1'), findsOneWidget);
      await reveal(t, find.text('Activity timeline'));
      expect(find.textContaining('Refunded ₹180'), findsWidgets);
      await reveal(t, find.text('Refund split'));
      await reveal(t, find.textContaining('Other payments by Riya'));
      expect(find.text('PAY-0099'), findsOneWidget);
      expect(_pay.calls, contains('list:m-d1::6'));
    });

    testWidgets('view only: no Refund, no Verify, no Cancel, no invoice', (
      t,
    ) async {
      _pay.detail = detailOf('SUCCESS');
      await pumpRouted(
        t,
        const PaymentDetailScreen(paymentId: 'd1'),
        perms: _view,
      );
      expect(find.text('Refund payment'), findsNothing);
      expect(find.text('View invoice'), findsNothing);
      await reveal(t, find.text('Refund split'));
      expect(find.text('Manage'), findsNothing);
      expect(find.text('Cancel payment'), findsNothing);
    });

    testWidgets('refund permission shows Refund (SUCCESS / partial only)', (
      t,
    ) async {
      _pay.detail = detailOf('SUCCESS');
      await pumpRouted(
        t,
        const PaymentDetailScreen(paymentId: 'd1'),
        perms: _refund,
      );
      expect(find.text('Refund payment'), findsOneWidget);
      expect(find.text('Manage'), findsNothing);
    });

    testWidgets('pending / refunded payments offer no Refund', (t) async {
      _pay.detail = detailOf('PENDING');
      await pumpRouted(
        t,
        const PaymentDetailScreen(paymentId: 'd1'),
        perms: _all,
      );
      expect(find.text('Refund payment'), findsNothing);
    });

    testWidgets('payment-create shows Verify + Cancel; cancel re-fetches', (
      t,
    ) async {
      _pay.detail = detailOf('PENDING');
      await pumpRouted(
        t,
        const PaymentDetailScreen(paymentId: 'd1'),
        perms: _create,
      );
      await reveal(t, find.text('Verify gateway status'));
      expect(find.text('Cancel payment'), findsOneWidget);
      await t.tap(find.text('Verify gateway status'));
      await settle(t);
      expect(_pay.calls, contains('verify:d1'));

      await reveal(t, find.text('Cancel payment'));
      await t.tap(find.text('Cancel payment'));
      await settle(t);
      await t.tap(find.text('Cancel payment').last); // dialog confirm
      await settle(t);
      expect(_pay.calls, contains('cancel:d1'));
      expect(find.text('Payment cancelled.'), findsOneWidget);
    });

    testWidgets('a refunded payment can no longer be cancelled', (t) async {
      _pay.detail = detailOf('PARTIALLY_REFUNDED', total: '10.00');
      await pumpRouted(
        t,
        const PaymentDetailScreen(paymentId: 'd1'),
        perms: _all,
      );
      await reveal(t, find.text('Verify gateway status'));
      expect(find.text('Cancel payment'), findsNothing);
    });

    testWidgets('refund sheet: full remainder sends no amount', (t) async {
      _pay.detail = detailOf('SUCCESS');
      await pumpRouted(
        t,
        const PaymentDetailScreen(paymentId: 'd1'),
        perms: _refund,
      );
      await t.tap(find.text('Refund payment'));
      await settle(t);
      expect(find.text('Refundable now'.toUpperCase()), findsOneWidget);
      expect(
        find.textContaining('After this refund: REFUNDED'),
        findsOneWidget,
      );
      await t.tap(find.text('Duplicate charge'));
      await t.pump();
      await t.tap(find.textContaining('Refund ₹1,180'));
      await settle(t);
      expect(_pay.refundArgs, {'amount': null, 'reason': 'Duplicate charge'});
      expect(find.text('Refund recorded.'), findsOneWidget);
    });

    testWidgets('refund sheet: 25% sends the cents-rounded amount', (t) async {
      _pay.detail = detailOf('SUCCESS');
      await pumpRouted(
        t,
        const PaymentDetailScreen(paymentId: 'd1'),
        perms: _refund,
      );
      await t.tap(find.text('Refund payment'));
      await settle(t);
      await t.tap(find.text('25%'));
      await t.pump();
      expect(
        find.textContaining('After this refund: PARTIALLY REFUNDED'),
        findsOneWidget,
      );
      await t.tap(find.textContaining('Refund ₹295'));
      await settle(t);
      expect(_pay.refundArgs!['amount'], 295.0);
      expect(_pay.refundArgs!['reason'], '');
    });

    testWidgets('refund sheet rejects an amount above the balance', (t) async {
      _pay.detail = detailOf('SUCCESS');
      await pumpRouted(
        t,
        const PaymentDetailScreen(paymentId: 'd1'),
        perms: _refund,
      );
      await t.tap(find.text('Refund payment'));
      await settle(t);
      await t.tap(find.text('Custom'));
      await t.pump();
      await t.enterText(find.byType(TextField).first, '99999');
      await t.pump();
      expect(
        find.textContaining('Enter an amount between 0 and'),
        findsOneWidget,
      );
      _pay.refundArgs = null;
      expect(_pay.refundArgs, isNull);
    });

    testWidgets('View invoice needs finance:invoice-view', (t) async {
      _pay.detail = detailOf('SUCCESS');
      await pumpRouted(
        t,
        const PaymentDetailScreen(paymentId: 'd1'),
        perms: const ['finance:view', 'finance:invoice-view'],
      );
      await t.tap(find.text('View invoice').first);
      await settle(t);
      expect(find.text('invoice-route:inv1'), findsOneWidget);
    });

    testWidgets('load failure shows a retry', (t) async {
      _pay.detail = null;
      _pay.rows = [];
      await pumpRouted(
        t,
        const PaymentDetailScreen(paymentId: 'missing'),
        perms: _view,
      );
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('tablet: two columns, no overflow', (t) async {
      _pay.detail = detailOf('PARTIALLY_REFUNDED', total: '180.00');
      await pumpRouted(
        t,
        const PaymentDetailScreen(paymentId: 'd1'),
        perms: _all,
        size: tablet,
      );
      await reveal(t, find.text('Payment details'));
      await reveal(t, find.text('Refund split'));
      expect(t.takeException(), isNull);
      final left = t.getTopLeft(find.text('Payment details')).dx;
      final right = t.getTopLeft(find.text('Refund split')).dx;
      expect(right > left + 300, isTrue);
    });
  });

  group('record payment', () {
    Finder field(String hint) => find.byWidgetPredicate(
          (w) => w is TextField && w.decoration?.hintText == hint,
        );

    testWidgets('tab mode: hamburger + Clear form, member search + snapshot', (
      t,
    ) async {
      await pumpTab(t);
      expect(find.text('Record a payment'), findsOneWidget);
      expect(find.byIcon(Icons.menu_rounded), findsOneWidget);
      expect(find.byIcon(Icons.arrow_back_rounded), findsNothing);
      await t.enterText(field('Search by name or member ID…'), 'riya');
      await t.pump(const Duration(milliseconds: 500));
      await t.pump();
      await t.tap(find.text('Riya Shah').last);
      await settle(t);
      expect(find.text('OUTSTANDING'), findsOneWidget);
      expect(find.text('₹250'), findsOneWidget);
      expect(_pay.calls, contains('invoices:m1'));
      expect(find.text('Clear form'), findsOneWidget);
    });

    testWidgets('records an offline payment with the web fields', (t) async {
      await pumpTab(t);
      await t.enterText(field('Search by name or member ID…'), 'riya');
      await t.pump(const Duration(milliseconds: 500));
      await t.pump();
      await t.tap(find.text('Riya Shah').last);
      await settle(t);
      await tapText(t, 'Cash');
      await t.enterText(field(r'₹'), '500');
      await t.enterText(find.widgetWithText(TextField, '').at(0), '');
      await t.pump();
      expect(find.text('Record ₹500 payment'), findsOneWidget);
      await tapText(t, 'Record ₹500 payment');
      expect(_fin.recorded, isNotNull);
      expect(_fin.recorded!['memberId'], 'm1');
      expect(_fin.recorded!['amount'], 500.0);
      expect(_fin.recorded!['method'], 'CASH');
      expect(_fin.recorded!['paymentDate'], isNull); // untouched = today
      expect(_fin.recorded!['membershipId'], isNull);
      expect(find.text('Payment recorded · Riya Shah'), findsOneWidget);
      expect(find.text('PAY-0100'), findsOneWidget);
      // Tab mode: the confirmation offers "Record another", not a pop.
      await tapText(t, 'Record another');
      expect(find.text('Record a payment'), findsOneWidget);
    });

    testWidgets('amount - discount + tax is what the summary shows', (t) async {
      await pumpTab(t);
      await t.enterText(field('Search by name or member ID…'), 'riya');
      await t.pump(const Duration(milliseconds: 500));
      await t.pump();
      await t.tap(find.text('Riya Shah').last);
      await settle(t);
      await t.enterText(field(r'₹'), '1000');
      await t.pump();
      final inputs = find.byType(TextField);
      // Discount + Tax are the two fields after Amount.
      final amount = field(r'₹');
      expect(amount, findsOneWidget);
      await t.enterText(inputs.at(1), '100');
      await t.enterText(inputs.at(2), '50');
      await t.pump();
      expect(find.text('Record ₹950 payment'), findsOneWidget);
    });

    testWidgets('validation: member then amount', (t) async {
      await pumpTab(t);
      await tapText(t, 'Record ₹0 payment');
      expect(find.text('Select a member first.'), findsOneWidget);
      // The tap scrolled the page down; the member search is at the top.
      await t.drag(find.byType(Scrollable).first, const Offset(0, 3000));
      await settle(t);
      await t.enterText(field('Search by name or member ID…'), 'riya');
      await t.pump(const Duration(milliseconds: 500));
      await t.pump();
      await t.tap(find.text('Riya Shah').last);
      await settle(t);
      await tapText(t, 'Record ₹0 payment');
      expect(find.text('Enter a valid amount.'), findsOneWidget);
      expect(_fin.recorded, isNull);
    });

    testWidgets('invoice step: needs invoice-view, prefills the due amount', (
      t,
    ) async {
      _pay.invoices = [
        PayableInvoice.fromJson({
          'id': 'inv9',
          'invoiceNumber': 'INV-9',
          'totalAmount': '1000.00',
          'status': 'PARTIALLY_PAID',
          'dueDate': '2026-10-20T00:00:00.000Z',
        }),
      ];
      await pumpTab(t);
      expect(find.textContaining('Invoice (optional)'), findsOneWidget);
      await t.enterText(field('Search by name or member ID…'), 'riya');
      await t.pump(const Duration(milliseconds: 500));
      await t.pump();
      await t.tap(find.text('Riya Shah').last);
      await settle(t);
      await tapText(t, 'INV-9 · ₹1,000');
      expect(_pay.calls, contains('due:inv9'));
      expect(find.textContaining('due ₹600'), findsOneWidget);
      expect(find.text('Record ₹600 payment'), findsOneWidget);
      await tapText(t, 'Half');
      expect(find.text('Record ₹300 payment'), findsOneWidget);
      await tapText(t, 'Record ₹300 payment');
      expect(_fin.recorded!['invoiceId'], 'inv9');
    });

    testWidgets('without invoice-view the invoice step is absent', (t) async {
      await pumpTab(t, perms: const ['finance:payment-create']);
      expect(find.textContaining('Invoice (optional)'), findsNothing);
      await t.enterText(field('Search by name or member ID…'), 'riya');
      await t.pump(const Duration(milliseconds: 500));
      await t.pump();
      await t.tap(find.text('Riya Shah').last);
      await settle(t);
      expect(_pay.calls.where((c) => c.startsWith('invoices')), isEmpty);
    });

    testWidgets('link: generates, then check status / resend / start over', (
      t,
    ) async {
      await pumpTab(t);
      await t.enterText(field('Search by name or member ID…'), 'riya');
      await t.pump(const Duration(milliseconds: 500));
      await t.pump();
      await t.tap(find.text('Riya Shah').last);
      await settle(t);
      await tapText(t, 'Send payment link');
      expect(find.text('Email the link'), findsOneWidget);
      await t.enterText(field(r'₹'), '500');
      await tapText(t, 'Generate payment link');
      expect(_fin.linked!['amount'], 500.0);
      expect(_fin.linked!['email'], isTrue);
      expect(_fin.linked!['sms'], isTrue);
      expect(find.text('https://rzp.io/abc'), findsOneWidget);
      expect(find.text('Awaiting payment'), findsOneWidget);

      _pay.verifyStatus = 'PENDING';
      await tapText(t, 'Check payment status');
      expect(_pay.calls, contains('verify:lnk'));
      expect(find.text('Awaiting payment'), findsOneWidget);

      await tapText(t, 'Resend by email');
      expect(_pay.calls, contains('resend:lnk:email'));
      await tapText(t, 'Resend by SMS');
      expect(_pay.calls, contains('resend:lnk:sms'));

      await tapText(t, 'Send a different link');
      expect(find.text('Generate payment link'), findsOneWidget);
    });

    testWidgets('link: a member without email cannot be emailed', (t) async {
      _fin.member = MemberSummary.fromJson({
        'id': 'm2',
        'memberId': 'MEM-0002',
        'name': 'Riya Shah',
        'email': null,
        'phone': '9999999999',
      });
      await pumpTab(t);
      await t.enterText(field('Search by name or member ID…'), 'riya');
      await t.pump(const Duration(milliseconds: 500));
      await t.pump();
      await t.tap(find.text('Riya Shah').last);
      await settle(t);
      await tapText(t, 'Send payment link');
      expect(find.text('(no email on file)'), findsOneWidget);
      await t.enterText(field(r'₹'), '500');
      await tapText(t, 'Generate payment link');
      expect(_fin.linked!['email'], isFalse);
      expect(_fin.linked!['sms'], isTrue);
      // Resend by email is disabled without an email.
      await tapText(t, 'Resend by email');
      expect(_pay.calls.where((c) => c.startsWith('resend:')), isEmpty);
    });

    testWidgets('pushed mode: back button, Cancel pops', (t) async {
      await pumpRouted(t, const RecordPaymentScreen());
      expect(find.byIcon(Icons.arrow_back_rounded), findsOneWidget);
      expect(find.byIcon(Icons.menu_rounded), findsNothing);
      await tapText(t, 'Cancel');
      expect(find.text('home'), findsOneWidget);
    });

    testWidgets('confirmation: View payment needs finance:view', (t) async {
      await pumpRouted(
        t,
        const RecordPaymentScreen(),
        perms: const ['finance:payment-create'],
      );
      await t.enterText(field('Search by name or member ID…'), 'riya');
      await t.pump(const Duration(milliseconds: 500));
      await t.pump();
      await t.tap(find.text('Riya Shah').last);
      await settle(t);
      await t.enterText(field(r'₹'), '500');
      await tapText(t, 'Record ₹500 payment');
      expect(find.text('View payment'), findsNothing);
      expect(find.text('Done'), findsOneWidget);
    });

    testWidgets('tablet: two columns, no overflow', (t) async {
      await pumpTab(t, size: tablet);
      expect(t.takeException(), isNull);
      final main = t.getTopLeft(find.textContaining('1 · Member')).dx;
      final side = t.getTopLeft(find.text('Summary')).dx;
      expect(side > main + 400, isTrue);
    });
  });
}
