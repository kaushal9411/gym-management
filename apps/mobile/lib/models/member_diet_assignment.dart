import 'diet_plan.dart';
import 'member_workout_progress.dart';

/// One day's entry of `dailyLogs` — the design's water glasses, weight
/// field and per-meal status pills all come from here.
class MemberDietDailyLog {
  const MemberDietDailyLog({
    required this.date,
    required this.waterIntakeMl,
    required this.weightKg,
    required this.mealsStatus,
    required this.notes,
  });

  final DateTime date;
  final int? waterIntakeMl;
  final double? weightKg;
  final Map<MealType, ExerciseProgressStatus> mealsStatus;
  final String? notes;

  factory MemberDietDailyLog.fromJson(Map<String, dynamic> json) {
    final raw = (json['mealsStatus'] as Map<String, dynamic>?) ?? const {};
    return MemberDietDailyLog(
      date: DateTime.parse(json['date'] as String),
      waterIntakeMl: json['waterIntakeMl'] as int?,
      weightKg: json['weightKg'] == null
          ? null
          : double.parse(json['weightKg'] as String),
      mealsStatus: {
        for (final entry in raw.entries)
          MealTypeX.fromApi(entry.key):
              ExerciseProgressStatusX.fromApi(entry.value as String),
      },
      notes: json['notes'] as String?,
    );
  }
}

/// Mirrors `GET /portal/diet` (null when nothing is assigned). The plan's
/// `mealTypes` drive which meal rows the Diet Log shows — the backend
/// rejects logging a meal type that isn't part of the assigned plan.
class MemberDietAssignment {
  const MemberDietAssignment({
    required this.id,
    required this.status,
    required this.startDate,
    required this.planName,
    required this.dailyCalories,
    required this.mealTypes,
    required this.dailyLogs,
  });

  final String id;
  final String status;
  final DateTime startDate;
  final String planName;
  final int? dailyCalories;
  final List<MealType> mealTypes;
  final List<MemberDietDailyLog> dailyLogs;

  MemberDietDailyLog? logFor(DateTime day) {
    for (final log in dailyLogs) {
      if (log.date.year == day.year &&
          log.date.month == day.month &&
          log.date.day == day.day) {
        return log;
      }
    }
    return null;
  }

  factory MemberDietAssignment.fromJson(Map<String, dynamic> json) {
    final plan = json['dietPlan'] as Map<String, dynamic>;
    return MemberDietAssignment(
      id: json['id'] as String,
      status: json['status'] as String,
      startDate: DateTime.parse(json['startDate'] as String),
      planName: plan['name'] as String,
      dailyCalories: plan['dailyCalories'] as int?,
      mealTypes: (plan['mealTypes'] as List)
          .map((m) => MealTypeX.fromApi(m as String))
          .toSet()
          .toList(),
      dailyLogs: (json['dailyLogs'] as List)
          .map((l) => MemberDietDailyLog.fromJson(l as Map<String, dynamic>))
          .toList(),
    );
  }
}
