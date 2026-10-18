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
import 'package:gym_saas_mobile/core/routing/app_routes.dart';
import 'package:gym_saas_mobile/features/diet/presentation/diet_meals_screen.dart';
import 'package:gym_saas_mobile/features/diet/presentation/diet_plan_form_screen.dart';
import 'package:gym_saas_mobile/features/diet/presentation/diet_plan_profile_screen.dart';
import 'package:gym_saas_mobile/features/diet/presentation/diet_plans_list_screen.dart';
import 'package:gym_saas_mobile/features/diet/presentation/smart_diet_plan_screen.dart';
import 'package:gym_saas_mobile/features/diet/smart/starter_foods.dart';
import 'package:gym_saas_mobile/models/attendance_summary.dart';
import 'package:gym_saas_mobile/models/body_measurement.dart';
import 'package:gym_saas_mobile/repositories/attendance_repository.dart';
import 'package:gym_saas_mobile/repositories/body_measurement_repository.dart';
import 'package:gym_saas_mobile/features/trainer/presentation/add_to_meal_screen.dart';
import 'package:gym_saas_mobile/features/trainer/presentation/diet_plan_form_screen.dart'
    as trainer_form;
import 'package:gym_saas_mobile/features/trainer/presentation/meal_builder_screen.dart';
import 'package:gym_saas_mobile/features/trainer/presentation/trainer_diet_plans_screen.dart';
import 'package:gym_saas_mobile/models/diet_plan.dart';
import 'package:gym_saas_mobile/models/diet_plan_summary.dart';
import 'package:gym_saas_mobile/models/food.dart';
import 'package:gym_saas_mobile/models/gym_member.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/diet_plan_repository.dart';
import 'package:gym_saas_mobile/repositories/food_repository.dart';
import 'package:gym_saas_mobile/repositories/member_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockSession extends MockCubit<SessionState> implements SessionCubit {}

Map<String, dynamic> _food(String id, String name) => {
      'id': id,
      'name': name,
      'category': 'Protein',
      'servingSize': '100 g',
      'calories': 165,
      'protein': '31.00',
      'carbohydrates': '0.00',
      'fat': '3.60',
      'fiber': null,
      'sugar': null,
      'sodium': null,
      'notes': null,
      'isActive': true,
      'deletedAt': null,
    };

Map<String, dynamic> _meal(
  String id,
  String foodId,
  String name,
  String type, {
  Object qty = '2.50',
  String? notes,
}) =>
    {
      'id': id,
      'food': _food(foodId, name),
      'mealType': type,
      'sortOrder': 0,
      'quantity': qty,
      'notes': notes,
    };

Map<String, dynamic> _raw({
  String id = 'p1',
  String name = 'Lean Cut',
  bool isActive = true,
  String? deletedAt,
  int days = 30,
  int? kcal = 2000,
  int members = 3,
  String? goal = 'Fat loss',
  bool withMeals = true,
}) =>
    {
      'id': id,
      'name': name,
      'goal': goal,
      'description': 'High protein, low fat',
      'notes': 'Check weekly',
      'dailyCalories': kcal,
      'durationDays': days,
      'trainer': {'id': 't1', 'name': 'Tara'},
      'isActive': isActive,
      'activeMemberCount': members,
      'createdAt': '2026-01-01T10:00:00.000Z',
      'updatedAt': '2026-02-01T10:00:00.000Z',
      'deletedAt': deletedAt,
      'meals': withMeals
          ? [
              _meal(
                'r1',
                'f1',
                'Chicken Breast',
                'BREAKFAST',
                notes: 'Grilled',
              ),
              _meal('r2', 'f2', 'Oats', 'BREAKFAST', qty: 1),
              _meal('r3', 'f3', 'Whey Shake', 'POST_WORKOUT'),
            ]
          : <Map<String, dynamic>>[],
    };

DietPlanSummary _summary(Map<String, dynamic> raw) =>
    DietPlanSummary.fromJson(raw);

Map<String, dynamic> _memberJson() => {
      'id': 'm1',
      'memberId': 'MEM-0001',
      'firstName': 'Ann',
      'lastName': 'Lee',
      'name': 'Ann Lee',
      'profilePhotoUrl': null,
      'email': null,
      'phone': '9876543210',
      'status': 'ACTIVE',
      'branch': {'id': 'b', 'name': 'Main'},
      'trainer': null,
      'currentMembership': null,
      'joiningDate': '2026-01-01T00:00:00.000Z',
      'createdAt': '2026-01-01T10:00:00.000Z',
      'outstandingAmount': '0',
      'deletedAt': null,
    };

class _Repo extends Fake implements DietPlanRepository {
  _Repo(this.rows, this.details);

  final List<DietPlanSummary> rows;
  final Map<String, DietPlan> details;
  final calls = <String>[];
  final searches = <String>[];
  Set<String>? searchResult;
  Map<String, dynamic>? created;
  Map<String, dynamic>? updated;
  DietPlanFormInput? trainerCreated;
  List<PlanMealDraft>? savedMeals;
  Map<String, dynamic>? assigned;

  @override
  Future<List<DietPlanSummary>> listAll({
    bool includeDeleted = true,
    int maxPages = 10,
  }) async =>
      includeDeleted ? rows : rows.where((p) => !p.isDeleted).toList();

  @override
  Future<PaginatedResult<DietPlanSummary>> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool? isActive,
    bool includeDeleted = false,
  }) async {
    searches.add(search ?? '');
    final items = searchResult == null
        ? rows
        : rows.where((p) => searchResult!.contains(p.id)).toList();
    return PaginatedResult(
      items: items,
      total: items.length,
      page: 1,
      limit: limit,
      totalPages: 1,
    );
  }

  @override
  Future<DietPlan> getById(String planId) async => details[planId]!;

  @override
  Future<DietPlan> create(DietPlanFormInput input) async {
    trainerCreated = input;
    return DietPlan.fromJson(_raw(id: 'new', name: input.name));
  }

  @override
  Future<DietPlan> createWith(Map<String, dynamic> body) async {
    created = body;
    return DietPlan.fromJson(_raw(id: 'new', name: body['name'] as String));
  }

  @override
  Future<DietPlan> updateWith(String planId, Map<String, dynamic> body) async {
    updated = body;
    return details[planId]!;
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
  Future<DietPlan> duplicate(String planId) async {
    calls.add('duplicate:$planId');
    return DietPlan.fromJson(
      _raw(id: 'copy', name: 'Lean Cut (Copy)', isActive: false),
    );
  }

  @override
  Future<DietPlan> setMeals(String planId, List<PlanMealDraft> meals) async {
    savedMeals = meals;
    return details[planId]!;
  }

  @override
  Future<void> assign({
    required String planId,
    required String memberId,
    required DateTime startDate,
  }) async {
    assigned = {
      'planId': planId,
      'memberId': memberId,
      'startDate': startDate,
    };
  }
}

class _FoodRepo extends Fake implements FoodRepository {
  @override
  Future<List<Food>> active() async => [
        Food.fromJson(_food('f1', 'Chicken Breast')),
        Food.fromJson(_food('f9', 'Brown Rice')),
      ];
}

class _MemberRepo extends Fake implements MemberRepository {
  @override
  Future<PaginatedResult<GymMember>> list({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
    String? trainerId,
    String? branchId,
    String? sortBy,
    String? sortDir,
  }) async =>
      PaginatedResult(
        items: [GymMember.fromJson(_memberJson())],
        total: 1,
        page: 1,
        limit: limit,
        totalPages: 1,
      );
}

/// Every starter food, so the planner has a complete library.
class _StarterFoodRepo extends Fake implements FoodRepository {
  @override
  Future<List<Food>> active() async => [
        for (final s in starterFoods)
          Food.fromJson({
            ..._food('id-${s.name}', s.name),
            'servingSize': s.serving,
            'calories': s.kcal,
            'protein': '${s.p}',
            'carbohydrates': '${s.c}',
            'fat': '${s.f}',
            'sugar': '${s.sugar}',
            'sodium': '${s.sodium}',
          }),
      ];
}

/// Replaces the member's profile fields per test.
Map<String, dynamic> _smartMember = {};

class _SmartMemberRepo extends _MemberRepo {
  @override
  Future<GymMember> getById(String memberId) async =>
      GymMember.fromJson({..._memberJson(), ..._smartMember});
}

class _MeasureRepo extends Fake implements BodyMeasurementRepository {
  @override
  Future<List<BodyMeasurement>> listForMember(String memberId) async => [
        BodyMeasurement.fromJson({
          'id': 'bm1',
          'memberId': memberId,
          'recordedAt': '2026-10-01T10:00:00.000Z',
          'weightKg': '80.00',
          'heightCm': '178.00',
        }),
      ];
}

class _AttendanceRepo extends Fake implements AttendanceRepository {
  @override
  Future<PaginatedResult<AttendanceRecord>> getMemberAttendance(
    String memberId, {
    int page = 1,
    int limit = 5,
  }) async =>
      PaginatedResult(
        items: const [],
        total: 0,
        page: 1,
        limit: limit,
        totalPages: 1,
      );
}

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

const _allPerms = [
  'diets:view',
  'diets:create',
  'diets:update',
  'diets:delete',
  'diets:restore',
  'diets:assign',
  'diets:progress',
];

/// The seeded TRAINER role.
const _trainerPerms = [
  'diets:view',
  'diets:create',
  'diets:update',
  'diets:assign',
  'diets:progress',
];

/// The seeded RECEPTIONIST role.
const _viewOnly = ['diets:view'];

late _Repo _repo;

GymMember _member() => GymMember.fromJson(_memberJson());

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  setUp(() {
    final g = GetIt.instance;
    final p1 = _raw();
    final p2 = _raw(
      id: 'p2',
      name: 'Bulk Up',
      isActive: false,
      days: 14,
      kcal: 3200,
      members: 0,
      goal: 'Muscle gain',
      withMeals: false,
    );
    final p3 = _raw(
      id: 'p3',
      name: 'Old Plan',
      deletedAt: '2026-03-01T00:00:00.000Z',
      withMeals: false,
    );
    _repo = _Repo(
      [_summary(p1), _summary(p2), _summary(p3)],
      {
        'p1': DietPlan.fromJson(p1),
        'p2': DietPlan.fromJson(p2),
        'copy': DietPlan.fromJson(_raw(id: 'copy')),
      },
    );
    void reg<T extends Object>(T v) {
      if (g.isRegistered<T>()) g.unregister<T>();
      g.registerSingleton<T>(v);
    }

    reg<DietPlanRepository>(_repo);
    reg<FoodRepository>(_FoodRepo());
    reg<MemberRepository>(_MemberRepo());
  });

  SessionCubit holder(
    List<String> perms, {
    List<String> roles = const ['OWNER'],
  }) {
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
          roles: roles,
          permissions: perms,
        ),
        _tenant,
      ),
    );
    return session;
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
        value: holder(perms),
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

  /// Pushes [screen] on a router so its `context.pop` works.
  Future<void> pumpRouted(
    WidgetTester t,
    Widget screen, {
    List<String> perms = _allPerms,
    Size size = const Size(560, 900),
    List<GoRoute> extra = const [],
  }) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(body: Text('home')),
        ),
        GoRoute(path: '/x', builder: (_, __) => screen),
        ...extra,
      ],
    );
    t.view.physicalSize = size * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: holder(perms),
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    unawaited(router.push('/x'));
    await settle(t);
  }

  Future<void> scrollTo(WidgetTester t, Finder f) => t.scrollUntilVisible(
        f,
        300,
        scrollable: find.byType(Scrollable).first,
      );

  /// Drags until [f] is built AND inside the viewport (slivers build 250px
  /// beyond it, so a plain scrollUntilVisible can stop one screen early).
  Future<void> reveal(WidgetTester t, Finder f) async {
    for (var i = 0; i < 40; i++) {
      if (f.evaluate().isNotEmpty) {
        final y = t.getCenter(f.first).dy;
        if (y > 80 && y < 780) return;
      }
      await t.drag(find.byType(Scrollable).first, const Offset(0, -250));
      await t.pump();
    }
  }

  Finder card(String id) => find.byKey(ValueKey('plan-$id'));

  Finder menuOf(String id) => find.descendant(
        of: card(id),
        matching: find.byType(PopupMenuButton<String>),
      );

  group('catalog list', () {
    testWidgets('hero, KPIs, insight panels and cards', (t) async {
      await pumpApp(t, const DietPlansScreen());
      await settle(t);
      expect(find.text('Diet Plans'), findsOneWidget);
      expect(find.text('Total plans'), findsOneWidget);
      expect(find.text('Members assigned'), findsOneWidget);
      expect(find.text('Status mix'), findsOneWidget);
      expect(find.text('By goal'), findsOneWidget);
      expect(find.text('By trainer'), findsOneWidget);
      // New plan + Smart Diet Plan (both diets:create).
      expect(find.byIcon(Icons.add_rounded), findsOneWidget);
      expect(find.byIcon(Icons.auto_awesome_rounded), findsOneWidget);
      await scrollTo(t, card('p1'));
      expect(
        find.descendant(of: card('p1'), matching: find.text('30d')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: card('p1'), matching: find.text('2000 kcal')),
        findsOneWidget,
      );
      expect(t.takeException(), isNull);
    });

    testWidgets('status chips filter; a deleted plan opens a restore sheet',
        (t) async {
      await pumpApp(t, const DietPlansScreen());
      await settle(t);
      await t.tap(find.text('Inactive · 1'));
      await step(t);
      await scrollTo(t, card('p2'));
      expect(card('p2'), findsOneWidget);
      expect(card('p1'), findsNothing);

      // "All" keeps soft-deleted plans in the list, like web.
      await t.drag(find.byType(Scrollable).first, const Offset(0, 3000));
      await step(t);
      await t.ensureVisible(find.text('All · 3'));
      await t.tap(find.text('All · 3'));
      await step(t);
      await t.drag(find.byType(Scrollable).first, const Offset(0, -1600));
      await step(t);
      await t.tap(card('p3'));
      await step(t);
      expect(find.text('Restore plan'), findsOneWidget);
      await t.tap(find.text('Restore plan'));
      await step(t);
      await t.tap(find.text('Restore').last);
      await step(t);
      expect(_repo.calls, ['restore:p3']);
      expect(t.takeException(), isNull);
    });

    testWidgets('menu deactivates after a confirm; Duplicate runs at once',
        (t) async {
      await pumpApp(t, const DietPlansScreen());
      await settle(t);
      await scrollTo(t, card('p1'));
      await t.tap(menuOf('p1'));
      await step(t);
      await t.tap(find.text('Deactivate'));
      await step(t);
      expect(find.text('Deactivate "Lean Cut"?'), findsOneWidget);
      await t.tap(find.text('Deactivate').last);
      await step(t);
      await t.tap(
        find.descendant(of: card('p1'), matching: find.text('Duplicate')),
      );
      await step(t);
      expect(_repo.calls, ['deactivate:p1', 'duplicate:p1']);
      expect(t.takeException(), isNull);
    });

    testWidgets('compact toggle swaps to dense rows', (t) async {
      await pumpApp(t, const DietPlansScreen());
      await settle(t);
      await t.drag(find.byType(Scrollable).first, const Offset(0, -700));
      await step(t);
      expect(
        find.descendant(of: card('p1'), matching: find.text('Duplicate')),
        findsOneWidget,
      );
      await t.tap(find.byIcon(Icons.view_list_rounded));
      await step(t);
      expect(
        find.descendant(of: card('p1'), matching: find.text('Duplicate')),
        findsNothing,
      );
      expect(t.takeException(), isNull);
    });

    testWidgets('search narrows the list (server ids cover the description)',
        (t) async {
      _repo.searchResult = {'p2'};
      await pumpApp(t, const DietPlansScreen());
      await settle(t);
      await t.ensureVisible(find.byType(TextField).first);
      await t.enterText(find.byType(TextField).first, 'mass');
      await t.pump(const Duration(milliseconds: 500));
      await step(t);
      await scrollTo(t, card('p2'));
      expect(card('p2'), findsOneWidget);
      expect(card('p1'), findsNothing);
      expect(_repo.searches, ['mass']);
    });
  });

  group('gating matrix - catalog list (web keys, same as the routes)', () {
    testWidgets('diets:view only: nothing to create or change', (t) async {
      await pumpApp(t, const DietPlansScreen(), perms: _viewOnly);
      await settle(t);
      expect(find.byIcon(Icons.add_rounded), findsNothing);
      expect(find.byIcon(Icons.auto_awesome_rounded), findsNothing);
      await scrollTo(t, card('p1'));
      expect(menuOf('p1'), findsNothing);
      expect(
        find.descendant(of: card('p1'), matching: find.text('Duplicate')),
        findsNothing,
      );
      // Reading is still possible.
      expect(
        find.descendant(of: card('p1'), matching: find.text('View')),
        findsOneWidget,
      );
    });

    testWidgets('trainer role: create + update, but no delete / restore',
        (t) async {
      await pumpApp(t, const DietPlansScreen(), perms: _trainerPerms);
      await settle(t);
      expect(find.byIcon(Icons.add_rounded), findsOneWidget);
      await scrollTo(t, card('p1'));
      await t.tap(menuOf('p1'));
      await step(t);
      expect(find.text('View / edit'), findsOneWidget);
      expect(find.text('Duplicate'), findsWidgets);
      expect(find.text('Deactivate'), findsOneWidget);
      expect(find.text('Delete'), findsNothing);
    });

    testWidgets('all keys: every lifecycle action is offered', (t) async {
      await pumpApp(t, const DietPlansScreen());
      await settle(t);
      await scrollTo(t, card('p1'));
      await t.tap(menuOf('p1'));
      await step(t);
      for (final label in ['View / edit', 'Deactivate', 'Delete']) {
        expect(find.text(label), findsWidgets, reason: label);
      }
    });

    testWidgets('deleted plan without diets:restore shows a notice', (t) async {
      await pumpApp(t, const DietPlansScreen(), perms: _trainerPerms);
      await settle(t);
      await t.drag(find.byType(Scrollable).first, const Offset(0, -1600));
      await step(t);
      await t.tap(card('p3'));
      await step(t);
      expect(find.text('Restore plan'), findsNothing);
      expect(
        find.text('You do not have permission to restore plans.'),
        findsOneWidget,
      );
    });
  });

  group('catalog plan page', () {
    testWidgets('owner: tabs, hero actions and the meals tab', (t) async {
      await pumpApp(t, const DietPlanProfileScreen(planId: 'p1'));
      await settle(t);
      for (final label in ['Overview', 'Meals', 'Assign', 'Manage']) {
        expect(find.text(label), findsWidgets, reason: label);
      }
      expect(find.text('Lean Cut'), findsWidgets);
      expect(find.text('Edit'), findsWidgets);
      expect(find.text('Duplicate'), findsWidgets);

      await t.tap(find.text('Meals').first);
      await step(t);
      expect(find.text('Chicken Breast'), findsOneWidget);
      expect(find.text('Whey Shake'), findsOneWidget);
      expect(find.text('Grilled'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('view only: no Assign tab, no edit / duplicate controls',
        (t) async {
      await pumpApp(
        t,
        const DietPlanProfileScreen(planId: 'p1'),
        perms: _viewOnly,
      );
      await settle(t);
      expect(find.text('Assign'), findsNothing);
      expect(find.text('Duplicate'), findsNothing);
      expect(find.text('Deactivate'), findsNothing);
      await t.tap(find.text('Manage'));
      await step(t);
      expect(
        find.text('You do not have permission to change this plan.'),
        findsOneWidget,
      );
    });

    testWidgets('trainer role: Assign tab + Duplicate, but no Delete',
        (t) async {
      await pumpApp(
        t,
        const DietPlanProfileScreen(planId: 'p1'),
        perms: _trainerPerms,
      );
      await settle(t);
      expect(find.text('Assign'), findsOneWidget);
      await t.tap(find.text('Manage'));
      await step(t);
      expect(find.text('Duplicate'), findsWidgets);
      expect(find.text('Deactivate'), findsWidgets);
      expect(find.text('Delete'), findsNothing);
    });

    testWidgets('an inactive plan cannot be assigned from the page', (t) async {
      await pumpApp(t, const DietPlanProfileScreen(planId: 'p2'));
      await settle(t);
      expect(find.text('Assign'), findsNothing);
      expect(find.text('Activate'), findsWidgets);
    });

    testWidgets('assign: pick a member, start date -> request', (t) async {
      await pumpApp(t, const DietPlanProfileScreen(planId: 'p1'));
      await settle(t);
      await t.tap(find.text('Assign'));
      await step(t);
      await t.ensureVisible(find.byType(TextField).first);
      await t.enterText(find.byType(TextField).first, 'ann');
      await t.pump(const Duration(milliseconds: 500));
      await step(t);
      await t.ensureVisible(find.byKey(const ValueKey('member-m1')));
      await t.tap(find.byKey(const ValueKey('member-m1')));
      await step(t);
      await t.drag(find.byType(ListView).first, const Offset(0, -700));
      await step(t);
      await t.tap(find.text('Assign plan'));
      await step(t);
      expect(_repo.assigned?['planId'], 'p1');
      expect(_repo.assigned?['memberId'], 'm1');
      expect(_repo.assigned?['startDate'], isA<DateTime>());
      expect(t.takeException(), isNull);
    });
  });

  group('catalog form', () {
    testWidgets('validates, then creates with the typed fields', (t) async {
      await pumpRouted(t, const DietPlanCatalogFormScreen());
      expect(find.text('Ready to create'), findsOneWidget);
      await t.tap(find.text('Create plan'));
      await step(t);
      expect(find.text('Plan name is required.'), findsOneWidget);

      await t.enterText(find.byType(TextField).at(0), 'Shred Block');
      await t.enterText(find.byType(TextField).at(1), 'Fat loss');
      await t.enterText(find.byType(TextField).at(3), '1800');
      await t.enterText(find.byType(TextField).at(4), '21');
      await t.tap(find.text('Create plan'));
      await step(t);
      expect(_repo.created, {
        'name': 'Shred Block',
        'durationDays': 21,
        'isActive': true,
        'goal': 'Fat loss',
        'dailyCalories': 1800,
      });
      expect(t.takeException(), isNull);
    });

    testWidgets('a duration over 730 days is refused client-side', (t) async {
      await pumpRouted(t, const DietPlanCatalogFormScreen());
      await t.enterText(find.byType(TextField).at(0), 'Long');
      await t.enterText(find.byType(TextField).at(4), '999');
      await t.tap(find.text('Create plan'));
      await step(t);
      expect(
        find.text('Duration must be a whole number of days from 1 to 730.'),
        findsOneWidget,
      );
      expect(_repo.created, isNull);
    });

    testWidgets('edit sends only the changed keys', (t) async {
      await pumpRouted(t, const DietPlanCatalogFormScreen(planId: 'p1'));
      await t.enterText(find.byType(TextField).at(0), 'Renamed');
      await t.tap(find.text('Save changes'));
      await step(t);
      expect(_repo.updated, {'name': 'Renamed'});
    });

    testWidgets('clearing the trainer sends trainerId: null', (t) async {
      await pumpRouted(t, const DietPlanCatalogFormScreen(planId: 'p1'));
      await t.ensureVisible(find.byIcon(Icons.close_rounded));
      await t.tap(find.byIcon(Icons.close_rounded));
      await step(t);
      await t.tap(find.text('Save changes'));
      await step(t);
      expect(_repo.updated, {'trainerId': null});
    });

    testWidgets('a blank goal is left alone, like web (not cleared)',
        (t) async {
      await pumpRouted(t, const DietPlanCatalogFormScreen(planId: 'p1'));
      await t.enterText(find.byType(TextField).at(1), '');
      await t.tap(find.text('Save changes'));
      await step(t);
      expect(_repo.updated, isNull);
    });

    testWidgets('edit with nothing changed does not call the API', (t) async {
      await pumpRouted(t, const DietPlanCatalogFormScreen(planId: 'p1'));
      await t.tap(find.text('Save changes'));
      await step(t);
      expect(_repo.updated, isNull);
    });
  });

  group('meal builder', () {
    testWidgets('adds a food and saves every slot with quantity + notes',
        (t) async {
      await pumpRouted(t, const DietMealsScreen(planId: 'p1'));
      expect(find.text('Save meal plan'), findsOneWidget);
      // Nothing to save until something changed.
      await t.tap(find.text('Save meal plan'));
      await step(t);
      expect(_repo.savedMeals, isNull);

      await t.ensureVisible(find.byKey(const ValueKey('add-LUNCH')));
      await t.tap(find.byKey(const ValueKey('add-LUNCH')));
      await step(t);
      await t.tap(find.byKey(const ValueKey('food-f9')));
      await step(t);
      await t.tap(find.text('Add 1 food'));
      await step(t);
      expect(find.text('Brown Rice'), findsOneWidget);

      await t.tap(find.text('Save meal plan'));
      await step(t);
      final saved = _repo.savedMeals!;
      expect(saved.length, 4);
      final chicken = saved.firstWhere((d) => d.foodId == 'f1');
      expect(chicken.notes, 'Grilled');
      expect(chicken.quantity, 2.5);
      expect(chicken.mealType, MealType.breakfast);
      final rice = saved.firstWhere((d) => d.foodId == 'f9');
      expect(rice.mealType, MealType.lunch);
      expect(rice.quantity, 1);
      expect(t.takeException(), isNull);
    });

    testWidgets('the stepper changes a quantity; remove drops only that row',
        (t) async {
      await pumpRouted(t, const DietMealsScreen(planId: 'p1'));
      await t.ensureVisible(find.byKey(const ValueKey('qty-r2')));
      await t.tap(
        find.descendant(
          of: find.byKey(const ValueKey('qty-r2')),
          matching: find.byIcon(Icons.add_rounded),
        ),
      );
      await step(t);
      await t.ensureVisible(find.byKey(const ValueKey('remove-r3')));
      await t.tap(find.byKey(const ValueKey('remove-r3')));
      await step(t);
      await t.tap(find.text('Save meal plan'));
      await step(t);
      final saved = _repo.savedMeals!;
      expect(saved.map((d) => d.foodId), ['f1', 'f2']);
      expect(saved.firstWhere((d) => d.foodId == 'f2').quantity, 1.25);
    });

    testWidgets('without diets:update it is a read-only view', (t) async {
      await pumpRouted(
        t,
        const DietMealsScreen(planId: 'p1'),
        perms: _viewOnly,
      );
      expect(find.text('Save meal plan'), findsNothing);
      expect(find.byKey(const ValueKey('add-LUNCH')), findsNothing);
      expect(find.text('Chicken Breast'), findsOneWidget);
    });
  });

  group('trainer flow (same screens as before, same - ungated - behaviour)',
      () {
    testWidgets('plan picker lists plans and offers create with no perms',
        (t) async {
      await pumpApp(
        t,
        TrainerDietPlansScreen(member: _member()),
        perms: const [],
      );
      await settle(t);
      expect(find.text('Diet plans'), findsOneWidget);
      expect(find.text('Assign to Ann Lee · 2 plans'), findsOneWidget);
      expect(find.byIcon(Icons.add_rounded), findsOneWidget);
      await scrollTo(t, card('p1'));
      expect(
        find.descendant(of: card('p1'), matching: find.text('Choose plan')),
        findsOneWidget,
      );
      // Same data as before: deleted plans were never listed here.
      expect(card('p3'), findsNothing);
      expect(t.takeException(), isNull);
    });

    testWidgets('meal builder shows all seven slots and keeps quantities',
        (t) async {
      await pumpRouted(
        t,
        MealBuilderScreen(planId: 'p1', member: _member()),
        perms: const [],
        extra: [
          GoRoute(
            path: AppRoutes.trainerAddToMeal,
            builder: (_, s) => AddToMealScreen(mealType: s.extra as MealType),
          ),
        ],
      );
      for (final slot in MealType.values) {
        expect(
          find.byKey(ValueKey('slot-${slot.apiValue}')),
          findsOneWidget,
          reason: slot.label,
        );
      }
      expect(find.text('Assign to Ann Lee'), findsOneWidget);

      // Add through the AddToMeal route (as before), then Save plan.
      await reveal(t, find.byKey(const ValueKey('add-DINNER')));
      await t.tap(find.byKey(const ValueKey('add-DINNER')));
      await settle(t);
      expect(find.text('Add to Dinner'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('food-f9')));
      await step(t);
      await t.tap(find.text('Save meal 1 food'));
      await settle(t);
      expect(find.text('Brown Rice'), findsOneWidget);
      expect(find.textContaining('Unsaved changes'), findsOneWidget);

      await reveal(t, find.text('Save plan'));
      await t.tap(find.text('Save plan'));
      await step(t);
      final saved = _repo.savedMeals!;
      expect(saved.length, 4);
      expect(saved.map((d) => d.mealType.apiValue), contains('POST_WORKOUT'));
      expect(
        saved.firstWhere((d) => d.foodId == 'f1').notes,
        'Grilled',
        reason: 'existing rows keep their note',
      );
      expect(t.takeException(), isNull);
    });

    testWidgets('assigns to the fixed client from the builder', (t) async {
      await pumpRouted(
        t,
        MealBuilderScreen(planId: 'p1', member: _member()),
        perms: const [],
      );
      await reveal(t, find.text('Assign plan'));
      await t.tap(find.text('Assign plan'));
      await step(t);
      expect(_repo.assigned?['memberId'], 'm1');
      expect(_repo.assigned?['planId'], 'p1');
      expect(t.takeException(), isNull);
    });

    testWidgets('the create step sends the same fields as before', (t) async {
      await pumpRouted(
        t,
        trainer_form.DietPlanFormScreen(member: _member()),
        perms: const [],
        extra: [
          GoRoute(
            path: AppRoutes.trainerDietPlanDetail,
            builder: (_, s) => const Scaffold(body: Text('builder')),
          ),
        ],
      );
      await t.tap(find.text('Create plan'));
      await step(t);
      expect(find.text('Enter a plan name'), findsOneWidget);
      await t.enterText(find.byType(TextField).at(0), 'Quick Plan');
      await t.enterText(find.byType(TextField).at(2), '1900');
      await t.tap(find.text('Create plan'));
      await settle(t);
      final input = _repo.trainerCreated!;
      expect(input.name, 'Quick Plan');
      expect(input.durationDays, 30);
      expect(input.dailyCalories, 1900);
      expect(input.goal, isNull);
      expect(input.trainerId, isNull);
      expect(find.text('builder'), findsOneWidget);
    });
  });

  group('smart diet plan (web /diet-plans/smart)', () {
    setUp(() {
      final g = GetIt.instance;
      void reg<T extends Object>(T v) {
        if (g.isRegistered<T>()) g.unregister<T>();
        g.registerSingleton<T>(v);
      }

      _smartMember = {};
      reg<FoodRepository>(_StarterFoodRepo());
      reg<MemberRepository>(_SmartMemberRepo());
      reg<BodyMeasurementRepository>(_MeasureRepo());
      reg<AttendanceRepository>(_AttendanceRepo());
    });

    Future<void> pickMember(WidgetTester t) async {
      await t.enterText(find.byType(TextField).first, 'ann');
      await t.pump(const Duration(milliseconds: 500));
      await step(t);
      await t.tap(find.byKey(const ValueKey('member-m1')));
      await settle(t);
    }

    testWidgets('an incomplete profile blocks the plan and saves nothing',
        (t) async {
      await pumpRouted(t, const SmartDietPlanScreen());
      expect(find.text('Pick a member to start'), findsOneWidget);
      await pickMember(t);
      expect(find.text('Complete the member profile first'), findsOneWidget);
      expect(find.text('• Gender'), findsOneWidget);
      expect(find.text('Daily meals'), findsNothing);
      await t.tap(find.text('Save draft plan'));
      await step(t);
      expect(_repo.created, isNull);
      expect(t.takeException(), isNull);
    });

    testWidgets('generates a plan, lets you swap, and saves an inactive draft',
        (t) async {
      _smartMember = {
        'gender': 'MALE',
        'dateOfBirth': '1990-05-05T00:00:00.000Z',
        'goal': 'MUSCLE_BUILDING',
        'foodPreference': 'NON_VEGETARIAN',
        'height': '170.00',
        'weight': '70.00',
      };
      await pumpRouted(t, const SmartDietPlanScreen());
      await pickMember(t);
      expect(find.text('Daily target'), findsOneWidget);
      expect(find.text('Daily meals'), findsOneWidget);
      expect(
        find.text('Weight source: Latest measurement, 01 Oct.'),
        findsOneWidget,
      );

      // Swap the first food of the first slot.
      await reveal(t, find.byKey(const ValueKey('swap-0-0')));
      await t.tap(find.byKey(const ValueKey('swap-0-0')));
      await step(t);
      final chips = find.byType(ActionChip);
      expect(chips, findsWidgets);
      await reveal(t, chips);
      await t.tap(chips.first);
      await step(t);
      expect(find.text('Edited'), findsOneWidget);

      await t.tap(find.text('Save draft plan'));
      await step(t);
      final body = _repo.created!;
      expect(body['name'], startsWith('Smart plan - Ann Lee - '));
      expect(body['isActive'], false);
      expect(body['durationDays'], 28);
      expect(body['goal'], 'Muscle building');
      expect(body['dailyCalories'], greaterThan(1000));
      expect(body['notes'], contains('Created by Smart Diet Plan'));
      final meals = _repo.savedMeals!;
      expect(meals.length, greaterThanOrEqualTo(10));
      expect(meals.every((m) => (m.quantity ?? 0) > 0), isTrue);
      expect(t.takeException(), isNull);
    });
  });

  group('tablet (1500x1300)', () {
    const tablet = Size(1500, 1300);

    testWidgets('list: hero edge to edge, cards two-up, KPIs four-up',
        (t) async {
      await pumpApp(t, const DietPlansScreen(), size: tablet);
      await settle(t);
      await t.drag(find.byType(Scrollable).first, const Offset(0, -500));
      await step(t);
      final a = t.getTopLeft(card('p1'));
      final b = t.getTopLeft(card('p2'));
      expect(a.dy, b.dy, reason: 'two cards share a row');
      expect(b.dx, greaterThan(a.dx));
      expect(t.takeException(), isNull);
    });

    testWidgets('plan page, form and meal builder lay out without errors',
        (t) async {
      await pumpApp(t, const DietPlanProfileScreen(planId: 'p1'), size: tablet);
      await settle(t);
      await t.tap(find.text('Meals').first);
      await step(t);
      expect(find.text('Chicken Breast'), findsOneWidget);
      expect(t.takeException(), isNull);

      await pumpRouted(t, const DietPlanCatalogFormScreen(), size: tablet);
      expect(find.text('Ready to create'), findsOneWidget);
      expect(t.takeException(), isNull);

      await pumpRouted(t, const DietMealsScreen(planId: 'p1'), size: tablet);
      // Two columns of meal cards on a wide screen.
      final first = t.getTopLeft(find.byKey(const ValueKey('slot-BREAKFAST')));
      final second =
          t.getTopLeft(find.byKey(const ValueKey('slot-MORNING_SNACK')));
      expect(second.dx, greaterThan(first.dx));
      expect(t.takeException(), isNull);
    });

    testWidgets('trainer picker lays out on a tablet', (t) async {
      await pumpApp(
        t,
        TrainerDietPlansScreen(member: _member()),
        perms: const [],
        size: tablet,
      );
      await settle(t);
      expect(find.text('Choose plan'), findsWidgets);
      expect(t.takeException(), isNull);
    });
  });
}
