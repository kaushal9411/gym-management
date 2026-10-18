import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/workouts/presentation/schedule_draft.dart';
import 'package:gym_saas_mobile/features/workouts/presentation/workout_actions.dart';
import 'package:gym_saas_mobile/features/workouts/presentation/workout_plans_list_screen.dart';
import 'package:gym_saas_mobile/models/member_workout_progress.dart';
import 'package:gym_saas_mobile/models/workout_plan.dart';
import 'package:gym_saas_mobile/models/workout_plan_summary.dart';
import 'package:gym_saas_mobile/repositories/workout_plan_repository.dart';

Map<String, dynamic> _ex(String id, String name, String? muscle) => {
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
  String? muscle,
  String day,
  int order, {
  Object? sets = 4,
  Object? reps = 10,
  Object? rest = 60,
  String? notes,
}) =>
    {
      'id': id,
      'exercise': _ex(exId, name, muscle),
      'dayOfWeek': day,
      'sortOrder': order,
      'sets': sets,
      'repetitions': reps,
      'restSeconds': rest,
      'notes': notes,
    };

Map<String, dynamic> _plan() => {
      'id': 'p1',
      'name': 'Strength Foundations',
      'goal': 'Build muscle',
      'description': null,
      'notes': 'Internal',
      'level': 'INTERMEDIATE',
      'durationWeeks': 8,
      'trainer': {'id': 't1', 'name': 'Tara'},
      'isActive': true,
      'activeMemberCount': 3,
      'createdAt': '2026-01-01T10:00:00.000Z',
      'updatedAt': '2026-02-01T10:00:00.000Z',
      'deletedAt': null,
      'exercises': [
        // Out of order on purpose: sortOrder decides within a day.
        _row('r2', 'e2', 'Incline Press', 'Chest', 'MONDAY', 1, notes: 'Slow'),
        _row('r1', 'e1', 'Bench Press', 'Chest', 'MONDAY', 0),
        _row('r3', 'e3', 'Squat', 'Legs', 'THURSDAY', 0, sets: '5', rest: null),
      ],
    };

WorkoutPlanSummary _s(
  String id,
  String name, {
  bool active = true,
  bool deleted = false,
  String level = 'BEGINNER',
  int weeks = 4,
  String? trainerId,
  String? created,
}) =>
    WorkoutPlanSummary.fromJson({
      'id': id,
      'name': name,
      'goal': 'Goal of $name',
      'level': level,
      'durationWeeks': weeks,
      'trainer': trainerId == null ? null : {'id': trainerId, 'name': 'T$id'},
      'isActive': active,
      'activeMemberCount': 2,
      'createdAt': created ?? '2026-01-01T00:00:00.000Z',
      'deletedAt': deleted ? '2026-03-01T00:00:00.000Z' : null,
    });

void main() {
  group('WorkoutPlan', () {
    test('parses a detail DTO and groups the week', () {
      final p = WorkoutPlan.fromJson(_plan());
      expect(p.level, WorkoutLevel.intermediate);
      expect(p.trainer?.name, 'Tara');
      expect(p.isDeleted, isFalse);
      expect(p.totalExercises, 3);
      expect(p.trainingDays, 2);
      // "5" arrives as a string and rest as null: both tolerated.
      expect(p.totalSets, 4 + 4 + 5);
      final monday = p.exercisesByDay[WeekDay.monday]!;
      expect(
        monday.map((e) => e.exercise.name),
        ['Bench Press', 'Incline Press'],
      );
      expect(p.muscleGroups, ['Chest', 'Legs']);
    });

    test('summary keeps the wire level, trainer id and duration', () {
      final s = _s('a', 'A', level: 'ADVANCED', weeks: 12, trainerId: 't9');
      expect(s.level, 'ADVANCED');
      expect(s.levelValue, WorkoutLevel.advanced);
      expect(s.trainerId, 't9');
      expect(s.durationWeeks, 12);
      expect(s.isDeleted, isFalse);
      expect(_s('d', 'D', deleted: true).isDeleted, isTrue);
    });

    test('weekday helpers use the UPPER_SNAKE wire values', () {
      expect(WeekDay.saturday.apiValue, 'SATURDAY');
      expect(WeekDayX.fromApi('SUNDAY'), WeekDay.sunday);
      expect(WeekDayX.fromDate(DateTime(2026, 10, 19)), WeekDay.monday);
      expect(WorkoutLevel.advanced.apiValue, 'ADVANCED');
    });
  });

  group('MemberWorkoutPlans', () {
    Map<String, dynamic> assignment(String id, String status, {int pct = 50}) =>
        {
          'id': id,
          'workoutPlan': {
            'id': 'p1',
            'name': 'Plan $id',
            'level': 'BEGINNER',
            'durationWeeks': 6,
          },
          'assignedDate': '2026-01-01T00:00:00.000Z',
          'startDate': '2026-01-02T00:00:00.000Z',
          'endDate': null,
          'status': status,
          'trainerRemarks': 'Keep going',
          'memberNotes': null,
          'progressPercent': pct,
          'completedCount': 2,
          'skippedCount': 1,
          'totalExercises': 5,
          'progress': [
            {
              'exerciseId': 'e1',
              'exerciseName': 'Bench',
              'dayOfWeek': 'MONDAY',
              'status': 'COMPLETED',
              'notes': null,
              'markedAt': '2026-01-03T10:00:00.000Z',
            },
          ],
        };

    test('parses current + history and derives counts', () {
      final plans = MemberWorkoutPlans.fromJson({
        'current': assignment('a2', 'ACTIVE'),
        'history': [assignment('a2', 'ACTIVE'), assignment('a1', 'COMPLETED')],
      });
      final cur = plans.current!;
      expect(cur.isActive, isTrue);
      expect(cur.skippedCount, 1);
      expect(cur.pendingCount, 2);
      expect(cur.progress.single.markedAt, isNotNull);
      expect(plans.past.map((h) => h.id), ['a1']);
      expect(
        cur.plannedEnd,
        DateTime.parse('2026-01-02T00:00:00.000Z')
            .add(const Duration(days: 42)),
      );
    });

    test('no current plan and a missing history list are fine', () {
      final plans = MemberWorkoutPlans.fromJson({'current': null});
      expect(plans.current, isNull);
      expect(plans.history, isEmpty);
    });
  });

  group('ScheduleDraft', () {
    test('round-trips every day with rest and notes intact', () {
      final plan = WorkoutPlan.fromJson(_plan());
      final draft = ScheduleDraft.fromPlan(plan);
      final out = draft.toDrafts();
      expect(out.length, 3);
      final incline = out.firstWhere((d) => d.exerciseId == 'e2');
      expect(incline.notes, 'Slow');
      expect(incline.restSeconds, 60);
      expect(out.first.dayOfWeek, WeekDay.monday);
      // Array order is the sort order inside a day.
      expect(out.map((d) => d.exerciseId).take(2), ['e1', 'e2']);
      expect(draft.sameAs(ScheduleDraft.fromPlan(plan)), isTrue);
    });

    test('edits and reorders are seen as changes', () {
      final plan = WorkoutPlan.fromJson(_plan());
      final draft = ScheduleDraft.fromPlan(plan);
      final original = ScheduleDraft.fromPlan(plan);
      draft.day(WeekDay.monday).first.sets = 5;
      expect(draft.sameAs(original), isFalse);
      draft.day(WeekDay.monday).first.sets = 4;
      expect(draft.sameAs(original), isTrue);
    });

    test('request json omits blank notes and unset numbers', () {
      const d = PlanExerciseDraft(
        exerciseId: 'e1',
        dayOfWeek: WeekDay.tuesday,
        notes: '  ',
      );
      expect(d.toJson(), {'exerciseId': 'e1', 'dayOfWeek': 'TUESDAY'});
    });
  });

  group('lifecycle actions (web WorkoutPlanCard menu)', () {
    List<WorkoutAction> actions({
      bool deleted = false,
      bool active = true,
      bool create = false,
      bool update = false,
      bool delete = false,
      bool restore = false,
    }) =>
        availableWorkoutActions(
          deleted: deleted,
          active: active,
          canCreate: create,
          canUpdate: update,
          canDelete: delete,
          canRestore: restore,
        );

    test('each action needs its own permission', () {
      expect(actions(), isEmpty);
      expect(actions(create: true), [WorkoutAction.duplicate]);
      expect(actions(update: true), [WorkoutAction.deactivate]);
      expect(actions(update: true, active: false), [WorkoutAction.activate]);
      expect(actions(delete: true), [WorkoutAction.delete]);
      expect(
        actions(create: true, update: true, delete: true),
        [
          WorkoutAction.duplicate,
          WorkoutAction.deactivate,
          WorkoutAction.delete,
        ],
      );
    });

    test('a deleted plan only offers restore', () {
      expect(
        actions(
          deleted: true,
          create: true,
          update: true,
          delete: true,
          restore: true,
        ),
        [WorkoutAction.restore],
      );
      expect(actions(deleted: true, update: true, delete: true), isEmpty);
    });
  });

  group('filterWorkoutPlans', () {
    final all = [
      _s('a', 'Alpha', trainerId: 't1', created: '2026-01-01T00:00:00.000Z'),
      _s(
        'b',
        'Bravo',
        active: false,
        level: 'ADVANCED',
        weeks: 12,
        created: '2026-02-01T00:00:00.000Z',
      ),
      _s('c', 'Charlie', deleted: true, created: '2026-03-01T00:00:00.000Z'),
    ];

    test('status filters never mix deleted into active / inactive', () {
      List<String> ids(String status) =>
          filterWorkoutPlans(all, status: status).map((p) => p.id).toList();
      expect(ids(''), ['c', 'b', 'a']);
      expect(ids('active'), ['a']);
      expect(ids('inactive'), ['b']);
      expect(ids('deleted'), ['c']);
    });

    test('search, level and sort', () {
      expect(filterWorkoutPlans(all, search: 'goal of bra').single.id, 'b');
      expect(filterWorkoutPlans(all, level: 'ADVANCED').single.id, 'b');
      expect(
        filterWorkoutPlans(all, sort: 'name:desc').map((p) => p.id),
        ['c', 'b', 'a'],
      );
      expect(
        filterWorkoutPlans(all, sort: 'durationWeeks:desc').first.id,
        'b',
      );
    });
  });

  group('WorkoutPlanRepository', () {
    test('listAll walks pages and only ever sends true flags', () async {
      final dio = Dio();
      final seen = <Map<String, dynamic>>[];
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            seen.add(Map.of(options.queryParameters));
            final page = options.queryParameters['page'] as int;
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': {
                    'items': [
                      {
                        'id': 'p$page',
                        'name': 'Plan $page',
                        'level': 'BEGINNER',
                        'durationWeeks': 4,
                        'isActive': true,
                        'activeMemberCount': 0,
                      },
                    ],
                    'total': 2,
                    'page': page,
                    'limit': 100,
                    'totalPages': 2,
                  },
                },
              ),
            );
          },
        ),
      );
      final repo = WorkoutPlanRepository(dio);
      final all = await repo.listAll();
      expect(all.map((p) => p.id), ['p1', 'p2']);
      expect(seen.first['includeDeleted'], true);
      expect(seen.first['limit'], 100);

      seen.clear();
      await repo.list(isActive: false);
      expect(seen.single.containsKey('isActive'), isFalse);
    });

    test('assign sends the start as a calendar day', () async {
      final dio = Dio();
      Object? body;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            body = options.data;
            handler.resolve(Response(requestOptions: options, statusCode: 200));
          },
        ),
      );
      await WorkoutPlanRepository(dio).assign(
        planId: 'p1',
        memberId: 'm1',
        startDate: DateTime(2026, 3, 5, 18, 30),
      );
      expect(body, {'memberId': 'm1', 'startDate': '2026-03-05'});
    });
  });
}
