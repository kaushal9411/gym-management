/// Mirrors `DietPlanListItemDto` — read-only catalog view, same reasoning
/// as `WorkoutPlanSummary`.
class DietPlanSummary {
  const DietPlanSummary({
    required this.id,
    required this.name,
    required this.dailyCalories,
    required this.trainerName,
    required this.activeMemberCount,
  });

  final String id;
  final String name;
  final int? dailyCalories;
  final String? trainerName;
  final int activeMemberCount;

  factory DietPlanSummary.fromJson(Map<String, dynamic> json) =>
      DietPlanSummary(
        id: json['id'] as String,
        name: json['name'] as String,
        dailyCalories: json['dailyCalories'] as int?,
        trainerName:
            (json['trainer'] as Map<String, dynamic>?)?['name'] as String?,
        activeMemberCount: json['activeMemberCount'] as int? ?? 0,
      );
}
