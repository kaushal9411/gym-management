// Platform feature flags (`TenantBranding.featureFlags` = the tenant's plan
// modules ANDed with the platform `FeatureFlag.enabled` kill switch, delivered
// by `GET /public/tenants/resolve`) — per-flag behaviour on the phone.
//
// One group per flag (the 11 platform keys): menu tile present when the flag is
// on, absent when it is off; graceful error when the API 403s. Further groups
// cover the places that used to ignore the flags (the "GAP" list in
// docs/FEATURE-FLAGS-AUDIT.md "Mobile", all fixed): any-of menu gates, the
// member menu, every role shell's bottom nav, the router guard, push-tap
// routing and the header bell. Dashboard/hub/refresh/403-debounce live in
// member_dashboard_test, gym_settings_screens_test and the session tests.
//
// Run: `flutter test test/widgets/feature_flags_test.dart`
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
import 'package:gym_saas_mobile/core/push/push_notification_service.dart';
import 'package:gym_saas_mobile/core/routing/app_router.dart';
import 'package:gym_saas_mobile/core/routing/app_routes.dart';
import 'package:gym_saas_mobile/core/routing/route_feature_rules.dart';
import 'package:gym_saas_mobile/core/storage/secure_storage.dart';
import 'package:gym_saas_mobile/features/attendance/presentation/attendance_access.dart';
import 'package:gym_saas_mobile/features/manager/presentation/manager_menu_screen.dart';
import 'package:gym_saas_mobile/features/manager/presentation/manager_shell.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_classes_screen.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_menu_screen.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_shell.dart';
import 'package:gym_saas_mobile/features/owner/presentation/menu_screen.dart';
import 'package:gym_saas_mobile/features/owner/presentation/owner_shell.dart';
import 'package:gym_saas_mobile/features/receptionist/presentation/receptionist_menu_screen.dart';
import 'package:gym_saas_mobile/features/receptionist/presentation/receptionist_shell.dart';
import 'package:gym_saas_mobile/features/support/presentation/support_ui.dart';
import 'package:gym_saas_mobile/features/trainer/presentation/trainer_menu_screen.dart';
import 'package:gym_saas_mobile/features/trainer/presentation/trainer_shell.dart';
import 'package:gym_saas_mobile/models/class_session.dart';
import 'package:gym_saas_mobile/models/member_booking.dart';
import 'package:gym_saas_mobile/models/member_profile.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/device_token_repository.dart';
import 'package:gym_saas_mobile/repositories/member_portal_repository.dart';
import 'package:gym_saas_mobile/repositories/tenant_notification_repository.dart';
import 'package:gym_saas_mobile/shared/widgets/glass_bottom_nav.dart';
import 'package:gym_saas_mobile/shared/widgets/menu_entry.dart';
import 'package:gym_saas_mobile/shared/widgets/notification_bell_icon.dart';
import 'package:gym_saas_mobile/shared/widgets/shell_tabs.dart';
import 'package:mocktail/mocktail.dart';

class _Session extends MockCubit<SessionState> implements SessionCubit {}

class _Platform extends MockCubit<PlatformConfigState>
    implements PlatformConfigCubit {}

/// A real Cubit (state + stream) standing in for SessionCubit, so widgets that
/// watch it rebuild when a test pushes a new state with [set].
class _FakeSession extends Cubit<SessionState> implements SessionCubit {
  _FakeSession(super.initial);

  void set(SessionState s) => emit(s);

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

class _MockStorage extends Mock implements SecureStorage {}

class _MockDeviceRepo extends Mock implements DeviceTokenRepository {}

class _MockTenantNotifRepo extends Mock
    implements TenantNotificationRepository {}

/// A tab body with its own State: "+" increments, the text shows "id:count".
class _Counter extends StatefulWidget {
  const _Counter(this.id);

  final String id;

  @override
  State<_Counter> createState() => _CounterState();
}

class _CounterState extends State<_Counter> {
  int _n = 0;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Text('${widget.id}:$_n'),
          TextButton(
            key: ValueKey('inc-${widget.id}'),
            onPressed: () => setState(() => _n++),
            child: const Text('+'),
          ),
        ],
      );
}

/// The 11 platform feature-flag keys (seed.ts `FEATURE_FLAGS`).
const kPlatformFlags = <String>[
  'ai_coach',
  'notifications',
  'support_tickets',
  'expenses',
  'income',
  'payments',
  'reports',
  'attendance',
  'diet_plans',
  'live_classes',
  'workout_plans',
];

/// Plan-only module keys the menus also gate on (not platform kill switches,
/// but they ride in the same `featureFlags` array).
const kPlanOnlyFlags = <String>['staff', 'branches', 'membership_plans'];

const _allKeys = [...kPlatformFlags, ...kPlanOnlyFlags];

/// A superset of every permission any menu tile asks for, so only the flag
/// decides visibility in these tests.
const _perms = <String>[
  'leads:view',
  'users:read',
  'staff:view',
  'branches:view',
  'memberships:manage',
  'attendance:view',
  'workouts:view',
  'classes:view',
  'diets:view',
  'measurements:view',
  'finance:view',
  'billing:read',
  'analytics:view',
  'reports:view',
  'notifications:view',
  'announcements:view',
  'settings:read',
];

TenantBranding _tenant(Iterable<String> flags) => TenantBranding(
      slug: 't',
      name: 'T',
      status: 'ACTIVE',
      maintenanceMode: false,
      primaryColor: '',
      featureFlags: flags.toList(),
    );

UserProfile _staff(String role) => UserProfile(
      id: 'u',
      tenantId: 't',
      name: 'Staff U',
      email: 'u@x.test',
      phone: null,
      status: 'ACTIVE',
      roles: [role],
      permissions: _perms,
    );

const _member = MemberProfile(
  id: 'm',
  memberId: 'MEM-1',
  name: 'Asha Rao',
  email: null,
  status: 'ACTIVE',
);

/// Flags of `_allKeys` with [off] removed.
List<String> _without(String off) => _allKeys.where((k) => k != off).toList();

class _MenuCase {
  const _MenuCase(this.role, this.roleKey, this.menu, this.tiles);

  final String role;
  final String roleKey;
  final Widget menu;

  /// platform flag -> menu tile titles that must follow it today.
  final Map<String, List<String>> tiles;
}

const _menus = <_MenuCase>[
  _MenuCase('owner', 'OWNER', MenuScreen(), {
    'attendance': ['Attendance', 'Attendance History'],
    'workout_plans': ['Workout Plans'],
    'live_classes': ['Classes'],
    'diet_plans': ['Diet Plans'],
    'payments': ['Payments'],
    'income': ['Income'],
    'expenses': ['Expenses'],
    'reports': ['Analytics'],
    'notifications': [
      'Notifications',
      'Communications',
      'Announcements',
      'Notification Templates',
    ],
  }),
  _MenuCase('manager', 'MANAGER', ManagerMenuScreen(), {
    'attendance': ['Attendance History'],
    'workout_plans': ['Workout Plans'],
    'live_classes': ['Classes'],
    'diet_plans': ['Diet Plans'],
    'reports': ['Analytics'],
    'notifications': ['Notifications', 'Communications', 'Announcements'],
  }),
  _MenuCase('receptionist', 'RECEPTIONIST', ReceptionistMenuScreen(), {
    'attendance': ['Attendance', 'Attendance History'],
    'workout_plans': ['Workout Plans'],
    'diet_plans': ['Diet Plans'],
    'payments': ['Invoices'],
    'income': ['Income'],
    'expenses': ['Expenses'],
    'reports': ['Reports'],
    'notifications': ['Notifications', 'Communications', 'Announcements'],
  }),
  _MenuCase('trainer', 'TRAINER', TrainerMenuScreen(), {
    'attendance': ['Attendance', 'Attendance History'],
    'workout_plans': ['Workout Plans'],
    'live_classes': ['Classes'],
    'diet_plans': ['Diet Plans'],
    'notifications': ['Notifications', 'Communications', 'Announcements'],
  }),
];

class _PortalRepo extends Fake implements MemberPortalRepository {
  ApiException? error;

  @override
  Future<List<ClassSession>> classes({
    required DateTime dateFrom,
    required DateTime dateTo,
  }) async {
    if (error != null) throw error!;
    return const [];
  }

  @override
  Future<List<MemberBooking>> myBookings() async {
    if (error != null) throw error!;
    return const [];
  }
}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  Future<void> pumpStaffMenu(
    WidgetTester t,
    _MenuCase c,
    Iterable<String> flags,
  ) async {
    t.view.physicalSize = const Size(360 * 2, 6000 * 2);
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final session = _Session();
    when(() => session.state).thenReturn(
      SessionAuthenticatedStaff(_staff(c.roleKey), _tenant(flags)),
    );
    final platform = _Platform();
    when(() => platform.state)
        .thenReturn(const PlatformConfigState('FitCloud'));
    await t.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<SessionCubit>.value(value: session),
          BlocProvider<PlatformConfigCubit>.value(value: platform),
        ],
        child: MaterialApp(home: Scaffold(body: c.menu)),
      ),
    );
    await t.pump();
  }

  Future<void> pumpMemberMenu(WidgetTester t, Iterable<String> flags) async {
    t.view.physicalSize = const Size(360 * 2, 3000 * 2);
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final session = _Session();
    when(() => session.state)
        .thenReturn(SessionAuthenticatedMember(_member, _tenant(flags)));
    final platform = _Platform();
    when(() => platform.state)
        .thenReturn(const PlatformConfigState('FitCloud'));
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(body: MemberMenuScreen()),
        ),
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
    await t.pump();
  }

  // ── payload + primitives ──────────────────────────────────────────────────
  group('payload shape (GET /public/tenants/resolve)', () {
    test('featureFlags is a string array of enabled module keys', () {
      final b = TenantBranding.fromJson({
        'slug': 'kaushal-fitness-club',
        'name': 'Kaushal Fitness Club',
        'status': 'ACTIVE',
        'maintenanceMode': false,
        'branding': {'primaryColor': '#4f46e5'},
        'featureFlags': [...kPlatformFlags, 'members', 'staff', 'branches'],
      });
      expect(b.featureFlags, containsAll(kPlatformFlags));
      expect(b.featureFlags, contains('members'));
    });

    test('a key the platform switched off is simply absent', () {
      final b = TenantBranding.fromJson({
        'slug': 't',
        'name': 'T',
        'branding': <String, dynamic>{},
        'featureFlags': kPlatformFlags.where((k) => k != 'diet_plans').toList(),
      });
      expect(b.featureFlags.contains('diet_plans'), isFalse);
      expect(b.featureFlags.contains('expenses'), isTrue);
    });

    test('a missing featureFlags field means NO modules (fail closed)', () {
      final b = TenantBranding.fromJson({'slug': 't', 'name': 'T'});
      expect(b.featureFlags, isEmpty);
    });
  });

  group('MenuEntry gating primitive', () {
    const entry = MenuEntry(
      icon: Icons.circle,
      title: 'X',
      subtitle: 's',
      route: '/x',
      permissions: ['finance:view'],
      featureFlag: 'expenses',
    );
    final user = _staff('OWNER');

    test('visible only when the flag is present AND the permission held', () {
      expect(entry.visibleFor(user, _tenant(['expenses'])), isTrue);
      expect(entry.visibleFor(user, _tenant(const [])), isFalse);
      expect(entry.visibleFor(user, _tenant(['income'])), isFalse);
    });

    test('an entry without a featureFlag ignores the tenant entirely', () {
      const open = MenuEntry(
        icon: Icons.circle,
        title: 'Y',
        subtitle: 's',
        route: '/y',
      );
      expect(open.visibleFor(user, _tenant(const [])), isTrue);
    });

    test('a section whose every tile is flagged off is dropped', () {
      final sections = visibleMenuSections(
        {
          'Money': [entry],
          'Other': [
            const MenuEntry(
              icon: Icons.circle,
              title: 'Z',
              subtitle: 's',
              route: '/z',
            ),
          ],
        },
        user,
        _tenant(const []),
      );
      expect(sections.keys, ['Other']);
    });
  });

  // ── one group per flag ────────────────────────────────────────────────────
  for (final flag in kPlatformFlags) {
    group('flag: $flag', () {
      // ACTIVE: staff menus. Enabled -> tile(s) render; disabled -> absent,
      // and every OTHER flag's tiles are untouched.
      for (final c in _menus) {
        final titles = c.tiles[flag];
        if (titles == null) continue;
        testWidgets(
          '${c.role} menu: $titles shown when enabled, hidden when disabled',
          (t) async {
            await pumpStaffMenu(t, c, [flag]);
            for (final title in titles) {
              expect(
                find.text(title),
                findsOneWidget,
                reason: '${c.role}: "$title" must show with only $flag on',
              );
            }
            // With ONLY this flag on, the other flags' tiles are gone.
            for (final other in c.tiles.entries.where((e) => e.key != flag)) {
              for (final title in other.value) {
                if (titles.contains(title)) continue;
                expect(
                  find.text(title),
                  findsNothing,
                  reason: '${c.role}: "$title" belongs to ${other.key}',
                );
              }
            }

            await pumpStaffMenu(t, c, _without(flag));
            for (final title in titles) {
              expect(
                find.text(title),
                findsNothing,
                reason: '${c.role}: "$title" must hide with $flag off',
              );
            }
            for (final other in c.tiles.entries.where((e) => e.key != flag)) {
              for (final title in other.value) {
                if (titles.contains(title)) continue;
                expect(
                  find.text(title),
                  findsOneWidget,
                  reason: '${c.role}: "$title" must survive $flag off',
                );
              }
            }
          },
        );
      }
    });
  }

  // flag-specific extras (kept inside the same per-flag groups by name) ─────
  group('flag: attendance (extra)', () {
    test('Manager Attendance tab History shortcut follows the flag', () {
      final u = _staff('MANAGER');
      expect(
        AttendanceAccess(u, _tenant(['attendance'])).showHistoryOnTab,
        isTrue,
      );
      expect(AttendanceAccess(u, _tenant(const [])).showHistoryOnTab, isFalse);
    });
  });

  group('flag: support_tickets', () {
    test('SupportAccess: plan flag off -> tickets disabled, cannot raise', () {
      const off = SupportAccess(hasPlan: false, canView: true, canCreate: true);
      const on = SupportAccess(hasPlan: true, canView: true, canCreate: true);
      expect(off.ticketsEnabled, isFalse);
      expect(off.canRaise, isFalse);
      expect(on.ticketsEnabled, isTrue);
      expect(on.canRaise, isTrue);
    });

    for (final c in _menus) {
      testWidgets(
        '${c.role} menu: Support tile is intentionally always listed '
        '(matches web; the screen shows "Not on your plan")',
        (t) async {
          await pumpStaffMenu(t, c, const []);
          expect(find.text('Support'), findsOneWidget);
        },
      );
    }
  });

  group('flag: ai_coach', () {
    test('the AI settings route is bounced when ai_coach is off', () {
      expect(
        routeBlockedByFeatures(
          AppRoutes.aiSettings,
          _tenant(_without('ai_coach')),
        ),
        isTrue,
      );
      expect(
        routeBlockedByFeatures(AppRoutes.aiSettings, _tenant(['ai_coach'])),
        isFalse,
      );
    });

    // The Gym Settings hub card ("AI assistant") hides without the flag:
    // gym_settings_screens_test.dart ("the AI assistant card is hidden when
    // ai_coach is off") — it needs that file's repository fakes.
  });

  group('flag: notifications (Notifications feed + templates tiles)', () {
    for (final c in _menus) {
      testWidgets(
        '${c.role}: the "Notifications" feed tile hides without the flag',
        (t) async {
          await pumpStaffMenu(t, c, _without('notifications'));
          // Exact title match: "Notifications" the feed tile, not the
          // Communications/Announcements tiles.
          expect(find.text('Notifications'), findsNothing);
          await pumpStaffMenu(t, c, ['notifications']);
          expect(find.text('Notifications'), findsOneWidget);
        },
      );
    }

    testWidgets('owner: "Notification Templates" follows the flag', (t) async {
      await pumpStaffMenu(t, _menus.first, _without('notifications'));
      expect(find.text('Notification Templates'), findsNothing);
      await pumpStaffMenu(t, _menus.first, ['notifications']);
      expect(find.text('Notification Templates'), findsOneWidget);
    });
  });

  // ── tiles with an any-of / extra gate ─────────────────────────────────────
  group('any-of menu gates', () {
    testWidgets('manager: Finance hides when payments+income+expenses are off',
        (t) async {
      await pumpStaffMenu(
        t,
        _menus[1],
        _allKeys
            .where((k) => !{'payments', 'income', 'expenses'}.contains(k))
            .toList(),
      );
      expect(find.text('Finance'), findsNothing);
      // Billing (the SaaS subscription) is not a finance module.
      expect(find.text('Billing'), findsOneWidget);
    });

    for (final only in ['payments', 'income', 'expenses']) {
      testWidgets('manager: Finance stays while only $only is on', (t) async {
        await pumpStaffMenu(t, _menus[1], [only]);
        expect(find.text('Finance'), findsOneWidget);
      });
    }

    testWidgets('trainer: Reports hides when reports AND attendance are off',
        (t) async {
      await pumpStaffMenu(
        t,
        _menus[3],
        _allKeys.where((k) => !{'reports', 'attendance'}.contains(k)).toList(),
      );
      expect(find.text('Reports'), findsNothing);
    });

    for (final only in ['reports', 'attendance']) {
      testWidgets('trainer: Reports stays while only $only is on', (t) async {
        await pumpStaffMenu(t, _menus[3], [only]);
        expect(find.text('Reports'), findsOneWidget);
      });
    }

    test('MenuEntry.featureFlagsAny: any one of the keys is enough', () {
      const entry = MenuEntry(
        icon: Icons.circle,
        title: 'X',
        subtitle: 's',
        route: '/x',
        featureFlagsAny: ['a', 'b'],
      );
      final u = _staff('OWNER');
      expect(entry.visibleFor(u, _tenant(const [])), isFalse);
      expect(entry.visibleFor(u, _tenant(['b'])), isTrue);
      expect(entry.visibleFor(u, _tenant(['a', 'b'])), isTrue);
    });
  });

  // ── member menu ───────────────────────────────────────────────────────────
  group('member menu', () {
    testWidgets('baseline: every module on lists every entry', (t) async {
      await pumpMemberMenu(t, _allKeys);
      expect(find.text('My Attendance'), findsOneWidget);
      expect(find.text('Invoices'), findsOneWidget);
      expect(find.text('Payments'), findsOneWidget);
      expect(find.text('Notifications'), findsOneWidget);
    });

    testWidgets('with NO modules only the ungated entries remain', (t) async {
      await pumpMemberMenu(t, const []);
      expect(find.text('My Attendance'), findsNothing);
      expect(find.text('Invoices'), findsNothing);
      expect(find.text('Payments'), findsNothing);
      expect(find.text('Notifications'), findsNothing);
      expect(find.text('Body Measurements'), findsOneWidget);
      expect(find.text('Gym info'), findsOneWidget);
      expect(find.text('Appearance'), findsOneWidget);
    });

    testWidgets('attendance: "My Attendance" hides without the flag',
        (t) async {
      await pumpMemberMenu(t, _without('attendance'));
      expect(find.text('My Attendance'), findsNothing);
      expect(find.text('Invoices'), findsOneWidget);
    });

    testWidgets('payments: "Invoices" + "Payments" hide without the flag',
        (t) async {
      await pumpMemberMenu(t, _without('payments'));
      expect(find.text('Invoices'), findsNothing);
      expect(find.text('Payments'), findsNothing);
      expect(find.text('My Attendance'), findsOneWidget);
    });

    testWidgets('notifications: member "Notifications" hides without the flag',
        (t) async {
      await pumpMemberMenu(t, _without('notifications'));
      expect(find.text('Notifications'), findsNothing);
      expect(find.text('Invoices'), findsOneWidget);
    });
  });

  // ── bottom navs ───────────────────────────────────────────────────────────
  group('shell tabs follow the modules', () {
    List<String> labels(List<ShellTab> tabs, Iterable<String> flags) =>
        visibleShellTabs(tabs, _tenant(flags))
            .map((t) => t.item.label)
            .toList();

    // (name, tab table, tab label, the module keys whose loss removes it)
    final cases = <(String, List<ShellTab>, String, List<String>)>[
      (
        'owner Finance',
        OwnerShell.tabs,
        'Finance',
        ['payments', 'income', 'expenses'],
      ),
      ('owner Reports', OwnerShell.tabs, 'Reports', ['reports']),
      ('manager Attendance', ManagerShell.tabs, 'Attendance', ['attendance']),
      (
        'receptionist Classes',
        ReceptionistShell.tabs,
        'Classes',
        ['live_classes'],
      ),
      (
        'receptionist Payments',
        ReceptionistShell.tabs,
        'Payments',
        ['payments'],
      ),
      ('trainer Workouts', TrainerShell.tabs, 'Workouts', ['workout_plans']),
      ('trainer Diet', TrainerShell.tabs, 'Diet', ['diet_plans']),
      (
        'member Workout',
        MemberShell.tabsFor((_) {}),
        'Workout',
        ['workout_plans'],
      ),
      ('member Diet', MemberShell.tabsFor((_) {}), 'Diet', ['diet_plans']),
      (
        'member Classes',
        MemberShell.tabsFor((_) {}),
        'Classes',
        ['live_classes'],
      ),
    ];

    for (final c in cases) {
      test('${c.$1} tab is removed when ${c.$4.join('/')} is off', () {
        expect(labels(c.$2, _allKeys), contains(c.$3));
        final off = labels(c.$2, _allKeys.where((k) => !c.$4.contains(k)));
        expect(off, isNot(contains(c.$3)));
        // Home is never gated and the OTHER tabs are untouched.
        expect(off.first, 'Home');
        expect(
          off.length,
          labels(c.$2, _allKeys).length - 1,
          reason: 'only the ${c.$3} tab may go',
        );
      });
    }

    test('owner Finance stays while any one of its modules is on', () {
      for (final only in ['payments', 'income', 'expenses']) {
        expect(labels(OwnerShell.tabs, [only]), contains('Finance'));
      }
    });

    test('ungated tabs never go, Home always stays', () {
      expect(labels(ManagerShell.tabs, const []), ['Home', 'Team', 'Members']);
      expect(labels(ReceptionistShell.tabs, const []), ['Home', 'Members']);
      expect(labels(OwnerShell.tabs, const []), ['Home', 'Members']);
      expect(labels(TrainerShell.tabs, const []), ['Home']);
      expect(labels(MemberShell.tabsFor((_) {}), const []), ['Home']);
    });

    test('the dashboard quick-action indexes map to the canonical tab ids', () {
      final ids = MemberShell.tabsFor((_) {}).map((t) => t.id).toList();
      expect(MemberShell.canonicalIds, ids);
      expect(ids[1], 'workout');
      expect(ids[2], 'diet');
      expect(ids[3], 'classes');
    });

    // The real shell body: nav + IndexedStack from one list, selection by id.
    group('FlagTabsShell', () {
      late _FakeSession session;
      const tabs = <ShellTab>[
        ShellTab(
          id: 'home',
          item: GlassNavItem(icon: Icons.home, label: 'Home'),
          child: _Counter('home'),
        ),
        ShellTab(
          id: 'workout',
          item: GlassNavItem(icon: Icons.fitness_center, label: 'Workout'),
          child: _Counter('workout'),
          featureFlag: 'workout_plans',
        ),
        ShellTab(
          id: 'diet',
          item: GlassNavItem(icon: Icons.restaurant, label: 'Diet'),
          child: _Counter('diet'),
          featureFlag: 'diet_plans',
        ),
      ];

      Future<ShellTabController> pumpShell(
        WidgetTester t,
        Iterable<String> flags,
      ) async {
        session = _FakeSession(
          SessionAuthenticatedStaff(_staff('OWNER'), _tenant(flags)),
        );
        final controller = ShellTabController();
        await t.pumpWidget(
          BlocProvider<SessionCubit>.value(
            value: session,
            child: MaterialApp(
              home: FlagTabsShell(
                tabs: tabs,
                drawer: const SizedBox(),
                controller: controller,
              ),
            ),
          ),
        );
        return controller;
      }

      Finder nav(String label) => find.descendant(
            of: find.byType(GlassBottomNav),
            matching: find.text(label),
          );

      int stackIndex(WidgetTester t) =>
          t.widget<IndexedStack>(find.byType(IndexedStack)).index!;

      testWidgets('a switched-off tab leaves BOTH the nav and the stack',
          (t) async {
        await pumpShell(t, ['diet_plans']);
        expect(nav('Home'), findsOneWidget);
        expect(nav('Workout'), findsNothing);
        expect(nav('Diet'), findsOneWidget);
        await t.tap(nav('Diet'));
        await t.pump();
        // Diet keeps its own slot (2) in the stack; the hidden Workout slot is
        // an empty placeholder, its screen is never built.
        final stack = t.widget<IndexedStack>(find.byType(IndexedStack));
        expect(stack.index, 2);
        expect(stack.children, hasLength(3));
        expect(
          find.byKey(const ValueKey('shell-tab-workout'), skipOffstage: false),
          findsNothing,
        );
        expect(find.text('workout:0', skipOffstage: false), findsNothing);
        expect(find.text('diet:0'), findsOneWidget);
      });

      testWidgets(
          'flags changing under the user: selection falls back to Home, '
          'surviving tabs keep their State', (t) async {
        await pumpShell(t, ['workout_plans', 'diet_plans']);
        await t.tap(nav('Diet'));
        await t.pump();
        await t.tap(find.byKey(const ValueKey('inc-diet')));
        await t.pump();
        expect(find.text('diet:1'), findsOneWidget);

        // The Workout module is switched off: Diet is still the selected tab
        // and still holds its counter (its stack slot did not move).
        session.set(
          SessionAuthenticatedStaff(_staff('OWNER'), _tenant(['diet_plans'])),
        );
        await t.pump();
        expect(nav('Workout'), findsNothing);
        expect(stackIndex(t), 2);
        expect(find.text('diet:1'), findsOneWidget);

        // Now the selected tab itself goes: back to Home.
        session.set(SessionAuthenticatedStaff(_staff('OWNER'), _tenant([])));
        await t.pump();
        expect(nav('Diet'), findsNothing);
        expect(stackIndex(t), 0);
        expect(t.takeException(), isNull);
      });

      testWidgets('the controller jumps by id and ignores a hidden tab',
          (t) async {
        final controller = await pumpShell(t, ['diet_plans']);
        controller.select('diet');
        await t.pump();
        expect(stackIndex(t), 2);
        controller.select('home');
        await t.pump();
        controller.select('workout'); // module off -> no-op
        await t.pump();
        expect(stackIndex(t), 0);
      });
    });
  });

  // ── routes ────────────────────────────────────────────────────────────────
  group('route guard (feature routes -> home when the module is off)', () {
    test('every gated route is blocked without its module and open with it',
        () {
      for (final e in kRouteFeatureRules.entries) {
        final rule = e.value;
        expect(
          routeBlockedByFeatures(e.key, _tenant(const [])),
          isTrue,
          reason: '${e.key} must be blocked with no modules',
        );
        expect(
          routeBlockedByFeatures(e.key, _tenant(_allKeys)),
          isFalse,
          reason: '${e.key} must open with every module',
        );
        if (rule.flag != null) {
          expect(
            routeBlockedByFeatures(
              e.key,
              _tenant(_allKeys.where((k) => k != rule.flag)),
            ),
            isTrue,
            reason: '${e.key} needs ${rule.flag}',
          );
        } else {
          // any-of: one module is enough
          expect(
            routeBlockedByFeatures(e.key, _tenant([rule.anyOf.last])),
            isFalse,
            reason: '${e.key} opens on any of ${rule.anyOf}',
          );
        }
      }
    });

    test('specific mappings', () {
      bool blocked(String route, String off) =>
          routeBlockedByFeatures(route, _tenant(_without(off)));
      expect(blocked(AppRoutes.dietPlans, 'diet_plans'), isTrue);
      expect(blocked(AppRoutes.workoutPlans, 'workout_plans'), isTrue);
      expect(blocked(AppRoutes.classes, 'live_classes'), isTrue);
      expect(blocked(AppRoutes.income, 'income'), isTrue);
      expect(blocked(AppRoutes.expenses, 'expenses'), isTrue);
      expect(blocked(AppRoutes.analytics, 'reports'), isTrue);
      expect(blocked(AppRoutes.communications, 'notifications'), isTrue);
      expect(blocked(AppRoutes.memberInvoices, 'payments'), isTrue);
      expect(blocked(AppRoutes.memberAttendance, 'attendance'), isTrue);
      // an unrelated flag never blocks
      expect(blocked(AppRoutes.dietPlans, 'workout_plans'), isFalse);
      // finance / receptionist reports are any-of
      expect(blocked(AppRoutes.finance, 'payments'), isFalse);
      expect(
        routeBlockedByFeatures(
          AppRoutes.finance,
          _tenant(
            _allKeys.where(
              (k) => !const {'payments', 'income', 'expenses'}.contains(k),
            ),
          ),
        ),
        isTrue,
      );
      expect(blocked(AppRoutes.receptionistReports, 'reports'), isFalse);
    });

    test('HR, profile, support and unlisted routes are never blocked', () {
      for (final route in [
        AppRoutes.hrMe,
        AppRoutes.hrApplyLeave,
        AppRoutes.hrMyLeaves,
        AppRoutes.hrPayslips,
        AppRoutes.hrInbox,
        AppRoutes.hrOverview,
        AppRoutes.hrApprovals,
        AppRoutes.hrTeamAttendance,
        AppRoutes.hrEmployees,
        AppRoutes.hrPayroll,
        AppRoutes.home,
        AppRoutes.myProfile,
        AppRoutes.support,
        AppRoutes.branches,
        AppRoutes.membershipPlans,
        AppRoutes.memberProfile,
        '/something/unknown',
      ]) {
        expect(
          routeBlockedByFeatures(route, _tenant(const [])),
          isFalse,
          reason: route,
        );
      }
    });

    testWidgets('the real router sends a disabled route home', (t) async {
      // A role no shell claims lands on the light SignedInStubScreen at /home.
      final session = _FakeSession(
        SessionAuthenticatedStaff(
          _staff('VIEWER'),
          _tenant(_without('income')),
        ),
      );
      final router = buildAppRouter(session);
      await t.pumpWidget(
        BlocProvider<SessionCubit>.value(
          value: session,
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      await t.pump();
      await t.pump();
      String loc() =>
          router.routerDelegate.currentConfiguration.last.matchedLocation;
      expect(loc(), AppRoutes.home);

      router.go(AppRoutes.income); // module off
      await t.pump();
      await t.pump();
      expect(loc(), AppRoutes.home);
      expect(t.takeException(), isNull);
    });
  });

  // ── push tap routing ──────────────────────────────────────────────────────
  group('push notification tap', () {
    late GoRouter router;

    Future<PushNotificationService> pumpPush(
      WidgetTester t, {
      required ActorType actor,
      required List<String> flags,
      bool knowTenant = true,
    }) async {
      final storage = _MockStorage();
      when(() => storage.readActorType()).thenAnswer((_) async => actor);
      router = GoRouter(
        initialLocation: AppRoutes.home,
        routes: [
          for (final p in [
            AppRoutes.home,
            AppRoutes.notifications,
            AppRoutes.memberNotifications,
            AppRoutes.hrApprovals,
            AppRoutes.hrMyLeaves,
          ])
            GoRoute(path: p, builder: (_, __) => Text('PAGE $p')),
        ],
      );
      await t.pumpWidget(MaterialApp.router(routerConfig: router));
      return PushNotificationService(
        _MockDeviceRepo(),
        storage,
        knowTenant ? () => _tenant(flags) : null,
      )..setRouterForTesting(router);
    }

    String loc() =>
        router.routerDelegate.currentConfiguration.last.matchedLocation;

    testWidgets('staff + notifications on -> the staff feed', (t) async {
      final svc = await pumpPush(t, actor: ActorType.staff, flags: _allKeys);
      await svc.navigateForTap(null);
      await t.pumpAndSettle();
      expect(loc(), AppRoutes.notifications);
    });

    testWidgets('staff + notifications OFF -> home, not the 403 feed',
        (t) async {
      final svc = await pumpPush(
        t,
        actor: ActorType.staff,
        flags: _without('notifications'),
      );
      await svc.navigateForTap(null);
      await t.pumpAndSettle();
      expect(loc(), AppRoutes.home);
    });

    testWidgets('member follows the same flag', (t) async {
      var svc = await pumpPush(t, actor: ActorType.member, flags: _allKeys);
      await svc.navigateForTap(null);
      await t.pumpAndSettle();
      expect(loc(), AppRoutes.memberNotifications);

      svc = await pumpPush(
        t,
        actor: ActorType.member,
        flags: _without('notifications'),
      );
      await svc.navigateForTap(null);
      await t.pumpAndSettle();
      expect(loc(), AppRoutes.home);
    });

    testWidgets('HR pushes are NOT gated by notifications', (t) async {
      final svc = await pumpPush(
        t,
        actor: ActorType.staff,
        flags: _without('notifications'),
      );
      await svc.navigateForTap('hr:LEAVE_APPLIED');
      await t.pumpAndSettle();
      expect(loc(), AppRoutes.hrApprovals);
    });

    testWidgets('no tenant known -> the old behaviour (feed)', (t) async {
      final svc = await pumpPush(
        t,
        actor: ActorType.staff,
        flags: const [],
        knowTenant: false,
      );
      await svc.navigateForTap(null);
      await t.pumpAndSettle();
      expect(loc(), AppRoutes.notifications);
    });
  });

  // ── the header bell ───────────────────────────────────────────────────────
  group('notification bell', () {
    late _MockTenantNotifRepo repo;

    setUp(() {
      repo = _MockTenantNotifRepo();
      when(() => repo.unreadCount()).thenAnswer((_) async => 3);
      final g = GetIt.instance;
      if (g.isRegistered<TenantNotificationRepository>()) {
        g.unregister<TenantNotificationRepository>();
      }
      g.registerSingleton<TenantNotificationRepository>(repo);
    });

    Future<_FakeSession> pumpBell(
      WidgetTester t,
      Iterable<String> flags,
    ) async {
      final session = _FakeSession(
        SessionAuthenticatedStaff(_staff('OWNER'), _tenant(flags)),
      );
      await t.pumpWidget(
        BlocProvider<SessionCubit>.value(
          value: session,
          child: const MaterialApp(
            home: Scaffold(body: NotificationBellIcon(isStaff: true)),
          ),
        ),
      );
      await t.pump();
      return session;
    }

    testWidgets('module on: polls on mount and every 60 s, shows the badge',
        (t) async {
      await pumpBell(t, ['notifications']);
      expect(find.byIcon(Icons.notifications_outlined), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
      verify(() => repo.unreadCount()).called(1);
      clearInteractions(repo);
      await t.pump(const Duration(seconds: 61));
      verify(() => repo.unreadCount()).called(1);
    });

    testWidgets('module off: no bell and NO polling at all', (t) async {
      await pumpBell(t, const []);
      expect(find.byIcon(Icons.notifications_outlined), findsNothing);
      await t.pump(const Duration(seconds: 130));
      verifyNever(() => repo.unreadCount());
    });

    testWidgets('switched off while mounted: polling stops; back on: resumes',
        (t) async {
      final session = await pumpBell(t, ['notifications']);
      verify(() => repo.unreadCount()).called(1);
      clearInteractions(repo);

      session
          .set(SessionAuthenticatedStaff(_staff('OWNER'), _tenant(const [])));
      await t.pump();
      await t.pump();
      expect(find.byIcon(Icons.notifications_outlined), findsNothing);
      await t.pump(const Duration(seconds: 130));
      verifyNever(() => repo.unreadCount());

      session.set(
        SessionAuthenticatedStaff(_staff('OWNER'), _tenant(['notifications'])),
      );
      await t.pump();
      await t.pump();
      expect(find.byIcon(Icons.notifications_outlined), findsOneWidget);
      verify(() => repo.unreadCount()).called(1);
    });
  });

  // ── graceful API failure when a flag is off but the UI still shows it ─────
  group('API 403 "This module is currently unavailable." on an ungated UI', () {
    late _PortalRepo repo;

    setUp(() {
      repo = _PortalRepo();
      final g = GetIt.instance;
      if (g.isRegistered<MemberPortalRepository>()) {
        g.unregister<MemberPortalRepository>();
      }
      g.registerSingleton<MemberPortalRepository>(repo);
    });

    Future<void> pumpClasses(WidgetTester t) async {
      repo.error = const ApiException(
        message: 'This module is currently unavailable.',
        statusCode: 403,
      );
      t.view.physicalSize = const Size(360 * 2, 800 * 2);
      t.view.devicePixelRatio = 2;
      addTearDown(t.view.reset);
      await t.pumpWidget(
        const MaterialApp(home: Scaffold(body: MemberClassesScreen())),
      );
      await t.pump();
      await t.pump(const Duration(seconds: 1));
    }

    testWidgets('member Classes tab: no crash, an inline error alert is shown',
        (t) async {
      await pumpClasses(t);
      expect(t.takeException(), isNull);
      // Both requests fail; the screen shows the server's own message.
      expect(find.textContaining('Could not load classes'), findsNothing);
    });

    testWidgets(
      'member Classes tab: shows the server message, not a '
      'ParallelWaitError dump',
      (t) async {
        await pumpClasses(t);
        expect(
          find.text('This module is currently unavailable.'),
          findsOneWidget,
        );
        expect(find.textContaining('ParallelWaitError'), findsNothing);
      },
    );
  });
}
