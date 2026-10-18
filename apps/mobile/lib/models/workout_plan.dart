import 'exercise.dart';

enum WeekDay { monday, tuesday, wednesday, thursday, friday, saturday, sunday }

extension WeekDayX on WeekDay {
  String get apiValue => switch (this) {
        WeekDay.monday => 'MONDAY',
        WeekDay.tuesday => 'TUESDAY',
        WeekDay.wednesday => 'WEDNESDAY',
        WeekDay.thursday => 'THURSDAY',
        WeekDay.friday => 'FRIDAY',
        WeekDay.saturday => 'SATURDAY',
        WeekDay.sunday => 'SUNDAY',
      };

  String get label => switch (this) {
        WeekDay.monday => 'Monday',
        WeekDay.tuesday => 'Tuesday',
        WeekDay.wednesday => 'Wednesday',
        WeekDay.thursday => 'Thursday',
        WeekDay.friday => 'Friday',
        WeekDay.saturday => 'Saturday',
        WeekDay.sunday => 'Sunday',
      };

  String get shortLabel => switch (this) {
        WeekDay.monday => 'Mon',
        WeekDay.tuesday => 'Tue',
        WeekDay.wednesday => 'Wed',
        WeekDay.thursday => 'Thu',
        WeekDay.friday => 'Fri',
        WeekDay.saturday => 'Sat',
        WeekDay.sunday => 'Sun',
      };

  static WeekDay fromApi(String v) => WeekDay.values.firstWhere(
        (d) => d.apiValue == v,
        orElse: () => WeekDay.monday,
      );

  /// The weekday of [d] in the device's calendar (`DateTime.monday == 1`).
  static WeekDay fromDate(DateTime d) => WeekDay.values[d.weekday - 1];
}

enum WorkoutLevel { beginner, intermediate, advanced }

extension WorkoutLevelX on WorkoutLevel {
  String get apiValue => switch (this) {
        WorkoutLevel.beginner => 'BEGINNER',
        WorkoutLevel.intermediate => 'INTERMEDIATE',
        WorkoutLevel.advanced => 'ADVANCED',
      };

  String get label => switch (this) {
        WorkoutLevel.beginner => 'Beginner',
        WorkoutLevel.intermediate => 'Intermediate',
        WorkoutLevel.advanced => 'Advanced',
      };

  static WorkoutLevel fromApi(String v) => switch (v) {
        'ADVANCED' => WorkoutLevel.advanced,
        'INTERMEDIATE' => WorkoutLevel.intermediate,
        _ => WorkoutLevel.beginner,
      };
}

int _int(Object? v, [int fallback = 0]) =>
    v is num ? v.toInt() : int.tryParse(v?.toString() ?? '') ?? fallback;

int? _intOrNull(Object? v) =>
    v is num ? v.toInt() : int.tryParse(v?.toString() ?? '');

DateTime? _date(Object? v) => v == null ? null : DateTime.tryParse('$v');

class PlanExercise {
  const PlanExercise({
    required this.id,
    required this.exercise,
    required this.dayOfWeek,
    required this.sets,
    required this.repetitions,
    this.sortOrder = 0,
    this.restSeconds,
    this.notes,
  });

  final String id;
  final Exercise exercise;
  final WeekDay dayOfWeek;
  final int? sets;
  final int? repetitions;
  final int sortOrder;
  final int? restSeconds;
  final String? notes;

  factory PlanExercise.fromJson(Map<String, dynamic> json) => PlanExercise(
        id: json['id'] as String,
        exercise: Exercise.fromJson(json['exercise'] as Map<String, dynamic>),
        dayOfWeek: WeekDayX.fromApi(json['dayOfWeek'] as String),
        sets: _intOrNull(json['sets']),
        repetitions: _intOrNull(json['repetitions']),
        sortOrder: _int(json['sortOrder']),
        restSeconds: _intOrNull(json['restSeconds']),
        notes: json['notes'] as String?,
      );
}

/// A plan's assigned trainer — nested `{id, name}` on both the list and
/// detail DTOs.
class PlanTrainer {
  const PlanTrainer({required this.id, required this.name});

  final String id;
  final String name;

  factory PlanTrainer.fromJson(Map<String, dynamic> json) => PlanTrainer(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

/// Mirrors `WorkoutPlanListItemDto`/`WorkoutPlanDetailDto` as one class —
/// `exercises` stays empty until fetched via
/// [WorkoutPlanRepository.getById].
class WorkoutPlan {
  const WorkoutPlan({
    required this.id,
    required this.name,
    required this.level,
    required this.durationWeeks,
    required this.isActive,
    required this.activeMemberCount,
    this.goal,
    this.description,
    this.trainer,
    this.notes,
    this.createdAt,
    this.updatedAt,
    this.deletedAt,
    this.exercises = const [],
  });

  final String id;
  final String name;
  final WorkoutLevel level;
  final int durationWeeks;
  final bool isActive;
  final int activeMemberCount;
  final String? goal;
  final String? description;
  final PlanTrainer? trainer;
  final String? notes;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// Non-null means soft-deleted.
  final DateTime? deletedAt;
  final List<PlanExercise> exercises;

  bool get isDeleted => deletedAt != null;

  /// Exercises grouped by day, each day in the plan's own `sortOrder`.
  Map<WeekDay, List<PlanExercise>> get exercisesByDay {
    final grouped = <WeekDay, List<PlanExercise>>{};
    for (final e in exercises) {
      (grouped[e.dayOfWeek] ??= []).add(e);
    }
    for (final list in grouped.values) {
      list.sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    }
    return grouped;
  }

  /// Days of the week with at least one exercise.
  int get trainingDays => exercisesByDay.length;

  int get totalExercises => exercises.length;

  /// Sum of the planned sets (exercises without a set count add nothing).
  int get totalSets => exercises.fold(0, (a, e) => a + (e.sets ?? 0));

  /// Distinct muscle groups the plan works, most-used first.
  List<String> get muscleGroups {
    final counts = <String, int>{};
    for (final e in exercises) {
      final g = e.exercise.muscleGroup?.trim();
      if (g != null && g.isNotEmpty) counts[g] = (counts[g] ?? 0) + 1;
    }
    final keys = counts.keys.toList()
      ..sort((a, b) => counts[b]!.compareTo(counts[a]!));
    return keys;
  }

  factory WorkoutPlan.fromJson(Map<String, dynamic> json) => WorkoutPlan(
        id: json['id'] as String,
        name: json['name'] as String,
        level: WorkoutLevelX.fromApi(json['level'] as String? ?? 'BEGINNER'),
        durationWeeks: _int(json['durationWeeks']),
        isActive: json['isActive'] as bool? ?? true,
        activeMemberCount: _int(json['activeMemberCount']),
        goal: json['goal'] as String?,
        description: json['description'] as String?,
        trainer: json['trainer'] == null
            ? null
            : PlanTrainer.fromJson(json['trainer'] as Map<String, dynamic>),
        notes: json['notes'] as String?,
        createdAt: _date(json['createdAt']),
        updatedAt: _date(json['updatedAt']),
        deletedAt: _date(json['deletedAt']),
        exercises: json['exercises'] == null
            ? const []
            : (json['exercises'] as List)
                .map(
                  (e) => PlanExercise.fromJson(e as Map<String, dynamic>),
                )
                .toList(),
      );
}
