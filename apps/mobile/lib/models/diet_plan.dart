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
  });

  final String id;
  final Food food;
  final MealType mealType;

  factory PlanMeal.fromJson(Map<String, dynamic> json) => PlanMeal(
        id: json['id'] as String,
        food: Food.fromJson(json['food'] as Map<String, dynamic>),
        mealType: MealTypeX.fromApi(json['mealType'] as String),
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
    this.meals = const [],
  });

  final String id;
  final String name;
  final int? dailyCalories;
  final int durationDays;
  final bool isActive;
  final int activeMemberCount;
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
        meals: json['meals'] == null
            ? const []
            : (json['meals'] as List)
                .map((e) => PlanMeal.fromJson(e as Map<String, dynamic>))
                .toList(),
      );
}
