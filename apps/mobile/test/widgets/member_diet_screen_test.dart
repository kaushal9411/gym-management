import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_diet_screen.dart';
import 'package:gym_saas_mobile/models/diet_plan.dart';
import 'package:gym_saas_mobile/models/member_diet_assignment.dart';
import 'package:gym_saas_mobile/models/member_workout_progress.dart';
import 'package:gym_saas_mobile/repositories/member_portal_repository.dart';

String _iso(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

DateTime _daysAgo(int n) {
  final t = DateTime.now();
  return DateTime(t.year, t.month, t.day - n);
}

/// Per-meal plan numbers (so eaten kcal is easy to verify by hand).
const _plan = {
  'BREAKFAST': (cal: 400.0, protein: 20.0, carbs: 50.0, fat: 10.0),
  'LUNCH': (cal: 600.0, protein: 40.0, carbs: 70.0, fat: 20.0),
  'DINNER': (cal: 500.0, protein: 30.0, carbs: 60.0, fat: 15.0),
};

Map<String, dynamic> _nutrients(double c, double p, double cb, double f) => {
      'calories': c,
      'protein': p,
      'carbs': cb,
      'fat': f,
      'fiber': 0,
      'sugar': 0,
      'sodium': 0,
    };

/// In-memory stand-in for the diet endpoints: keeps statuses / water / weight
/// per day and regenerates the whole payload (incl. the `nutrition` block)
/// the way the API would.
class _Repo extends Fake implements MemberPortalRepository {
  _Repo({
    this.fiber = 0.0,
    this.itemsWithoutData = 0,
    this.assigned = true,
    this.withNutrition = true,
    this.startDaysAgo = 20,
    this.insights = const [],
  });

  final double fiber;
  final int itemsWithoutData;
  final bool assigned;
  final bool withNutrition;
  final int startDaysAgo;
  final List<Map<String, dynamic>> insights;

  final status = <String, Map<String, String>>{};
  final water = <String, int>{};
  final weight = <String, double>{};
  final notes = <String, String>{};
  final calls = <Map<String, Object?>>[];
  Object? failNext;

  @override
  Future<MemberDietAssignment?> diet() async =>
      assigned ? MemberDietAssignment.fromJson(_payload()) : null;

  @override
  Future<MemberDietAssignment> logDiet({
    required String assignmentId,
    required DateTime date,
    int? waterIntakeMl,
    double? weightKg,
    Map<MealType, ExerciseProgressStatus>? mealsStatus,
    String? notes,
  }) async {
    calls.add({
      'date': _iso(date),
      'water': waterIntakeMl,
      'weight': weightKg,
      'notes': notes,
      'meals': mealsStatus == null
          ? null
          : {
              for (final e in mealsStatus.entries)
                e.key.apiValue: e.value.apiValue,
            },
    });
    if (failNext != null) {
      final e = failNext!;
      failNext = null;
      throw e;
    }
    final k = _iso(date);
    if (waterIntakeMl != null) water[k] = waterIntakeMl;
    if (weightKg != null) weight[k] = weightKg;
    if (notes != null) this.notes[k] = notes;
    if (mealsStatus != null) {
      final m = status.putIfAbsent(k, () => {});
      for (final e in mealsStatus.entries) {
        m[e.key.apiValue] = e.value.apiValue;
      }
    }
    return MemberDietAssignment.fromJson(_payload());
  }

  Map<String, dynamic> _day(DateTime d) {
    final k = _iso(d);
    final st = status[k] ?? {};
    final meals = [
      for (final t in _plan.keys) {'mealType': t, 'status': st[t] ?? 'PENDING'},
    ];
    final done = [
      for (final t in _plan.keys)
        if (st[t] == 'COMPLETED') t,
    ];
    double sum(double Function(dynamic) f) =>
        done.fold(0.0, (a, t) => a + f(_plan[t]));
    final skipped = st.values.where((s) => s == 'SKIPPED').length;
    return {
      'date': k,
      'logged': done.isNotEmpty ||
          skipped > 0 ||
          water.containsKey(k) ||
          weight.containsKey(k),
      'mealsPlanned': 3,
      'mealsCompleted': done.length,
      'mealsSkipped': skipped,
      'mealsPending': 3 - done.length - skipped,
      'allDone': done.length == 3,
      'meals': meals,
      'eaten': _nutrients(
        sum((r) => r.cal as double),
        sum((r) => r.protein as double),
        sum((r) => r.carbs as double),
        sum((r) => r.fat as double),
      ),
      'waterMl': water[k],
      'weightKg': weight[k],
    };
  }

  Map<String, dynamic> _payload() {
    final today = _daysAgo(0);
    final days = [
      for (var i = 13; i >= 0; i--)
        if (i <= startDaysAgo) _day(_daysAgo(i)),
    ];
    final tk = _iso(today);
    final planned = _nutrients(1500, 90, 180, 45);
    planned['fiber'] = fiber;
    final json = {
      'id': 'a1',
      'status': 'ACTIVE',
      'startDate': _iso(_daysAgo(startDaysAgo)),
      'endDate': null,
      'trainerRemarks': null,
      'dietPlan': {
        'id': 'p1',
        'name': 'Lean plan',
        'dailyCalories': 1800,
        'durationDays': 28,
        'mealTypes': _plan.keys.toList(),
      },
      'dailyLogs': [
        for (final k in {...status.keys, ...water.keys, ...weight.keys})
          {
            'date': k,
            'waterIntakeMl': water[k],
            'weightKg': weight[k]?.toStringAsFixed(2),
            'mealsStatus': status[k] ?? {},
            'notes': notes[k],
          },
      ],
      if (withNutrition)
        'nutrition': {
          'today': tk,
          'planStarted': startDaysAgo >= 0,
          'planned': planned,
          'calorieTarget': 1800,
          'waterTargetMl': 2000,
          'waterTargetIsDefault': true,
          'itemsTotal': 9,
          'itemsWithoutData': itemsWithoutData,
          'meals': [
            for (final e in _plan.entries)
              {
                'mealType': e.key,
                'nutrients': _nutrients(
                  e.value.cal,
                  e.value.protein,
                  e.value.carbs,
                  e.value.fat,
                ),
                'items': [
                  {
                    'name': '${e.key} item',
                    'servingSize': '1 bowl',
                    'quantity': 1,
                    'nutrients': _nutrients(
                      e.value.cal,
                      e.value.protein,
                      e.value.carbs,
                      e.value.fat,
                    ),
                    'hasData': true,
                  },
                ],
              },
          ],
          'days': days,
          'week': {
            'windowDays': 7,
            'countedDays': 6,
            'loggedDays': 0,
            'mealsPlanned': 18,
            'mealsCompleted': 0,
            'mealsSkipped': 0,
            'adherencePct': 0,
            'avgEaten': null,
            'avgWaterMl': null,
            'waterDays': 0,
          },
          'streakDays': 2,
          'weight': null,
          'insights': insights,
        },
    };
    return json;
  }
}

Future<void> settle(WidgetTester t) async {
  await t.pump();
  await t.pump(const Duration(seconds: 3));
}

void main() {
  late _Repo repo;

  setUp(() {
    final g = GetIt.instance;
    if (g.isRegistered<MemberPortalRepository>()) {
      g.unregister<MemberPortalRepository>();
    }
  });

  Future<void> pumpScreen(
    WidgetTester t,
    _Repo r, {
    Size size = const Size(560, 900),
  }) async {
    repo = r;
    GetIt.instance.registerSingleton<MemberPortalRepository>(r);
    t.view.physicalSize = size * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      const MaterialApp(home: Scaffold(body: MemberDietScreen())),
    );
    await settle(t);
  }

  Future<void> tapKey(WidgetTester t, String key) async {
    final f = find.byKey(ValueKey(key));
    await Scrollable.ensureVisible(t.element(f), alignment: 0.5);
    await t.pump();
    await t.tap(f);
    await t.pump();
    await t.pump(const Duration(seconds: 2));
  }

  String richText(WidgetTester t, String key) {
    final w = t.widget(find.byKey(ValueKey(key)));
    if (w is Text) return w.textSpan?.toPlainText() ?? w.data ?? '';
    throw StateError('not a Text');
  }

  testWidgets('shows the plan, the ring, macro bars and every meal card',
      (t) async {
    await pumpScreen(t, _Repo());
    expect(find.text('Lean plan'), findsOneWidget);
    expect(find.byKey(const ValueKey('diet-calorie-ring')), findsOneWidget);
    expect(find.byKey(const ValueKey('diet-hero-ring')), findsOneWidget);
    for (final m in ['BREAKFAST', 'LUNCH', 'DINNER']) {
      expect(find.byKey(ValueKey('diet-meal-$m')), findsOneWidget);
    }
    // Nothing eaten yet: planned macros are shown against 0.
    await Scrollable.ensureVisible(
      t.element(find.byKey(const ValueKey('diet-macro-protein'))),
    );
    await t.pump();
    expect(richText(t, 'diet-macro-protein'), '0 / 90 g');
    expect(richText(t, 'diet-macro-carbs'), '0 / 180 g');
    expect(richText(t, 'diet-macro-fat'), '0 / 45 g');
    expect(richText(t, 'diet-kcal-left'), contains('1,500 kcal'));
    // Fibre/sugar/sodium chips are hidden when the plan has no values for them.
    expect(find.byKey(const ValueKey('diet-extra-fiber')), findsNothing);
    expect(find.byKey(const ValueKey('diet-extra-sodium')), findsNothing);
    // No data-gap note when every food has data.
    expect(find.byKey(const ValueKey('diet-data-gap')), findsNothing);
    expect(t.takeException(), isNull);
  });

  testWidgets('Done adds the meal to what was eaten; Undo takes it away',
      (t) async {
    await pumpScreen(t, _Repo());
    await tapKey(t, 'meal-done-LUNCH');
    expect(repo.calls.single['date'], _iso(DateTime.now()));
    expect(repo.calls.single['meals'], {'LUNCH': 'COMPLETED'});
    expect(find.text('Done'), findsWidgets);
    // 600 kcal eaten, 900 left of 1500; protein 40 of 90.
    expect(richText(t, 'diet-kcal-left'), contains('900 kcal'));
    expect(richText(t, 'diet-macro-protein'), '40 / 90 g');
    expect(find.byKey(const ValueKey('meal-undo-LUNCH')), findsOneWidget);
    expect(find.byKey(const ValueKey('meal-done-LUNCH')), findsNothing);

    await tapKey(t, 'meal-undo-LUNCH');
    expect(repo.calls.last['meals'], {'LUNCH': 'PENDING'});
    expect(richText(t, 'diet-macro-protein'), '0 / 90 g');
    expect(find.byKey(const ValueKey('meal-done-LUNCH')), findsOneWidget);
  });

  testWidgets('Skip logs SKIPPED and adds nothing to the intake', (t) async {
    await pumpScreen(t, _Repo());
    await tapKey(t, 'meal-skip-DINNER');
    expect(repo.calls.single['meals'], {'DINNER': 'SKIPPED'});
    expect(find.text('Skipped'), findsOneWidget);
    expect(richText(t, 'diet-macro-protein'), '0 / 90 g');
  });

  testWidgets('water quick adds send the new absolute total', (t) async {
    await pumpScreen(t, _Repo());
    await tapKey(t, 'water-add-250');
    expect(repo.calls.last['water'], 250);
    await tapKey(t, 'water-add-500');
    expect(repo.calls.last['water'], 750);
    await tapKey(t, 'water-undo');
    expect(repo.calls.last['water'], 500);

    await t.enterText(find.byKey(const ValueKey('water-custom')), '300');
    await tapKey(t, 'water-add-custom');
    expect(repo.calls.last['water'], 800);
    expect(find.textContaining('general default'), findsWidgets);
    expect(find.textContaining('no water target'), findsOneWidget);
  });

  testWidgets('picking a previous day logs against that day', (t) async {
    await pumpScreen(t, _Repo());
    final yesterday = _daysAgo(1);
    await tapKey(t, 'diet-day-${_iso(yesterday)}');
    await tapKey(t, 'meal-done-BREAKFAST');
    expect(repo.calls.single['date'], _iso(yesterday));
    // Today stays untouched.
    expect(repo.status[_iso(DateTime.now())], isNull);
    expect(richText(t, 'diet-macro-protein'), '20 / 90 g');
  });

  testWidgets('only the last 7 days can be picked', (t) async {
    await pumpScreen(t, _Repo());
    for (var i = 0; i < 7; i++) {
      expect(
        find.byKey(ValueKey('diet-day-${_iso(_daysAgo(i))}')),
        findsOneWidget,
        reason: '$i days ago',
      );
    }
    expect(
      find.byKey(ValueKey('diet-day-${_iso(_daysAgo(7))}')),
      findsNothing,
    );
  });

  testWidgets('weight and a note save together; invalid weight is rejected',
      (t) async {
    await pumpScreen(t, _Repo());
    await t.enterText(find.byKey(const ValueKey('diet-weight')), '900');
    await tapKey(t, 'diet-weight-save');
    expect(find.text('Enter a weight between 0 and 500 kg'), findsOneWidget);
    expect(repo.calls, isEmpty);

    await t.enterText(find.byKey(const ValueKey('diet-weight')), '72.4');
    await t.enterText(find.byKey(const ValueKey('diet-notes')), 'ate well');
    await tapKey(t, 'diet-weight-save');
    expect(repo.calls.single['weight'], 72.4);
    expect(repo.calls.single['notes'], 'ate well');
    expect(repo.calls.single['date'], _iso(DateTime.now()));
  });

  testWidgets('an API error is shown and the controls recover', (t) async {
    final r = _Repo()
      ..failNext = ApiException(message: 'Slow down', statusCode: 429);
    await pumpScreen(t, r);
    await tapKey(t, 'meal-done-BREAKFAST');
    expect(find.text('Slow down'), findsOneWidget);
    // Still pending; retry works.
    await tapKey(t, 'meal-done-BREAKFAST');
    expect(repo.calls.length, 2);
    expect(find.byKey(const ValueKey('meal-undo-BREAKFAST')), findsOneWidget);
  });

  testWidgets('fibre chip and the no-data note appear only when real',
      (t) async {
    await pumpScreen(t, _Repo(fiber: 25.0, itemsWithoutData: 2));
    await Scrollable.ensureVisible(
      t.element(find.byKey(const ValueKey('diet-extra-fiber'))),
    );
    await t.pump();
    expect(richText(t, 'diet-extra-fiber'), contains('0 / 25 g'));
    expect(find.byKey(const ValueKey('diet-data-gap')), findsOneWidget);
    expect(find.textContaining('2 of 9 in your plan'), findsOneWidget);
  });

  testWidgets('renders the API advice cards', (t) async {
    await pumpScreen(
      t,
      _Repo(
        insights: [
          {
            'id': 'protein-low',
            'tone': 'warn',
            'title': 'Protein was below plan on 3 of 4 logged days',
            'body': 'Finish Dinner.',
          },
          {
            'id': 'streak',
            'tone': 'good',
            'title': '3-day streak',
            'body': 'Keep it going.',
          },
        ],
      ),
    );
    await Scrollable.ensureVisible(
      t.element(find.byKey(const ValueKey('diet-insight-protein-low'))),
    );
    await t.pump();
    expect(find.text('What to do next'), findsOneWidget);
    expect(
      find.text('Protein was below plan on 3 of 4 logged days'),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('diet-insight-streak')), findsOneWidget);
  });

  testWidgets('no plan assigned shows the empty state', (t) async {
    await pumpScreen(t, _Repo(assigned: false));
    expect(find.text('No diet plan yet'), findsOneWidget);
  });

  testWidgets('an older API without the nutrition block degrades', (t) async {
    await pumpScreen(t, _Repo(withNutrition: false));
    expect(find.text('Diet tracker is updating'), findsOneWidget);
  });

  testWidgets('a plan that has not started cannot be logged yet', (t) async {
    await pumpScreen(t, _Repo(startDaysAgo: -3));
    expect(find.byKey(const ValueKey('diet-not-started')), findsOneWidget);
    expect(find.byKey(const ValueKey('meal-done-LUNCH')), findsNothing);
  });

  testWidgets('no overflow on a 360 dp phone', (t) async {
    await pumpScreen(
      t,
      _Repo(fiber: 25.0, itemsWithoutData: 1),
      size: const Size(360, 740),
    );
    for (var i = 0; i < 14; i++) {
      await t.drag(find.byType(Scrollable).first, const Offset(0, -450));
      await t.pump(const Duration(milliseconds: 300));
      expect(t.takeException(), isNull, reason: 'after scroll step $i');
    }
    // Interact once at phone width too.
    await t.drag(find.byType(Scrollable).first, const Offset(0, 6000));
    await t.pump();
    await tapKey(t, 'meal-done-BREAKFAST');
    expect(t.takeException(), isNull);
  });

  testWidgets('lays out on a 1500x1300 tablet without overflow', (t) async {
    await pumpScreen(t, _Repo(fiber: 25.0), size: const Size(1500, 1300));
    expect(find.byKey(const ValueKey('diet-calorie-ring')), findsOneWidget);
    expect(find.text('What to do next'), findsOneWidget);
    for (var i = 0; i < 8; i++) {
      await t.drag(find.byType(Scrollable).first, const Offset(0, -600));
      await t.pump(const Duration(milliseconds: 300));
      expect(t.takeException(), isNull, reason: 'after scroll step $i');
    }
  });
}
