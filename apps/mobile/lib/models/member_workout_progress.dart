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

int _int(Object? v) =>
    v is num ? v.toInt() : int.tryParse(v?.toString() ?? '') ?? 0;

class ExerciseProgressEntry {
  const ExerciseProgressEntry({
    required this.exerciseId,
    required this.exerciseName,
    required this.dayOfWeek,
    required this.status,
    this.notes,
    this.markedAt,
  });

  final String exerciseId;
  final String exerciseName;
  final WeekDay dayOfWeek;
  final ExerciseProgressStatus status;
  final String? notes;
  final DateTime? markedAt;

  factory ExerciseProgressEntry.fromJson(Map<String, dynamic> json) =>
      ExerciseProgressEntry(
        exerciseId: json['exerciseId'] as String,
        exerciseName: json['exerciseName'] as String,
        dayOfWeek: WeekDayX.fromApi(json['dayOfWeek'] as String),
        status: ExerciseProgressStatusX.fromApi(
          json['status'] as String? ?? 'PENDING',
        ),
        notes: json['notes'] as String?,
        markedAt: json['markedAt'] == null
            ? null
            : DateTime.tryParse(json['markedAt'] as String),
      );
}

/// Mirrors `MemberWorkoutPlanDto` (`GET /workout-plans/members/:memberId`
/// → `current` and every `history` row).
class MemberWorkoutProgress {
  const MemberWorkoutProgress({
    required this.id,
    required this.workoutPlanId,
    required this.workoutPlanName,
    required this.level,
    required this.durationWeeks,
    required this.status,
    required this.startDate,
    required this.endDate,
    required this.trainerRemarks,
    required this.progressPercent,
    required this.completedCount,
    required this.totalExercises,
    required this.progress,
    this.skippedCount = 0,
    this.memberNotes,
    this.assignedDate,
  });

  final String id;
  final String workoutPlanId;
  final String workoutPlanName;
  final WorkoutLevel level;
  final int durationWeeks;

  /// `ACTIVE`, `COMPLETED` or `CANCELLED`.
  final String status;
  final DateTime startDate;
  final DateTime? endDate;
  final DateTime? assignedDate;
  final String? trainerRemarks;
  final String? memberNotes;
  final int progressPercent;
  final int completedCount;
  final int skippedCount;
  final int totalExercises;
  final List<ExerciseProgressEntry> progress;

  bool get isActive => status == 'ACTIVE';

  /// Exercises neither done nor skipped yet.
  int get pendingCount =>
      (totalExercises - completedCount - skippedCount).clamp(0, 1 << 30);

  /// 1-based week of the plan the member is currently in.
  int get currentWeek => DateTime.now().difference(startDate).inDays ~/ 7 + 1;

  /// Where the plan is on the calendar: the day it ends (the explicit end
  /// date, else start + the plan's length).
  DateTime get plannedEnd =>
      endDate ?? startDate.add(Duration(days: durationWeeks * 7));

  Map<WeekDay, List<ExerciseProgressEntry>> get progressByDay {
    final grouped = <WeekDay, List<ExerciseProgressEntry>>{};
    for (final e in progress) {
      (grouped[e.dayOfWeek] ??= []).add(e);
    }
    return grouped;
  }

  MemberWorkoutProgress copyWith({String? trainerRemarks}) =>
      MemberWorkoutProgress(
        id: id,
        workoutPlanId: workoutPlanId,
        workoutPlanName: workoutPlanName,
        level: level,
        durationWeeks: durationWeeks,
        status: status,
        startDate: startDate,
        endDate: endDate,
        trainerRemarks: trainerRemarks ?? this.trainerRemarks,
        progressPercent: progressPercent,
        completedCount: completedCount,
        totalExercises: totalExercises,
        progress: progress,
        skippedCount: skippedCount,
        memberNotes: memberNotes,
        assignedDate: assignedDate,
      );

  factory MemberWorkoutProgress.fromJson(Map<String, dynamic> json) {
    final plan = json['workoutPlan'] as Map<String, dynamic>;
    return MemberWorkoutProgress(
      id: json['id'] as String,
      workoutPlanId: plan['id'] as String,
      workoutPlanName: plan['name'] as String,
      level: WorkoutLevelX.fromApi(plan['level'] as String? ?? 'BEGINNER'),
      durationWeeks: _int(plan['durationWeeks']),
      status: json['status'] as String? ?? 'ACTIVE',
      startDate: DateTime.parse(json['startDate'] as String),
      endDate: json['endDate'] == null
          ? null
          : DateTime.tryParse(json['endDate'] as String),
      assignedDate: json['assignedDate'] == null
          ? null
          : DateTime.tryParse(json['assignedDate'] as String),
      trainerRemarks: json['trainerRemarks'] as String?,
      memberNotes: json['memberNotes'] as String?,
      progressPercent: _int(json['progressPercent']),
      completedCount: _int(json['completedCount']),
      skippedCount: _int(json['skippedCount']),
      totalExercises: _int(json['totalExercises']),
      progress: ((json['progress'] as List?) ?? const [])
          .map(
            (e) => ExerciseProgressEntry.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}

/// `GET /workout-plans/members/:memberId` → `{ current, history }`.
class MemberWorkoutPlans {
  const MemberWorkoutPlans({required this.current, required this.history});

  final MemberWorkoutProgress? current;

  /// Every assignment the member has had, newest first (the current one
  /// included when the API lists it).
  final List<MemberWorkoutProgress> history;

  /// Past assignments only (the current one excluded).
  List<MemberWorkoutProgress> get past =>
      history.where((h) => h.id != current?.id).toList();

  factory MemberWorkoutPlans.fromJson(Map<String, dynamic> json) {
    final current = json['current'];
    return MemberWorkoutPlans(
      current: current == null
          ? null
          : MemberWorkoutProgress.fromJson(current as Map<String, dynamic>),
      history: ((json['history'] as List?) ?? const [])
          .map(
            (e) => MemberWorkoutProgress.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}
