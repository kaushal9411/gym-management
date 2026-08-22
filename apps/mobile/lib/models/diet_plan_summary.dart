/// Mirrors `DietPlanListItemDto` (`GET /diet-plans`).
class DietPlanSummary {
  const DietPlanSummary({
    required this.id,
    required this.name,
    required this.dailyCalories,
    required this.durationDays,
    required this.trainerName,
    required this.activeMemberCount,
    this.goal,
    this.isActive = true,
    this.createdAt,
    this.deletedAt,
  });

  final String id;
  final String name;
  final int? dailyCalories;
  final int durationDays;
  final String? trainerName;
  final int activeMemberCount;
  final String? goal;
  final bool isActive;
  final DateTime? createdAt;

  /// Non-null means soft-deleted.
  final DateTime? deletedAt;

  factory DietPlanSummary.fromJson(Map<String, dynamic> json) =>
      DietPlanSummary(
        id: json['id'] as String,
        name: json['name'] as String,
        dailyCalories: json['dailyCalories'] as int?,
        durationDays: json['durationDays'] as int? ?? 0,
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
