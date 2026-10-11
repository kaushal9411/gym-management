import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/features/leads/presentation/lead_detail_screen.dart';
import 'package:gym_saas_mobile/features/leads/presentation/leads_dashboard_screen.dart';
import 'package:gym_saas_mobile/models/lead.dart';
import 'package:gym_saas_mobile/models/lead_analytics.dart';
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
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

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

  testWidgets('detail: manager sees Assign + Delete, can convert', (t) async {
    when(() => repo.getById('l1')).thenAnswer((_) async => sample());
    await pumpApp(t, const LeadDetailScreen(leadId: 'l1'), _manager);
    await t.pumpAndSettle();
    expect(find.text('ZZ Lead Test'), findsWidgets);
    expect(find.text('Convert to member'), findsOneWidget);
    expect(find.text('Assign'), findsOneWidget);
    expect(find.text('Log activity'), findsOneWidget);
    await t.scrollUntilVisible(
      find.text('spoke to lead'),
      300,
      scrollable: find
          .descendant(
            of: find.byType(RefreshIndicator),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    expect(find.text('spoke to lead'), findsOneWidget);
    await t.tap(find.byTooltip('More'));
    await t.pumpAndSettle();
    expect(find.text('Delete lead'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('detail: receptionist has no Assign / Delete', (t) async {
    when(() => repo.getById('l1')).thenAnswer((_) async => sample());
    await pumpApp(t, const LeadDetailScreen(leadId: 'l1'), _receptionist);
    await t.pumpAndSettle();
    expect(find.text('Convert to member'), findsOneWidget);
    expect(find.text('Assign'), findsNothing);
    expect(find.byTooltip('More'), findsNothing);
    expect(find.text('Delete lead'), findsNothing);
    expect(t.takeException(), isNull);
  });

  testWidgets('dashboard renders at 360px without overflow', (t) async {
    when(() => repo.analytics(range: any(named: 'range'))).thenAnswer(
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
        'lostReasons': [
          {'reason': 'PRICE_TOO_HIGH', 'count': 2},
        ],
        'ageing': [
          {'bucket': '0-7', 'count': 3},
          {'bucket': '8-14', 'count': 1},
        ],
      }),
    );
    await pumpApp(t, const LeadsDashboardScreen(), _manager);
    await t.pump();
    await t.pump(const Duration(seconds: 2));
    expect(find.text('THIS MONTH'), findsOneWidget);
    expect(find.text('CONVERSION RATE'), findsOneWidget);
    expect(find.text('FOLLOW-UPS DUE'), findsOneWidget);
    expect(find.text('Today'), findsWidgets);
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
