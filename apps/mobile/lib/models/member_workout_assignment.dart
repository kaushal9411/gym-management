import 'member_workout_progress.dart';
import 'member_workout_tracking.dart';
import 'workout_plan.dart';

/// One exercise of the member's assigned plan as `GET /portal/workout`
/// returns it. Deliberately thinner than the trainer plane's
/// [PlanExercise]: the portal DTO carries only `exerciseId`/`name`/
/// `dayOfWeek`; the per-day targets, logs and progress come from
/// [MemberWorkoutAssignment.tracking] instead.
class MemberPlanExercise {
  const MemberPlanExercise({
    required this.exerciseId,
    required this.name,
    required this.dayOfWeek,
  });

  final String exerciseId;
  final String name;
  final WeekDay dayOfWeek;

  factory MemberPlanExercise.fromJson(Map<String, dynamic> json) =>
      MemberPlanExercise(
        exerciseId: json['exerciseId'] as String,
        name: json['name'] as String,
        dayOfWeek: WeekDayX.fromApi(json['dayOfWeek'] as String),
      );
}

/// Mirrors `GET /portal/workout` (null when nothing is assigned).
class MemberWorkoutAssignment {
  const MemberWorkoutAssignment({
    required this.id,
    required this.status,
    required this.startDate,
    required this.trainerRemarks,
    required this.planName,
    required this.planLevel,
    required this.durationWeeks,
    required this.exercises,
    required this.progress,
    this.tracking,
  });

  final String id;
  final String status;
  final DateTime startDate;
  final String? trainerRemarks;
  final String planName;
  final WorkoutLevel planLevel;
  final int durationWeeks;
  final List<MemberPlanExercise> exercises;
  final Map<String, ExerciseProgressStatus> progress;

  /// Daily log, progress and advice (additive on `GET /portal/workout`).
  final WorkoutTracking? tracking;

  int get currentWeek => DateTime.now().difference(startDate).inDays ~/ 7 + 1;

  List<MemberPlanExercise> exercisesFor(WeekDay day) =>
      exercises.where((e) => e.dayOfWeek == day).toList();

  ExerciseProgressStatus statusOf(String exerciseId) =>
      progress[exerciseId] ?? ExerciseProgressStatus.pending;

  factory MemberWorkoutAssignment.fromJson(Map<String, dynamic> json) {
    final plan = json['workoutPlan'] as Map<String, dynamic>;
    return MemberWorkoutAssignment(
      id: json['id'] as String,
      status: json['status'] as String,
      startDate: DateTime.parse(json['startDate'] as String),
      trainerRemarks: json['trainerRemarks'] as String?,
      planName: plan['name'] as String,
      planLevel: WorkoutLevelX.fromApi(plan['level'] as String),
      durationWeeks: plan['durationWeeks'] as int,
      exercises: (plan['exercises'] as List)
          .map((e) => MemberPlanExercise.fromJson(e as Map<String, dynamic>))
          .toList(),
      progress: {
        for (final p in json['progress'] as List)
          (p as Map<String, dynamic>)['exerciseId'] as String:
              ExerciseProgressStatusX.fromApi(p['status'] as String),
      },
      tracking: json['tracking'] == null
          ? null
          : WorkoutTracking.fromJson(json['tracking'] as Map<String, dynamic>),
    );
  }
}

/// What every `/portal/workout/log*` write returns: the refreshed workout
/// (null when the member no longer has an active plan), plus the entry that
/// was written and, for `complete`, how many exercises it newly marked done.
class WorkoutWriteResult {
  const WorkoutWriteResult({
    this.workout,
    this.entry,
    this.created = false,
    this.completedNow = 0,
  });

  final MemberWorkoutAssignment? workout;
  final WorkoutLogEntry? entry;

  /// True when the log call created a new entry (HTTP 201) instead of
  /// updating the day's existing one.
  final bool created;
  final int completedNow;

  factory WorkoutWriteResult.fromJson(
    Map<String, dynamic> json, {
    bool created = false,
  }) {
    final workout = json['workout'];
    final entry = json['entry'];
    return WorkoutWriteResult(
      workout: workout == null
          ? null
          : MemberWorkoutAssignment.fromJson(workout as Map<String, dynamic>),
      entry: entry == null
          ? null
          : WorkoutLogEntry.fromJson(entry as Map<String, dynamic>),
      created: created,
      completedNow: (json['completedNow'] as num?)?.toInt() ?? 0,
    );
  }
}
