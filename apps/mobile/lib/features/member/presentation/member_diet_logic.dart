import 'package:flutter/material.dart';

import '../../../models/diet_plan.dart';
import '../../../models/member_diet_nutrition.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Pure helpers for the member Diet screen (kept free of widgets so they are
/// unit-testable): number formatting, per-meal colours, the water quick-add
/// maths and the selectable-day rules.

/// `1787` -> `1,787` (en-IN grouping is not needed at these magnitudes).
String groupInt(num value) {
  final negative = value < 0;
  final digits = value.abs().round().toString();
  final buf = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buf.write(',');
    buf.write(digits[i]);
  }
  return '${negative ? '-' : ''}$buf';
}

/// One decimal at most, no trailing `.0` (`72.0` -> `72`, `72.46` -> `72.5`).
String oneDecimal(double v) {
  final tenths = (v * 10).round();
  if (tenths % 10 == 0) return groupInt(tenths ~/ 10);
  final sign = tenths < 0 ? '-' : '';
  final abs = tenths.abs();
  return '$sign${groupInt(abs ~/ 10)}.${abs % 10}';
}

/// Leading date part used as the wire value of a day (`2026-10-19`).
String apiDay(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

bool sameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

const _weekdayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const _monthShort = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

String weekdayShort(DateTime d) => _weekdayShort[d.weekday - 1];
String shortDate(DateTime d) => '${d.day} ${_monthShort[d.month - 1]}';

/// Icon + accent for a meal slot.
({IconData icon, Color color}) mealStyle(MealType t) => switch (t) {
      MealType.breakfast => (
          icon: Icons.free_breakfast_rounded,
          color: TeamColors.amber,
        ),
      MealType.morningSnack => (
          icon: Icons.apple_rounded,
          color: TeamColors.green,
        ),
      MealType.lunch => (
          icon: Icons.lunch_dining_rounded,
          color: TeamColors.rose,
        ),
      MealType.eveningSnack => (
          icon: Icons.cookie_rounded,
          color: TeamColors.violet,
        ),
      MealType.dinner => (
          icon: Icons.dinner_dining_rounded,
          color: TeamColors.indigo,
        ),
      MealType.preWorkout => (
          icon: Icons.bolt_rounded,
          color: TeamColors.teal,
        ),
      MealType.postWorkout => (
          icon: Icons.fitness_center_rounded,
          color: TeamColors.fuchsia,
        ),
    };

/// Macro rows shown as growing bars (one fixed colour per nutrient).
enum DietMacro { protein, carbs, fat }

extension DietMacroX on DietMacro {
  String get label => switch (this) {
        DietMacro.protein => 'Protein',
        DietMacro.carbs => 'Carbs',
        DietMacro.fat => 'Fat',
      };

  Color get color => switch (this) {
        DietMacro.protein => TeamColors.green,
        DietMacro.carbs => TeamColors.amber,
        DietMacro.fat => TeamColors.violet,
      };

  double of(Nutrients n) => switch (this) {
        DietMacro.protein => n.protein,
        DietMacro.carbs => n.carbs,
        DietMacro.fat => n.fat,
      };
}

/// Secondary nutrients; a chip only appears when the PLAN has a real value
/// (an all-null column would otherwise read as a misleading "0").
enum DietExtra { fiber, sugar, sodium }

extension DietExtraX on DietExtra {
  String get label => switch (this) {
        DietExtra.fiber => 'Fibre',
        DietExtra.sugar => 'Sugar',
        DietExtra.sodium => 'Sodium',
      };

  String get unit => this == DietExtra.sodium ? 'mg' : 'g';

  Color get color => switch (this) {
        DietExtra.fiber => TeamColors.teal,
        DietExtra.sugar => TeamColors.rose,
        DietExtra.sodium => TeamColors.sky,
      };

  double of(Nutrients n) => switch (this) {
        DietExtra.fiber => n.fiber,
        DietExtra.sugar => n.sugar,
        DietExtra.sodium => n.sodium,
      };
}

Color insightColor(InsightTone t) => switch (t) {
      InsightTone.good => TeamColors.green,
      InsightTone.warn => TeamColors.amber,
      InsightTone.tip => TeamColors.sky,
    };

IconData insightIcon(InsightTone t) => switch (t) {
      InsightTone.good => Icons.emoji_events_rounded,
      InsightTone.warn => Icons.warning_amber_rounded,
      InsightTone.tip => Icons.lightbulb_rounded,
    };

/// The calorie figure the ring compares against: the sum of the plan's foods,
/// or the plan's own `dailyCalories` when the foods carry no calories.
double calorieDenominator(MemberDietNutrition n) =>
    n.planned.calories > 0 ? n.planned.calories : (n.calorieTarget ?? 0) * 1.0;

/// True when the plan's foods give us at least one real number to compare.
bool planHasNutrition(MemberDietNutrition n) =>
    n.planned.calories > 0 ||
    n.planned.protein > 0 ||
    n.planned.carbs > 0 ||
    n.planned.fat > 0;

/// New day total after a quick add (never below 0, capped at the API's
/// 20,000 ml limit).
int waterAfter(int current, int delta) =>
    (current + delta).clamp(0, kMaxWaterMl);

const kMaxWaterMl = 20000;

/// The selected day if it is still loggable, else today (e.g. after a refresh
/// that rolled past midnight).
DateTime resolveSelectedDay(MemberDietNutrition n, DateTime? picked) {
  if (picked != null && n.loggableDays.any((d) => sameDay(d.date, picked))) {
    return picked;
  }
  return n.today;
}
