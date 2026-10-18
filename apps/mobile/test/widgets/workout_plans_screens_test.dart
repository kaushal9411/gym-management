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
import 'package:gym_saas_mobile/features/trainer/presentation/assign_plan_screen.dart';
import 'package:gym_saas_mobile/features/trainer/presentation/client_progress_screen.dart';
import 'package:gym_saas_mobile/features/trainer/presentation/day_editor_screen.dart';
import 'package:gym_saas_mobile/features/trainer/presentation/trainer_workout_plans_screen.dart';
import 'package:gym_saas_mobile/features/trainer/presentation/workout_log_screen.dart';
import 'package:gym_saas_mobile/features/trainer/presentation/workout_plan_detail_screen.dart';
import 'package:gym_saas_mobile/features/trainer/presentation/workout_plan_form_screen.dart'
    as trainer_form;
import 'package:gym_saas_mobile/features/workouts/presentation/workout_plan_form_screen.dart';
import 'package:gym_saas_mobile/features/workouts/presentation/workout_plan_profile_screen.dart';
import 'package:gym_saas_mobile/features/workouts/presentation/workout_plans_list_screen.dart';
import 'package:gym_saas_mobile/features/workouts/presentation/workout_schedule_screen.dart';
import 'package:gym_saas_mobile/models/exercise.dart';
import 'package:gym_saas_mobile/models/gym_member.dart';
import 'package:gym_saas_mobile/models/member_workout_progress.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/models/workout_plan.dart';
import 'package:gym_saas_mobile/models/workout_plan_summary.dart';
import 'package:gym_saas_mobile/repositories/exercise_repository.dart';
import 'package:gym_saas_mobile/repositories/member_repository.dart';
import 'package:gym_saas_mobile/repositories/workout_plan_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockSession extends MockCubit<SessionState> implements SessionCubit {}

Map<String, dynamic> _exJson(String id, String name, String muscle) => {
      'id': id,
      'name': name,
      'category': null,
      'muscleGroup': muscle,
      'equipment': null,
      'difficultyLevel': 'BEGINNER',
      'instructions': null,
      'defaultSets': 3,
      'defaultReps': 12,
      'restSeconds': 45,
      'isActive': true,
    };

Map<String, dynamic> _row(
  String id,
  String exId,
  String name,
  String muscle,
  String day,
  int order, {
  String? notes,
}) =>
    {
      'id': id,
      'exercise': _exJson(exId, name, muscle),
      'dayOfWeek': day,
      'sortOrder': order,
      'sets': 4,
      'repetitions': 10,
      'restSeconds': 60,
      'notes': notes,
    };

Map<String, dynamic> _raw({
  String id = 'p1',
  String name = 'Strength Foundations',
  bool isActive = true,
  String? deletedAt,
  String level = 'INTERMEDIATE',
  int weeks = 8,
  int members = 3,
  bool withExercises = true,
}) =>
    {
      'id': id,
      'name': name,
      'goal': 'Build muscle',
      'description': 'A solid base',
      'notes': 'Internal',
      'level': level,
      'durationWeeks': weeks,
      'trainer': {'id': 't1', 'name': 'Tara'},
      'isActive': isActive,
      'activeMemberCount': members,
      'createdAt': '2026-01-01T10:00:00.000Z',
      'updatedAt': '2026-02-01T10:00:00.000Z',
      'deletedAt': deletedAt,
      'exercises': withExercises
          ? [
              _row('r1', 'e1', 'Bench Press', 'Chest', 'MONDAY', 0),
              _row(
                'r2',
                'e2',
                'Incline Press',
                'Chest',
                'MONDAY',
                1,
                notes: 'Slow negatives',
              ),
              _row('r3', 'e3', 'Squat', 'Legs', 'THURSDAY', 0),
            ]
          : <Map<String, dynamic>>[],
    };

WorkoutPlanSummary _summary(Map<String, dynamic> raw) =>
    WorkoutPlanSummary.fromJson(raw);

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

Map<String, dynamic> _assignment({String status = 'ACTIVE'}) => {
      'id': 'a1',
      'workoutPlan': {
        'id': 'p1',
        'name': 'Strength Foundations',
        'level': 'INTERMEDIATE',
        'durationWeeks': 8,
      },
      'assignedDate': '2026-10-01T00:00:00.000Z',
      'startDate': '2026-10-01T00:00:00.000Z',
      'endDate': null,
      'status': status,
      'trainerRemarks': 'Keep it up',
      'memberNotes': null,
      'progressPercent': 40,
      'completedCount': 2,
      'skippedCount': 1,
      'totalExercises': 5,
      'progress': [
        {
          'exerciseId': 'e1',
          'exerciseName': 'Bench Press',
          'dayOfWeek': 'MONDAY',
          'status': 'COMPLETED',
          'notes': null,
          'markedAt': null,
        },
        {
          'exerciseId': 'e2',
          'exerciseName': 'Incline Press',
          'dayOfWeek': 'MONDAY',
          'status': 'PENDING',
          'notes': null,
          'markedAt': null,
        },
        {
          'exerciseId': 'e3',
          'exerciseName': 'Squat',
          'dayOfWeek': 'THURSDAY',
          'status': 'SKIPPED',
          'notes': null,
          'markedAt': null,
        },
      ],
    };

class _Repo extends Fake implements WorkoutPlanRepository {
  _Repo(this.rows, this.details);

  final List<WorkoutPlanSummary> rows;
  final Map<String, WorkoutPlan> details;
  final calls = <String>[];
  Map<String, dynamic>? created;
  Map<String, dynamic>? updated;
  List<PlanExerciseDraft>? savedSchedule;
  Map<String, dynamic>? assigned;
  String? remarks;
  String? marked;
  MemberWorkoutPlans plans = MemberWorkoutPlans.fromJson({
    'current': _assignment(),
    'history': [
      _assignment(),
      {..._assignment(status: 'COMPLETED'), 'id': 'a0'},
    ],
  });

  @override
  Future<List<WorkoutPlanSummary>> listAll({
    bool includeDeleted = true,
    int maxPages = 10,
  }) async =>
      includeDeleted ? rows : rows.where((p) => !p.isDeleted).toList();

  @override
  Future<WorkoutPlan> getById(String planId) async => details[planId]!;

  @override
  Future<WorkoutPlan> create(WorkoutPlanFormInput input) async {
    created = input.toJson();
    return WorkoutPlan.fromJson(_raw(id: 'new', name: input.name));
  }

  @override
  Future<WorkoutPlan> createWith(Map<String, dynamic> body) async {
    created = body;
    return WorkoutPlan.fromJson(_raw(id: 'new', name: body['name'] as String));
  }

  @override
  Future<WorkoutPlan> updateWith(
    String planId,
    Map<String, dynamic> body,
  ) async {
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
  Future<WorkoutPlan> duplicate(String planId) async {
    calls.add('duplicate:$planId');
    return WorkoutPlan.fromJson(
      _raw(id: 'copy', name: 'Strength Foundations (Copy)', isActive: false),
    );
  }

  @override
  Future<WorkoutPlan> setExercises(
    String planId,
    List<PlanExerciseDraft> exercises,
  ) async {
    savedSchedule = exercises;
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

  @override
  Future<MemberWorkoutPlans> memberPlans(String memberId) async => plans;

  @override
  Future<MemberWorkoutProgress?> currentForMember(String memberId) async =>
      plans.current;

  @override
  Future<void> updateTrainerRemarks({
    required String assignmentId,
    required String trainerRemarks,
  }) async =>
      remarks = trainerRemarks;

  @override
  Future<void> markProgress({
    required String assignmentId,
    required String exerciseId,
    required ExerciseProgressStatus status,
  }) async =>
      marked = '$exerciseId:${status.apiValue}';
}

class _ExerciseRepo extends Fake implements ExerciseRepository {
  @override
  Future<List<Exercise>> active() async => [
        Exercise.fromJson(_exJson('e1', 'Bench Press', 'Chest')),
        Exercise.fromJson(_exJson('e9', 'Deadlift', 'Back')),
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

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

const _allPerms = [
  'workouts:view',
  'workouts:create',
  'workouts:update',
  'workouts:delete',
  'workouts:restore',
  'workouts:assign',
  'workouts:progress',
];

/// The seeded TRAINER role.
const _trainerPerms = [
  'workouts:view',
  'workouts:create',
  'workouts:update',
  'workouts:assign',
  'workouts:progress',
];

const _viewOnly = ['workouts:view'];

late _Repo _repo;

GymMember _member() => GymMember.fromJson(_memberJson());

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  setUp(() {
    final g = GetIt.instance;
    final p1 = _raw();
    final p2 = _raw(
      id: 'p2',
      name: 'Beginner Burn',
      isActive: false,
      level: 'BEGINNER',
      weeks: 4,
      members: 0,
      withExercises: false,
    );
    final p3 = _raw(
      id: 'p3',
      name: 'Old Plan',
      deletedAt: '2026-03-01T00:00:00.000Z',
      withExercises: false,
    );
    _repo = _Repo(
      [_summary(p1), _summary(p2), _summary(p3)],
      {
        'p1': WorkoutPlan.fromJson(p1),
        'p2': WorkoutPlan.fromJson(p2),
        'copy': WorkoutPlan.fromJson(_raw(id: 'copy')),
      },
    );
    void reg<T extends Object>(T v) {
      if (g.isRegistered<T>()) g.unregister<T>();
      g.registerSingleton<T>(v);
    }

    reg<WorkoutPlanRepository>(_repo);
    reg<ExerciseRepository>(_ExerciseRepo());
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
  }) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(body: Text('home')),
        ),
        GoRoute(path: '/x', builder: (_, __) => screen),
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

  Finder card(String id) => find.byKey(ValueKey('plan-$id'));

  Finder menuOf(String id) => find.descendant(
        of: card(id),
        matching: find.byType(PopupMenuButton<String>),
      );

  group('catalog list', () {
    testWidgets('hero, KPIs, insight panels and cards', (t) async {
      await pumpApp(t, const WorkoutPlansScreen());
      await settle(t);
      expect(find.text('Workout Plans'), findsOneWidget);
      expect(find.text('Total plans'), findsOneWidget);
      expect(find.text('Members assigned'), findsOneWidget);
      expect(find.text('Status mix'), findsOneWidget);
      expect(find.text('By level'), findsOneWidget);
      expect(find.text('By trainer'), findsOneWidget);
      expect(find.byIcon(Icons.add_rounded), findsOneWidget);
      // Web's three status chips; deleted plans live under All.
      expect(find.text('All · 3'), findsOneWidget);
      expect(find.text('Active · 1'), findsOneWidget);
      expect(find.text('Inactive · 1'), findsOneWidget);
      expect(find.text('Deleted · 1'), findsNothing);
      await scrollTo(t, card('p1'));
      expect(card('p1'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('status chips filter; a deleted plan opens a restore sheet',
        (t) async {
      await pumpApp(t, const WorkoutPlansScreen());
      await settle(t);
      await t.tap(find.text('Inactive · 1'));
      await step(t);
      await scrollTo(t, card('p2'));
      expect(card('p2'), findsOneWidget);
      expect(card('p1'), findsNothing);

      await t.drag(find.byType(Scrollable).first, const Offset(0, 3000));
      await step(t);
      await t.tap(find.text('All · 3'));
      await step(t);
      await t.drag(find.byType(Scrollable).first, const Offset(0, -1400));
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
      await pumpApp(t, const WorkoutPlansScreen());
      await settle(t);
      await scrollTo(t, card('p1'));
      await t.tap(menuOf('p1'));
      await step(t);
      await t.tap(find.text('Deactivate').last);
      await step(t);
      await t.tap(find.text('Deactivate').last);
      await step(t);
      expect(_repo.calls, ['deactivate:p1']);

      await t.tap(
        find.descendant(of: card('p1'), matching: find.text('Duplicate')),
      );
      await step(t);
      expect(_repo.calls, ['deactivate:p1', 'duplicate:p1']);
      expect(t.takeException(), isNull);
    });

    testWidgets('compact toggle swaps to dense rows', (t) async {
      await pumpApp(t, const WorkoutPlansScreen());
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

    testWidgets('search narrows the list', (t) async {
      await pumpApp(t, const WorkoutPlansScreen());
      await settle(t);
      await t.ensureVisible(find.byType(TextField).first);
      await t.enterText(find.byType(TextField).first, 'burn');
      await t.pump(const Duration(milliseconds: 500));
      await step(t);
      await scrollTo(t, card('p2'));
      expect(card('p2'), findsOneWidget);
      expect(card('p1'), findsNothing);
    });
  });

  group('gating matrix - catalog list (unchanged keys, web parity)', () {
    testWidgets('workouts:view only: nothing to create or change', (t) async {
      await pumpApp(t, const WorkoutPlansScreen(), perms: _viewOnly);
      await settle(t);
      expect(find.byIcon(Icons.add_rounded), findsNothing);
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
      await pumpApp(t, const WorkoutPlansScreen(), perms: _trainerPerms);
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
      await pumpApp(t, const WorkoutPlansScreen());
      await settle(t);
      await scrollTo(t, card('p1'));
      await t.tap(menuOf('p1'));
      await step(t);
      for (final label in ['View / edit', 'Deactivate', 'Delete']) {
        expect(find.text(label), findsWidgets, reason: label);
      }
    });

    testWidgets('deleted plan without workouts:restore shows a notice',
        (t) async {
      await pumpApp(t, const WorkoutPlansScreen(), perms: _trainerPerms);
      await settle(t);
      await t.drag(find.byType(Scrollable).first, const Offset(0, -1400));
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
    testWidgets('owner: tabs, hero actions and the schedule tab', (t) async {
      await pumpApp(t, const WorkoutPlanProfileScreen(planId: 'p1'));
      await settle(t);
      for (final label in ['Overview', 'Schedule', 'Assign', 'Manage']) {
        expect(find.text(label), findsWidgets, reason: label);
      }
      expect(find.text('Strength Foundations'), findsWidgets);
      expect(find.text('Edit'), findsWidgets);
      expect(find.text('Duplicate'), findsWidgets);

      await t.tap(find.text('Schedule').first);
      await step(t);
      expect(find.text('Bench Press'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('day-thursday')));
      await step(t);
      expect(find.text('Squat'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('view only: no Assign tab, no edit / duplicate controls',
        (t) async {
      await pumpApp(
        t,
        const WorkoutPlanProfileScreen(planId: 'p1'),
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
        const WorkoutPlanProfileScreen(planId: 'p1'),
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
      await pumpApp(t, const WorkoutPlanProfileScreen(planId: 'p2'));
      await settle(t);
      expect(find.text('Assign'), findsNothing);
      expect(find.text('Activate'), findsWidgets);
    });

    testWidgets('assign: pick a member, start date -> request', (t) async {
      await pumpApp(t, const WorkoutPlanProfileScreen(planId: 'p1'));
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
    testWidgets('wizard validates, then creates with the typed fields',
        (t) async {
      await pumpRouted(t, const WorkoutPlanCatalogFormScreen());
      await t.tap(find.text('Next'));
      await step(t);
      expect(find.text('Plan name is required.'), findsOneWidget);

      await t.enterText(find.byType(TextField).at(0), 'Shred Block');
      await t.enterText(find.byType(TextField).at(1), 'Fat loss');
      await t.tap(find.text('Next'));
      await step(t);
      await t.tap(find.text('Advanced'));
      await step(t);
      await t.enterText(find.byType(TextField).at(0), '12');
      await t.tap(find.text('Next'));
      await step(t);
      expect(find.text('Ready to create'), findsOneWidget);
      await t.tap(find.text('Create plan'));
      await step(t);
      expect(_repo.created, {
        'name': 'Shred Block',
        'level': 'ADVANCED',
        'durationWeeks': 12,
        'isActive': true,
        'goal': 'Fat loss',
      });
      expect(t.takeException(), isNull);
    });

    testWidgets('edit sends only the changed keys', (t) async {
      await pumpRouted(t, const WorkoutPlanCatalogFormScreen(planId: 'p1'));
      await t.enterText(find.byType(TextField).at(0), 'Renamed');
      await t.ensureVisible(find.text('Save changes'));
      await t.tap(find.text('Save changes'));
      await step(t);
      expect(_repo.updated, {'name': 'Renamed'});
    });

    testWidgets('a blank goal is left alone, like web (not cleared)',
        (t) async {
      await pumpRouted(t, const WorkoutPlanCatalogFormScreen(planId: 'p1'));
      await t.enterText(find.byType(TextField).at(1), '');
      await t.ensureVisible(find.text('Save changes'));
      await t.tap(find.text('Save changes'));
      await step(t);
      expect(_repo.updated, isNull);
    });

    testWidgets('edit with nothing changed does not call the API', (t) async {
      await pumpRouted(t, const WorkoutPlanCatalogFormScreen(planId: 'p1'));
      await t.ensureVisible(find.text('Save changes'));
      await t.tap(find.text('Save changes'));
      await step(t);
      expect(_repo.updated, isNull);
    });

    testWidgets('invalid duration is refused client-side', (t) async {
      await pumpRouted(t, const WorkoutPlanCatalogFormScreen(planId: 'p1'));
      await t.enterText(find.byType(TextField).at(3), '999');
      await t.ensureVisible(find.text('Save changes'));
      await t.tap(find.text('Save changes'));
      await step(t);
      expect(
        find.text('Duration must be a whole number of weeks from 1 to 104.'),
        findsOneWidget,
      );
      expect(_repo.updated, isNull);
    });
  });

  group('weekly schedule editor', () {
    testWidgets('adds an exercise and saves every day (rest + notes kept)',
        (t) async {
      await pumpRouted(t, const WorkoutScheduleScreen(planId: 'p1'));
      await t.tap(find.byKey(const ValueKey('day-wednesday')));
      await step(t);
      expect(find.text('Rest day'), findsWidgets);
      await t.tap(find.text('Add exercise'));
      await step(t);
      await t.tap(find.byKey(const ValueKey('pick-e9')));
      await step(t);
      expect(find.text('Deadlift'), findsOneWidget);
      await t.tap(find.text('Save weekly schedule'));
      await step(t);
      final saved = _repo.savedSchedule!;
      expect(saved.length, 4);
      final incline = saved.firstWhere((d) => d.exerciseId == 'e2');
      expect(incline.notes, 'Slow negatives');
      expect(incline.restSeconds, 60);
      final dead = saved.firstWhere((d) => d.exerciseId == 'e9');
      expect(dead.dayOfWeek, WeekDay.wednesday);
      expect(dead.sets, 3);
      expect(dead.repetitions, 12);
      expect(dead.restSeconds, 45);
      expect(t.takeException(), isNull);
    });

    testWidgets('removing an exercise drops only that row', (t) async {
      await pumpRouted(t, const WorkoutScheduleScreen(planId: 'p1'));
      await t.tap(find.byKey(const ValueKey('remove-r2')));
      await step(t);
      await t.tap(find.text('Save weekly schedule'));
      await step(t);
      expect(
        _repo.savedSchedule!.map((d) => d.exerciseId),
        ['e1', 'e3'],
      );
    });

    testWidgets('without workouts:update it is a read-only view', (t) async {
      await pumpRouted(
        t,
        const WorkoutScheduleScreen(planId: 'p1'),
        perms: _viewOnly,
      );
      expect(find.text('Add exercise'), findsNothing);
      expect(find.text('Save weekly schedule'), findsNothing);
      expect(find.text('Bench Press'), findsOneWidget);
    });
  });

  group('trainer flow (same screens as before, same - ungated - behaviour)',
      () {
    testWidgets('plan picker lists plans and offers create with no perms',
        (t) async {
      await pumpApp(
        t,
        TrainerWorkoutPlansScreen(member: _member()),
        perms: const [],
      );
      await settle(t);
      expect(find.text('Workout plans'), findsOneWidget);
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

    testWidgets('plan page assigns to the fixed client from the form',
        (t) async {
      await pumpRouted(
        t,
        WorkoutPlanDetailScreen(planId: 'p1', member: _member()),
        perms: const [],
      );
      expect(find.text('Assign to client'), findsOneWidget);
      // The "currently on a plan" heads-up loads in and grows the page.
      await step(t);
      await t.drag(find.byType(ListView).first, const Offset(0, -700));
      await step(t);
      await t.tap(find.text('Assign plan'));
      await step(t);
      expect(_repo.assigned?['memberId'], 'm1');
      expect(_repo.assigned?['planId'], 'p1');
      expect(t.takeException(), isNull);
    });

    testWidgets('day editor keeps the other days and every rest / note',
        (t) async {
      final plan = _repo.details['p1']!;
      await pumpRouted(
        t,
        DayEditorScreen(
          args: DayEditorArgs(plan: plan, day: WeekDay.monday),
        ),
        perms: const [],
      );
      await t.tap(find.byKey(const ValueKey('remove-r2')));
      await step(t);
      await t.tap(find.text('Save'));
      await step(t);
      final saved = _repo.savedSchedule!;
      expect(saved.map((d) => d.exerciseId), ['e1', 'e3']);
      expect(saved.every((d) => d.restSeconds == 60), isTrue);
    });

    testWidgets('minimal create form posts the same reduced body', (t) async {
      await pumpRouted(
        t,
        trainer_form.WorkoutPlanFormScreen(member: _member()),
        perms: const [],
      );
      await t.enterText(find.byType(TextField).at(0), 'Quick Plan');
      await t.ensureVisible(find.text('Create plan'));
      await t.tap(find.text('Create plan'));
      await step(t);
      expect(_repo.created, {
        'name': 'Quick Plan',
        'level': 'INTERMEDIATE',
        'durationWeeks': 8,
      });
    });

    testWidgets('assign hub keeps both destinations', (t) async {
      await pumpApp(t, AssignPlanScreen(member: _member()), perms: const []);
      await settle(t);
      expect(find.text('Workout plan'), findsOneWidget);
      expect(find.text('Diet plan'), findsOneWidget);
      expect(find.text('MEM-0001'), findsOneWidget);
    });

    testWidgets('client progress: ring numbers, days, history', (t) async {
      await pumpApp(
        t,
        ClientProgressScreen(member: _member()),
        perms: const [],
      );
      await settle(t);
      expect(find.text('40%'), findsOneWidget);
      expect(find.text('2/5'), findsOneWidget);
      await t.ensureVisible(find.byKey(const ValueKey('progress-monday')));
      expect(find.byKey(const ValueKey('progress-monday')), findsOneWidget);
      await t.ensureVisible(find.text('Plan history'));
      expect(find.text('Plan history'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('client without a plan shows the empty state', (t) async {
      _repo.plans = MemberWorkoutPlans.fromJson({
        'current': null,
        'history': <Object>[],
      });
      await pumpApp(
        t,
        ClientProgressScreen(member: _member()),
        perms: const [],
      );
      await settle(t);
      expect(find.text('No active workout plan'), findsOneWidget);
    });

    testWidgets('workout log marks a status through the API', (t) async {
      final progress = _repo.plans.current!;
      await pumpRouted(
        t,
        WorkoutLogScreen(
          args: WorkoutLogArgs(
            progress: progress,
            day: WeekDay.monday,
            member: _member(),
          ),
        ),
        perms: const [],
      );
      await t.tap(find.byKey(const ValueKey('mark-e2-completed')));
      await step(t);
      expect(_repo.marked, 'e2:COMPLETED');
      await t.ensureVisible(find.text('Save note'));
      await t.tap(find.text('Save note'));
      await step(t);
      expect(_repo.remarks, 'Keep it up');
    });
  });

  group('tablet (wide) layouts', () {
    const tablet = Size(1500, 1300);

    testWidgets('list: content capped + centred, cards go two-up', (t) async {
      await pumpApp(t, const WorkoutPlansScreen(), size: tablet);
      await settle(t);
      final kpi = t.getTopLeft(find.text('Total plans'));
      expect(kpi.dx, greaterThan(110));
      await scrollTo(t, card('p2'));
      final a = t.getTopLeft(card('p1'));
      final b = t.getTopLeft(card('p2'));
      expect(b.dx, greaterThan(a.dx + 200));
      expect((b.dy - a.dy).abs(), lessThan(5));
      expect(t.takeException(), isNull);
    });

    testWidgets('list hero gradient is full-width, its text in the column',
        (t) async {
      await pumpApp(t, const WorkoutPlansScreen(), size: tablet);
      await settle(t);
      expect(t.getSize(find.byType(MeshHeroBackground).first).width, 1500);
      expect(t.getTopLeft(find.text('Workout Plans')).dx, greaterThan(110));
    });

    testWidgets('trainer list uses the same full-width hero', (t) async {
      await pumpApp(
        t,
        TrainerWorkoutPlansScreen(member: _member()),
        size: tablet,
        perms: const [],
      );
      await settle(t);
      expect(t.getSize(find.byType(MeshHeroBackground).first).width, 1500);
      expect(t.takeException(), isNull);
    });

    testWidgets('every other screen renders on a tablet', (t) async {
      final plan = _repo.details['p1']!;
      for (final w in <Widget>[
        const WorkoutPlanProfileScreen(planId: 'p1'),
        const WorkoutPlanCatalogFormScreen(),
        const WorkoutPlanCatalogFormScreen(planId: 'p1'),
        const WorkoutScheduleScreen(planId: 'p1'),
        WorkoutPlanDetailScreen(planId: 'p1', member: _member()),
        DayEditorScreen(args: DayEditorArgs(plan: plan, day: WeekDay.monday)),
        AssignPlanScreen(member: _member()),
        ClientProgressScreen(member: _member()),
        trainer_form.WorkoutPlanFormScreen(member: _member()),
      ]) {
        await pumpApp(t, w, size: tablet);
        await settle(t);
        expect(t.takeException(), isNull, reason: w.runtimeType.toString());
      }
    });

    testWidgets('edit form: fields two per row', (t) async {
      await pumpApp(
        t,
        const WorkoutPlanCatalogFormScreen(planId: 'p1'),
        size: tablet,
      );
      await settle(t);
      final first = t.getTopLeft(find.byType(TextField).at(0));
      final second = t.getTopLeft(find.byType(TextField).at(1));
      // The Team form section lays single-line fields out two per row.
      expect((first.dy - second.dy).abs(), lessThan(5));
      expect(second.dx, greaterThan(first.dx + 150));
    });
  });
}
