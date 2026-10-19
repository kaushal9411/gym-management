import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_diet_logic.dart';
import 'package:gym_saas_mobile/models/diet_plan.dart';
import 'package:gym_saas_mobile/models/member_diet_assignment.dart';
import 'package:gym_saas_mobile/models/member_diet_nutrition.dart';
import 'package:gym_saas_mobile/models/member_workout_progress.dart';

Map<String, dynamic> _day(
  String date, {
  int done = 0,
  int skipped = 0,
  double kcal = 0,
  int? water,
  Object? weight,
}) =>
    {
      'date': date,
      'logged': done + skipped > 0 || water != null || weight != null,
      'mealsPlanned': 3,
      'mealsCompleted': done,
      'mealsSkipped': skipped,
      'mealsPending': 3 - done - skipped,
      'allDone': done == 3,
      'meals': [
        {'mealType': 'BREAKFAST', 'status': done > 0 ? 'COMPLETED' : 'PENDING'},
        {'mealType': 'LUNCH', 'status': skipped > 0 ? 'SKIPPED' : 'PENDING'},
        {'mealType': 'DINNER', 'status': 'PENDING'},
      ],
      'eaten': {
        'calories': kcal,
        'protein': kcal / 20,
        'carbs': 0,
        'fat': 0,
        'fiber': 0,
        'sugar': 0,
        'sodium': 0,
      },
      'waterMl': water,
      'weightKg': weight,
    };

Map<String, dynamic> _json({List<Map<String, dynamic>>? days}) => {
      'id': 'a1',
      'status': 'ACTIVE',
      'startDate': '2026-10-01',
      'endDate': null,
      'trainerRemarks': 'Eat slowly',
      'dietPlan': {
        'id': 'p1',
        'name': 'Lean plan',
        'dailyCalories': 1800,
        'durationDays': 28,
        'mealTypes': ['BREAKFAST', 'BREAKFAST', 'LUNCH', 'DINNER'],
      },
      'dailyLogs': [
        {
          'date': '2026-10-19',
          'waterIntakeMl': 500,
          'weightKg': '72.40', // Decimal arrives as a string
          'mealsStatus': {'BREAKFAST': 'COMPLETED'},
          'notes': 'felt good',
        },
      ],
      'nutrition': {
        'today': '2026-10-19',
        'planStarted': true,
        'planned': {
          'calories': 1500.5,
          'protein': 90,
          'carbs': 180,
          'fat': 45,
          'fiber': 0,
          'sugar': 0,
          'sodium': 0,
        },
        'calorieTarget': 1800,
        'waterTargetMl': 2000,
        'waterTargetIsDefault': true,
        'itemsTotal': 4,
        'itemsWithoutData': 1,
        'meals': [
          {
            'mealType': 'BREAKFAST',
            'nutrients': {'calories': 400, 'protein': 20},
            'items': [
              {
                'name': 'Oats',
                'servingSize': '40 g',
                'quantity': 1.5,
                'nutrients': {'calories': 150.5},
                'hasData': true,
              },
              {
                'name': 'Mystery',
                'servingSize': null,
                'quantity': 1,
                'nutrients': <String, dynamic>{},
                'hasData': false,
              },
            ],
          },
        ],
        'days': days ??
            [
              for (var d = 10; d <= 19; d++)
                _day(
                  '2026-10-$d',
                  done: d == 19 ? 1 : 0,
                  kcal: d == 19 ? 400 : 0,
                ),
            ],
        'week': {
          'windowDays': 7,
          'countedDays': 6,
          'loggedDays': 1,
          'mealsPlanned': 18,
          'mealsCompleted': 1,
          'mealsSkipped': 0,
          'adherencePct': 6,
          'avgEaten': {'calories': 400, 'protein': 20},
          'avgWaterMl': 500,
          'avgDays': 1,
          'waterDays': 1,
        },
        'streakDays': 0,
        'weight': {
          'first': {'date': '2026-10-12', 'kg': 73.1},
          'last': {'date': '2026-10-19', 'kg': 72.4},
          'deltaKg': -0.7,
          'entries': 2,
        },
        'insights': [
          {
            'id': 'water-low',
            'tone': 'warn',
            'title': 'Water is averaging 500 ml a day',
            'body': 'Keep a bottle nearby.',
          },
          {'id': 'x', 'tone': 'weird', 'title': 'T', 'body': 'B'},
        ],
      },
    };

void main() {
  group('MemberDietAssignment + nutrition parsing', () {
    final a = MemberDietAssignment.fromJson(_json());
    final n = a.nutrition!;

    test('keeps the existing fields and adds the new ones', () {
      expect(a.planName, 'Lean plan');
      expect(a.dailyCalories, 1800);
      expect(
        a.mealTypes,
        [MealType.breakfast, MealType.lunch, MealType.dinner],
      );
      expect(a.durationDays, 28);
      expect(a.trainerRemarks, 'Eat slowly');
      // weightKg is a Decimal string on the wire.
      expect(a.logFor(DateTime(2026, 10, 19))!.weightKg, 72.4);
      expect(a.logFor(DateTime(2026, 10, 19))!.notes, 'felt good');
    });

    test('parses nutrients tolerantly (ints, doubles, missing keys)', () {
      expect(n.planned.calories, 1500.5);
      expect(n.planned.protein, 90.0);
      expect(n.meals.single.nutrients.protein, 20);
      expect(n.meals.single.nutrients.fat, 0); // missing -> 0
      expect(n.meals.single.items.first.nutrients.calories, 150.5);
      expect(n.meals.single.items.last.hasData, isFalse);
      expect(n.itemsWithoutData, 1);
    });

    test('days, today and the loggable window', () {
      expect(n.today, DateTime(2026, 10, 19));
      expect(n.days.length, 10);
      expect(n.loggableDays.length, 7);
      expect(n.loggableDays.last.date, DateTime(2026, 10, 19));
      expect(n.loggableDays.first.date, DateTime(2026, 10, 13));
      final t = n.todayEntry!;
      expect(t.mealsCompleted, 1);
      expect(t.statusOf(MealType.breakfast), ExerciseProgressStatus.completed);
      expect(t.statusOf(MealType.lunch), ExerciseProgressStatus.pending);
      expect(t.statusOf(MealType.preWorkout), ExerciseProgressStatus.pending);
      expect(t.completion, closeTo(1 / 3, 1e-9));
      expect(n.dayFor(DateTime(2026, 9, 1)), isNull);
    });

    test('week, weight trend, defaults and advice', () {
      expect(n.week.adherencePct, 6);
      expect(n.week.avgEaten!.calories, 400);
      expect(n.week.avgWaterMl, 500);
      expect(n.waterTargetIsDefault, isTrue);
      expect(n.weight!.deltaKg, -0.7);
      expect(n.weight!.firstDate, DateTime(2026, 10, 12));
      expect(n.insights.first.tone, InsightTone.warn);
      expect(n.insights.last.tone, InsightTone.tip); // unknown tone -> tip
    });

    test('an older API without the nutrition block still parses', () {
      final old = _json()..remove('nutrition');
      final m = MemberDietAssignment.fromJson(old);
      expect(m.nutrition, isNull);
      expect(m.planName, 'Lean plan');
    });

    test('empty week / no averages parse as nulls', () {
      final j = jsonDecode(jsonEncode(_json())) as Map<String, dynamic>;
      (j['nutrition'] as Map<String, dynamic>)['week'] = {
        'windowDays': 0,
        'countedDays': 0,
        'loggedDays': 0,
        'mealsPlanned': 0,
        'mealsCompleted': 0,
        'mealsSkipped': 0,
        'adherencePct': null,
        'avgEaten': null,
        'avgWaterMl': null,
        'waterDays': 0,
      };
      (j['nutrition'] as Map<String, dynamic>)['weight'] = null;
      final m = MemberDietAssignment.fromJson(j).nutrition!;
      expect(m.week.adherencePct, isNull);
      expect(m.week.avgEaten, isNull);
      expect(m.week.avgWaterMl, isNull);
      expect(m.weight, isNull);
    });
  });

  group('diet logic helpers', () {
    final n = MemberDietAssignment.fromJson(_json()).nutrition!;

    test('groupInt / oneDecimal', () {
      expect(groupInt(1787), '1,787');
      expect(groupInt(999.6), '1,000');
      expect(groupInt(0), '0');
      expect(groupInt(1234567), '1,234,567');
      expect(oneDecimal(72.0), '72');
      expect(oneDecimal(72.46), '72.5');
      expect(oneDecimal(1500.5), '1,500.5');
    });

    test('apiDay / sameDay / labels', () {
      expect(apiDay(DateTime(2026, 3, 5)), '2026-03-05');
      expect(sameDay(DateTime(2026, 3, 5, 22), DateTime(2026, 3, 5)), isTrue);
      expect(shortDate(DateTime(2026, 10, 19)), '19 Oct');
      expect(weekdayShort(DateTime(2026, 10, 19)), 'Mon');
    });

    test('waterAfter never goes below 0 or above the API cap', () {
      expect(waterAfter(0, -250), 0);
      expect(waterAfter(500, 250), 750);
      expect(waterAfter(19900, 500), kMaxWaterMl);
    });

    test('calorie denominator prefers the plan foods, then the target', () {
      expect(calorieDenominator(n), 1500.5);
      final noFoods = MemberDietAssignment.fromJson(
        _json()
          ..['nutrition'] = {
            ...(_json()['nutrition'] as Map<String, dynamic>),
            'planned': <String, dynamic>{},
          },
      ).nutrition!;
      expect(calorieDenominator(noFoods), 1800);
      expect(planHasNutrition(noFoods), isFalse);
      expect(planHasNutrition(n), isTrue);
    });

    test('resolveSelectedDay falls back to today for an unloggable pick', () {
      expect(resolveSelectedDay(n, null), n.today);
      expect(
        resolveSelectedDay(n, DateTime(2026, 10, 15)),
        DateTime(2026, 10, 15),
      );
      // Older than 7 days -> today.
      expect(resolveSelectedDay(n, DateTime(2026, 10, 10)), n.today);
    });

    test('macro / extra accessors read the right nutrient', () {
      const x = Nutrients(
        calories: 1,
        protein: 2,
        carbs: 3,
        fat: 4,
        fiber: 5,
        sugar: 6,
        sodium: 7,
      );
      expect(DietMacro.protein.of(x), 2);
      expect(DietMacro.carbs.of(x), 3);
      expect(DietMacro.fat.of(x), 4);
      expect(DietExtra.fiber.of(x), 5);
      expect(DietExtra.sugar.of(x), 6);
      expect(DietExtra.sodium.of(x), 7);
      expect(DietExtra.sodium.unit, 'mg');
      expect(DietExtra.fiber.unit, 'g');
    });
  });
}
