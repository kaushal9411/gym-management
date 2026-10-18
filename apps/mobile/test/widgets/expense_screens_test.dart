import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/routing/app_routes.dart';
import 'package:gym_saas_mobile/features/expenses/presentation/expense_form_screen.dart';
import 'package:gym_saas_mobile/features/expenses/presentation/expense_list_screen.dart';
import 'package:gym_saas_mobile/models/branch_option.dart';
import 'package:gym_saas_mobile/models/expense_entry.dart';
import 'package:gym_saas_mobile/models/ledger_analytics.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';
import 'package:gym_saas_mobile/repositories/expense_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockSession extends MockCubit<SessionState> implements SessionCubit {}

Map<String, dynamic> _entry(
  String id,
  String category,
  String amount, {
  String? description,
  String? receiptFileName,
  String? receiptUrl,
  String? recordedBy = 'Asha',
}) =>
    {
      'id': id,
      'category': category,
      'amount': amount,
      'expenseDate': '2026-10-17',
      'branch': {'id': 'b1', 'name': 'Bandra'},
      'description': description,
      'receiptFileName': receiptFileName,
      'receiptDataUrl': receiptUrl,
      'recordedBy': recordedBy == null ? null : {'id': 'u', 'name': recordedBy},
      'createdAt': '2026-10-17T10:00:00.000Z',
      'updatedAt': '2026-10-17T10:00:00.000Z',
      'deletedAt': null,
    };

LedgerAnalytics _analytics() => LedgerAnalytics.fromJson({
      'range': {'from': '2026-10-01', 'to': '2026-10-18'},
      'previousRange': {'from': '2026-09-01', 'to': '2026-09-18'},
      'kpis': {
        'total': {'value': '8000.00', 'previous': '4000.00'},
        'count': {'value': 4, 'previous': 2},
        'average': {'value': '2000.00', 'previous': '2000.00'},
        'largest': {
          'value': '5000.00',
          'description': 'October rent',
          'category': 'RENT',
          'date': '2026-10-05',
        },
        'netProfit': {'value': '3000.00', 'previous': '1000.00'},
      },
      'daily': [
        for (var i = 1; i <= 10; i++)
          {
            'date': '2026-10-${i.toString().padLeft(2, '0')}',
            'total': '${i * 100}.00',
            'count': 1,
            'previousTotal': '${i * 50}.00',
          },
      ],
      'categories': [
        {
          'category': 'RENT',
          'amount': '5000.00',
          'count': 2,
          'previousAmount': '2500.00',
        },
        {
          'category': 'SALARY',
          'amount': '3000.00',
          'count': 2,
          'previousAmount': '1500.00',
        },
      ],
      'branches': [
        {
          'branchId': 'b1',
          'name': 'Bandra',
          'total': '8000.00',
          'previousTotal': '4000.00',
        },
      ],
      'topEntries': [
        {
          'id': 'e1',
          'description': 'October rent',
          'category': 'RENT',
          'amount': '5000.00',
          'date': '2026-10-05',
        },
        {
          'id': 'e2',
          'description': null,
          'category': 'SALARY',
          'amount': '3000.00',
          'date': '2026-10-07',
        },
      ],
    });

class _ExpenseRepo extends Fake implements ExpenseRepository {
  final lists = <Map<String, Object?>>[];
  final analyticsCalls = <Map<String, Object?>>[];
  final deleted = <String>[];
  final created = <Map<String, Object?>>[];
  ApiException? analyticsError;
  ApiException? listError;
  ApiException? createError;
  List<Map<String, dynamic>> rows = [
    _entry('1', 'SALARY', '3000.00', description: 'Trainer salaries'),
    _entry(
      '2',
      'RENT',
      '5000.00',
      description: 'October rent',
      receiptFileName: 'rent.jpg',
      receiptUrl: 'https://files.test/rent.jpg',
    ),
  ];

  @override
  Future<({PaginatedResult<ExpenseEntry> page, LedgerListSummary? summary})>
      listWithSummary({
    int page = 1,
    int limit = 20,
    String? search,
    String? category,
    String? branchId,
    String? dateFrom,
    String? dateTo,
    String? sortBy,
    String? sortDir,
  }) async {
    lists.add({
      'page': page,
      'search': search,
      'category': category,
      'branchId': branchId,
      'dateFrom': dateFrom,
      'dateTo': dateTo,
      'sortBy': sortBy,
      'sortDir': sortDir,
    });
    if (listError != null) throw listError!;
    final items = rows.map(ExpenseEntry.fromJson).toList();
    return (
      page: PaginatedResult(
        items: items,
        total: items.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      ),
      summary: const LedgerListSummary(total: 8000, count: 2, average: 4000),
    );
  }

  @override
  Future<LedgerAnalytics> analytics({
    required String dateFrom,
    required String dateTo,
    String? branchId,
  }) async {
    analyticsCalls.add({'from': dateFrom, 'to': dateTo, 'branchId': branchId});
    if (analyticsError != null) throw analyticsError!;
    return _analytics();
  }

  @override
  Future<void> delete(String id) async => deleted.add(id);

  @override
  Future<ExpenseEntry> create({
    required ExpenseCategory category,
    required double amount,
    required DateTime expenseDate,
    String? description,
    String? receiptFileName,
    String? receiptDataUrl,
  }) async {
    if (createError != null) throw createError!;
    created.add({
      'category': category.apiValue,
      'amount': amount,
      'date': '${expenseDate.year}-${expenseDate.month}-${expenseDate.day}',
      'description': description,
      'receiptFileName': receiptFileName,
      'receiptDataUrl': receiptDataUrl,
    });
    return ExpenseEntry.fromJson(_entry('new', category.apiValue, '$amount'));
  }
}

class _BranchRepo extends Fake implements BranchRepository {
  @override
  Future<List<BranchOption>> assignable() async => const [
        BranchOption(id: 'b1', name: 'Bandra'),
        BranchOption(id: 'b2', name: 'Andheri'),
      ];
}

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
  featureFlags: ['expenses'],
);

const _view = ['finance:view'];
const _manage = ['finance:view', 'finance:expense-manage'];

late _ExpenseRepo _repo;

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  setUp(() {
    final g = GetIt.instance;
    _repo = _ExpenseRepo();
    void reg<T extends Object>(T v) {
      if (g.isRegistered<T>()) g.unregister<T>();
      g.registerSingleton<T>(v);
    }

    reg<ExpenseRepository>(_repo);
    reg<BranchRepository>(_BranchRepo());
  });

  Future<GoRouter> pumpApp(
    WidgetTester t, {
    List<String> perms = _view,
    Size size = const Size(560, 900),
    String initial = '/',
  }) async {
    t.view.physicalSize = size * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
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
          roles: const ['MANAGER'],
          permissions: perms,
        ),
        _tenant,
      ),
    );
    final router = GoRouter(
      initialLocation: initial,
      routes: [
        GoRoute(path: '/', builder: (_, __) => const ExpenseListScreen()),
        GoRoute(
          path: AppRoutes.expenseForm,
          builder: (_, __) => const ExpenseFormScreen(),
        ),
      ],
    );
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    return router;
  }

  Future<void> settle(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  Future<void> step(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(milliseconds: 600));
  }

  /// Brings [f] on screen: lazily built slivers first, then an exact scroll.
  Future<void> scrollTo(WidgetTester t, Finder f) async {
    await t.scrollUntilVisible(
      f,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await t.ensureVisible(f);
    await t.pump();
  }

  /// The form is a plain scroll view (not lazy) and sits above the list route
  /// in the tree, so just make the target visible.
  Future<void> reveal(WidgetTester t, Finder f) async {
    await t.ensureVisible(f);
    await t.pump();
  }

  Future<void> formToTop(WidgetTester t) async {
    final scroller = find.descendant(
      of: find.byType(ExpenseFormScreen),
      matching: find.byType(SingleChildScrollView),
    );
    t
        .state<ScrollableState>(
          find
              .descendant(of: scroller, matching: find.byType(Scrollable))
              .first,
        )
        .position
        .jumpTo(0);
    await t.pump();
  }

  group('list', () {
    testWidgets('hero, period bar, analytics panels and ledger render',
        (t) async {
      await pumpApp(t);
      await settle(t);
      expect(find.text('Expenses'), findsOneWidget);
      expect(find.text('PERIOD'), findsOneWidget);
      // Hero chips come from the analytics (web's three hero stats).
      expect(find.textContaining('spent this month'), findsOneWidget);
      expect(find.text('4 expenses'), findsOneWidget);
      expect(find.text('Total expenses'), findsOneWidget);
      expect(find.text('Net profit'), findsOneWidget);
      expect(find.text('Largest expense'), findsOneWidget);
      expect(find.text('Expenses over time'), findsOneWidget);
      expect(find.text('Expenses by category'), findsOneWidget);
      expect(find.text('Branch comparison'), findsOneWidget);
      expect(find.text('Top expenses'), findsOneWidget);
      await scrollTo(t, find.byKey(const ValueKey('expense-2')));
      expect(find.text('Trainer salaries'), findsOneWidget);
      // Web's table columns: branch, receipt, recorded by.
      expect(find.text('rent.jpg'), findsOneWidget);
      expect(find.text('by Asha'), findsWidgets);
      expect(find.textContaining('2 results'), findsOneWidget);
      expect(t.takeException(), isNull);
      // The ledger follows the period (this month) with web's default sort.
      final q = _repo.lists.last;
      expect(q['sortBy'], 'expenseDate');
      expect(q['sortDir'], 'desc');
      expect(q['dateFrom'], endsWith('-01'));
      expect(q['category'], '');
      expect(_repo.analyticsCalls.last['from'], q['dateFrom']);
    });

    testWidgets('trend chart modes and the compare switch', (t) async {
      await pumpApp(t);
      await settle(t);
      await scrollTo(t, find.text('Cumulative'));
      await t.tap(find.text('Weekly'));
      await step(t);
      await t.tap(find.text('Cumulative'));
      await step(t);
      expect(find.textContaining('vs last month'), findsWidgets);
      await scrollTo(t, find.byKey(const ValueKey('income-compare')));
      await t.tap(find.byKey(const ValueKey('income-compare')));
      await step(t);
      expect(find.textContaining('vs last month'), findsNothing);
      expect(find.text('Income − expenses'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('category chips, sort and period re-query the API', (t) async {
      await pumpApp(t);
      await settle(t);
      await scrollTo(t, find.text('CATEGORY'));
      expect(find.text('All 4'), findsOneWidget);
      expect(find.text('Rent 2'), findsOneWidget);
      expect(find.text('Office Supplies 0'), findsOneWidget);
      await t.tap(find.text('Salary 2'));
      await step(t);
      expect(_repo.lists.last['category'], 'SALARY');
      // Tapping the active chip again clears it.
      await t.tap(find.text('Salary 2'));
      await step(t);
      expect(_repo.lists.last['category'], '');

      await t.tap(find.text('Date · newest first'));
      await step(t);
      await t.tap(find.text('Amount · high to low'));
      await step(t);
      expect(_repo.lists.last['sortBy'], 'amount');
      expect(_repo.lists.last['sortDir'], 'desc');

      final before = _repo.analyticsCalls.length;
      await scrollTo(t, find.text('Last month').first);
      await t.tap(find.text('Last month').first);
      await step(t);
      expect(_repo.analyticsCalls.length, before + 1);
      expect(_repo.analyticsCalls.last['from'], endsWith('-01'));
      expect(_repo.lists.last['dateTo'], _repo.analyticsCalls.last['to']);
      expect(t.takeException(), isNull);
    });

    testWidgets('branch picker scopes both the analytics and the ledger',
        (t) async {
      await pumpApp(t);
      await settle(t);
      await t.tap(find.text('All branches'));
      await step(t);
      await t.tap(find.text('Andheri'));
      await step(t);
      expect(_repo.lists.last['branchId'], 'b2');
      expect(_repo.analyticsCalls.last['branchId'], 'b2');
    });

    testWidgets('a 403 on analytics hides the block, the list still works',
        (t) async {
      _repo.analyticsError = const ApiException(
        message: 'This module is currently unavailable',
        statusCode: 403,
      );
      await pumpApp(t);
      await settle(t);
      expect(find.text('Total expenses'), findsNothing);
      expect(find.text('Expenses over time'), findsNothing);
      expect(find.textContaining('unavailable'), findsNothing);
      await scrollTo(t, find.byKey(const ValueKey('expense-1')));
      expect(find.text('Trainer salaries'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('a plan-gated 403 on the list shows the server message',
        (t) async {
      _repo.listError = const ApiException(
        message: 'This module is currently unavailable',
        statusCode: 403,
      );
      await pumpApp(t);
      await settle(t);
      await scrollTo(t, find.text('This module is currently unavailable'));
      expect(find.text('Try again'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets("empty ledger shows web's message", (t) async {
      _repo.rows = [];
      await pumpApp(t);
      await settle(t);
      await scrollTo(t, find.text('No expenses found'));
      expect(find.text('No expenses match these filters.'), findsOneWidget);
    });
  });

  group('gating matrix', () {
    testWidgets('finance:view only: no Add, no row menu', (t) async {
      await pumpApp(t, perms: _view);
      await settle(t);
      expect(find.byIcon(Icons.add_rounded), findsNothing);
      await scrollTo(t, find.byKey(const ValueKey('expense-1')));
      expect(find.byType(PopupMenuButton<String>), findsNothing);
      // Analytics are on for finance:view.
      expect(_repo.analyticsCalls, isNotEmpty);
    });

    testWidgets('finance:expense-manage: Add and a Delete menu on every row',
        (t) async {
      await pumpApp(t, perms: _manage);
      await settle(t);
      expect(find.byIcon(Icons.add_rounded), findsOneWidget);
      await scrollTo(t, find.byKey(const ValueKey('expense-2')));
      expect(find.byKey(const ValueKey('expense-menu-1')), findsOneWidget);
      expect(find.byKey(const ValueKey('expense-menu-2')), findsOneWidget);
    });

    testWidgets('without finance:view the analytics are never requested',
        (t) async {
      await pumpApp(t, perms: const ['finance:expense-manage']);
      await settle(t);
      expect(_repo.analyticsCalls, isEmpty);
      expect(find.text('Total expenses'), findsNothing);
      expect(find.text('Expenses over time'), findsNothing);
    });
  });

  group('delete', () {
    testWidgets('confirm -> DELETE -> reload; cancel does nothing', (t) async {
      await pumpApp(t, perms: _manage);
      await settle(t);
      await scrollTo(t, find.byKey(const ValueKey('expense-menu-1')));
      await t.tap(find.byKey(const ValueKey('expense-menu-1')));
      await step(t);
      await t.tap(find.text('Delete').last);
      await step(t);
      expect(find.text('Delete this expense?'), findsOneWidget);
      await t.tap(find.text('Cancel'));
      await step(t);
      expect(_repo.deleted, isEmpty);

      final loads = _repo.lists.length;
      await t.tap(find.byKey(const ValueKey('expense-menu-1')));
      await step(t);
      await t.tap(find.text('Delete').last);
      await step(t);
      await t.tap(find.text('Delete').last);
      await step(t);
      expect(_repo.deleted, ['1']);
      expect(find.text('Expense deleted.'), findsOneWidget);
      expect(_repo.lists.length, greaterThan(loads));
      expect(t.takeException(), isNull);
    });
  });

  group('add expense', () {
    testWidgets("validates the amount, sends web's payload, returns to list",
        (t) async {
      await pumpApp(t, perms: _manage);
      await settle(t);
      await t.tap(find.byIcon(Icons.add_rounded));
      await settle(t);
      expect(find.text('Add an expense'), findsOneWidget);
      // The summary mirrors the form live.
      expect(find.text('None attached'), findsOneWidget);

      // Empty amount -> web's message, nothing sent.
      await reveal(t, find.text('Add expense'));
      await t.tap(find.text('Add expense'));
      await step(t);
      expect(find.text('Enter a valid amount.'), findsOneWidget);
      expect(_repo.created, isEmpty);

      await formToTop(t);
      await t.tap(find.text('Utilities'));
      await step(t);
      await t.enterText(find.byType(TextField).at(0), '1250.5');
      await t.enterText(find.byType(TextField).at(2), '  Electricity bill ');
      await settle(t);
      expect(
        (t.widget(find.byKey(const ValueKey('expense-summary-amount'))) as Text)
            .data,
        '₹1,251',
      );
      await reveal(t, find.text('Add expense'));
      await t.tap(find.text('Add expense'));
      await settle(t);
      final now = DateTime.now();
      expect(_repo.created.single, {
        'category': 'UTILITIES',
        'amount': 1250.5,
        'date': '${now.year}-${now.month}-${now.day}',
        'description': 'Electricity bill',
        'receiptFileName': null,
        'receiptDataUrl': null,
      });
      // Back on the list with the success toast and a reload.
      expect(find.text('Expense recorded.'), findsOneWidget);
      expect(find.text('PERIOD'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets("shows the server's field errors and stays on the form",
        (t) async {
      _repo.createError = const ApiException(
        message: 'Request Validation Failed',
        statusCode: 400,
        fieldErrors: [FieldError(field: 'amount', message: 'Too large')],
      );
      await pumpApp(t, perms: _manage);
      await settle(t);
      await t.tap(find.byIcon(Icons.add_rounded));
      await settle(t);
      await t.enterText(find.byType(TextField).at(0), '10');
      await settle(t);
      await reveal(t, find.text('Add expense'));
      await t.tap(find.text('Add expense'));
      await settle(t);
      expect(find.text('amount: Too large'), findsOneWidget);
      expect(_repo.created, isEmpty);
      expect(find.text('PERIOD'), findsNothing);
    });

    testWidgets('the receipt picker is offered (images only)', (t) async {
      await pumpApp(t, perms: _manage, initial: AppRoutes.expenseForm);
      await settle(t);
      await reveal(t, find.byKey(const ValueKey('expense-receipt-pick')));
      expect(find.text('Upload receipt'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('expense-receipt-pick')));
      await step(t);
      expect(find.text('Take a photo'), findsOneWidget);
      expect(find.text('Choose from gallery'), findsOneWidget);
    });
  });

  group('small phone (360x740)', () {
    testWidgets('list renders without overflow', (t) async {
      await pumpApp(t, perms: _manage, size: const Size(360, 740));
      await settle(t);
      await scrollTo(t, find.byKey(const ValueKey('expense-2')));
      expect(t.takeException(), isNull);
    });

    testWidgets('form fits', (t) async {
      await pumpApp(
        t,
        perms: _manage,
        size: const Size(360, 740),
        initial: AppRoutes.expenseForm,
      );
      await settle(t);
      expect(find.text('Amount & date'), findsOneWidget);
      await reveal(t, find.text('Summary'));
      expect(t.takeException(), isNull);
    });
  });

  group('tablet (1500x1300)', () {
    testWidgets('list: cards sit two-up, no overflow', (t) async {
      await pumpApp(t, perms: _manage, size: const Size(1500, 1300));
      await settle(t);
      await scrollTo(t, find.byKey(const ValueKey('expense-2')));
      final a = t.getTopLeft(find.byKey(const ValueKey('expense-1')));
      final b = t.getTopLeft(find.byKey(const ValueKey('expense-2')));
      expect(a.dy, b.dy);
      expect(b.dx, greaterThan(a.dx));
      expect(t.takeException(), isNull);
    });

    testWidgets('form: details and summary sit side by side', (t) async {
      await pumpApp(
        t,
        perms: _manage,
        size: const Size(1500, 1300),
        initial: AppRoutes.expenseForm,
      );
      await settle(t);
      expect(find.text('Amount & date'), findsOneWidget);
      final details = t.getTopLeft(find.text('Amount & date'));
      final summary = t.getTopLeft(find.text('Summary'));
      expect(summary.dx, greaterThan(details.dx));
      expect(t.takeException(), isNull);
    });
  });
}
