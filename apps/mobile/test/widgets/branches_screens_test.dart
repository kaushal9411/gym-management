import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/features/branches/presentation/branch_detail_screen.dart';
import 'package:gym_saas_mobile/features/branches/presentation/branch_form_screen.dart';
import 'package:gym_saas_mobile/features/branches/presentation/branch_holidays_screen.dart';
import 'package:gym_saas_mobile/features/branches/presentation/branch_hours_screen.dart';
import 'package:gym_saas_mobile/features/branches/presentation/branches_list_screen.dart';
import 'package:gym_saas_mobile/features/manager/presentation/widgets/member_detail_anim.dart';
import 'package:gym_saas_mobile/models/branch.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockSession extends MockCubit<SessionState> implements SessionCubit {}

Map<String, dynamic> _raw({
  String id = 'b1',
  String name = 'Bandra Branch',
  String code = 'BR-0001',
  bool isDefault = true,
  bool isActive = true,
  String? deletedAt,
  int members = 120,
  int staff = 8,
  int? capacity = 150,
}) =>
    {
      'id': id,
      'name': name,
      'branchCode': code,
      'email': 'bandra@gym.test',
      'phone': '9876543210',
      'whatsappNumber': '9876543210',
      'addressLine1': '12 Hill Road',
      'addressLine2': null,
      'city': 'Mumbai',
      'state': 'MH',
      'country': 'India',
      'postalCode': '400050',
      'latitude': '19.059984',
      'longitude': '72.829500',
      'operatingHours': {
        'monday': {'open': '06:00', 'close': '22:00', 'closed': false},
        'tuesday': {'open': '06:00', 'close': '22:00', 'closed': false},
        'sunday': {'open': null, 'close': null, 'closed': true},
      },
      'holidays': [
        {
          'date': DateTime.now()
              .add(const Duration(days: 20))
              .toIso8601String()
              .substring(0, 10),
          'label': 'Founders day',
        },
      ],
      'capacity': capacity,
      'maxMembers': 500,
      'maxStaff': 20,
      'allowCheckIn': true,
      'notes': 'Rooftop studio',
      'isDefault': isDefault,
      'isActive': isActive,
      'timezone': 'Asia/Kolkata',
      'memberCount': members,
      'staffCount': staff,
      'createdAt': '2026-01-01T10:00:00.000Z',
      'updatedAt': '2026-02-01T10:00:00.000Z',
      'deletedAt': deletedAt,
    };

class _BranchRepo extends Fake implements BranchRepository {
  _BranchRepo(this.rows);

  final List<Branch> rows;
  Map<String, dynamic>? created;
  Map<String, dynamic>? updated;
  final calls = <String>[];

  @override
  Future<List<Branch>> listAll({
    bool includeDeleted = true,
    int maxPages = 10,
  }) async =>
      rows;

  @override
  Future<Branch> getById(String branchId) async =>
      rows.firstWhere((b) => b.id == branchId);

  @override
  Future<Branch> create(Map<String, dynamic> body) async {
    created = body;
    return Branch.fromJson(_raw(id: 'new', name: body['name'] as String));
  }

  @override
  Future<Branch> update(String branchId, Map<String, dynamic> body) async {
    updated = body;
    return rows.first;
  }

  @override
  Future<void> setActive(String branchId, {required bool active}) async {
    calls.add(active ? 'activate:$branchId' : 'deactivate:$branchId');
  }

  @override
  Future<void> restore(String branchId) async => calls.add('restore:$branchId');

  @override
  Future<void> setDefault(String branchId) async =>
      calls.add('default:$branchId');

  @override
  Future<void> softDelete(String branchId) async =>
      calls.add('delete:$branchId');
}

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

const _allPerms = [
  'branches:view',
  'branches:create',
  'branches:update',
  'branches:activate',
  'branches:delete',
  'branches:restore',
];

late _BranchRepo _repo;

Branch _b([Map<String, dynamic>? raw]) => Branch.fromJson(raw ?? _raw());

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  setUp(() {
    final g = GetIt.instance;
    _repo = _BranchRepo([
      _b(),
      _b(
        _raw(
          id: 'b2',
          name: 'Andheri Branch',
          code: 'BR-0002',
          isDefault: false,
          isActive: false,
          members: 30,
          capacity: null,
        ),
      ),
      _b(
        _raw(
          id: 'b3',
          name: 'Old Powai',
          code: 'BR-0003',
          isDefault: false,
          deletedAt: '2026-03-01T00:00:00.000Z',
        ),
      ),
    ]);
    if (g.isRegistered<BranchRepository>()) g.unregister<BranchRepository>();
    g.registerSingleton<BranchRepository>(_repo);
  });

  Future<void> pumpApp(
    WidgetTester t,
    Widget child, {
    List<String> perms = _allPerms,
    Size size = const Size(560, 900),
  }) async {
    // Wider than a phone: flutter_test draws every glyph in the square Ahem
    // font (~2x wider than the real fonts).
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
          roles: const ['OWNER'],
          permissions: perms,
        ),
        _tenant,
      ),
    );
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp(home: child),
      ),
    );
  }

  // Looping hero animations: pump fixed time instead of pumpAndSettle.
  Future<void> settle(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  // Two frames: the first starts a route / sheet / dialog animation, the
  // second lets it run to the end.
  Future<void> step(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(milliseconds: 600));
  }

  Future<void> scrollTo(WidgetTester t, Finder f) => t.scrollUntilVisible(
        f,
        300,
        scrollable: find.byType(Scrollable).first,
      );

  testWidgets('list: hero, KPIs, insight panels and cards render', (t) async {
    await pumpApp(t, const BranchesListScreen());
    await settle(t);
    expect(find.text('Branches'), findsOneWidget);
    expect(find.text('Total branches'), findsOneWidget);
    expect(find.text('Status mix'), findsOneWidget);
    expect(find.text('Members per branch'), findsOneWidget);
    expect(find.byIcon(Icons.add_rounded), findsOneWidget);
    await scrollTo(t, find.text('Andheri Branch').last);
    expect(find.text('Andheri Branch'), findsWidgets);
    expect(t.takeException(), isNull);
  });

  testWidgets('list: status chips filter, deleted opens a restore sheet',
      (t) async {
    await pumpApp(t, const BranchesListScreen());
    await settle(t);
    await t.tap(find.text('Inactive · 1'));
    await step(t);
    await scrollTo(t, find.byKey(const ValueKey('branch-b2')));
    expect(find.byKey(const ValueKey('branch-b2')), findsOneWidget);
    expect(find.byKey(const ValueKey('branch-b1')), findsNothing);

    await t.drag(find.byType(Scrollable).first, const Offset(0, 3000));
    await step(t);
    await t.ensureVisible(find.text('Deleted · 1'));
    await t.tap(find.text('Deleted · 1'));
    await step(t);
    await t.drag(find.byType(Scrollable).first, const Offset(0, -1400));
    await step(t);
    expect(find.byKey(const ValueKey('branch-b3')), findsOneWidget);
    await t.tap(find.byKey(const ValueKey('branch-b3')));
    await step(t);
    expect(find.text('Restore branch'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('list: KPI tile opens its sheet; card menu runs an action',
      (t) async {
    await pumpApp(t, const BranchesListScreen());
    await settle(t);
    await t.tap(find.text('Total branches'));
    await step(t);
    expect(find.text('Show everything in the main list'), findsOneWidget);
    await t.tap(find.text('Show everything in the main list'));
    await step(t);

    // Branch menu -> Deactivate -> confirm.
    await scrollTo(t, find.byKey(const ValueKey('branch-b1')));
    await t.tap(
      find.descendant(
        of: find.byKey(const ValueKey('branch-b1')),
        matching: find.byType(PopupMenuButton<String>),
      ),
    );
    await step(t);
    // The default branch can't be deactivated server-side, but the menu
    // mirrors web: Deactivate + Delete are offered, Set default is not.
    expect(find.text('Set as default'), findsNothing);
    expect(find.text('Deactivate'), findsOneWidget);
    await t.tap(find.text('Deactivate'));
    await step(t);
    await t.tap(find.text('Deactivate').last);
    await step(t);
    expect(_repo.calls, ['deactivate:b1']);
    expect(t.takeException(), isNull);
  });

  testWidgets('list: without create permission there is no New branch',
      (t) async {
    await pumpApp(
      t,
      const BranchesListScreen(),
      perms: const ['branches:view'],
    );
    await settle(t);
    expect(find.byIcon(Icons.add_rounded), findsNothing);
    expect(t.takeException(), isNull);
  });

  testWidgets('detail: hero, tiles and all three tabs render', (t) async {
    await pumpApp(t, const BranchDetailScreen(branchId: 'b1'));
    await settle(t);
    expect(find.text('Bandra Branch'), findsWidgets);
    expect(find.text('Capacity & limits'), findsOneWidget);
    for (final tab in ['Schedule', 'Manage', 'Overview']) {
      await t.tap(find.text(tab));
      await step(t);
    }
    await t.tap(find.text('Schedule'));
    await step(t);
    expect(find.text('Operating hours'), findsOneWidget);
    expect(find.text('Holidays'), findsOneWidget);
    expect(find.text('Founders day'), findsOneWidget);
    await t.tap(find.text('Manage'));
    await step(t);
    await scrollTo(t, find.text('Profile completeness'));
    expect(find.text('Profile completeness'), findsOneWidget);
    expect(find.text('Status & lifecycle'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('detail: lifecycle action tiles follow the permissions',
      (t) async {
    // The default branch: no "Set as default"; activate perm -> Deactivate.
    await pumpApp(t, const BranchDetailScreen(branchId: 'b1'));
    await settle(t);
    await t.tap(find.text('Manage'));
    await step(t);
    await scrollTo(t, find.text('Status & lifecycle'));
    expect(find.text('Set as default'), findsNothing);
    expect(find.text('Deactivate'), findsWidgets);
    expect(find.text('Delete'), findsWidgets);

    // A read-only viewer gets no tiles and no overflow menu.
    await pumpApp(
      t,
      const BranchDetailScreen(branchId: 'b1'),
      perms: const ['branches:view'],
    );
    await settle(t);
    await t.tap(find.text('Manage'));
    await step(t);
    await scrollTo(t, find.text('Status & lifecycle'));
    expect(
      find.text('You do not have permission to change this branch.'),
      findsOneWidget,
    );
    expect(find.byType(PopupMenuButton<String>), findsNothing);
    expect(t.takeException(), isNull);
  });

  testWidgets('add wizard: validates, walks the four steps and sends the body',
      (t) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(body: Text('list')),
        ),
        GoRoute(
          path: '/form',
          builder: (_, __) => const BranchFormScreen(),
        ),
      ],
    );
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
          permissions: _allPerms,
        ),
        _tenant,
      ),
    );
    t.view.physicalSize = const Size(560, 900) * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    unawaited(router.push('/form'));
    await settle(t);

    expect(find.text('Branch information'), findsOneWidget);
    await t.tap(find.text('Next'));
    await step(t);
    expect(find.text('Branch name is required.'), findsOneWidget);

    await t.enterText(find.byType(TextField).at(0), 'Powai Branch');
    await t.enterText(find.byType(TextField).at(2), 'powai@gym.test');
    await t.tap(find.text('Next'));
    await step(t);
    expect(find.text('Address'), findsOneWidget);
    await t.enterText(find.byType(TextField).at(2), 'Mumbai');
    await t.tap(find.text('Next'));
    await step(t);
    expect(find.text('Operating hours'), findsOneWidget);
    await t.tap(find.text('Next'));
    await step(t);
    expect(find.text('Capacity & settings'), findsOneWidget);
    expect(find.text('Ready to create'), findsOneWidget);
    await t.enterText(find.byType(TextField).at(0), '80');
    await t.ensureVisible(find.text('Create branch'));
    await t.tap(find.text('Create branch'));
    await step(t);

    expect(_repo.created, isNotNull);
    expect(_repo.created!['name'], 'Powai Branch');
    expect(_repo.created!['email'], 'powai@gym.test');
    expect(_repo.created!['city'], 'Mumbai');
    expect(_repo.created!['capacity'], 80);
    expect(_repo.created!['allowCheckIn'], true);
    // Untouched hours / no holidays are not sent.
    expect(_repo.created!.containsKey('operatingHours'), isFalse);
    expect(_repo.created!.containsKey('holidays'), isFalse);
    expect(t.takeException(), isNull);
  });

  testWidgets('edit form sends only the changed keys', (t) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(body: Text('detail')),
        ),
        GoRoute(
          path: '/edit',
          builder: (_, __) => BranchFormScreen(existing: _b()),
        ),
      ],
    );
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
          permissions: _allPerms,
        ),
        _tenant,
      ),
    );
    t.view.physicalSize = const Size(560, 900) * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    unawaited(router.push('/edit'));
    await settle(t);
    expect(find.text('Operating hours'), findsWidgets);
    expect(find.text('Holidays'), findsWidgets);

    await t.enterText(find.byType(TextField).at(0), 'Bandra West');
    await t.ensureVisible(find.text('Save changes'));
    await t.tap(find.text('Save changes'));
    await step(t);
    expect(_repo.updated, {'name': 'Bandra West'});
    expect(t.takeException(), isNull);
  });

  testWidgets('edit form refuses to clear a value the API cannot clear',
      (t) async {
    await pumpApp(t, BranchFormScreen(existing: _b()));
    await settle(t);
    // Email is the 3rd field (name, code, email).
    await t.enterText(find.byType(TextField).at(2), '');
    await t.ensureVisible(find.text('Save changes'));
    await t.tap(find.text('Save changes'));
    await step(t);
    expect(find.textContaining("Email can't be removed"), findsOneWidget);
    expect(_repo.updated, isNull);
  });

  testWidgets('hours and holidays screens render', (t) async {
    await pumpApp(t, BranchHoursScreen(branch: _b()));
    await settle(t);
    expect(find.text('Weekly schedule'), findsOneWidget);
    expect(find.text('Monday to all days'), findsOneWidget);
    expect(find.text('Monday'), findsOneWidget);
    expect(t.takeException(), isNull);

    await pumpApp(t, BranchHolidaysScreen(branch: _b()));
    await settle(t);
    expect(find.text('Closures'), findsOneWidget);
    expect(find.text('Founders day'), findsOneWidget);
    expect(find.text('Add holiday'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  group('tablet (wide) layouts', () {
    const tablet = Size(1500, 1300);

    testWidgets('list: content is capped + centred, cards go two-up',
        (t) async {
      await pumpApp(t, const BranchesListScreen(), size: tablet);
      await settle(t);
      // Capped: the KPI column starts at the (1500-1280)/2 inset, not the edge.
      final kpi = t.getTopLeft(find.text('Total branches'));
      expect(kpi.dx, greaterThan(110));
      await scrollTo(t, find.byKey(const ValueKey('branch-b2')));
      // Sorted by name: Andheri (b2) first, Bandra (b1) beside it.
      final a = t.getTopLeft(find.byKey(const ValueKey('branch-b2')));
      final b = t.getTopLeft(find.byKey(const ValueKey('branch-b1')));
      expect(b.dx, greaterThan(a.dx + 200));
      expect((b.dy - a.dy).abs(), lessThan(5));
      expect(t.takeException(), isNull);
    });

    testWidgets('list hero gradient is full-width, its text in the column',
        (t) async {
      await pumpApp(t, const BranchesListScreen(), size: tablet);
      await settle(t);
      expect(t.getSize(find.byType(MeshHeroBackground).first).width, 1500);
      expect(t.getTopLeft(find.text('Branches')).dx, greaterThan(110));
      expect(t.takeException(), isNull);
    });

    testWidgets('detail and every form render on a tablet', (t) async {
      for (final w in <Widget>[
        const BranchDetailScreen(branchId: 'b1'),
        const BranchFormScreen(),
        BranchFormScreen(existing: _b()),
        BranchHoursScreen(branch: _b()),
        BranchHolidaysScreen(branch: _b()),
      ]) {
        await pumpApp(t, w, size: tablet);
        await settle(t);
        expect(t.takeException(), isNull, reason: w.runtimeType.toString());
      }
    });

    testWidgets('edit form fields sit two per row on a tablet', (t) async {
      await pumpApp(t, BranchFormScreen(existing: _b()), size: tablet);
      await settle(t);
      final first = t.getTopLeft(find.byType(TextField).at(0));
      final second = t.getTopLeft(find.byType(TextField).at(1));
      expect((first.dy - second.dy).abs(), lessThan(5));
      expect(second.dx, greaterThan(first.dx + 200));
      expect(t.takeException(), isNull);
    });
  });
}
