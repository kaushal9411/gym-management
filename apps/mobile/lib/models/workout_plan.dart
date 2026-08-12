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

class PlanExercise {
  const PlanExercise({
    required this.id,
    required this.exercise,
    required this.dayOfWeek,
    required this.sets,
    required this.repetitions,
  });

  final String id;
  final Exercise exercise;
  final WeekDay dayOfWeek;
  final int? sets;
  final int? repetitions;

  factory PlanExercise.fromJson(Map<String, dynamic> json) => PlanExercise(
        id: json['id'] as String,
        exercise: Exercise.fromJson(json['exercise'] as Map<String, dynamic>),
        dayOfWeek: WeekDayX.fromApi(json['dayOfWeek'] as String),
        sets: json['sets'] as int?,
        repetitions: json['repetitions'] as int?,
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
    this.exercises = const [],
  });

  final String id;
  final String name;
  final WorkoutLevel level;
  final int durationWeeks;
  final bool isActive;
  final int activeMemberCount;
  final List<PlanExercise> exercises;

  Map<WeekDay, List<PlanExercise>> get exercisesByDay {
    final grouped = <WeekDay, List<PlanExercise>>{};
    for (final e in exercises) {
      (grouped[e.dayOfWeek] ??= []).add(e);
    }
    return grouped;
  }

  factory WorkoutPlan.fromJson(Map<String, dynamic> json) => WorkoutPlan(
        id: json['id'] as String,
        name: json['name'] as String,
        level: WorkoutLevelX.fromApi(json['level'] as String),
        durationWeeks: json['durationWeeks'] as int,
        isActive: json['isActive'] as bool? ?? true,
        activeMemberCount: json['activeMemberCount'] as int? ?? 0,
        exercises: json['exercises'] == null
            ? const []
            : (json['exercises'] as List)
                .map(
                  (e) => PlanExercise.fromJson(e as Map<String, dynamic>),
                )
                .toList(),
      );
}
