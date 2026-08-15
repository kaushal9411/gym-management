import 'diet_plan.dart';
import 'member_workout_progress.dart';

/// One `dailyLogs[]` entry (`GET /diet-plans/members/:memberId` → `current`).
class DietDailyLog {
  const DietDailyLog({
    required this.date,
    required this.waterIntakeMl,
    required this.weightKg,
    required this.mealsStatus,
  });

  final String date;
  final int? waterIntakeMl;
  final double? weightKg;
  final Map<MealType, ExerciseProgressStatus> mealsStatus;

  factory DietDailyLog.fromJson(Map<String, dynamic> json) => DietDailyLog(
        date: json['date'] as String,
        waterIntakeMl: json['waterIntakeMl'] as int?,
        weightKg: (json['weightKg'] as num?)?.toDouble(),
        mealsStatus: (json['mealsStatus'] as Map<String, dynamic>? ?? {}).map(
          (k, v) => MapEntry(
            MealTypeX.fromApi(k),
            ExerciseProgressStatusX.fromApi(v as String),
          ),
        ),
      );
}

/// Mirrors `MemberDietPlanDto` (`GET /diet-plans/members/:memberId` →
/// `current`).
class MemberDietProgress {
  const MemberDietProgress({
    required this.id,
    required this.dietPlanId,
    required this.dietPlanName,
    required this.dailyCalories,
    required this.durationDays,
    required this.mealTypes,
    required this.status,
    required this.startDate,
    required this.endDate,
    required this.progressPercent,
    required this.daysLogged,
    required this.latestWeightKg,
    required this.latestWaterIntakeMl,
    required this.dailyLogs,
  });

  final String id;
  final String dietPlanId;
  final String dietPlanName;
  final int? dailyCalories;
  final int durationDays;
  final List<MealType> mealTypes;
  final String status;
  final DateTime startDate;
  final DateTime? endDate;
  final int progressPercent;
  final int daysLogged;
  final double? latestWeightKg;
  final int? latestWaterIntakeMl;
  final List<DietDailyLog> dailyLogs;

  DietDailyLog? logFor(DateTime date) {
    final key = date.toIso8601String().substring(0, 10);
    for (final log in dailyLogs) {
      if (log.date.startsWith(key)) return log;
    }
    return null;
  }

  factory MemberDietProgress.fromJson(Map<String, dynamic> json) {
    final plan = json['dietPlan'] as Map<String, dynamic>;
    return MemberDietProgress(
      id: json['id'] as String,
      dietPlanId: plan['id'] as String,
      dietPlanName: plan['name'] as String,
      dailyCalories: plan['dailyCalories'] as int?,
      durationDays: plan['durationDays'] as int? ?? 0,
      mealTypes: ((plan['mealTypes'] as List?) ?? const [])
          .map((e) => MealTypeX.fromApi(e as String))
          .toList(),
      status: json['status'] as String,
      startDate: DateTime.parse(json['startDate'] as String),
      endDate: json['endDate'] == null
          ? null
          : DateTime.parse(json['endDate'] as String),
      progressPercent: json['progressPercent'] as int? ?? 0,
      daysLogged: json['daysLogged'] as int? ?? 0,
      latestWeightKg: (json['latestWeightKg'] as num?)?.toDouble(),
      latestWaterIntakeMl: json['latestWaterIntakeMl'] as int?,
      dailyLogs: ((json['dailyLogs'] as List?) ?? const [])
          .map((e) => DietDailyLog.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
