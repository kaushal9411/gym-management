import 'member_workout_progress.dart';
import 'workout_plan.dart';

/// One exercise of the member's assigned plan as `GET /portal/workout`
/// returns it. Deliberately thinner than the trainer plane's
/// [PlanExercise]: the portal DTO carries only `exerciseId`/`name`/
/// `dayOfWeek` — no sets/reps — so the design's "4×10 · 60kg" detail line
/// has nothing to render from here.
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
    );
  }
}
