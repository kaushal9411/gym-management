import 'workout_plan.dart';

enum ExerciseProgressStatus { pending, completed, skipped }

extension ExerciseProgressStatusX on ExerciseProgressStatus {
  String get apiValue => switch (this) {
        ExerciseProgressStatus.pending => 'PENDING',
        ExerciseProgressStatus.completed => 'COMPLETED',
        ExerciseProgressStatus.skipped => 'SKIPPED',
      };

  static ExerciseProgressStatus fromApi(String v) => switch (v) {
        'COMPLETED' => ExerciseProgressStatus.completed,
        'SKIPPED' => ExerciseProgressStatus.skipped,
        _ => ExerciseProgressStatus.pending,
      };
}

class ExerciseProgressEntry {
  const ExerciseProgressEntry({
    required this.exerciseId,
    required this.exerciseName,
    required this.dayOfWeek,
    required this.status,
  });

  final String exerciseId;
  final String exerciseName;
  final WeekDay dayOfWeek;
  final ExerciseProgressStatus status;

  factory ExerciseProgressEntry.fromJson(Map<String, dynamic> json) =>
      ExerciseProgressEntry(
        exerciseId: json['exerciseId'] as String,
        exerciseName: json['exerciseName'] as String,
        dayOfWeek: WeekDayX.fromApi(json['dayOfWeek'] as String),
        status: ExerciseProgressStatusX.fromApi(json['status'] as String),
      );
}

/// Mirrors `MemberWorkoutPlanDto` (`GET /workout-plans/members/:memberId`
/// → `current`).
class MemberWorkoutProgress {
  const MemberWorkoutProgress({
    required this.id,
    required this.workoutPlanId,
    required this.workoutPlanName,
    required this.status,
    required this.startDate,
    required this.trainerRemarks,
    required this.progressPercent,
    required this.progress,
  });

  final String id;
  final String workoutPlanId;
  final String workoutPlanName;
  final String status;
  final DateTime startDate;
  final String? trainerRemarks;
  final int progressPercent;
  final List<ExerciseProgressEntry> progress;

  /// 1-based week of the plan the member is currently in.
  int get currentWeek =>
      DateTime.now().difference(startDate).inDays ~/ 7 + 1;

  Map<WeekDay, List<ExerciseProgressEntry>> get progressByDay {
    final grouped = <WeekDay, List<ExerciseProgressEntry>>{};
    for (final e in progress) {
      (grouped[e.dayOfWeek] ??= []).add(e);
    }
    return grouped;
  }

  factory MemberWorkoutProgress.fromJson(Map<String, dynamic> json) =>
      MemberWorkoutProgress(
        id: json['id'] as String,
        workoutPlanId:
            (json['workoutPlan'] as Map<String, dynamic>)['id'] as String,
        workoutPlanName:
            (json['workoutPlan'] as Map<String, dynamic>)['name'] as String,
        status: json['status'] as String,
        startDate: DateTime.parse(json['startDate'] as String),
        trainerRemarks: json['trainerRemarks'] as String?,
        progressPercent: json['progressPercent'] as int? ?? 0,
        progress: (json['progress'] as List)
            .map(
              (e) => ExerciseProgressEntry.fromJson(e as Map<String, dynamic>),
            )
            .toList(),
      );
}
