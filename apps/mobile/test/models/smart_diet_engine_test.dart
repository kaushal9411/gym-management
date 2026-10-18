import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/diet/smart/smart_engine.dart';
import 'package:gym_saas_mobile/features/diet/smart/smart_input.dart';
import 'package:gym_saas_mobile/features/diet/smart/starter_foods.dart';
import 'package:gym_saas_mobile/models/body_measurement.dart';
import 'package:gym_saas_mobile/models/diet_plan.dart';
import 'package:gym_saas_mobile/models/food.dart';
import 'package:gym_saas_mobile/models/gym_member.dart';

/// `test/fixtures/smart_diet_golden.json` was produced by running web's own
/// `engine.ts` (frozen clock 2026-10-18) over the starter foods, so these
/// tests pin the Dart port to the web planner number for number.
final _now = DateTime(2026, 10, 18, 12);

final _catalog = [
  for (final s in starterFoods)
    PlannerFood(
      id: s.name,
      name: s.name,
      serving: s.serving,
      kcal: s.kcal.toDouble(),
      p: s.p,
      c: s.c,
      f: s.f,
      sugar: s.sugar,
      sodium: s.sodium,
      diet: s.diet,
      role: s.role,
      meals: s.meals,
      allergens: s.allergens,
    ),
];

PlannerMember _member(String name) => switch (name) {
      'maleCut' => const PlannerMember(
          sex: Sex.m,
          dob: '1990-06-15',
          heightCm: 178,
          weightKg: 88.5,
          goal: GoalKey.weightLoss,
          pref: DietType.nonVegetarian,
          visits28: 16,
        ),
      'femaleVeg' => const PlannerMember(
          sex: Sex.f,
          dob: '1995-02-03',
          heightCm: 162,
          weightKg: 58,
          goal: GoalKey.muscleBuilding,
          pref: DietType.vegetarian,
          allergies: 'lactose intolerant, peanuts',
          visits28: 8,
        ),
      'veganDiabetic' => const PlannerMember(
          sex: Sex.m,
          dob: '1984-11-30',
          heightCm: 170,
          weightKg: 79,
          goal: GoalKey.generalFitness,
          pref: DietType.vegan,
          allergies: 'soy',
          medical: 'Type 2 diabetes',
          diabetesOrBp: true,
          visits28: 4,
        ),
      'eggGain' => const PlannerMember(
          sex: Sex.o,
          dob: '2001-08-21',
          heightCm: 175,
          weightKg: 62,
          goal: GoalKey.weightGain,
          pref: DietType.eggetarian,
          allergies: 'gluten',
          medical: 'high blood pressure',
          heart: true,
          visits28: 24,
        ),
      'rehab' => const PlannerMember(
          sex: Sex.f,
          dob: '1950-01-10',
          heightCm: 158,
          weightKg: 70,
          goal: GoalKey.rehabilitation,
          pref: DietType.vegetarian,
          medical: 'kidney issue',
        ),
      'minor' => const PlannerMember(
          sex: Sex.m,
          dob: '2012-01-01',
          heightCm: 150,
          weightKg: 45,
          goal: GoalKey.weightLoss,
          pref: DietType.vegan,
          visits28: 4,
        ),
      _ => const PlannerMember(
          heightCm: 170,
          pref: DietType.vegan,
        ),
    };

Map<String, dynamic> _golden() => jsonDecode(
      File('test/fixtures/smart_diet_golden.json').readAsStringSync(),
    ) as Map<String, dynamic>;

void _near(num actual, num expected, [String? reason]) => expect(
      actual.toDouble(),
      closeTo(expected.toDouble(), 1e-9),
      reason: reason,
    );

void main() {
  final golden = _golden();

  group('matches web engine.ts', () {
    for (final entry in golden.entries.where((e) => !e.key.endsWith('#swap'))) {
      test(entry.key, () {
        final parts = entry.key.split('#');
        final exp = entry.value as Map<String, dynamic>;
        final r = generate(
          _member(parts[0]),
          _catalog,
          mix: int.parse(parts[1]),
          now: _now,
        );
        switch (exp['status']) {
          case 'missing':
            expect(r, isA<GenerateMissing>());
            expect(
              (r as GenerateMissing).missing.map((m) => m.name).toList(),
              exp['missing'],
            );
          case 'blocked':
            expect(r, isA<GenerateBlocked>());
            expect((r as GenerateBlocked).blocks, exp['blocks']);
          case 'ok':
            expect(r, isA<GenerateOk>());
            final p = (r as GenerateOk).plan;
            final t = exp['targets'] as Map<String, dynamic>;
            expect(p.t.age, t['age']);
            _near(p.t.bmr, t['bmr'] as num, 'bmr');
            expect(p.t.vpw, t['vpw']);
            _near(p.t.tdee, t['tdee'] as num, 'tdee');
            _near(p.t.raw, t['raw'] as num, 'raw');
            _near(p.t.kcal, t['kcal'] as num, 'kcal');
            _near(p.t.p, t['p'] as num, 'p');
            _near(p.t.c, t['c'] as num, 'c');
            _near(p.t.f, t['f'] as num, 'f');
            expect(p.t.floored, t['floored']);
            expect(p.t.pCapped, t['pCapped']);
            expect(p.review, exp['review']);
            final slots = exp['slots'] as List;
            expect(p.slots.length, slots.length);
            for (var i = 0; i < slots.length; i++) {
              final s = slots[i] as Map<String, dynamic>;
              expect(p.slots[i].type.apiValue, s['type']);
              final items = s['items'] as List;
              expect(p.slots[i].items.length, items.length, reason: '$i');
              for (var j = 0; j < items.length; j++) {
                final it = items[j] as List;
                expect(p.slots[i].items[j].foodId, it[0]);
                _near(p.slots[i].items[j].qty, it[1] as num, '${it[0]} qty');
              }
            }
            final tot = totals(p);
            final et = exp['totals'] as Map<String, dynamic>;
            _near(tot.kcal, et['kcal'] as num, 'total kcal');
            _near(tot.p, et['p'] as num, 'total p');
            expect(warnings(p), exp['warnings']);
            expect(p.explain, exp['explain']);
        }
      });
    }

    test('swap + manual quantity (maleCut#0)', () {
      final exp = golden['maleCut#swap'] as Map<String, dynamic>;
      final r = generate(_member('maleCut'), _catalog, now: _now) as GenerateOk;
      final swaps = swapOptions(r.plan, 0, 0, _catalog);
      expect(
        [
          for (final o in swaps) [o.food.id, o.qty],
        ],
        exp['swaps'],
      );
      final copy = r.plan.copy();
      applySwap(copy, 0, 0, swapOptions(copy, 0, 0, _catalog).first);
      final after = exp['afterSwap'] as List;
      for (var i = 0; i < after.length; i++) {
        final items = (after[i] as Map<String, dynamic>)['items'] as List;
        for (var j = 0; j < items.length; j++) {
          final it = items[j] as List;
          expect(copy.slots[i].items[j].foodId, it[0]);
          _near(copy.slots[i].items[j].qty, it[1] as num);
          expect(copy.slots[i].items[j].edited, it[2]);
        }
      }
      // The original plan is untouched by edits to the copy.
      expect(r.plan.slots[0].items[0].edited, isFalse);

      final copy2 = r.plan.copy();
      setQty(copy2, 2, 0, 3.25);
      final q = exp['afterSetQty'] as List;
      _near(copy2.slots[2].items[0].qty, (q[0] as List)[1] as num);
      expect(copy2.slots[2].items[0].edited, isTrue);
    });
  });

  group('helpers', () {
    test('fmtInt / q2 / numStr mirror the JS formatting', () {
      expect(fmtInt(1822.5), '1,823');
      expect(fmtInt(999.4), '999');
      expect(fmtInt(12345678), '12,345,678');
      expect(q2(1.5), '1.5');
      expect(q2(2), '2');
      expect(q2(0.25), '0.25');
      expect(numStr(1.375), '1.375');
      expect(numStr(170), '170');
    });

    test('ageOf counts whole years on a calendar date', () {
      final now = DateTime(2026, 10, 18);
      expect(ageOf('1990-10-18', now: now), 36);
      expect(ageOf('1990-10-19', now: now), 35);
      expect(ageOf('nope', now: now), isNull);
      expect(ageOf(null, now: now), isNull);
    });
  });

  group('smart input mapping', () {
    GymMember member(Map<String, dynamic> extra) => GymMember.fromJson({
          'id': 'm1',
          'memberId': 'MEM-0001',
          'firstName': 'Ann',
          'lastName': 'Lee',
          'name': 'Ann Lee',
          'status': 'ACTIVE',
          'branch': {'id': 'b', 'name': 'Main'},
          'joiningDate': '2026-01-01T00:00:00.000Z',
          'createdAt': '2026-01-01T10:00:00.000Z',
          'outstandingAmount': '0',
          'gender': 'FEMALE',
          'dateOfBirth': '1995-02-03T00:00:00.000Z',
          'height': '165.00',
          'weight': '60.00',
          'goal': 'WEIGHT_LOSS',
          'foodPreference': 'VEGAN',
          'allergies': 'soy',
          'medicalConditions': 'asthma',
          'healthScreeningOtherDetails': 'none',
          'healthDiabetesOrBp': true,
          ...extra,
        });

    BodyMeasurement meas(String at, {String? w, String? h}) =>
        BodyMeasurement.fromJson({
          'id': at,
          'memberId': 'm1',
          'recordedAt': at,
          'weightKg': w,
          'heightCm': h,
        });

    test('newest positive measurement wins, profile is the fallback', () {
      final now = DateTime(2026, 10, 18);
      final i = buildSmartInput(
        member: member({}),
        measurements: [
          meas('2026-09-01T10:00:00.000Z', w: '70.00', h: '170.00'),
          meas('2026-10-01T10:00:00.000Z', w: '68.50'),
        ],
        visitTimes: [
          now.subtract(const Duration(days: 3)),
          now.subtract(const Duration(days: 27)),
          now.subtract(const Duration(days: 40)),
        ],
        now: now,
      );
      expect(i.member.weightKg, 68.5);
      expect(i.member.heightCm, 170);
      expect(i.member.visits28, 2);
      expect(i.member.sex, Sex.f);
      expect(i.member.dob, '1995-02-03');
      expect(i.member.pref, DietType.vegan);
      expect(i.member.goal, GoalKey.weightLoss);
      expect(i.member.medical, 'asthma. none');
      expect(i.member.diabetesOrBp, isTrue);
      expect(i.weightSource, startsWith('Latest measurement'));

      final p = buildSmartInput(
        member: member({}),
        measurements: const [],
        visitTimes: const [],
        now: now,
      );
      expect(p.member.weightKg, 60);
      expect(p.member.heightCm, 165);
      expect(p.weightSource, 'Member profile');
    });

    test('toPlannerFoods keeps only starter-named foods and fills blanks', () {
      Food food(String name, {Object? kcal}) => Food.fromJson({
            'id': 'id-$name',
            'name': name,
            'servingSize': null,
            'calories': kcal,
            'protein': '0',
            'isActive': true,
          });
      final out = toPlannerFoods([
        food(' Banana ', kcal: 120),
        food('Mystery bar'),
      ]);
      expect(out.length, 1);
      expect(out.single.kcal, 120);
      // Zero / missing values fall back to the starter tag.
      expect(out.single.p, 1.3);
      expect(out.single.serving, '1 medium');
      expect(out.single.role, FoodRole.fruit);
      expect(out.single.meals, contains(MealType.preWorkout));
    });
  });
}
