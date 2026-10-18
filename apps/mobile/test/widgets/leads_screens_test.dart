import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/features/leads/presentation/lead_detail_screen.dart';
import 'package:gym_saas_mobile/features/leads/presentation/lead_follow_ups_screen.dart';
import 'package:gym_saas_mobile/features/leads/presentation/lead_form_screen.dart';
import 'package:gym_saas_mobile/features/leads/presentation/lead_list_screen.dart';
import 'package:gym_saas_mobile/features/leads/presentation/leads_dashboard_screen.dart';
import 'package:gym_saas_mobile/features/manager/presentation/widgets/member_detail_anim.dart';
import 'package:gym_saas_mobile/models/lead.dart';
import 'package:gym_saas_mobile/models/lead_analytics.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/lead_repository.dart';
import 'package:gym_saas_mobile/shared/widgets/menu_entry.dart';
import 'package:mocktail/mocktail.dart';

class _MockRepo extends Mock implements LeadRepository {}

class _MockSession extends MockCubit<SessionState> implements SessionCubit {}

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

UserProfile _user(List<String> perms, String role) => UserProfile(
      id: 'u',
      tenantId: 't',
      name: 'U',
      email: 'u@x.test',
      phone: null,
      status: 'ACTIVE',
      roles: [role],
      permissions: perms,
    );

const _receptionist = [
  'leads:view',
  'leads:create',
  'leads:update',
  'leads:convert',
];
const _manager = [..._receptionist, 'leads:delete', 'leads:assign'];

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    registerFallbackValue(const LeadFilters());
  });

  late _MockRepo repo;
  setUp(() {
    repo = _MockRepo();
    final g = GetIt.instance;
    if (g.isRegistered<LeadRepository>()) g.unregister<LeadRepository>();
    g.registerSingleton<LeadRepository>(repo);
  });

  Future<void> pumpApp(WidgetTester t, Widget child, List<String> perms) async {
    t.view.physicalSize = const Size(360 * 3, 800 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final session = _MockSession();
    when(() => session.state).thenReturn(
      SessionAuthenticatedStaff(_user(perms, 'X'), _tenant),
    );
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp(home: child),
      ),
    );
  }

  // The redesigned screens contain looping animations (hero mesh, pulse
  // dots, shimmer), so pumpAndSettle would never return — pump fixed time.
  Future<void> settle(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  Lead sample() => Lead(
        id: 'l1',
        name: 'ZZ Lead Test',
        phone: '9000099001',
        source: LeadSource.walkIn,
        status: LeadStatus.contacted,
        activities: const [
          LeadActivity(
            id: 'a',
            type: LeadActivityType.created,
            rawType: 'CREATED',
          ),
          LeadActivity(
            id: 'b',
            type: LeadActivityType.call,
            rawType: 'CALL',
            note: 'spoke to lead',
          ),
        ],
      );

  Finder detailScrollable() => find
      .descendant(
        of: find.byType(RefreshIndicator),
        matching: find.byType(Scrollable),
      )
      .first;

  testWidgets('detail: manager sees Assign + Delete, can convert', (t) async {
    when(() => repo.getById('l1')).thenAnswer((_) async => sample());
    await pumpApp(t, const LeadDetailScreen(leadId: 'l1'), _manager);
    await settle(t);
    expect(find.text('ZZ Lead Test'), findsWidgets);
    expect(find.text('Convert to member'), findsOneWidget);
    expect(find.text('Assign'), findsOneWidget);
    // Composer (panel title + button) sits on the default Activity tab,
    // below the hero / pipeline panel.
    await t.scrollUntilVisible(
      find.widgetWithText(ShimmerButton, 'Log activity'),
      300,
      scrollable: detailScrollable(),
    );
    expect(find.text('Log activity'), findsWidgets);
    await t.scrollUntilVisible(
      find.text('spoke to lead'),
      300,
      scrollable: detailScrollable(),
    );
    expect(find.text('spoke to lead'), findsOneWidget);
    await t.tap(find.byTooltip('More'));
    await t.pump(const Duration(seconds: 1));
    expect(find.text('Delete lead'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('detail: receptionist has no Assign / Delete', (t) async {
    when(() => repo.getById('l1')).thenAnswer((_) async => sample());
    await pumpApp(t, const LeadDetailScreen(leadId: 'l1'), _receptionist);
    await settle(t);
    expect(find.text('Convert to member'), findsOneWidget);
    expect(find.text('Assign'), findsNothing);
    expect(find.byTooltip('More'), findsNothing);
    expect(find.text('Delete lead'), findsNothing);
    expect(t.takeException(), isNull);
  });

  testWidgets('detail: Details tab shows every field panel', (t) async {
    when(() => repo.getById('l1')).thenAnswer((_) async => sample());
    await pumpApp(t, const LeadDetailScreen(leadId: 'l1'), _manager);
    await settle(t);
    await t.scrollUntilVisible(
      find.text('Details'),
      300,
      scrollable: detailScrollable(),
    );
    await t.tap(find.text('Details'));
    await settle(t);
    for (final title in ['Contact', 'Interest & plan', 'Source', 'Notes']) {
      await t.scrollUntilVisible(
        find.text(title),
        300,
        scrollable: detailScrollable(),
      );
      expect(find.text(title), findsOneWidget);
    }
    expect(t.takeException(), isNull);
  });

  void stubDashboard() {
    when(
      () => repo.analytics(
        range: any(named: 'range'),
        dateFrom: any(named: 'dateFrom'),
        dateTo: any(named: 'dateTo'),
      ),
    ).thenAnswer(
      (_) async => LeadAnalytics.fromJson({
        'kpis': {
          'newLeads': {'value': 10, 'previous': 5},
          'conversionRate': {'value': 0.2},
          'open': {'value': 7},
          'followUpsDueToday': {'value': 2},
          'followUpsOverdue': {'value': 1},
        },
        'headline': {
          'today': {'newLeads': 1, 'converted': 0},
          'thisMonth': {'newLeads': 9, 'converted': 2, 'newLeadsDelta': 12},
          'thisYear': {'newLeads': 23, 'converted': 6},
        },
        'daily': [
          for (var i = 1; i <= 30; i++)
            {
              'date': '2026-09-${i.toString().padLeft(2, '0')}',
              'newLeads': i % 4,
              'converted': i % 7 == 0 ? 1 : 0,
            },
        ],
        'monthly': [
          for (var m = 1; m <= 12; m++)
            {
              'month': '2026-${m.toString().padLeft(2, '0')}',
              'newLeads': m,
              'converted': m ~/ 3,
              'conversionRate': 0.3,
            },
        ],
        'funnel': {
          'stages': [
            {'stage': 'NEW', 'count': 10, 'dropOff': 0},
            {'stage': 'CONTACTED', 'count': 6, 'dropOff': 4},
          ],
          'lost': 2,
          'total': 10,
        },
        'bySource': [
          {
            'source': 'WALK_IN',
            'leads': 4,
            'converted': 1,
            'conversionRate': 0.25,
          },
        ],
        'byStaff': [
          {'userId': 'u', 'name': 'Asha Verma', 'leads': 4, 'converted': 1},
        ],
        'byPlan': [
          {'planId': 'p', 'name': 'Gold', 'leads': 3, 'converted': 1},
        ],
        'topBranches': [
          {'branchId': 'b1', 'name': 'Main', 'leads': 6, 'converted': 2},
          {'branchId': 'b2', 'name': 'East', 'leads': 4, 'converted': 1},
        ],
        'lostReasons': [
          {'reason': 'PRICE_TOO_HIGH', 'count': 2},
        ],
        'ageing': [
          {'bucket': '0-7', 'count': 3},
          {'bucket': '8-14', 'count': 1},
        ],
      }),
    );
    when(() => repo.list(limit: any(named: 'limit'))).thenAnswer(
      (_) async => LeadListPage(
        page: const PaginatedResult<Lead>(
          items: [],
          total: 0,
          page: 1,
          limit: 1,
          totalPages: 1,
        ),
        counts: const LeadCounts(all: 12, byStatus: {'NEW': 5, 'CONTACTED': 4}),
        summary: const LeadSummary(total: 12, open: 9, converted: 2, lost: 1),
      ),
    );
    when(
      () => repo.followUps(
        scope: any(named: 'scope'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer(
      (_) async => LeadFollowUps(items: [sample()], overdue: 1, today: 1),
    );
  }

  testWidgets('dashboard renders at 360px without overflow', (t) async {
    stubDashboard();
    await pumpApp(t, const LeadsDashboardScreen(), _manager);
    await settle(t);
    expect(find.text('THIS MONTH'), findsOneWidget);
    expect(find.text('Conversion rate'), findsOneWidget);
    expect(find.text('Follow-ups today'), findsOneWidget);
    expect(find.text('Leads & Enquiries'), findsOneWidget);
    expect(find.text('7D'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('dashboard: tapping a KPI tile opens its detail sheet', (
    t,
  ) async {
    stubDashboard();
    await pumpApp(t, const LeadsDashboardScreen(), _manager);
    await settle(t);
    await t.tap(find.text('New leads'));
    await settle(t);
    expect(
      find.text('Selected range vs the period before it'),
      findsOneWidget,
    );
    expect(find.text('Open all leads'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('dashboard: pipeline, follow-ups and insight panels render', (
    t,
  ) async {
    stubDashboard();
    await pumpApp(t, const LeadsDashboardScreen(), _manager);
    await settle(t);
    final scroll = find.byType(Scrollable).first;
    for (final title in [
      'Pipeline',
      'Pipeline funnel',
      'Interest by plan',
      'Branches',
      'Why leads are lost',
    ]) {
      await t.scrollUntilVisible(find.text(title), 400, scrollable: scroll);
      expect(find.text(title), findsWidgets);
    }
    expect(t.takeException(), isNull);
  });

  testWidgets('list: renders cards, switches to board', (t) async {
    final page = LeadListPage(
      page: PaginatedResult<Lead>(
        items: [sample()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      ),
      counts: const LeadCounts(all: 1, byStatus: {'CONTACTED': 1}),
      summary: const LeadSummary(total: 1, open: 1),
    );
    when(
      () => repo.list(
        page: any(named: 'page'),
        filters: any(named: 'filters'),
      ),
    ).thenAnswer((_) async => page);
    when(
      () => repo.list(
        limit: any(named: 'limit'),
        filters: any(named: 'filters'),
      ),
    ).thenAnswer((_) async => page);
    when(() => repo.assignees()).thenAnswer((_) async => const []);
    await pumpApp(t, const LeadListScreen(), _manager);
    await settle(t);
    expect(find.text('ZZ Lead Test'), findsOneWidget);
    expect(find.text('All leads'), findsOneWidget);
    expect(find.text('1 matching'), findsOneWidget);
    await t.tap(find.byTooltip('Board view'));
    await settle(t);
    expect(find.text('ZZ Lead Test'), findsOneWidget);
    expect(find.text('Negotiation'), findsWidgets);
    expect(t.takeException(), isNull);
  });

  testWidgets('form: create screen shows the banner + sections', (t) async {
    await pumpApp(t, const LeadFormScreen(), _manager);
    await settle(t);
    expect(find.text('New lead'), findsWidgets);
    expect(find.text('Create lead'), findsOneWidget);
    expect(find.text('Contact'), findsOneWidget);
    expect(find.text('Enquiry'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('detail: a lost lead can be reopened', (t) async {
    final lost = Lead(
      id: 'l2',
      name: 'Lost Lead',
      phone: '9000099002',
      source: LeadSource.website,
      status: LeadStatus.lost,
      lostReason: 'PRICE_TOO_HIGH',
      lostNote: 'Found cheaper',
      activities: const [
        LeadActivity(
          id: 'x',
          type: LeadActivityType.statusChange,
          rawType: 'STATUS_CHANGE',
          fromStatus: 'NEGOTIATION',
          toStatus: 'LOST',
        ),
      ],
    );
    when(() => repo.getById('l2')).thenAnswer((_) async => lost);
    await pumpApp(t, const LeadDetailScreen(leadId: 'l2'), _manager);
    await settle(t);
    expect(find.text('Reopen'), findsOneWidget);
    expect(find.text('Mark lost'), findsNothing);
    expect(t.takeException(), isNull);
  });

  testWidgets('detail: a converted lead is terminal', (t) async {
    final converted = Lead(
      id: 'l3',
      name: 'Won Lead',
      phone: '9000099003',
      source: LeadSource.referral,
      status: LeadStatus.converted,
      convertedMember: const ConvertedMember(
        id: 'm1',
        memberId: 'MEM-1',
        name: 'Won Lead',
      ),
    );
    when(() => repo.getById('l3')).thenAnswer((_) async => converted);
    await pumpApp(t, const LeadDetailScreen(leadId: 'l3'), _manager);
    await settle(t);
    expect(find.text('Convert to member'), findsNothing);
    expect(find.text('Edit'), findsNothing);
    expect(find.text('Move stage'), findsNothing);
    expect(find.textContaining('MEM-1'), findsWidgets);
    expect(t.takeException(), isNull);
  });

  testWidgets('detail: Convert opens the convert sheet', (t) async {
    when(() => repo.getById('l1')).thenAnswer((_) async => sample());
    await pumpApp(t, const LeadDetailScreen(leadId: 'l1'), _manager);
    await settle(t);
    await t.tap(find.text('Convert to member'));
    await settle(t);
    expect(
      find.text('Creates the member record and marks this lead as converted.'),
      findsOneWidget,
    );
    expect(t.takeException(), isNull);
  });

  testWidgets('list: filter sheet opens and applies', (t) async {
    final page = LeadListPage(
      page: PaginatedResult<Lead>(
        items: [sample()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      ),
      counts: const LeadCounts(all: 1, byStatus: {'CONTACTED': 1}),
      summary: const LeadSummary(total: 1, open: 1),
    );
    when(
      () => repo.list(
        page: any(named: 'page'),
        filters: any(named: 'filters'),
      ),
    ).thenAnswer((_) async => page);
    when(() => repo.assignees()).thenAnswer(
      (_) async =>
          const [LeadAssignee(id: 'u1', name: 'Asha', role: 'MANAGER')],
    );
    await pumpApp(t, const LeadListScreen(), _manager);
    await settle(t);
    await t.tap(find.text('Filters'));
    await settle(t);
    expect(find.text('Filter leads'), findsOneWidget);
    expect(find.text('Apply filters'), findsOneWidget);
    await t.tap(find.text('Apply filters'));
    await settle(t);
    expect(find.text('Filter leads'), findsNothing);
    expect(t.takeException(), isNull);
  });

  testWidgets('follow-ups screen shows bucket tiles and quick actions', (
    t,
  ) async {
    when(
      () => repo.followUps(
        scope: any(named: 'scope'),
        bucket: any(named: 'bucket'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer(
      (_) async => LeadFollowUps(
        items: [sample()],
        overdue: 2,
        today: 3,
        upcoming: 4,
        due: 5,
      ),
    );
    await pumpApp(t, const LeadFollowUpsScreen(), _manager);
    await settle(t);
    expect(find.text('Overdue'), findsOneWidget);
    expect(find.text('Upcoming'), findsOneWidget);
    expect(find.text('Log call'), findsOneWidget);
    expect(find.text('Reschedule'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  test('menu entry is hidden without leads:view (trainer)', () {
    const entry = MenuEntry(
      icon: Icons.person_search_outlined,
      title: 'Leads',
      subtitle: '',
      route: '/leads',
      permissions: ['leads:view'],
    );
    expect(entry.visibleFor(_user(const [], 'TRAINER'), _tenant), isFalse);
    expect(
      entry.visibleFor(_user(_receptionist, 'RECEPTIONIST'), _tenant),
      isTrue,
    );
  });
}
