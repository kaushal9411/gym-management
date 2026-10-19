import 'diet_plan.dart';
import 'member_workout_progress.dart';

/// Mirrors the additive `nutrition` block of `GET /portal/diet` (and of the
/// log response). Everything here is DERIVED by the API from the member's real
/// logs and the plan's foods: what they ate is the sum of their COMPLETED
/// meals (food nutrient x serving multiplier); foods with no nutrition data
/// contribute nothing and are counted in [MemberDietNutrition.itemsWithoutData]
/// so the UI can say so honestly. Nothing is estimated on the device.

double _d(Object? v) =>
    v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0;

double? _dn(Object? v) => v == null
    ? null
    : (v is num ? v.toDouble() : double.tryParse(v.toString()));

int _i(Object? v) =>
    v is num ? v.toInt() : int.tryParse(v?.toString() ?? '') ?? 0;

DateTime _day(Object? v) => DateTime.parse('${v ?? ''}'.substring(0, 10));

MealType _mealOf(Object? m) => MealTypeX.fromApi(
      (m as Map<String, dynamic>)['mealType'] as String? ?? '',
    );

ExerciseProgressStatus _statusOf(Object? m) => ExerciseProgressStatusX.fromApi(
      (m as Map<String, dynamic>)['status'] as String? ?? '',
    );

/// One bundle of nutrients (all totals; sodium in milligrams).
class Nutrients {
  const Nutrients({
    this.calories = 0,
    this.protein = 0,
    this.carbs = 0,
    this.fat = 0,
    this.fiber = 0,
    this.sugar = 0,
    this.sodium = 0,
  });

  static const zero = Nutrients();

  final double calories;
  final double protein;
  final double carbs;
  final double fat;
  final double fiber;
  final double sugar;
  final double sodium;

  factory Nutrients.fromJson(Object? json) {
    final m = json is Map<String, dynamic> ? json : const <String, dynamic>{};
    return Nutrients(
      calories: _d(m['calories']),
      protein: _d(m['protein']),
      carbs: _d(m['carbs']),
      fat: _d(m['fat']),
      fiber: _d(m['fiber']),
      sugar: _d(m['sugar']),
      sodium: _d(m['sodium']),
    );
  }
}

class NutritionItem {
  const NutritionItem({
    required this.name,
    required this.servingSize,
    required this.quantity,
    required this.nutrients,
    required this.hasData,
  });

  final String name;
  final String? servingSize;
  final double quantity;
  final Nutrients nutrients;

  /// False when the food has no calories/protein/carbs/fat at all.
  final bool hasData;

  factory NutritionItem.fromJson(Map<String, dynamic> json) => NutritionItem(
        name: json['name'] as String? ?? '',
        servingSize: json['servingSize'] as String?,
        quantity: _d(json['quantity']) == 0 ? 1 : _d(json['quantity']),
        nutrients: Nutrients.fromJson(json['nutrients']),
        hasData: json['hasData'] as bool? ?? true,
      );
}

class NutritionPlanMeal {
  const NutritionPlanMeal({
    required this.mealType,
    required this.nutrients,
    required this.items,
  });

  final MealType mealType;
  final Nutrients nutrients;
  final List<NutritionItem> items;

  factory NutritionPlanMeal.fromJson(Map<String, dynamic> json) =>
      NutritionPlanMeal(
        mealType: MealTypeX.fromApi(json['mealType'] as String? ?? ''),
        nutrients: Nutrients.fromJson(json['nutrients']),
        items: ((json['items'] as List?) ?? const [])
            .map((e) => NutritionItem.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class NutritionDay {
  const NutritionDay({
    required this.date,
    required this.logged,
    required this.mealsPlanned,
    required this.mealsCompleted,
    required this.mealsSkipped,
    required this.mealsPending,
    required this.allDone,
    required this.meals,
    required this.eaten,
    required this.waterMl,
    required this.weightKg,
  });

  /// Date-only (local midnight of the calendar day).
  final DateTime date;

  /// Any meal marked done/skipped, or water/weight saved, that day.
  final bool logged;
  final int mealsPlanned;
  final int mealsCompleted;
  final int mealsSkipped;
  final int mealsPending;
  final bool allDone;
  final Map<MealType, ExerciseProgressStatus> meals;
  final Nutrients eaten;
  final int? waterMl;
  final double? weightKg;

  ExerciseProgressStatus statusOf(MealType t) =>
      meals[t] ?? ExerciseProgressStatus.pending;

  double get completion => mealsPlanned > 0 ? mealsCompleted / mealsPlanned : 0;

  factory NutritionDay.fromJson(Map<String, dynamic> json) => NutritionDay(
        date: _day(json['date']),
        logged: json['logged'] as bool? ?? false,
        mealsPlanned: _i(json['mealsPlanned']),
        mealsCompleted: _i(json['mealsCompleted']),
        mealsSkipped: _i(json['mealsSkipped']),
        mealsPending: _i(json['mealsPending']),
        allDone: json['allDone'] as bool? ?? false,
        meals: {
          for (final m in (json['meals'] as List?) ?? const [])
            _mealOf(m): _statusOf(m),
        },
        eaten: Nutrients.fromJson(json['eaten']),
        waterMl: json['waterMl'] == null ? null : _i(json['waterMl']),
        weightKg: _dn(json['weightKg']),
      );
}

class NutritionWeek {
  const NutritionWeek({
    required this.windowDays,
    required this.countedDays,
    required this.loggedDays,
    required this.mealsPlanned,
    required this.mealsCompleted,
    required this.mealsSkipped,
    required this.adherencePct,
    required this.avgEaten,
    required this.avgDays,
    required this.avgWaterMl,
    required this.waterDays,
  });

  final int windowDays;
  final int countedDays;
  final int loggedDays;
  final int mealsPlanned;
  final int mealsCompleted;
  final int mealsSkipped;
  final int? adherencePct;
  final Nutrients? avgEaten;

  /// Settled logged days that [avgEaten] averages.
  final int avgDays;
  final int? avgWaterMl;
  final int waterDays;

  factory NutritionWeek.fromJson(Map<String, dynamic> json) => NutritionWeek(
        windowDays: _i(json['windowDays']),
        countedDays: _i(json['countedDays']),
        loggedDays: _i(json['loggedDays']),
        mealsPlanned: _i(json['mealsPlanned']),
        mealsCompleted: _i(json['mealsCompleted']),
        mealsSkipped: _i(json['mealsSkipped']),
        adherencePct:
            json['adherencePct'] == null ? null : _i(json['adherencePct']),
        avgEaten: json['avgEaten'] == null
            ? null
            : Nutrients.fromJson(json['avgEaten']),
        avgDays: _i(json['avgDays']),
        avgWaterMl: json['avgWaterMl'] == null ? null : _i(json['avgWaterMl']),
        waterDays: _i(json['waterDays']),
      );
}

enum InsightTone { good, warn, tip }

/// One rule-based "what to do next" card, computed by the API so web and
/// mobile show identical advice.
class DietInsight {
  const DietInsight({
    required this.id,
    required this.tone,
    required this.title,
    required this.body,
  });

  final String id;
  final InsightTone tone;
  final String title;
  final String body;

  factory DietInsight.fromJson(Map<String, dynamic> json) => DietInsight(
        id: json['id'] as String? ?? '',
        tone: switch (json['tone']) {
          'good' => InsightTone.good,
          'warn' => InsightTone.warn,
          _ => InsightTone.tip,
        },
        title: json['title'] as String? ?? '',
        body: json['body'] as String? ?? '',
      );
}

class NutritionWeightTrend {
  const NutritionWeightTrend({
    required this.firstDate,
    required this.firstKg,
    required this.lastDate,
    required this.lastKg,
    required this.deltaKg,
    required this.entries,
  });

  final DateTime firstDate;
  final double firstKg;
  final DateTime lastDate;
  final double lastKg;
  final double deltaKg;
  final int entries;
}

class MemberDietNutrition {
  const MemberDietNutrition({
    required this.today,
    required this.planStarted,
    required this.planned,
    required this.calorieTarget,
    required this.waterTargetMl,
    required this.waterTargetIsDefault,
    required this.itemsTotal,
    required this.itemsWithoutData,
    required this.meals,
    required this.days,
    required this.week,
    required this.streakDays,
    required this.weight,
    required this.insights,
  });

  /// The member's branch-local calendar date (date-only) — the day all
  /// logging is done against, instead of the device clock.
  final DateTime today;
  final bool planStarted;

  /// Per-day plan total (sum of every plan meal).
  final Nutrients planned;
  final int? calorieTarget;
  final int waterTargetMl;

  /// True when the plan has no water target and the app default is used.
  final bool waterTargetIsDefault;
  final int itemsTotal;
  final int itemsWithoutData;
  final List<NutritionPlanMeal> meals;

  /// Oldest first, ending today (up to 14 days, never before the plan start).
  final List<NutritionDay> days;
  final NutritionWeek week;
  final int streakDays;
  final NutritionWeightTrend? weight;
  final List<DietInsight> insights;

  /// The last 7 days — the days a member may log.
  List<NutritionDay> get loggableDays =>
      days.length <= 7 ? days : days.sublist(days.length - 7);

  NutritionDay? dayFor(DateTime d) {
    for (final x in days) {
      if (x.date.year == d.year &&
          x.date.month == d.month &&
          x.date.day == d.day) {
        return x;
      }
    }
    return null;
  }

  NutritionDay? get todayEntry => dayFor(today);

  factory MemberDietNutrition.fromJson(Map<String, dynamic> json) {
    final w = json['weight'] as Map<String, dynamic>?;
    return MemberDietNutrition(
      today: _day(json['today']),
      planStarted: json['planStarted'] as bool? ?? true,
      planned: Nutrients.fromJson(json['planned']),
      calorieTarget:
          json['calorieTarget'] == null ? null : _i(json['calorieTarget']),
      waterTargetMl:
          _i(json['waterTargetMl']) == 0 ? 2000 : _i(json['waterTargetMl']),
      waterTargetIsDefault: json['waterTargetIsDefault'] as bool? ?? true,
      itemsTotal: _i(json['itemsTotal']),
      itemsWithoutData: _i(json['itemsWithoutData']),
      meals: ((json['meals'] as List?) ?? const [])
          .map((e) => NutritionPlanMeal.fromJson(e as Map<String, dynamic>))
          .toList(),
      days: ((json['days'] as List?) ?? const [])
          .map((e) => NutritionDay.fromJson(e as Map<String, dynamic>))
          .toList(),
      week: NutritionWeek.fromJson(
        (json['week'] as Map<String, dynamic>?) ?? const {},
      ),
      streakDays: _i(json['streakDays']),
      weight: w == null
          ? null
          : NutritionWeightTrend(
              firstDate: _day((w['first'] as Map<String, dynamic>)['date']),
              firstKg: _d((w['first'] as Map<String, dynamic>)['kg']),
              lastDate: _day((w['last'] as Map<String, dynamic>)['date']),
              lastKg: _d((w['last'] as Map<String, dynamic>)['kg']),
              deltaKg: _d(w['deltaKg']),
              entries: _i(w['entries']),
            ),
      insights: ((json['insights'] as List?) ?? const [])
          .map((e) => DietInsight.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
