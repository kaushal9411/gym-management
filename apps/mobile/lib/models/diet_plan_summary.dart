/// Mirrors `DietPlanListItemDto` (`GET /diet-plans`). Every field parses
/// tolerantly - a count or calorie target that arrives as a string must not
/// take the whole list down.
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

  bool get isDeleted => deletedAt != null;

  factory DietPlanSummary.fromJson(Map<String, dynamic> json) =>
      DietPlanSummary(
        id: json['id'] as String,
        name: json['name'] as String,
        dailyCalories: _int(json['dailyCalories']),
        durationDays: _int(json['durationDays']) ?? 0,
        trainerName:
            (json['trainer'] as Map<String, dynamic>?)?['name'] as String?,
        activeMemberCount: _int(json['activeMemberCount']) ?? 0,
        goal: json['goal'] as String?,
        isActive: json['isActive'] as bool? ?? true,
        createdAt: _date(json['createdAt']),
        deletedAt: _date(json['deletedAt']),
      );
}

int? _int(Object? v) {
  if (v == null) return null;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString());
}

DateTime? _date(Object? v) => v is String ? DateTime.tryParse(v) : null;
