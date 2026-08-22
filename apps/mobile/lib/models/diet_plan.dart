import 'food.dart';

enum MealType {
  breakfast,
  morningSnack,
  lunch,
  eveningSnack,
  dinner,
  preWorkout,
  postWorkout,
}

extension MealTypeX on MealType {
  String get apiValue => switch (this) {
        MealType.breakfast => 'BREAKFAST',
        MealType.morningSnack => 'MORNING_SNACK',
        MealType.lunch => 'LUNCH',
        MealType.eveningSnack => 'EVENING_SNACK',
        MealType.dinner => 'DINNER',
        MealType.preWorkout => 'PRE_WORKOUT',
        MealType.postWorkout => 'POST_WORKOUT',
      };

  String get label => switch (this) {
        MealType.breakfast => 'Breakfast',
        MealType.morningSnack => 'Morning snack',
        MealType.lunch => 'Lunch',
        MealType.eveningSnack => 'Evening snack',
        MealType.dinner => 'Dinner',
        MealType.preWorkout => 'Pre-workout',
        MealType.postWorkout => 'Post-workout',
      };

  static MealType fromApi(String v) => MealType.values.firstWhere(
        (m) => m.apiValue == v,
        orElse: () => MealType.breakfast,
      );
}

class PlanMeal {
  const PlanMeal({
    required this.id,
    required this.food,
    required this.mealType,
    this.sortOrder = 0,
    this.quantity = 1,
    this.notes,
  });

  final String id;
  final Food food;
  final MealType mealType;
  final int sortOrder;
  final double quantity;
  final String? notes;

  factory PlanMeal.fromJson(Map<String, dynamic> json) => PlanMeal(
        id: json['id'] as String,
        food: Food.fromJson(json['food'] as Map<String, dynamic>),
        mealType: MealTypeX.fromApi(json['mealType'] as String),
        sortOrder: json['sortOrder'] as int? ?? 0,
        quantity: double.tryParse('${json['quantity'] ?? 1}') ?? 1,
        notes: json['notes'] as String?,
      );
}

/// A plan's assigned trainer — nested `{id, name}`, same shape as
/// workout plans' `PlanTrainer`.
class DietPlanTrainer {
  const DietPlanTrainer({required this.id, required this.name});

  final String id;
  final String name;

  factory DietPlanTrainer.fromJson(Map<String, dynamic> json) =>
      DietPlanTrainer(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

/// Mirrors `DietPlanListItemDto`/`DietPlanDetailDto` as one class —
/// `meals` stays empty until fetched via [DietPlanRepository.getById].
class DietPlan {
  const DietPlan({
    required this.id,
    required this.name,
    required this.dailyCalories,
    required this.durationDays,
    required this.isActive,
    required this.activeMemberCount,
    this.goal,
    this.description,
    this.trainer,
    this.notes,
    this.createdAt,
    this.updatedAt,
    this.deletedAt,
    this.meals = const [],
  });

  final String id;
  final String name;
  final int? dailyCalories;
  final int durationDays;
  final bool isActive;
  final int activeMemberCount;
  final String? goal;
  final String? description;
  final DietPlanTrainer? trainer;
  final String? notes;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// Non-null means soft-deleted.
  final DateTime? deletedAt;
  final List<PlanMeal> meals;

  Map<MealType, List<PlanMeal>> get mealsByType {
    final grouped = <MealType, List<PlanMeal>>{};
    for (final m in meals) {
      (grouped[m.mealType] ??= []).add(m);
    }
    return grouped;
  }

  factory DietPlan.fromJson(Map<String, dynamic> json) => DietPlan(
        id: json['id'] as String,
        name: json['name'] as String,
        dailyCalories: json['dailyCalories'] as int?,
        durationDays: json['durationDays'] as int,
        isActive: json['isActive'] as bool? ?? true,
        activeMemberCount: json['activeMemberCount'] as int? ?? 0,
        goal: json['goal'] as String?,
        description: json['description'] as String?,
        trainer: json['trainer'] == null
            ? null
            : DietPlanTrainer.fromJson(json['trainer'] as Map<String, dynamic>),
        notes: json['notes'] as String?,
        createdAt: json['createdAt'] == null
            ? null
            : DateTime.parse(json['createdAt'] as String),
        updatedAt: json['updatedAt'] == null
            ? null
            : DateTime.parse(json['updatedAt'] as String),
        deletedAt: json['deletedAt'] == null
            ? null
            : DateTime.parse(json['deletedAt'] as String),
        meals: json['meals'] == null
            ? const []
            : (json['meals'] as List)
                .map((e) => PlanMeal.fromJson(e as Map<String, dynamic>))
                .toList(),
      );
}
