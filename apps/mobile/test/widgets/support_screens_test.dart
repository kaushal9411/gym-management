import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/platform/platform_config_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/features/support/presentation/support_ticket_detail_screen.dart';
import 'package:gym_saas_mobile/features/support/presentation/support_ticket_form_screen.dart';
import 'package:gym_saas_mobile/features/support/presentation/support_tickets_screen.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/support_ticket.dart';
import 'package:gym_saas_mobile/models/support_ticket_stats.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/support_ticket_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Repo extends Mock implements SupportTicketRepository {}

class _Session extends MockCubit<SessionState> implements SessionCubit {}

class _Platform extends MockCubit<PlatformConfigState>
    implements PlatformConfigCubit {}

const _plan = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
  featureFlags: ['support_tickets'],
);
const _noPlan = TenantBranding(
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
      roles: const ['MANAGER'],
      permissions: perms,
    );

const _view = ['support:view'];
const _all = ['support:view', 'support:create'];

SupportTicket _ticket(
  String id,
  String status,
  TicketPriority p, {
  List<TicketNote> notes = const [],
}) =>
    SupportTicket(
      id: id,
      subject: 'Subject $id',
      description: 'Description for ticket $id',
      status: status,
      priority: p,
      createdByName: 'Asha Rao',
      createdByEmail: 'asha@gym.test',
      createdAt: DateTime.now().subtract(const Duration(hours: 3)),
      closedAt: null,
      notes: notes,
    );

SupportTicketStats _stats() => SupportTicketStats.fromJson({
      'range': {'from': '2026-10-01', 'to': '2026-10-18'},
      'previousRange': {'from': '2026-09-13', 'to': '2026-09-30'},
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
        {'priority': 'LOW', 'count': 1, 'previousCount': 0},
      ],
    });

PaginatedResult<T> _page<T>(List<T> items) => PaginatedResult<T>(
      items: items,
      total: items.length,
      page: 1,
      limit: 20,
      totalPages: 1,
    );

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    registerFallbackValue(TicketPriority.medium);
  });

  late _Repo repo;

  setUp(() {
    repo = _Repo();
    final g = GetIt.instance;
    if (g.isRegistered<SupportTicketRepository>()) {
      g.unregister<SupportTicketRepository>();
    }
    g.registerSingleton<SupportTicketRepository>(repo);
    when(
      () => repo.listWithCounts(
        page: any(named: 'page'),
        status: any(named: 'status'),
      ),
    ).thenAnswer(
      (_) async => (
        page: _page([
          _ticket('1', 'OPEN', TicketPriority.high),
          _ticket('2', 'RESOLVED', TicketPriority.low),
        ]),
        counts: const SupportTicketCounts(
          all: 2,
          open: 1,
          inProgress: 0,
          resolved: 1,
          closed: 0,
        ),
      ),
    );
    when(
      () => repo.stats(
        dateFrom: any(named: 'dateFrom'),
        dateTo: any(named: 'dateTo'),
      ),
    ).thenAnswer((_) async => _stats());
    when(() => repo.faqs()).thenAnswer(
      (_) async => const [
        FaqItem(id: 'f1', question: 'How do I pay?', answer: 'Use the app.'),
      ],
    );
    when(
      () => repo.create(
        subject: any(named: 'subject'),
        description: any(named: 'description'),
        priority: any(named: 'priority'),
      ),
    ).thenAnswer((_) async => _ticket('new', 'OPEN', TicketPriority.medium));
  });

  Future<GoRouter> pump(
    WidgetTester t,
    Widget child,
    List<String> perms, {
    TenantBranding tenant = _plan,
    Size size = const Size(360, 740),
    bool pushed = false,
  }) async {
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final session = _Session();
    when(() => session.state)
        .thenReturn(SessionAuthenticatedStaff(_user(perms), tenant));
    final platform = _Platform();
    when(() => platform.state)
        .thenReturn(const PlatformConfigState('FitCloud'));
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => pushed ? const SizedBox() : child,
        ),
        GoRoute(path: '/x', builder: (_, __) => child),
      ],
    );
    await t.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<SessionCubit>.value(value: session),
          BlocProvider<PlatformConfigCubit>.value(value: platform),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    if (pushed) router.push('/x');
    await t.pump();
    await t.pump(const Duration(seconds: 3));
    return router;
  }

  Future<void> show(WidgetTester t, Finder f) async {
    for (var i = 0; i < 40 && f.evaluate().isEmpty; i++) {
      await t.drag(find.byType(Scrollable).first, const Offset(0, -300));
      await t.pump();
    }
    await t.ensureVisible(f.first);
    await t.pump();
  }

  group('list', () {
    testWidgets('phone 360: hero, KPIs, insights, help centre, tickets',
        (t) async {
      await pump(t, const SupportTicketsScreen(), _all);
      expect(t.takeException(), isNull);
      expect(find.text('Support'), findsWidgets);
      for (final label in [
        'Created',
        'Oldest open',
        'Tickets created',
        'By status',
        'By priority',
        'Frequently asked questions',
        'How do I pay?',
        'support@fitcloud.com',
        'Support tickets',
        'Subject 1',
        'Subject 2',
      ]) {
        await show(t, find.text(label));
        expect(find.text(label), findsWidgets, reason: label);
      }
      expect(t.takeException(), isNull);
    });

    testWidgets('a FAQ expands to its answer', (t) async {
      await pump(t, const SupportTicketsScreen(), _all);
      await show(t, find.text('How do I pay?'));
      expect(find.text('Use the app.'), findsNothing);
      await t.tap(find.text('How do I pay?'));
      await t.pump();
      expect(find.text('Use the app.'), findsOneWidget);
    });

    testWidgets('tablet 1500x1300 renders without overflow', (t) async {
      await pump(
        t,
        const SupportTicketsScreen(),
        _all,
        size: const Size(1500, 1300),
      );
      await show(t, find.text('Subject 2'));
      expect(t.takeException(), isNull);
    });

    testWidgets('"+" needs support:create', (t) async {
      await pump(t, const SupportTicketsScreen(), _all);
      expect(find.byIcon(Icons.add_rounded), findsOneWidget);
      await pump(t, const SupportTicketsScreen(), _view);
      expect(find.byIcon(Icons.add_rounded), findsNothing);
      await show(t, find.text('Subject 1'));
      expect(find.text('Subject 1'), findsOneWidget);
    });

    testWidgets('status chip sends the server status param', (t) async {
      await pump(t, const SupportTicketsScreen(), _all);
      await show(t, find.textContaining('Resolved ·'));
      await t.tap(find.textContaining('Resolved ·').first);
      await t.pump();
      verify(
        () => repo.listWithCounts(
          page: any(named: 'page'),
          status: 'RESOLVED',
        ),
      ).called(greaterThan(0));
    });

    testWidgets('without the plan flag: "Not on your plan", no API calls',
        (t) async {
      await pump(t, const SupportTicketsScreen(), _all, tenant: _noPlan);
      await show(t, find.text('Not on your plan'));
      expect(find.text('Not on your plan'), findsOneWidget);
      expect(find.byIcon(Icons.add_rounded), findsNothing);
      verifyNever(
        () => repo.listWithCounts(
          page: any(named: 'page'),
          status: any(named: 'status'),
        ),
      );
    });

    testWidgets('without support:view: "No access", no API calls', (t) async {
      await pump(t, const SupportTicketsScreen(), const ['support:create']);
      await show(t, find.text('No access'));
      expect(find.text('No access'), findsOneWidget);
      verifyNever(
        () => repo.stats(
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
        ),
      );
    });

    testWidgets('a failing stats call hides insights; the list stays',
        (t) async {
      when(
        () => repo.stats(
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
        ),
      ).thenAnswer((_) async => throw ApiException.network());
      await pump(t, const SupportTicketsScreen(), _all);
      expect(find.text('Tickets created'), findsNothing);
      await show(t, find.text('Subject 1'));
      expect(find.text('Subject 1'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('an empty status shows its own empty copy', (t) async {
      when(
        () => repo.listWithCounts(
          page: any(named: 'page'),
          status: any(named: 'status'),
        ),
      ).thenAnswer((_) async => (page: _page(<SupportTicket>[]), counts: null));
      await pump(t, const SupportTicketsScreen(), _all);
      await show(t, find.text('No tickets yet'));
      expect(find.text('Raise one if you run into an issue.'), findsOneWidget);
    });
  });

  group('form', () {
    testWidgets('validates then submits and pops true', (t) async {
      await pump(t, const SupportTicketFormScreen(), _all, pushed: true);
      expect(t.takeException(), isNull);
      await show(t, find.text('Submit ticket'));
      await t.tap(find.text('Submit ticket'));
      await t.pump();
      expect(find.textContaining('Subject needs at least 3'), findsOneWidget);

      await t.enterText(find.byType(TextField).first, 'Printer down');
      await t.enterText(find.byType(TextField).last, 'short');
      await t.pump();
      await show(t, find.text('Submit ticket'));
      await t.tap(find.text('Submit ticket'));
      await t.pump();
      expect(find.textContaining('at least 10'), findsWidgets);

      await t.enterText(
        find.byType(TextField).last,
        'The front desk printer is offline',
      );
      await show(t, find.text('Urgent'));
      await t.tap(find.text('Urgent'));
      await t.pump();
      await show(t, find.text('Submit ticket'));
      await t.tap(find.text('Submit ticket'));
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      verify(
        () => repo.create(
          subject: 'Printer down',
          description: 'The front desk printer is offline',
          priority: TicketPriority.urgent,
        ),
      ).called(1);
    });

    testWidgets('shows the API error and stays', (t) async {
      when(
        () => repo.create(
          subject: any(named: 'subject'),
          description: any(named: 'description'),
          priority: any(named: 'priority'),
        ),
      ).thenAnswer((_) async => throw ApiException.network());
      await pump(t, const SupportTicketFormScreen(), _all, pushed: true);
      await t.enterText(find.byType(TextField).first, 'Printer down');
      await t.enterText(
        find.byType(TextField).last,
        'The front desk printer is offline',
      );
      await show(t, find.text('Submit ticket'));
      await t.tap(find.text('Submit ticket'));
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      expect(find.byType(SupportTicketFormScreen), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('without support:create the form is blocked', (t) async {
      await pump(t, const SupportTicketFormScreen(), _view);
      expect(find.text('Cannot raise tickets'), findsOneWidget);
      expect(find.text('Submit ticket'), findsNothing);
    });

    testWidgets('tablet renders without overflow', (t) async {
      await pump(
        t,
        const SupportTicketFormScreen(),
        _all,
        size: const Size(1500, 1300),
      );
      expect(t.takeException(), isNull);
    });
  });

  group('detail', () {
    testWidgets('shows replies from the team', (t) async {
      when(() => repo.getById('t1')).thenAnswer(
        (_) async => _ticket(
          't1',
          'IN_PROGRESS',
          TicketPriority.high,
          notes: [
            TicketNote(
              id: 'n1',
              note: 'We are on it',
              authorName: 'Sam',
              createdAt: DateTime.now(),
            ),
          ],
        ),
      );
      await pump(t, const SupportTicketDetailScreen(ticketId: 't1'), _view);
      expect(find.text('Subject t1'), findsOneWidget);
      expect(find.text('Description for ticket t1'), findsOneWidget);
      expect(find.text('We are on it'), findsOneWidget);
      expect(find.text('Sam'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('no replies: "Waiting for our team"', (t) async {
      when(() => repo.getById('t2')).thenAnswer(
        (_) async => _ticket('t2', 'OPEN', TicketPriority.low),
      );
      await pump(t, const SupportTicketDetailScreen(ticketId: 't2'), _view);
      expect(find.text('Waiting for our team'), findsOneWidget);
    });

    testWidgets('a load error shows retry', (t) async {
      when(() => repo.getById('t3'))
          .thenAnswer((_) async => throw ApiException.network());
      await pump(t, const SupportTicketDetailScreen(ticketId: 't3'), _view);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('tablet renders without overflow', (t) async {
      when(() => repo.getById('t2')).thenAnswer(
        (_) async => _ticket('t2', 'OPEN', TicketPriority.low),
      );
      await pump(
        t,
        const SupportTicketDetailScreen(ticketId: 't2'),
        _view,
        size: const Size(1500, 1300),
      );
      expect(t.takeException(), isNull);
    });
  });
}
