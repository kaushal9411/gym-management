import 'workout_plan.dart';

/// Mirrors `WorkoutPlanListItemDto` (`GET /workout-plans`).
class WorkoutPlanSummary {
  const WorkoutPlanSummary({
    required this.id,
    required this.name,
    required this.level,
    required this.trainerName,
    required this.activeMemberCount,
    this.goal,
    this.isActive = true,
    this.durationWeeks = 0,
    this.trainerId,
    this.createdAt,
    this.deletedAt,
  });

  final String id;
  final String name;

  /// The wire value (`BEGINNER` ...); see [levelValue] for the enum.
  final String level;
  final String? trainerName;
  final String? trainerId;
  final int activeMemberCount;
  final int durationWeeks;
  final String? goal;
  final bool isActive;
  final DateTime? createdAt;

  /// Non-null means soft-deleted.
  final DateTime? deletedAt;

  bool get isDeleted => deletedAt != null;

  WorkoutLevel get levelValue => WorkoutLevelX.fromApi(level);

  factory WorkoutPlanSummary.fromJson(Map<String, dynamic> json) {
    final trainer = json['trainer'] as Map<String, dynamic>?;
    final weeks = json['durationWeeks'];
    final members = json['activeMemberCount'];
    return WorkoutPlanSummary(
      id: json['id'] as String,
      name: json['name'] as String,
      level: json['level'] as String? ?? 'BEGINNER',
      trainerName: trainer?['name'] as String?,
      trainerId: trainer?['id'] as String?,
      activeMemberCount: members is num ? members.toInt() : 0,
      durationWeeks: weeks is num ? weeks.toInt() : 0,
      goal: json['goal'] as String?,
      isActive: json['isActive'] as bool? ?? true,
      createdAt: json['createdAt'] == null
          ? null
          : DateTime.tryParse(json['createdAt'] as String),
      deletedAt: json['deletedAt'] == null
          ? null
          : DateTime.tryParse(json['deletedAt'] as String),
    );
  }
}
