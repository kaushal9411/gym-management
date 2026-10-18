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
import 'package:gym_saas_mobile/features/manager/presentation/widgets/member_detail_anim.dart';
import 'package:gym_saas_mobile/features/plans/presentation/plan_detail_screen.dart';
import 'package:gym_saas_mobile/features/plans/presentation/plan_form_screen.dart';
import 'package:gym_saas_mobile/features/plans/presentation/plans_list_screen.dart';
import 'package:gym_saas_mobile/models/branch_option.dart';
import 'package:gym_saas_mobile/models/membership_plan.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';
import 'package:gym_saas_mobile/repositories/membership_plan_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockSession extends MockCubit<SessionState> implements SessionCubit {}

Map<String, dynamic> _raw({
  String id = 'p1',
  String name = 'Quarterly Pro',
  String code = 'PLAN-0001',
  bool isActive = true,
  String? deletedAt,
  String price = '5000.00',
  String discount = '10.00',
  String tax = '18.00',
  int members = 12,
  String? category = 'Premium',
}) =>
    {
      'id': id,
      'name': name,
      'planCode': code,
      'description': 'Best value for regulars',
      'category': category,
      'durationValue': 3,
      'durationType': 'MONTHS',
      'durationDays': 90,
      'price': price,
      'joiningFee': '500.00',
      'taxPercentage': tax,
      'discountPercentage': discount,
      'isActive': isActive,
      'displayOrder': 1,
      'notes': 'Internal',
      'gymAccessAllBranches': true,
      'accessBranchIds': null,
      'ptSessionsIncluded': 4,
      'groupClassesIncluded': 0,
      'dietConsultationIncluded': true,
      'lockerAccess': false,
      'guestPasses': 2,
      'freezeAllowed': true,
      'freezeDaysLimit': 30,
      'memberCount': members,
      'createdAt': '2026-01-01T10:00:00.000Z',
      'updatedAt': '2026-02-01T10:00:00.000Z',
      'deletedAt': deletedAt,
    };

class _PlanRepo extends Fake implements MembershipPlanRepository {
  _PlanRepo(this.rows);

  final List<MembershipPlan> rows;
  Map<String, dynamic>? created;
  Map<String, dynamic>? updated;
  final calls = <String>[];

  @override
  Future<List<MembershipPlan>> listAll({
    bool includeDeleted = true,
    int maxPages = 10,
  }) async =>
      rows;

  @override
  Future<MembershipPlan> getById(String planId) async =>
      rows.firstWhere((p) => p.id == planId);

  @override
  Future<MembershipPlan> create(Map<String, dynamic> body) async {
    created = body;
    return MembershipPlan.fromJson(
      _raw(id: 'new', name: body['name'] as String),
    );
  }

  @override
  Future<MembershipPlan> update(
    String planId,
    Map<String, dynamic> body,
  ) async {
    updated = body;
    return rows.first;
  }

  @override
  Future<void> activate(String planId) async => calls.add('activate:$planId');

  @override
  Future<void> deactivate(String planId) async =>
      calls.add('deactivate:$planId');

  @override
  Future<void> delete(String planId) async => calls.add('delete:$planId');

  @override
  Future<void> restore(String planId) async => calls.add('restore:$planId');

  @override
  Future<MembershipPlan> duplicate(String planId) async {
    calls.add('duplicate:$planId');
    return MembershipPlan.fromJson(
      _raw(id: 'copy', name: 'Quarterly Pro (Copy)', isActive: false),
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

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

const _allPerms = [
  'memberships:view',
  'memberships:create',
  'memberships:update',
  'memberships:delete',
  'memberships:restore',
];

late _PlanRepo _repo;

MembershipPlan _p([Map<String, dynamic>? raw]) =>
    MembershipPlan.fromJson(raw ?? _raw());

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  setUp(() {
    final g = GetIt.instance;
    _repo = _PlanRepo([
      _p(),
      _p(
        _raw(
          id: 'p2',
          name: 'Monthly Basic',
          code: 'PLAN-0002',
          isActive: false,
          price: '1000.00',
          discount: '0',
          tax: '0',
          members: 3,
          category: null,
        ),
      ),
      _p(
        _raw(
          id: 'p3',
          name: 'Old Annual',
          code: 'PLAN-0003',
          deletedAt: '2026-03-01T00:00:00.000Z',
        ),
      ),
    ]);
    if (g.isRegistered<MembershipPlanRepository>()) {
      g.unregister<MembershipPlanRepository>();
    }
    g.registerSingleton<MembershipPlanRepository>(_repo);
    if (g.isRegistered<BranchRepository>()) g.unregister<BranchRepository>();
    g.registerSingleton<BranchRepository>(_BranchRepo());
  });

  MockSessionHolder holder(List<String> perms) {
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
    return MockSessionHolder(session);
  }

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
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: holder(perms).session,
        child: MaterialApp(home: child),
      ),
    );
  }

  // Looping hero animations: pump fixed time instead of pumpAndSettle.
  Future<void> settle(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  Future<void> step(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(milliseconds: 600));
  }

  Future<void> scrollTo(WidgetTester t, Finder f) => t.scrollUntilVisible(
        f,
        300,
        scrollable: find.byType(Scrollable).first,
      );

  /// Pushes [screen] on a router so its `context.pop` works.
  Future<void> pumpRouted(WidgetTester t, Widget screen) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(body: Text('home')),
        ),
        GoRoute(path: '/x', builder: (_, __) => screen),
      ],
    );
    t.view.physicalSize = const Size(560, 900) * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: holder(_allPerms).session,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    unawaited(router.push('/x'));
    await settle(t);
  }

  testWidgets('list: hero, KPIs, insight panels and cards render', (t) async {
    await pumpApp(t, const MembershipPlansScreen());
    await settle(t);
    expect(find.text('Membership Plans'), findsOneWidget);
    expect(find.text('Total plans'), findsOneWidget);
    expect(find.text('Status mix'), findsOneWidget);
    expect(find.text('Members per plan'), findsOneWidget);
    expect(find.byIcon(Icons.add_rounded), findsOneWidget);
    await scrollTo(t, find.byKey(const ValueKey('plan-p2')));
    expect(find.byKey(const ValueKey('plan-p2')), findsOneWidget);
    await scrollTo(t, find.byKey(const ValueKey('plan-p1')));
    expect(find.byKey(const ValueKey('plan-p1')), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('list: status chips filter, deleted opens a restore sheet',
      (t) async {
    await pumpApp(t, const MembershipPlansScreen());
    await settle(t);
    await t.tap(find.text('Inactive · 1'));
    await step(t);
    await scrollTo(t, find.byKey(const ValueKey('plan-p2')));
    expect(find.byKey(const ValueKey('plan-p2')), findsOneWidget);
    expect(find.byKey(const ValueKey('plan-p1')), findsNothing);

    await t.drag(find.byType(Scrollable).first, const Offset(0, 3000));
    await step(t);
    await t.ensureVisible(find.text('Deleted · 1'));
    await t.tap(find.text('Deleted · 1'));
    await step(t);
    await t.drag(find.byType(Scrollable).first, const Offset(0, -1400));
    await step(t);
    expect(find.byKey(const ValueKey('plan-p3')), findsOneWidget);
    await t.tap(find.byKey(const ValueKey('plan-p3')));
    await step(t);
    expect(find.text('Restore plan'), findsOneWidget);
    await t.tap(find.text('Restore plan'));
    await step(t);
    await t.tap(find.text('Restore').last);
    await step(t);
    expect(_repo.calls, ['restore:p3']);
    expect(t.takeException(), isNull);
  });

  testWidgets('list: KPI sheet opens; card menu deactivates; Duplicate runs',
      (t) async {
    await pumpApp(t, const MembershipPlansScreen());
    await settle(t);
    await t.tap(find.text('Total plans'));
    await step(t);
    expect(find.text('Show everything in the main list'), findsOneWidget);
    await t.tap(find.text('Show everything in the main list'));
    await step(t);

    await scrollTo(t, find.byKey(const ValueKey('plan-p1')));
    final menu = find.descendant(
      of: find.byKey(const ValueKey('plan-p1')),
      matching: find.byType(PopupMenuButton<String>),
    );
    await t.ensureVisible(menu);
    await t.pump();
    await t.tap(menu);
    await step(t);
    expect(find.text('Deactivate'), findsOneWidget);
    await t.tap(find.text('Deactivate'));
    await step(t);
    await t.tap(find.text('Deactivate').last);
    await step(t);
    expect(_repo.calls, ['deactivate:p1']);

    final dup = find.descendant(
      of: find.byKey(const ValueKey('plan-p1')),
      matching: find.text('Duplicate'),
    );
    await t.ensureVisible(dup);
    await t.pump();
    await t.tap(dup);
    await step(t);
    expect(_repo.calls, ['deactivate:p1', 'duplicate:p1']);
    expect(t.takeException(), isNull);
  });

  testWidgets('list: without create permission there is no New plan',
      (t) async {
    await pumpApp(
      t,
      const MembershipPlansScreen(),
      perms: const ['memberships:view'],
    );
    await settle(t);
    expect(find.byIcon(Icons.add_rounded), findsNothing);
    await scrollTo(t, find.byKey(const ValueKey('plan-p1')));
    expect(find.text('Duplicate'), findsNothing);
    expect(t.takeException(), isNull);
  });

  testWidgets('detail: hero, tiles and all four tabs render', (t) async {
    await pumpApp(t, const PlanDetailScreen(planId: 'p1'));
    await settle(t);
    expect(find.text('Quarterly Pro'), findsWidgets);
    expect(find.text('About this plan'), findsOneWidget);
    for (final tab in ['Pricing', 'Features', 'Manage', 'Overview']) {
      await t.tap(find.text(tab));
      await step(t);
    }
    await t.tap(find.text('Pricing'));
    await step(t);
    expect(find.text('Price details'), findsOneWidget);
    expect(find.text('Total at sign-up'), findsWidgets);
    await t.tap(find.text('Features'));
    await step(t);
    expect(find.text('Quotas'), findsOneWidget);
    await t.tap(find.text('Manage'));
    await step(t);
    await scrollTo(t, find.text('Manage plan'));
    expect(find.text('Deactivate'), findsWidgets);
    expect(find.text('Delete'), findsWidgets);
    expect(t.takeException(), isNull);
  });

  testWidgets('detail: a read-only viewer gets no actions', (t) async {
    await pumpApp(
      t,
      const PlanDetailScreen(planId: 'p1'),
      perms: const ['memberships:view'],
    );
    await settle(t);
    await t.tap(find.text('Manage'));
    await step(t);
    await scrollTo(t, find.text('Manage plan'));
    expect(
      find.text('You do not have permission to change this plan.'),
      findsOneWidget,
    );
    expect(find.byType(PopupMenuButton<String>), findsNothing);
    expect(t.takeException(), isNull);
  });

  testWidgets('add wizard: validates, walks the steps and sends the body',
      (t) async {
    await pumpRouted(t, const MembershipPlanFormScreen());
    expect(find.text('Plan information'), findsOneWidget);
    await t.tap(find.text('Next'));
    await step(t);
    expect(find.text('Plan name is required.'), findsOneWidget);

    await t.enterText(find.byType(TextField).at(0), 'Gold Annual');
    await t.tap(find.text('Next'));
    await step(t);
    expect(find.text('Duration & pricing'), findsOneWidget);
    await t.tap(find.text('Next'));
    await step(t);
    expect(find.text('Enter the plan price.'), findsOneWidget);
    // duration(0) type(1) price(2) fee(3) discount(4) tax(5)
    await t.enterText(find.byType(TextField).at(2), '4999');
    await t.enterText(find.byType(TextField).at(4), '10');
    await step(t);
    expect(find.text('Plan price'), findsOneWidget);
    await t.tap(find.text('Next'));
    await step(t);
    expect(find.text('Plan features'), findsOneWidget);
    await t.enterText(find.byType(TextField).at(0), '6');
    await t.tap(find.text('Next'));
    await step(t);
    expect(find.text('Ready to create'), findsOneWidget);
    await t.ensureVisible(find.text('Create plan'));
    await t.tap(find.text('Create plan'));
    await step(t);

    final body = _repo.created!;
    expect(body['name'], 'Gold Annual');
    expect(body['price'], 4999);
    expect(body['discountPercentage'], 10);
    expect(body['durationValue'], 1);
    expect(body['durationType'], 'MONTHS');
    expect(body['ptSessionsIncluded'], 6);
    expect(body['gymAccessAllBranches'], true);
    expect(body['isActive'], true);
    expect(body.containsKey('accessBranchIds'), isFalse);
    expect(body.containsKey('planCode'), isFalse);
    expect(t.takeException(), isNull);
  });

  testWidgets('edit form sends only the changed keys; description clears',
      (t) async {
    await pumpRouted(t, MembershipPlanFormScreen(plan: _p()));
    expect(find.text('Plan information'), findsOneWidget);
    await t.enterText(find.byType(TextField).at(0), 'Quarterly Elite');
    await t.ensureVisible(find.text('Save changes'));
    await t.tap(find.text('Save changes'));
    await step(t);
    expect(_repo.updated, {'name': 'Quarterly Elite'});
  });

  testWidgets('edit form can clear the description (sent as null)', (t) async {
    await pumpRouted(t, MembershipPlanFormScreen(plan: _p()));
    // name(0) code(1) category(2) order(3) description(4)
    await t.enterText(find.byType(TextField).at(4), '');
    await t.ensureVisible(find.text('Save changes'));
    await t.tap(find.text('Save changes'));
    await step(t);
    expect(_repo.updated, {'description': null});
    expect(t.takeException(), isNull);
  });

  testWidgets('edit form validates server limits before sending', (t) async {
    await pumpApp(t, MembershipPlanFormScreen(plan: _p()));
    await settle(t);
    await t.enterText(find.byType(TextField).at(0), '');
    await t.ensureVisible(find.text('Save changes'));
    await t.tap(find.text('Save changes'));
    await step(t);
    expect(find.text('Plan name is required.'), findsOneWidget);
    expect(_repo.updated, isNull);
  });

  group('tablet (wide) layouts', () {
    const tablet = Size(1500, 1300);

    testWidgets('list: content is capped + centred, cards go two-up',
        (t) async {
      await pumpApp(t, const MembershipPlansScreen(), size: tablet);
      await settle(t);
      final kpi = t.getTopLeft(find.text('Total plans'));
      expect(kpi.dx, greaterThan(110));
      await scrollTo(t, find.byKey(const ValueKey('plan-p3')));
      // Display order ties break by name: Monthly Basic (p2) and Old Annual
      // (p3, deleted but listed under All) share the first row.
      final a = t.getTopLeft(find.byKey(const ValueKey('plan-p2')));
      final b = t.getTopLeft(find.byKey(const ValueKey('plan-p3')));
      expect(b.dx, greaterThan(a.dx + 200));
      expect((b.dy - a.dy).abs(), lessThan(5));
      expect(t.takeException(), isNull);
    });

    testWidgets('list hero gradient is full-width, its text in the column',
        (t) async {
      await pumpApp(t, const MembershipPlansScreen(), size: tablet);
      await settle(t);
      expect(t.getSize(find.byType(MeshHeroBackground).first).width, 1500);
      expect(t.getTopLeft(find.text('Membership Plans')).dx, greaterThan(110));
      expect(t.takeException(), isNull);
    });

    testWidgets('detail and both forms render on a tablet', (t) async {
      for (final w in <Widget>[
        const PlanDetailScreen(planId: 'p1'),
        const MembershipPlanFormScreen(),
        MembershipPlanFormScreen(plan: _p()),
      ]) {
        await pumpApp(t, w, size: tablet);
        await settle(t);
        expect(t.takeException(), isNull, reason: w.runtimeType.toString());
      }
    });

    testWidgets('edit form: fields two per row, price summary beside',
        (t) async {
      await pumpApp(t, MembershipPlanFormScreen(plan: _p()), size: tablet);
      await settle(t);
      final first = t.getTopLeft(find.byType(TextField).at(0));
      final second = t.getTopLeft(find.byType(TextField).at(1));
      expect((first.dy - second.dy).abs(), lessThan(5));
      expect(second.dx, greaterThan(first.dx + 150));
      expect(find.text('Plan price'), findsOneWidget);
      expect(t.takeException(), isNull);
    });
  });
}

/// Keeps the mock cubit reachable from the helper without a global.
class MockSessionHolder {
  MockSessionHolder(this.session);

  final SessionCubit session;
}
