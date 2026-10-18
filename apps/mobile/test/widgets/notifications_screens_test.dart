import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/features/notifications/presentation/notification_log_screen.dart';
import 'package:gym_saas_mobile/features/notifications/presentation/notification_template_form_screen.dart';
import 'package:gym_saas_mobile/features/notifications/presentation/notification_templates_screen.dart';
import 'package:gym_saas_mobile/features/notifications/presentation/notification_ui.dart';
import 'package:gym_saas_mobile/features/notifications/presentation/notifications_screen.dart';
import 'package:gym_saas_mobile/models/message_log_item.dart';
import 'package:gym_saas_mobile/models/notification_stats.dart';
import 'package:gym_saas_mobile/models/notification_template.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/tenant_notification.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/tenant_notification_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Repo extends Mock implements TenantNotificationRepository {}

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

const _view = ['notifications:view'];
const _manage = ['notifications:view', 'notifications:manage'];

NotificationStats _stats() => NotificationStats.fromJson({
      'range': {'from': '2026-10-01', 'to': '2026-10-02'},
      'previousRange': {'from': '2026-09-29', 'to': '2026-09-30'},
      'kpis': {
        'total': {'value': 10, 'previous': 5},
        'unread': {'value': 4},
        'read': {'value': 6, 'previous': 5},
        'readRate': {'value': 0.6, 'previous': 1},
      },
      'daily': [
        {'date': '2026-10-01', 'total': 6, 'read': 4, 'previousTotal': 5},
        {'date': '2026-10-02', 'total': 4, 'read': 2, 'previousTotal': 0},
      ],
      'categories': [
        {'category': 'PAYMENT', 'count': 7, 'unread': 3, 'previousCount': 2},
        {'category': 'MEMBER', 'count': 3, 'unread': 1, 'previousCount': 0},
      ],
      'hourly': [
        {'hour': 9, 'count': 8},
        {'hour': 14, 'count': 2},
      ],
    });

TenantNotification _n(String id,
        {bool unread = true, String cat = 'PAYMENT',}) =>
    TenantNotification(
      id: id,
      category: cat,
      title: 'Title $id',
      body: 'Body $id',
      readAt: unread ? null : DateTime.now(),
      createdAt: DateTime.now().subtract(const Duration(minutes: 5)),
    );

PaginatedResult<T> _page<T>(List<T> items) => PaginatedResult<T>(
      items: items,
      total: items.length,
      page: 1,
      limit: 20,
      totalPages: 1,
    );

NotificationTemplate _tpl(String type, {bool active = true}) =>
    NotificationTemplate(
      type: type,
      label:
          type == 'PAYMENT_SUCCESS' ? 'Payment success' : 'Membership expiry',
      description: 'desc $type',
      channels: const ['IN_APP', 'EMAIL'],
      titleTemplate: 'Hello {{memberName}}',
      bodyTemplate: 'Your plan ends on {{endDate}}',
      isActive: active,
      isCustomized: type == 'PAYMENT_SUCCESS',
    );

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    registerFallbackValue(DateTime(2026));
  });

  late _Repo repo;

  setUp(() {
    repo = _Repo();
    final g = GetIt.instance;
    if (g.isRegistered<TenantNotificationRepository>()) {
      g.unregister<TenantNotificationRepository>();
    }
    g.registerSingleton<TenantNotificationRepository>(repo);
    when(
      () => repo.listWithCounts(
        page: any(named: 'page'),
        category: any(named: 'category'),
        search: any(named: 'search'),
        unreadOnly: any(named: 'unreadOnly'),
      ),
    ).thenAnswer(
      (_) async => (
        page: _page([_n('a'), _n('b', unread: false, cat: 'MEMBER')]),
        counts: const NotificationCounts(all: 2, unread: 1),
      ),
    );
    when(
      () => repo.stats(
        dateFrom: any(named: 'dateFrom'),
        dateTo: any(named: 'dateTo'),
      ),
    ).thenAnswer((_) async => _stats());
    when(() => repo.markRead(any())).thenAnswer((_) async {});
    when(() => repo.markAllRead()).thenAnswer((_) async {});
    when(() => repo.delete(any())).thenAnswer((_) async {});
    when(
      () => repo.messageLog(
        page: any(named: 'page'),
        limit: any(named: 'limit'),
        channel: any(named: 'channel'),
        status: any(named: 'status'),
      ),
    ).thenAnswer(
      (_) async => _page([
        MessageLogItem(
          id: 'm1',
          channel: 'EMAIL',
          recipient: 'a@x.test',
          subject: 'Welcome aboard',
          content: 'Full email text here',
          status: 'FAILED',
          providerRef: 'ref-1',
          errorMessage: 'Mailbox full',
          createdAt: DateTime(2026, 10, 1, 9, 30),
        ),
        MessageLogItem(
          id: 'm2',
          channel: 'SMS',
          recipient: '+91999',
          subject: null,
          content: 'Your code is 123',
          status: 'SENT',
          providerRef: null,
          errorMessage: null,
          createdAt: DateTime(2026, 10, 1, 8),
        ),
      ]),
    );
    when(() => repo.listTemplates()).thenAnswer(
      (_) async => [_tpl('MEMBERSHIP_EXPIRY'), _tpl('PAYMENT_SUCCESS')],
    );
    when(
      () => repo.updateTemplate(
        any(),
        channels: any(named: 'channels'),
        titleTemplate: any(named: 'titleTemplate'),
        bodyTemplate: any(named: 'bodyTemplate'),
        isActive: any(named: 'isActive'),
      ),
    ).thenAnswer(
      (i) async => _tpl(
        i.positionalArguments.first as String,
        active: i.namedArguments[#isActive] as bool,
      ),
    );
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

  // The screens are long scroll views whose lower sections are only built
  // once scrolled near, so bring a widget into view before asserting on it.
  Future<void> show(WidgetTester t, Finder f) async {
    for (var i = 0; i < 40 && f.evaluate().isEmpty; i++) {
      await t.drag(find.byType(Scrollable).first, const Offset(0, -300));
      await t.pump();
    }
    // Built is not the same as on screen: bring it fully into view to tap.
    await t.ensureVisible(f.first);
    await t.pump();
  }

  // Looping hero animations: pumpAndSettle would hang.
  Future<void> settle(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  group('notification helpers', () {
    test('day labels', () {
      final now = DateTime(2026, 10, 18, 12);
      expect(notifDayLabel(DateTime(2026, 10, 18, 1), now), 'Today');
      expect(notifDayLabel(DateTime(2026, 10, 17, 23), now), 'Yesterday');
      expect(notifDayLabel(DateTime(2026, 10, 14), now), 'Wed, 14 Oct');
      expect(notifDayLabel(DateTime(2025, 12, 1), now), 'Mon, 1 Dec 2025');
    });

    test('every API category has a label, colour and icon', () {
      for (final c in kNotificationCategories) {
        expect(notifCategoryLabel(c), isNotEmpty);
        expect(notifCategoryIcon(c), isA<IconData>());
        expect(notifCategoryColor(c), isA<Color>());
      }
      expect(notifCategoryLabel('SOMETHING_NEW'), 'Something_new');
    });
  });

  group('inbox', () {
    testWidgets('phone 360: hero, tabs, KPIs, insights and grouped feed',
        (t) async {
      await pump(t, const NotificationsScreen(), _manage);
      await settle(t);
      expect(t.takeException(), isNull);
      expect(find.text('Notifications'), findsOneWidget);
      expect(find.text('Message log'), findsOneWidget);
      expect(find.text('Settings'), findsOneWidget);
      for (final label in [
        'Received',
        'Read by your team',
        'Notification volume',
        'By category',
        'Activity by hour',
        'Today',
        'Title a',
      ]) {
        await show(t, find.text(label));
        expect(find.text(label), findsOneWidget, reason: label);
      }
      expect(t.takeException(), isNull);
    });

    testWidgets('tablet 1500x1300 renders without overflow', (t) async {
      await pump(
        t,
        const NotificationsScreen(),
        _manage,
        size: const Size(1500, 1300),
      );
      await settle(t);
      expect(t.takeException(), isNull);
      await show(t, find.text('Title a'));
      expect(find.text('Title a'), findsOneWidget);
    });

    testWidgets('without notifications:view: message and no requests',
        (t) async {
      await pump(t, const NotificationsScreen(), const []);
      await settle(t);
      expect(find.text('No access to notifications'), findsOneWidget);
      verifyNever(
        () => repo.stats(
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
        ),
      );
    });

    testWidgets('view-only: no Settings tab and no Delete', (t) async {
      await pump(t, const NotificationsScreen(), _view);
      await settle(t);
      expect(find.text('Message log'), findsOneWidget);
      expect(find.text('Settings'), findsNothing);
      await show(t, find.text('Title a'));
      expect(find.byTooltip('Delete notification'), findsNothing);
    });

    testWidgets('manage: Delete is offered and asks for confirmation',
        (t) async {
      await pump(t, const NotificationsScreen(), _manage);
      await settle(t);
      await show(t, find.byTooltip('Delete notification'));
      expect(find.byTooltip('Delete notification'), findsWidgets);
      await t.tap(find.byTooltip('Delete notification').first);
      await settle(t);
      expect(find.text('Delete this notification?'), findsOneWidget);
      await t.tap(find.text('Delete').last);
      await settle(t);
      verify(() => repo.delete('a')).called(1);
    });

    testWidgets('tapping an unread notification marks it read', (t) async {
      await pump(t, const NotificationsScreen(), _view);
      await settle(t);
      await show(t, find.text('Title a'));
      await t.tap(find.text('Title a'));
      await settle(t);
      verify(() => repo.markRead('a')).called(1);
    });

    testWidgets('Unread / All switch drives the server filter', (t) async {
      await pump(t, const NotificationsScreen(), _view);
      await settle(t);
      verify(
        () => repo.listWithCounts(
          page: 1,
          category: null,
          search: '',
          unreadOnly: true,
        ),
      ).called(1);
      await show(t, find.textContaining('All ·'));
      await t.tap(find.textContaining('All ·'));
      await settle(t);
      verify(
        () => repo.listWithCounts(
          page: 1,
          category: null,
          search: '',
          unreadOnly: false,
        ),
      ).called(1);
    });

    testWidgets('a failed stats call hides the KPIs and shows Retry',
        (t) async {
      when(
        () => repo.stats(
          dateFrom: any(named: 'dateFrom'),
          dateTo: any(named: 'dateTo'),
        ),
      ).thenAnswer((_) async => throw Exception('boom'));
      await pump(t, const NotificationsScreen(), _view);
      await settle(t);
      expect(find.text('Read by your team'), findsNothing);
      await show(t, find.text('Title a'));
      expect(find.text('Title a'), findsOneWidget);
      await t.scrollUntilVisible(
        find.text('Retry').first,
        -400,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Retry'), findsWidgets);
      expect(t.takeException(), isNull);
    });
  });

  group('message log', () {
    testWidgets('lists sends, filters by status, opens the detail sheet',
        (t) async {
      await pump(t, const NotificationLogScreen(), _view);
      await settle(t);
      expect(t.takeException(), isNull);
      expect(find.text('Message log'), findsWidgets);
      expect(find.text('Welcome aboard'), findsOneWidget);
      expect(find.text('Your code is 123'), findsOneWidget);
      await t.tap(find.text('Failed').first);
      await settle(t);
      verify(
        () => repo.messageLog(
          page: 1,
          limit: any(named: 'limit'),
          channel: null,
          status: 'FAILED',
        ),
      ).called(1);
      await t.tap(find.text('Welcome aboard'));
      await settle(t);
      expect(find.text('Full email text here'), findsOneWidget);
      expect(find.text('Mailbox full'), findsOneWidget);
      expect(find.textContaining('ref-1'), findsOneWidget);
    });

    testWidgets('without notifications:view: message, no request', (t) async {
      await pump(t, const NotificationLogScreen(), const []);
      await settle(t);
      expect(find.text('No access to the message log'), findsOneWidget);
      verifyNever(
        () => repo.messageLog(
          page: any(named: 'page'),
          limit: any(named: 'limit'),
          channel: any(named: 'channel'),
          status: any(named: 'status'),
        ),
      );
    });

    testWidgets('tablet renders without overflow', (t) async {
      await pump(
        t,
        const NotificationLogScreen(),
        _view,
        size: const Size(1500, 1300),
      );
      await settle(t);
      expect(t.takeException(), isNull);
    });
  });

  group('settings (templates)', () {
    testWidgets('needs notifications:manage: locked state, no request',
        (t) async {
      await pump(t, const NotificationTemplatesScreen(), _view);
      await settle(t);
      expect(
        find.text('Notification settings are managed by admins'),
        findsOneWidget,
      );
      verifyNever(() => repo.listTemplates());
    });

    testWidgets('groups, preview chips and the Active switch', (t) async {
      await pump(t, const NotificationTemplatesScreen(), _manage);
      await settle(t);
      expect(t.takeException(), isNull);
      expect(find.text('Membership'), findsOneWidget);
      await show(t, find.text('Payments'));
      expect(find.text('Payments'), findsOneWidget);
      expect(find.text('Customized'), findsOneWidget);
      expect(find.textContaining('{{memberName}}'), findsWidgets);
      await show(t, find.byType(Switch).first);
      await t.tap(find.byType(Switch).first);
      await settle(t);
      verify(
        () => repo.updateTemplate(
          'MEMBERSHIP_EXPIRY',
          channels: const ['IN_APP', 'EMAIL'],
          titleTemplate: 'Hello {{memberName}}',
          bodyTemplate: 'Your plan ends on {{endDate}}',
          isActive: false,
        ),
      ).called(1);
    });

    testWidgets('tablet renders without overflow', (t) async {
      await pump(
        t,
        const NotificationTemplatesScreen(),
        _manage,
        size: const Size(1500, 1300),
      );
      await settle(t);
      expect(t.takeException(), isNull);
    });
  });

  group('template form', () {
    Future<GoRouter> pumpForm(WidgetTester t, NotificationTemplate tpl) async {
      t.view.physicalSize = const Size(720, 1480);
      t.view.devicePixelRatio = 2;
      addTearDown(t.view.reset);
      final router = GoRouter(
        routes: [
          GoRoute(path: '/', builder: (_, __) => const SizedBox()),
          GoRoute(
            path: '/edit',
            builder: (_, __) => NotificationTemplateFormScreen(template: tpl),
          ),
        ],
      );
      await t.pumpWidget(MaterialApp.router(routerConfig: router));
      router.push('/edit');
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      return router;
    }

    testWidgets('saves the whole template and pops true', (t) async {
      await pumpForm(t, _tpl('PAYMENT_SUCCESS'));
      expect(find.text('Preview'), findsOneWidget);
      await t.enterText(find.byType(TextField).first, 'New title');
      await t.pump();
      await t.ensureVisible(find.text('Save template'));
      await t.tap(find.text('Save template'));
      await settle(t);
      verify(
        () => repo.updateTemplate(
          'PAYMENT_SUCCESS',
          channels: any(named: 'channels'),
          titleTemplate: 'New title',
          bodyTemplate: 'Your plan ends on {{endDate}}',
          isActive: true,
        ),
      ).called(1);
    });

    testWidgets('keeps the "choose at least one channel" check', (t) async {
      await pumpForm(
        t,
        const NotificationTemplate(
          type: 'WELCOME_MESSAGE',
          label: 'Welcome',
          description: 'd',
          channels: [],
          titleTemplate: 't',
          bodyTemplate: 'b',
          isActive: true,
          isCustomized: false,
        ),
      );
      await t.ensureVisible(find.text('Save template'));
      await t.tap(find.text('Save template'));
      await t.pump();
      expect(find.text('Choose at least one channel'), findsOneWidget);
      verifyNever(
        () => repo.updateTemplate(
          any(),
          channels: any(named: 'channels'),
          titleTemplate: any(named: 'titleTemplate'),
          bodyTemplate: any(named: 'bodyTemplate'),
          isActive: any(named: 'isActive'),
        ),
      );
    });
  });
}
