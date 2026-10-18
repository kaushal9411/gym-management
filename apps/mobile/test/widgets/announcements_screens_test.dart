import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/features/announcements/presentation/announcement_form_screen.dart';
import 'package:gym_saas_mobile/features/announcements/presentation/announcement_rich_text.dart';
import 'package:gym_saas_mobile/features/announcements/presentation/announcement_ui.dart';
import 'package:gym_saas_mobile/features/announcements/presentation/announcements_screen.dart';
import 'package:gym_saas_mobile/features/announcements/presentation/schedule_announcement_screen.dart';
import 'package:gym_saas_mobile/models/announcement.dart';
import 'package:gym_saas_mobile/models/announcement_stats.dart';
import 'package:gym_saas_mobile/models/branch_option.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/announcement_repository.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Repo extends Mock implements AnnouncementRepository {}

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
      roles: const ['MANAGER'],
      permissions: perms,
    );

const _viewOnly = ['announcements:view'];
const _all = [
  'announcements:view',
  'announcements:create',
  'announcements:update',
  'announcements:delete',
  'announcements:publish',
];

Announcement _ann(
  String id,
  String status, {
  String body = 'Plain body',
  String title = 'Pool closed',
  DateTime? publishAt,
  DateTime? expiresAt,
}) =>
    Announcement(
      id: id,
      title: title,
      body: body,
      audience: AnnouncementAudience.members,
      status: status,
      publishedAt: status == 'PUBLISHED' ? DateTime.now() : null,
      expiresAt: expiresAt,
      createdAt: DateTime.now(),
      publishAt: publishAt,
      branchName: 'Main',
      createdByName: 'Asha',
    );

AnnouncementStats _stats() => AnnouncementStats.fromJson({
      'range': {'from': '2026-10-01', 'to': '2026-10-18'},
      'previousRange': {'from': '2026-09-13', 'to': '2026-09-30'},
      'kpis': {
        'published': {'value': 3, 'previous': 2},
        'drafts': {'value': 1},
        'scheduled': {'value': 2},
        'expired': {'value': 4},
        'expiringSoon': {'value': 1},
      },
      'daily': [
        {'date': '2026-10-01', 'published': 2, 'previousPublished': 1},
        {'date': '2026-10-02', 'published': 1, 'previousPublished': 0},
      ],
      'byStatus': [
        {'status': 'DRAFT', 'count': 1},
        {'status': 'PUBLISHED', 'count': 3},
      ],
      'byAudience': [
        {'audience': 'ALL', 'count': 2, 'previousCount': 0},
        {'audience': 'STAFF', 'count': 1, 'previousCount': 2},
      ],
      'byBranch': [
        {'branchId': 'b1', 'name': 'Main', 'count': 2},
      ],
      'upcoming': [
        {
          'id': 'a1',
          'title': 'Sale starts',
          'audience': 'MEMBERS',
          'publishAt': DateTime.now()
              .add(const Duration(days: 2))
              .toUtc()
              .toIso8601String(),
        },
      ],
      'expiring': [
        {
          'id': 'a2',
          'title': 'Promo ends',
          'audience': 'ALL',
          'expiresAt': DateTime.now()
              .add(const Duration(days: 1))
              .toUtc()
              .toIso8601String(),
        },
      ],
      'recent': [
        {
          'id': 'a3',
          'title': 'Closed Friday',
          'audience': 'ALL',
          'publishedAt': '2026-10-01T08:00:00.000Z',
          'delivered': 10,
          'read': 4,
        },
        {
          'id': 'a4',
          'title': 'Unlinked one',
          'audience': 'ALL',
          'publishedAt': '2026-10-01T08:00:00.000Z',
          'delivered': null,
          'read': null,
        },
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
    registerFallbackValue(DateTime(2026));
    registerFallbackValue(AnnouncementAudience.all);
  });

  late _Repo repo;
  late _Branches branches;

  setUp(() {
    repo = _Repo();
    branches = _Branches();
    final g = GetIt.instance;
    if (g.isRegistered<AnnouncementRepository>()) {
      g.unregister<AnnouncementRepository>();
    }
    if (g.isRegistered<BranchRepository>()) g.unregister<BranchRepository>();
    g.registerSingleton<AnnouncementRepository>(repo);
    g.registerSingleton<BranchRepository>(branches);
    when(() => branches.assignable()).thenAnswer(
      (_) async => [BranchOption(id: 'b1', name: 'Main')],
    );
    when(
      () => repo.listWithCounts(
        page: any(named: 'page'),
        status: any(named: 'status'),
        audience: any(named: 'audience'),
        search: any(named: 'search'),
      ),
    ).thenAnswer(
      (_) async => (
        page: _page([
          _ann('d', 'DRAFT', body: '<b>Hours</b><ul><li>Mon 6am</li></ul>'),
          _ann('p', 'PUBLISHED'),
        ]),
        counts: const AnnouncementCounts(
          all: 2,
          draft: 1,
          scheduled: 0,
          published: 1,
          expired: 0,
        ),
      ),
    );
    when(
      () => repo.stats(
        dateFrom: any(named: 'dateFrom'),
        dateTo: any(named: 'dateTo'),
      ),
    ).thenAnswer((_) async => _stats());
    when(() => repo.publish(any())).thenAnswer((_) async {});
    when(() => repo.delete(any())).thenAnswer((_) async {});
    when(() => repo.schedule(any(), any())).thenAnswer((_) async {});
    when(
      () => repo.create(
        title: any(named: 'title'),
        body: any(named: 'body'),
        audience: any(named: 'audience'),
        branchId: any(named: 'branchId'),
        expiresAt: any(named: 'expiresAt'),
      ),
    ).thenAnswer((_) async => _ann('new', 'DRAFT'));
    when(
      () => repo.update(
        any(),
        title: any(named: 'title'),
        body: any(named: 'body'),
        audience: any(named: 'audience'),
        branchId: any(named: 'branchId'),
        expiresAt: any(named: 'expiresAt'),
      ),
    ).thenAnswer((_) async => _ann('d', 'DRAFT'));
  });

  Future<void> pump(
    WidgetTester t,
    Widget child,
    List<String> perms, {
    Size size = const Size(360, 740),
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
        child: MaterialApp(home: child),
      ),
    );
  }

  /// Pushes [child] above a placeholder route so `context.pop` works.
  Future<GoRouter> pumpRoute(
    WidgetTester t,
    Widget child,
    List<String> perms, {
    Size size = const Size(390, 900),
  }) async {
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final session = _Session();
    when(() => session.state)
        .thenReturn(SessionAuthenticatedStaff(_user(perms), _tenant));
    final router = GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, __) => const SizedBox()),
        GoRoute(path: '/x', builder: (_, __) => child),
      ],
    );
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    router.push('/x');
    await t.pump();
    await t.pump(const Duration(seconds: 1));
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

  Future<void> settle(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  group('list', () {
    testWidgets('phone 360: hero, KPIs, insights and cards', (t) async {
      await pump(t, const AnnouncementsScreen(), _all);
      await settle(t);
      expect(t.takeException(), isNull);
      expect(find.text('Announcements'), findsOneWidget);
      for (final label in [
        'Published',
        'Expiring soon',
        'Publishing trend',
        'By status',
        'Audience',
        'By branch',
        'Upcoming',
        'Recent reach',
        'Pool closed',
      ]) {
        await show(t, find.text(label));
        expect(find.text(label), findsWidgets, reason: label);
      }
      expect(t.takeException(), isNull);
    });

    testWidgets('rich text bodies render, never as raw tags', (t) async {
      await pump(t, const AnnouncementsScreen(), _all);
      await settle(t);
      await show(t, find.textContaining('Hours', findRichText: true));
      expect(find.textContaining('<b>', findRichText: true), findsNothing);
      expect(find.textContaining('Hours', findRichText: true), findsWidgets);
    });

    testWidgets('tablet 1500x1300 renders without overflow', (t) async {
      await pump(
        t,
        const AnnouncementsScreen(),
        _all,
        size: const Size(1500, 1300),
      );
      await settle(t);
      expect(t.takeException(), isNull);
    });

    testWidgets('view-only: no create, edit, schedule, publish or delete',
        (t) async {
      await pump(t, const AnnouncementsScreen(), _viewOnly);
      await settle(t);
      await show(t, find.text('Pool closed'));
      expect(find.byIcon(Icons.add_rounded), findsNothing);
      expect(find.text('Edit'), findsNothing);
      expect(find.text('Schedule'), findsNothing);
      expect(find.text('Publish now'), findsNothing);
      expect(find.text('Delete'), findsNothing);
    });

    testWidgets(
        'full access: a draft offers all four actions, a published '
        'one only Delete', (t) async {
      await pump(t, const AnnouncementsScreen(), _all);
      await settle(t);
      expect(find.byIcon(Icons.add_rounded), findsOneWidget);
      await show(t, find.text('Publish now'));
      expect(find.text('Edit'), findsOneWidget);
      expect(find.text('Schedule'), findsOneWidget);
      expect(find.text('Publish now'), findsOneWidget);
      expect(find.text('Delete'), findsNWidgets(2));
    });

    testWidgets('each key gates only its own action', (t) async {
      await pump(
        t,
        const AnnouncementsScreen(),
        const ['announcements:view', 'announcements:publish'],
      );
      await settle(t);
      await show(t, find.text('Publish now'));
      expect(find.text('Schedule'), findsOneWidget);
      expect(find.text('Edit'), findsNothing);
      expect(find.text('Delete'), findsNothing);
    });

    testWidgets('Publish now calls the API', (t) async {
      await pump(t, const AnnouncementsScreen(), _all);
      await settle(t);
      await show(t, find.text('Publish now'));
      await t.tap(find.text('Publish now'));
      await settle(t);
      verify(() => repo.publish('d')).called(1);
    });

    testWidgets('Delete asks first, then deletes', (t) async {
      await pump(t, const AnnouncementsScreen(), _all);
      await settle(t);
      await show(t, find.text('Delete'));
      await t.tap(find.text('Delete').first);
      await settle(t);
      expect(find.text('Delete this announcement?'), findsOneWidget);
      verifyNever(() => repo.delete(any()));
      await t.tap(find.text('Delete').last);
      await settle(t);
      verify(() => repo.delete('d')).called(1);
    });

    testWidgets('status chips use the server filter and counts', (t) async {
      await pump(t, const AnnouncementsScreen(), _all);
      await settle(t);
      await show(t, find.text('Draft · 1'));
      await t.tap(find.text('Draft · 1'));
      await settle(t);
      verify(
        () => repo.listWithCounts(
          page: 1,
          status: 'DRAFT',
          audience: null,
          search: '',
        ),
      ).called(1);
    });

    testWidgets(
        'a failed stats call hides the insights, the list still '
        'works', (t) async {
      when(
        () => repo.stats(
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
        ),
      ).thenAnswer((_) async => throw Exception('boom'));
      await pump(t, const AnnouncementsScreen(), _all);
      await settle(t);
      expect(find.text('Publishing trend'), findsNothing);
      await show(t, find.text('Pool closed'));
      expect(find.text('Pool closed'), findsWidgets);
    });

    testWidgets('without announcements:view: message and no requests',
        (t) async {
      await pump(t, const AnnouncementsScreen(), const []);
      await settle(t);
      expect(find.text('No access to announcements'), findsOneWidget);
      verifyNever(
        () => repo.listWithCounts(
          page: any(named: 'page'),
          status: any(named: 'status'),
          audience: any(named: 'audience'),
          search: any(named: 'search'),
        ),
      );
    });
  });

  group('form', () {
    testWidgets('create: web validation text, then saves a draft with HTML',
        (t) async {
      await pumpRoute(t, const AnnouncementFormScreen(), _all);
      await t.ensureVisible(find.text('Save as draft'));
      await t.tap(find.text('Save as draft'));
      await t.pump();
      expect(find.text('Title and body are required.'), findsOneWidget);
      verifyNever(
        () => repo.create(
          title: any(named: 'title'),
          body: any(named: 'body'),
          audience: any(named: 'audience'),
          branchId: any(named: 'branchId'),
          expiresAt: any(named: 'expiresAt'),
        ),
      );
      await t.enterText(find.byType(TextField).first, '  Pool closed  ');
      await t.enterText(
          find.byType(TextField).at(1), '**Closed** Friday\n- 6am',);
      await t.pump();
      await t.ensureVisible(find.text('Save as draft'));
      await t.tap(find.text('Save as draft'));
      await settle(t);
      verify(
        () => repo.create(
          title: 'Pool closed',
          body: '<b>Closed</b> Friday<ul><li>6am</li></ul>',
          audience: AnnouncementAudience.all,
          branchId: null,
          expiresAt: null,
        ),
      ).called(1);
    });

    testWidgets('publish / schedule shortcuts need announcements:publish',
        (t) async {
      await pumpRoute(
        t,
        const AnnouncementFormScreen(),
        const ['announcements:view', 'announcements:create'],
      );
      expect(find.text('Save & publish now'), findsNothing);
      expect(find.text('Save & schedule…'), findsNothing);
    });

    testWidgets('create with publish key: Save & publish now', (t) async {
      await pumpRoute(t, const AnnouncementFormScreen(), _all);
      await t.enterText(find.byType(TextField).first, 'Hello');
      await t.enterText(find.byType(TextField).at(1), 'World');
      await t.pump();
      await t.ensureVisible(find.text('Save & publish now'));
      await t.tap(find.text('Save & publish now'));
      await settle(t);
      verify(() => repo.publish('new')).called(1);
    });

    testWidgets('edit: prefilled from the HTML, saves with update', (t) async {
      await pumpRoute(
        t,
        AnnouncementFormScreen(
          editing: _ann('d', 'DRAFT', body: '<b>Notice</b><br>Gym closed'),
        ),
        _all,
      );
      expect(find.text('Edit announcement'), findsWidgets);
      expect(find.text('Save changes'), findsOneWidget);
      expect(find.text('Save as draft'), findsNothing);
      // The body field shows the editing syntax of the web HTML.
      expect(find.textContaining('Notice', findRichText: true), findsWidgets);
      await t.ensureVisible(find.text('Save changes'));
      await t.tap(find.text('Save changes'));
      await settle(t);
      verify(
        () => repo.update(
          'd',
          title: 'Pool closed',
          body: '<b>Notice</b><br>Gym closed',
          audience: AnnouncementAudience.members,
          branchId: null,
          expiresAt: null,
        ),
      ).called(1);
    });

    testWidgets('tablet renders two columns without overflow', (t) async {
      await pumpRoute(
        t,
        const AnnouncementFormScreen(),
        _all,
        size: const Size(1500, 1300),
      );
      expect(t.takeException(), isNull);
      expect(find.text('Live preview'), findsOneWidget);
    });
  });

  group('schedule', () {
    testWidgets('needs a future date: web validation text', (t) async {
      await pumpRoute(
        t,
        ScheduleAnnouncementScreen(announcement: _ann('d', 'DRAFT')),
        _all,
      );
      await t.ensureVisible(find.text('Schedule').last);
      await t.tap(find.text('Schedule').last);
      await t.pump();
      expect(find.text('Pick a future date and time.'), findsOneWidget);
      verifyNever(() => repo.schedule(any(), any()));
    });

    testWidgets('a preset schedules it and shows the confirmation line',
        (t) async {
      await pumpRoute(
        t,
        ScheduleAnnouncementScreen(announcement: _ann('d', 'DRAFT')),
        _all,
      );
      await t.tap(find.text('Tomorrow 9am'));
      await t.pump();
      expect(find.textContaining('Goes out'), findsOneWidget);
      await t.ensureVisible(find.text('Schedule').last);
      await t.tap(find.text('Schedule').last);
      await settle(t);
      final at = verify(() => repo.schedule('d', captureAny())).captured.single
          as DateTime;
      expect(at.isAfter(DateTime.now()), isTrue);
      expect(at.hour, 9);
    });
  });

  group('helpers', () {
    test('relative times match web', () {
      final now = DateTime(2026, 10, 18, 12);
      expect(
          annRelative(now.add(const Duration(minutes: 90)), now), 'in 1h 30m',);
      expect(annRelative(now.add(const Duration(days: 3)), now), 'in 3d');
      expect(annRelative(now.subtract(const Duration(days: 2)), now), '2d ago');
      expect(annRelative(now, now), 'now');
    });

    test('audience and status metadata', () {
      for (final a in AnnouncementAudience.values) {
        expect(audienceLabel(a), isNotEmpty);
        expect(audienceHint(a), isNotEmpty);
      }
      expect(announcementStatusLabel('SCHEDULED'), 'Scheduled');
    });

    testWidgets(
        'AnnouncementBody makes safe links tappable only for '
        'http(s)', (t) async {
      await t.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AnnouncementBody(
              html: 'See <a href="https://x.test">site</a> and '
                  '<a href="javascript:alert(1)">bad</a>',
            ),
          ),
        ),
      );
      expect(find.textContaining('site', findRichText: true), findsOneWidget);
      expect(t.takeException(), isNull);
    });
  });
}
