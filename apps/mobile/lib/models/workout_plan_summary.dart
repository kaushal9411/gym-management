/// Mirrors `WorkoutPlanListItemDto` — read-only catalog view (the design's
/// Owner/Manager "7b. Workout plans" frame has no create button; building
/// one is a Trainer-chunk concern with its exercise-builder UI).
class WorkoutPlanSummary {
  const WorkoutPlanSummary({
    required this.id,
    required this.name,
    required this.level,
    required this.trainerName,
    required this.activeMemberCount,
  });

  final String id;
  final String name;
  final String level;
  final String? trainerName;
  final int activeMemberCount;

  factory WorkoutPlanSummary.fromJson(Map<String, dynamic> json) =>
      WorkoutPlanSummary(
        id: json['id'] as String,
        name: json['name'] as String,
        level: json['level'] as String,
        trainerName:
            (json['trainer'] as Map<String, dynamic>?)?['name'] as String?,
        activeMemberCount: json['activeMemberCount'] as int? ?? 0,
      );
}
