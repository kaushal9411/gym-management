import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/diet/presentation/diet_actions.dart';
import 'package:gym_saas_mobile/features/diet/presentation/diet_plans_list_screen.dart';
import 'package:gym_saas_mobile/features/diet/presentation/diet_ui.dart';
import 'package:gym_saas_mobile/features/diet/presentation/meal_draft.dart';
import 'package:gym_saas_mobile/models/diet_plan.dart';
import 'package:gym_saas_mobile/models/diet_plan_summary.dart';
import 'package:gym_saas_mobile/models/food.dart';
import 'package:gym_saas_mobile/models/member_diet_progress.dart';
import 'package:gym_saas_mobile/repositories/diet_plan_repository.dart';

Map<String, dynamic> _food(String id, String name, {bool deleted = false}) => {
      'id': id,
      'name': name,
      'category': 'Protein',
      'servingSize': '100 g',
      'calories': 165,
      'protein': '31.00',
      'carbohydrates': '0.00',
      'fat': '3.60',
      'fiber': null,
      'sugar': '0',
      'sodium': '74',
      'notes': null,
      'isActive': true,
      'deletedAt': deleted ? '2026-04-01T00:00:00.000Z' : null,
    };

Map<String, dynamic> _meal(
  String id,
  String foodId,
  String type, {
  Object? qty = '2.50',
  String? notes,
  bool deletedFood = false,
}) =>
    {
      'id': id,
      'food': _food(foodId, 'Food $foodId', deleted: deletedFood),
      'mealType': type,
      'sortOrder': 0,
      'quantity': qty,
      'notes': notes,
    };

Map<String, dynamic> _plan({
  String id = 'p1',
  String name = 'Lean Cut',
  bool isActive = true,
  String? deletedAt,
  Object? kcal = 2000,
  Object? days = 30,
  Object? members = 3,
  String? goal = 'Fat loss',
  List<Map<String, dynamic>>? meals,
}) =>
    {
      'id': id,
      'name': name,
      'goal': goal,
      'description': 'High protein',
      'notes': 'Check weekly',
      'dailyCalories': kcal,
      'durationDays': days,
      'trainer': {'id': 't1', 'name': 'Tara'},
      'isActive': isActive,
      'activeMemberCount': members,
      'createdAt': '2026-01-01T10:00:00.000Z',
      'updatedAt': '2026-02-01T10:00:00.000Z',
      'deletedAt': deletedAt,
      'meals': meals ??
          [
            _meal('m1', 'f1', 'BREAKFAST', notes: 'Boiled'),
            _meal('m2', 'f2', 'BREAKFAST', qty: 1),
            _meal('m3', 'f3', 'POST_WORKOUT'),
          ],
    };

void main() {
  group('models parse tolerantly', () {
    test('DietPlanSummary accepts string counts and flags deleted', () {
      final s = DietPlanSummary.fromJson(
        _plan(
          kcal: '1800',
          days: '14',
          members: '2',
          deletedAt: '2026-03-01T00:00:00.000Z',
        ),
      );
      expect(s.dailyCalories, 1800);
      expect(s.durationDays, 14);
      expect(s.activeMemberCount, 2);
      expect(s.trainerName, 'Tara');
      expect(s.isDeleted, isTrue);
    });

    test('DietPlan groups meals by slot and keeps decimal-string quantities',
        () {
      final p = DietPlan.fromJson(_plan());
      expect(p.dailyCalories, 2000);
      expect(p.mealsByType[MealType.breakfast]!.length, 2);
      expect(p.mealsByType[MealType.postWorkout]!.single.quantity, 2.5);
      expect(p.mealsByType[MealType.breakfast]!.first.food.protein, 31.0);
      expect(p.isDeleted, isFalse);
    });

    test('Food accepts decimal strings and plain numbers', () {
      final f = Food.fromJson({
        ..._food('f9', 'Rice'),
        'protein': 2.7,
        'fat': '0.30',
        'calories': 130.0,
      });
      expect(f.protein, 2.7);
      expect(f.fat, 0.3);
      expect(f.calories, 130);
    });

    test('MemberDietProgress survives a Decimal-string weight', () {
      final p = MemberDietProgress.fromJson({
        'id': 'a1',
        'dietPlan': {
          'id': 'p1',
          'name': 'Lean Cut',
          'dailyCalories': 2000,
          'durationDays': 30,
          'mealTypes': ['BREAKFAST'],
        },
        'status': 'ACTIVE',
        'startDate': '2026-10-01T00:00:00.000Z',
        'endDate': null,
        'progressPercent': 40,
        'daysLogged': 4,
        'latestWeightKg': '72.50',
        'latestWaterIntakeMl': 1500,
        'dailyLogs': [
          {
            'date': '2026-10-02',
            'waterIntakeMl': 1500,
            'weightKg': '72.50',
            'mealsStatus': {'BREAKFAST': 'COMPLETED'},
          },
        ],
      });
      expect(p.latestWeightKg, 72.5);
      expect(p.dailyLogs.single.weightKg, 72.5);
    });
  });

  group('MealPlanDraft', () {
    test('round trip re-sends every slot with quantity and notes', () {
      final plan = DietPlan.fromJson(_plan());
      final draft = MealPlanDraft.fromPlan(plan);
      expect(draft.total, 3);
      final out = draft.toDrafts();
      expect(out.length, 3);
      expect(out.map((d) => d.mealType.apiValue), [
        'BREAKFAST',
        'BREAKFAST',
        'POST_WORKOUT',
      ]);
      expect(out[0].quantity, 2.5);
      expect(out[0].notes, 'Boiled');
      expect(out[1].notes, isNull);
      // The PATCH body is exactly what is stored - nothing is wiped.
      expect(out[2].toJson(), {
        'foodId': 'f3',
        'mealType': 'POST_WORKOUT',
        'quantity': 2.5,
      });
    });

    test('sameAs tracks quantity, notes and membership', () {
      final plan = DietPlan.fromJson(_plan());
      final a = MealPlanDraft.fromPlan(plan);
      final b = MealPlanDraft.fromPlan(plan);
      expect(a.sameAs(b), isTrue);
      b.slot(MealType.breakfast).first.quantity = 3;
      expect(a.sameAs(b), isFalse);
      b.slot(MealType.breakfast).first.quantity = 2.5;
      expect(a.sameAs(b), isTrue);
      b.slot(MealType.lunch).add(MealDraft(food: plan.meals.first.food));
      expect(a.sameAs(b), isFalse);
    });

    test('counts rows whose food was deleted', () {
      final plan = DietPlan.fromJson(
        _plan(meals: [_meal('m1', 'f1', 'LUNCH', deletedFood: true)]),
      );
      expect(MealPlanDraft.fromPlan(plan).deletedFoodCount, 1);
    });

    test('PlanMealDraft.fromPlanMeal keeps quantity and notes', () {
      final plan = DietPlan.fromJson(_plan());
      final d = PlanMealDraft.fromPlanMeal(plan.meals.first);
      expect(d.quantity, 2.5);
      expect(d.notes, 'Boiled');
      expect(d.foodId, 'f1');
    });
  });

  group('lifecycle actions (web DietPlanCard menu)', () {
    List<String> names({
      bool deleted = false,
      bool active = true,
      bool create = true,
      bool update = true,
      bool delete = true,
      bool restore = true,
    }) =>
        availableDietActions(
          deleted: deleted,
          active: active,
          canCreate: create,
          canUpdate: update,
          canDelete: delete,
          canRestore: restore,
        ).map((a) => a.name).toList();

    test('live plan: duplicate, deactivate, delete', () {
      expect(names(), ['duplicate', 'deactivate', 'delete']);
      expect(names(active: false), ['duplicate', 'activate', 'delete']);
    });

    test('deleted plan only offers restore', () {
      expect(names(deleted: true), ['restore']);
      expect(names(deleted: true, restore: false), isEmpty);
    });

    test('each key hides only its own action', () {
      expect(names(create: false), ['deactivate', 'delete']);
      expect(names(update: false), ['duplicate', 'delete']);
      expect(names(delete: false), ['duplicate', 'deactivate']);
      expect(
        names(create: false, update: false, delete: false, restore: false),
        isEmpty,
      );
    });
  });

  group('formatting', () {
    test('qtyLabel trims zeros', () {
      expect(qtyLabel(2), '2');
      expect(qtyLabel(1.5), '1.5');
      expect(qtyLabel(0.25), '0.25');
      expect(qtyLabel(0.1), '0.1');
    });

    test('status helpers', () {
      expect(dietStatus(deleted: true, active: true), 'Deleted');
      expect(dietStatus(deleted: false, active: false), 'Inactive');
      expect(daysLabel(1), '1 day');
      expect(daysLabel(30), '30 days');
    });
  });

  group('filterDietPlans', () {
    final all = [
      DietPlanSummary.fromJson(_plan(id: 'a', name: 'Bulk Up', goal: 'Muscle')),
      DietPlanSummary.fromJson(
        _plan(id: 'b', name: 'Lean Cut', isActive: false, days: 14),
      ),
      DietPlanSummary.fromJson(
        _plan(id: 'c', name: 'Old', deletedAt: '2026-03-01T00:00:00.000Z'),
      ),
    ];

    test('status', () {
      expect(filterDietPlans(all).length, 3);
      expect(filterDietPlans(all, status: 'active').map((p) => p.id), ['a']);
      expect(filterDietPlans(all, status: 'inactive').map((p) => p.id), ['b']);
    });

    test('search matches name or goal, or the server ids when given', () {
      expect(filterDietPlans(all, search: 'muscle').map((p) => p.id), ['a']);
      expect(filterDietPlans(all, search: 'lean').map((p) => p.id), ['b']);
      expect(
        filterDietPlans(all, search: 'whey', searchIds: {'c'}).map((p) => p.id),
        ['c'],
      );
    });

    test('sorts', () {
      expect(
        filterDietPlans(all, sort: 'name:asc').map((p) => p.id),
        ['a', 'b', 'c'],
      );
      expect(
        filterDietPlans(all, sort: 'durationDays:asc').first.id,
        'b',
      );
      expect(
        filterDietPlans(all, sort: 'name:desc').first.id,
        'c',
      );
    });
  });

  group('DietPlanRepository', () {
    test('listAll walks pages and only ever sends true flags', () async {
      final dio = Dio();
      final seen = <Map<String, dynamic>>[];
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            seen.add(Map.of(options.queryParameters));
            final page = options.queryParameters['page'] as int;
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': {
                    'items': [_plan(id: 'p$page', name: 'Plan $page')],
                    'total': 2,
                    'page': page,
                    'limit': 100,
                    'totalPages': 2,
                  },
                },
              ),
            );
          },
        ),
      );
      final repo = DietPlanRepository(dio);
      final all = await repo.listAll();
      expect(all.map((p) => p.id), ['p1', 'p2']);
      expect(seen.first['includeDeleted'], true);
      expect(seen.first['limit'], 100);

      seen.clear();
      await repo.list(isActive: false);
      expect(seen.single.containsKey('isActive'), isFalse);
      seen.clear();
      await repo.list(isActive: true, search: 'cut');
      expect(seen.single['isActive'], true);
      expect(seen.single['search'], 'cut');
    });

    test('assign sends the start as a calendar day', () async {
      final dio = Dio();
      Object? body;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            body = options.data;
            handler.resolve(Response(requestOptions: options, statusCode: 200));
          },
        ),
      );
      await DietPlanRepository(dio).assign(
        planId: 'p1',
        memberId: 'm1',
        startDate: DateTime(2026, 3, 5, 18, 30),
      );
      expect(body, {'memberId': 'm1', 'startDate': '2026-03-05'});
    });

    test('updateWith / createWith send the body as given', () async {
      final dio = Dio();
      final calls = <String>[];
      Object? body;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            calls.add('${options.method} ${options.path}');
            body = options.data;
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {'data': _plan()},
              ),
            );
          },
        ),
      );
      final repo = DietPlanRepository(dio);
      await repo.updateWith('p1', {'trainerId': null});
      expect(calls.last, 'PATCH /diet-plans/p1');
      expect(body, {'trainerId': null});
      await repo.createWith({'name': 'X', 'durationDays': 7});
      expect(calls.last, 'POST /diet-plans');
    });
  });
}
