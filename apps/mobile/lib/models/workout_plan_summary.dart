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
    this.createdAt,
    this.deletedAt,
  });

  final String id;
  final String name;
  final String level;
  final String? trainerName;
  final int activeMemberCount;
  final String? goal;
  final bool isActive;
  final DateTime? createdAt;

  /// Non-null means soft-deleted.
  final DateTime? deletedAt;

  factory WorkoutPlanSummary.fromJson(Map<String, dynamic> json) =>
      WorkoutPlanSummary(
        id: json['id'] as String,
        name: json['name'] as String,
        level: json['level'] as String,
        trainerName:
            (json['trainer'] as Map<String, dynamic>?)?['name'] as String?,
        activeMemberCount: json['activeMemberCount'] as int? ?? 0,
        goal: json['goal'] as String?,
        isActive: json['isActive'] as bool? ?? true,
        createdAt: json['createdAt'] == null
            ? null
            : DateTime.parse(json['createdAt'] as String),
        deletedAt: json['deletedAt'] == null
            ? null
            : DateTime.parse(json['deletedAt'] as String),
      );
}
