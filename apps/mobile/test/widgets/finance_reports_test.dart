import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/features/reports/presentation/branch_performance_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/expense_report_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/payment_report_screen.dart';
import 'package:gym_saas_mobile/features/reports/presentation/revenue_report_screen.dart';
import 'package:gym_saas_mobile/models/branch_comparison_row.dart';
import 'package:gym_saas_mobile/models/branch_option.dart';
import 'package:gym_saas_mobile/models/branch_performance_row.dart';
import 'package:gym_saas_mobile/models/expense_report_row.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/payment_report_row.dart';
import 'package:gym_saas_mobile/models/report_summary.dart';
import 'package:gym_saas_mobile/models/revenue_report_row.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/analytics_repository.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';
import 'package:gym_saas_mobile/repositories/reports_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Reports extends Mock implements ReportsRepository {}

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
      roles: const ['OWNER'],
      permissions: perms,
    );

Map<String, dynamic> _kpi(
  String key,
  String label,
  Object value,
  String format, [
  Object? previous,
]) =>
    {
      'key': key,
      'label': label,
      'value': value,
      'format': format,
      if (previous != null) 'previous': previous,
    };

Map<String, dynamic> _series(String title) => {
      'title': title,
      'points': [
        for (var i = 1; i <= 5; i++)
          {
            'date': '2026-10-0$i',
            'value': i * 1000,
            'previous': i * 800,
          },
      ],
    };

Map<String, dynamic> _summaryJson(String type) {
  const range = {'from': '2026-10-01', 'to': '2026-10-05'};
  const prev = {'from': '2026-09-26', 'to': '2026-09-30'};
  switch (type) {
    case 'revenue':
      return {
        'range': range,
        'previousRange': prev,
        'kpis': [
          _kpi('total', 'Total revenue', '150000.00', 'money', '100000.00'),
          _kpi('payments', 'Payments', 30, 'number', 20),
          _kpi('average', 'Average payment', '5000.00', 'money', '5000.00'),
        ],
        'breakdowns': [
          {
            'key': 'by-method',
            'title': 'Revenue by method',
            'kind': 'donut',
            'items': [
              {'label': 'ONLINE_GATEWAY', 'value': 90000},
              {'label': 'CASH', 'value': 60000},
            ],
          },
        ],
        'series': _series('Daily revenue'),
      };
    case 'expenses':
      return {
        'range': range,
        'previousRange': prev,
        'kpis': [
          _kpi('total', 'Total expenses', '60000.00', 'money', '50000.00'),
          _kpi('count', 'Expense entries', 12, 'number', 10),
          _kpi('average', 'Average expense', '5000.00', 'money', '5000.00'),
        ],
        'breakdowns': [
          {
            'key': 'by-category',
            'title': 'Expenses by category',
            'kind': 'bar',
            'items': [
              {'label': 'OFFICE_SUPPLIES', 'value': 20000, 'previous': 10000},
              {'label': 'RENT', 'value': 40000, 'previous': 40000},
            ],
          },
        ],
        'series': _series('Daily expenses'),
      };
    case 'payments':
      return {
        'range': range,
        'previousRange': prev,
        'kpis': [
          _kpi(
            'collected',
            'Total collected',
            '150000.00',
            'money',
            '100000.00',
          ),
          _kpi('count', 'Payments', 40, 'number', 30),
          _kpi('success-rate', 'Success rate', 0.9, 'percent', 0.8),
        ],
        'breakdowns': [
          {
            'key': 'by-status',
            'title': 'Payments by status',
            'kind': 'donut',
            'items': [
              {'label': 'SUCCESS', 'value': 36},
              {'label': 'PARTIALLY_REFUNDED', 'value': 4},
            ],
          },
          {
            'key': 'by-method',
            'title': 'Collected by method',
            'kind': 'donut',
            'items': [
              {'label': 'BANK_TRANSFER', 'value': 100000},
              {'label': 'UPI', 'value': 50000},
            ],
          },
        ],
        'series': _series('Daily collected'),
      };
    default:
      return {
        'kpis': [
          _kpi('branches', 'Branches', 2, 'number'),
          _kpi('revenue', 'Total revenue', '90000.00', 'money'),
          _kpi('members', 'Total members', 150, 'number'),
        ],
        'breakdowns': [
          {
            'key': 'revenue-per-branch',
            'title': 'Revenue per branch',
            'kind': 'bar',
            'items': [
              {'label': 'Main Branch', 'value': 60000},
              {'label': 'Annex', 'value': 30000},
            ],
          },
        ],
        'series': null,
      };
  }
}

PaginatedResult<T> _page<T>(List<T> items, {int page = 1, int pages = 1}) =>
    PaginatedResult(
      items: items,
      total: items.length * pages,
      page: page,
      limit: 20,
      totalPages: pages,
    );

RevenueReportRow _rev(String branch, String method, String amount) =>
    RevenueReportRow.fromJson({
      'date': '2026-10-04',
      'branch': branch,
      'method': method,
      'amount': amount,
    });

ExpenseReportRow _exp(String category, String? desc) =>
    ExpenseReportRow.fromJson({
      'date': '2026-10-03',
      'branch': 'Main Branch',
      'category': category,
      'amount': '2500.00',
      'description': desc,
    });

PaymentReportRow _pay(String n, String name, String status) =>
    PaymentReportRow.fromJson({
      'paymentNumber': n,
      'memberCode': 'M-001',
      'name': name,
      'branch': 'Main Branch',
      'finalAmount': '1500.50',
      'method': 'UPI',
      'status': status,
      'paymentDate': '2026-10-02',
    });

BranchPerformanceRow _bp(String id, String name, String revenue) =>
    BranchPerformanceRow.fromJson({
      'branchId': id,
      'branch': name,
      'totalMembers': 100,
      'activeMembers': 80,
      'monthlyRevenue': revenue,
      'monthlyAttendance': 420,
      'staffCount': 6,
    });

const _view = ['reports:view'];

Future<void> settle(WidgetTester t) async {
  await t.pump();
  await t.pump(const Duration(seconds: 3));
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    registerFallbackValue(const ReportSummaryFilters());
    registerFallbackValue(DateTime(2026));
  });

  late _Reports reports;
  late _Analytics analytics;
  late _Branches branches;

  void stubDefaults() {
    when(() => reports.summary(any(), any())).thenAnswer(
      (i) async => ReportSummary.fromJson(
        _summaryJson(i.positionalArguments.first as String),
      ),
    );
    when(
      () => reports.revenue(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
        page: any(named: 'page'),
      ),
    ).thenAnswer(
      (_) async => (
        page: _page([
          _rev('Main Branch', 'UPI', '2500.00'),
          _rev('Annex', 'CASH', '1200.00'),
        ]),
        totalAmount: 3700.0,
      ),
    );
    when(
      () => reports.expenses(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
        page: any(named: 'page'),
      ),
    ).thenAnswer(
      (_) async => (
        page: _page([
          _exp('OFFICE_SUPPLIES', 'Printer paper'),
          _exp('RENT', null),
        ]),
        totalAmount: 5000.0,
      ),
    );
    when(
      () => reports.payments(
        from: any(named: 'from'),
        to: any(named: 'to'),
        branchId: any(named: 'branchId'),
        paymentStatus: any(named: 'paymentStatus'),
        page: any(named: 'page'),
      ),
    ).thenAnswer(
      (_) async => _page([
        _pay('PAY-1', 'Asha Rao', 'SUCCESS'),
        _pay('PAY-2', 'Ravi Kumar', 'PARTIALLY_REFUNDED'),
      ]),
    );
    when(() => reports.branchPerformance(branchId: any(named: 'branchId')))
        .thenAnswer(
      (_) async => [
        _bp('b2', 'Annex', '30000.00'),
        _bp('b1', 'Main Branch', '60000.00'),
      ],
    );
    when(() => reports.branchPerformance()).thenAnswer(
      (_) async => [
        _bp('b2', 'Annex', '30000.00'),
        _bp('b1', 'Main Branch', '60000.00'),
      ],
    );
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
          members: 80,
          revenue: 90000,
          attendance: 400,
        ),
      ],
    );
    when(() => branches.assignable()).thenAnswer(
      (_) async => [const BranchOption(id: 'b1', name: 'Main Branch')],
    );
  }

  setUp(() {
    reports = _Reports();
    analytics = _Analytics();
    branches = _Branches();
    final g = GetIt.instance;
    void reg<T extends Object>(T v) {
      if (g.isRegistered<T>()) g.unregister<T>();
      g.registerSingleton<T>(v);
    }

    reg<ReportsRepository>(reports);
    reg<AnalyticsRepository>(analytics);
    reg<BranchRepository>(branches);
    stubDefaults();
  });

  Future<void> pump(
    WidgetTester t,
    Widget screen, {
    List<String> perms = _view,
    Size size = const Size(360, 3200),
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
        child: MaterialApp(home: screen),
      ),
    );
    await settle(t);
  }

  void noDollar() {
    expect(find.textContaining(r'$'), findsNothing);
  }

  group('Revenue report', () {
    testWidgets('phone: hero chips, KPIs, charts, branch panel, rows',
        (t) async {
      await pump(t, const RevenueReportScreen());
      expect(find.text('Revenue Report'), findsOneWidget);
      // Hero chips come from the first summary KPIs (INR, compact).
      expect(find.textContaining('₹1.50L · Total revenue'), findsOneWidget);
      expect(find.text('TOTAL REVENUE'), findsOneWidget);
      expect(find.text('Daily revenue'), findsOneWidget);
      expect(find.text('Revenue by method'), findsOneWidget);
      expect(find.text('Online Gateway'), findsWidgets);
      expect(find.text('Revenue by branch'), findsOneWidget);
      expect(find.text('Selected period'), findsOneWidget);
      expect(
        find.textContaining('Payments received', findRichText: true),
        findsOneWidget,
      );
      expect(find.text('UPI'), findsWidgets);
      noDollar();
      expect(t.takeException(), isNull);
      verify(() => reports.summary('revenue', any())).called(1);
    });

    testWidgets('tablet 1500x1300 renders without overflow', (t) async {
      await pump(
        t,
        const RevenueReportScreen(),
        size: const Size(1500, 1300),
      );
      expect(find.text('Revenue Report'), findsOneWidget);
      expect(find.text('Revenue by method'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('the summary needs reports:view (list still loads)', (t) async {
      await pump(t, const RevenueReportScreen(), perms: const []);
      verifyNever(() => reports.summary(any(), any()));
      expect(find.text('Daily revenue'), findsNothing);
      expect(
        find.textContaining('Payments received', findRichText: true),
        findsOneWidget,
      );
      expect(find.text('Annex'), findsWidgets);
    });

    testWidgets('branch panel falls back to branch-performance on a 403',
        (t) async {
      when(
        () => analytics.branchComparison(
          from: any(named: 'from'),
          to: any(named: 'to'),
          branchId: any(named: 'branchId'),
        ),
      ).thenThrow(const ApiException(message: 'Forbidden', statusCode: 403));
      await pump(t, const RevenueReportScreen());
      expect(find.text('Month to date'), findsOneWidget);
      verify(() => reports.branchPerformance()).called(1);
    });

    testWidgets('period chip reloads list, summary and branches', (t) async {
      await pump(t, const RevenueReportScreen());
      await t.tap(find.text('7 days'));
      await settle(t);
      verify(
        () => reports.revenue(
          from: any(named: 'from'),
          to: any(named: 'to'),
          branchId: any(named: 'branchId'),
          page: any(named: 'page'),
        ),
      ).called(2);
      verify(() => reports.summary('revenue', any())).called(2);
      verify(
        () => analytics.branchComparison(
          from: any(named: 'from'),
          to: any(named: 'to'),
          branchId: any(named: 'branchId'),
        ),
      ).called(2);
    });

    testWidgets('error shows retry; retry reloads', (t) async {
      var fail = true;
      when(
        () => reports.revenue(
          from: any(named: 'from'),
          to: any(named: 'to'),
          branchId: any(named: 'branchId'),
          page: any(named: 'page'),
        ),
      ).thenAnswer((_) async {
        if (fail) throw const ApiException(message: 'Boom');
        return (
          page: _page([_rev('Main Branch', 'UPI', '10')]),
          totalAmount: 10.0
        );
      });
      await pump(t, const RevenueReportScreen());
      expect(find.text('Boom'), findsOneWidget);
      fail = false;
      await t.tap(find.text('Try again'));
      await settle(t);
      expect(find.text('Boom'), findsNothing);
      expect(find.text('UPI'), findsWidgets);
    });

    testWidgets('load more appends page 2; tapping a row opens details',
        (t) async {
      when(
        () => reports.revenue(
          from: any(named: 'from'),
          to: any(named: 'to'),
          branchId: any(named: 'branchId'),
          page: any(named: 'page'),
        ),
      ).thenAnswer((i) async {
        final p = i.namedArguments[#page] as int;
        return (
          page: _page(
            [_rev(p == 1 ? 'Main Branch' : 'Annex', 'CHEQUE', '700.00')],
            page: p,
            pages: 2,
          ),
          totalAmount: 1400.0,
        );
      });
      await pump(t, const RevenueReportScreen());
      await t.ensureVisible(find.text('Load more'));
      await t.tap(find.text('Load more'));
      await settle(t);
      expect(find.text('Cheque'), findsNWidgets(4));
      await t.tap(find.text('Cheque').first);
      await settle(t);
      expect(find.text('Method'), findsOneWidget);
      expect(find.text('Amount'), findsOneWidget);
    });

    testWidgets('empty state', (t) async {
      when(
        () => reports.revenue(
          from: any(named: 'from'),
          to: any(named: 'to'),
          branchId: any(named: 'branchId'),
          page: any(named: 'page'),
        ),
      ).thenAnswer(
        (_) async => (page: _page<RevenueReportRow>([]), totalAmount: 0.0),
      );
      await pump(t, const RevenueReportScreen());
      expect(find.text('No revenue in this period'), findsOneWidget);
    });
  });

  group('Expense report', () {
    testWidgets('phone: summary, category chart, rows', (t) async {
      await pump(t, const ExpenseReportScreen());
      expect(find.text('Expense Report'), findsOneWidget);
      expect(find.textContaining('₹60k · Total expenses'), findsOneWidget);
      expect(find.text('Daily expenses'), findsOneWidget);
      expect(find.text('Expenses by category'), findsOneWidget);
      expect(find.text('Office Supplies'), findsWidgets);
      expect(find.text('Printer paper'), findsOneWidget);
      // No description -> the category is the title.
      expect(find.text('Rent'), findsWidgets);
      noDollar();
      expect(t.takeException(), isNull);
      verify(() => reports.summary('expenses', any())).called(1);
    });

    testWidgets('tablet 1500x1300 renders without overflow', (t) async {
      await pump(
        t,
        const ExpenseReportScreen(),
        size: const Size(1500, 1300),
      );
      expect(find.text('Expenses by category'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('detail sheet shows the description', (t) async {
      await pump(t, const ExpenseReportScreen());
      await t.tap(find.text('Printer paper'));
      await settle(t);
      expect(find.text('Description'), findsOneWidget);
      expect(find.text('Category'), findsOneWidget);
    });

    testWidgets('the summary needs reports:view', (t) async {
      await pump(t, const ExpenseReportScreen(), perms: const []);
      verifyNever(() => reports.summary(any(), any()));
      expect(find.text('Printer paper'), findsOneWidget);
    });
  });

  group('Payment report', () {
    testWidgets('phone: all six status chips, charts, rows', (t) async {
      await pump(t, const PaymentReportScreen());
      expect(find.text('Payment Report'), findsOneWidget);
      for (final s in [
        'All',
        'Success',
        'Pending',
        'Partially refunded',
        'Refunded',
        'Failed',
        'Cancelled',
      ]) {
        expect(find.text(s), findsWidgets, reason: s);
      }
      expect(find.text('Daily collected'), findsOneWidget);
      expect(find.text('Payments by status'), findsOneWidget);
      expect(find.text('Collected by method'), findsOneWidget);
      expect(find.text('Bank Transfer'), findsWidgets);
      expect(find.text('Asha Rao'), findsOneWidget);
      expect(find.text('#PAY-1 · M-001'), findsOneWidget);
      // Success rate is a 0..1 ratio on the wire -> 90%, no currency.
      expect(find.textContaining('90%'), findsWidgets);
      noDollar();
      expect(t.takeException(), isNull);
    });

    testWidgets('tablet 1500x1300 renders without overflow', (t) async {
      await pump(
        t,
        const PaymentReportScreen(),
        size: const Size(1500, 1300),
      );
      expect(find.text('Payments by status'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('status chip filters list AND summary', (t) async {
      await pump(t, const PaymentReportScreen());
      await t.ensureVisible(find.text('Failed').first);
      await t.tap(find.text('Failed').first);
      await settle(t);
      verify(
        () => reports.payments(
          from: any(named: 'from'),
          to: any(named: 'to'),
          branchId: any(named: 'branchId'),
          paymentStatus: 'FAILED',
          page: any(named: 'page'),
        ),
      ).called(1);
      final captured = verify(
        () => reports.summary('payments', captureAny()),
      ).captured.cast<ReportSummaryFilters>();
      expect(captured.last.paymentStatus, 'FAILED');
      expect(captured.last.from, isNotNull);
      expect(find.text('Failed payments'), findsOneWidget);
    });

    testWidgets('detail sheet lists every web column', (t) async {
      await pump(t, const PaymentReportScreen());
      await t.tap(find.text('Asha Rao'));
      await settle(t);
      for (final s in [
        'Payment #',
        'Member ID',
        'Branch',
        'Method',
        'Status',
        'Date',
      ]) {
        expect(find.text(s), findsWidgets, reason: s);
      }
      expect(find.text('₹1,500.50'), findsWidgets);
    });

    testWidgets('the summary needs reports:view', (t) async {
      await pump(t, const PaymentReportScreen(), perms: const []);
      verifyNever(() => reports.summary(any(), any()));
      expect(find.text('Asha Rao'), findsOneWidget);
    });
  });

  group('Branch performance', () {
    testWidgets('phone: branch-only bar, summary, ranked cards', (t) async {
      await pump(t, const BranchPerformanceScreen());
      expect(find.text('Branch Performance'), findsOneWidget);
      expect(find.textContaining('current snapshot'), findsOneWidget);
      expect(find.text('This month'), findsNothing);
      expect(find.byKey(const ValueKey('rpt-compare')), findsNothing);
      expect(find.text('Revenue per branch'), findsOneWidget);
      expect(find.text('BRANCHES'), findsOneWidget);
      // Richest first.
      final main = t.getTopLeft(find.text('Main Branch').last).dy;
      final annex = t.getTopLeft(find.text('Annex').last).dy;
      expect(main, lessThan(annex));
      expect(find.text('80 of 100 members active'), findsNWidgets(2));
      noDollar();
      expect(t.takeException(), isNull);
    });

    testWidgets('summary is requested WITHOUT a date range', (t) async {
      await pump(t, const BranchPerformanceScreen());
      final captured = verify(
        () => reports.summary('branch-performance', captureAny()),
      ).captured.cast<ReportSummaryFilters>();
      expect(captured.single.from, isNull);
      expect(captured.single.to, isNull);
    });

    testWidgets('tablet 1500x1300 renders without overflow', (t) async {
      await pump(
        t,
        const BranchPerformanceScreen(),
        size: const Size(1500, 1300),
      );
      expect(find.text('Revenue per branch'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('tapping a card opens its detail sheet', (t) async {
      await pump(t, const BranchPerformanceScreen());
      await t.tap(find.text('80 of 100 members active').first);
      await settle(t);
      expect(find.text('Monthly attendance'), findsOneWidget);
      expect(find.text('Rank #1 by revenue · this month'), findsOneWidget);
    });

    testWidgets('the summary needs reports:view', (t) async {
      await pump(t, const BranchPerformanceScreen(), perms: const []);
      verifyNever(() => reports.summary(any(), any()));
      expect(find.text('Annex'), findsWidgets);
    });

    testWidgets('empty', (t) async {
      when(() => reports.branchPerformance(branchId: any(named: 'branchId')))
          .thenAnswer((_) async => <BranchPerformanceRow>[]);
      await pump(t, const BranchPerformanceScreen());
      expect(find.text('No branches found'), findsOneWidget);
    });
  });

  group('360x740 phone viewport (scrolling) never overflows', () {
    for (final entry in <String, Widget>{
      'revenue': const RevenueReportScreen(),
      'expenses': const ExpenseReportScreen(),
      'payments': const PaymentReportScreen(),
      'branch-performance': const BranchPerformanceScreen(),
    }.entries) {
      testWidgets(entry.key, (t) async {
        await pump(t, entry.value, size: const Size(360, 740));
        for (var i = 0; i < 12; i++) {
          await t.drag(find.byType(CustomScrollView), const Offset(0, -500));
          await t.pump(const Duration(milliseconds: 400));
        }
        expect(t.takeException(), isNull);
      });
    }
  });
}
