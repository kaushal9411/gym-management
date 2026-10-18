import '../../../models/diet_plan.dart';
import '../../../models/food.dart';
import '../../../repositories/diet_plan_repository.dart';

int _seq = 0;

/// One editable meal row: the food, how many servings and the note.
/// [key] is a stable identity for list diffing.
class MealDraft {
  MealDraft({
    required this.food,
    this.quantity = 1,
    this.notes,
    String? key,
  }) : key = key ?? 'm${_seq++}';

  factory MealDraft.fromPlanMeal(PlanMeal m) => MealDraft(
        food: m.food,
        quantity: m.quantity,
        notes: m.notes,
        key: m.id,
      );

  final String key;
  final Food food;
  double quantity;
  String? notes;

  bool sameAs(MealDraft o) =>
      food.id == o.food.id &&
      quantity == o.quantity &&
      (notes ?? '').trim() == (o.notes ?? '').trim();
}

/// A plan's whole meal builder held in memory while it is edited, grouped by
/// meal slot (a diet plan repeats every day, so there is no day dimension).
/// Because `PATCH /diet-plans/:id/meals` replaces the entire array, every
/// save goes through [toDrafts], which always carries every slot and every
/// row's quantity + notes - editing one slot can never wipe another.
class MealPlanDraft {
  MealPlanDraft(Map<MealType, List<MealDraft>> bySlot)
      : bySlot = {
          for (final t in MealType.values) t: [...?bySlot[t]],
        };

  factory MealPlanDraft.fromPlan(DietPlan plan) {
    final grouped = plan.mealsByType;
    return MealPlanDraft({
      for (final t in MealType.values)
        t: [
          for (final m in grouped[t] ?? const <PlanMeal>[])
            MealDraft.fromPlanMeal(m),
        ],
    });
  }

  final Map<MealType, List<MealDraft>> bySlot;

  List<MealDraft> slot(MealType t) => bySlot[t]!;

  int countOn(MealType t) => bySlot[t]!.length;

  int get total => bySlot.values.fold(0, (a, l) => a + l.length);

  /// Rows whose food was deleted after it was added; the API refuses to save
  /// a plan that still references one ("One or more selected foods do not
  /// exist"), so the editor flags them.
  int get deletedFoodCount => bySlot.values
      .expand((l) => l)
      .where((d) => d.food.deletedAt != null)
      .length;

  /// The request body list: slot order as [MealType.values], array order =
  /// the sort order inside a slot.
  List<PlanMealDraft> toDrafts() => [
        for (final t in MealType.values)
          for (final d in bySlot[t]!)
            PlanMealDraft(
              foodId: d.food.id,
              mealType: t,
              quantity: d.quantity,
              notes: (d.notes ?? '').trim().isEmpty ? null : d.notes!.trim(),
            ),
      ];

  bool sameAs(MealPlanDraft o) {
    for (final t in MealType.values) {
      final a = bySlot[t]!;
      final b = o.bySlot[t]!;
      if (a.length != b.length) return false;
      for (var i = 0; i < a.length; i++) {
        if (!a[i].sameAs(b[i])) return false;
      }
    }
    return true;
  }
}
