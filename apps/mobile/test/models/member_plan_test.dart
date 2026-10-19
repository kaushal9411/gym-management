import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/models/member_plan.dart';

import '../fixtures/member_plan_fixtures.dart';

void main() {
  test('parses the full plan in server order', () {
    final p = MemberPlan.fromJson(planJson());
    expect(p.name, 'Quarterly Pro');
    expect(p.code, 'PLAN-0002');
    expect(p.category, 'Premium');
    expect(p.durationLabel, '3 Months');
    expect(p.daysLeft, 61);
    expect(p.remainingFraction, closeTo(61 / 90, 0.0001));
    expect(p.benefits.map((b) => b.key).toList(), [
      PlanBenefitKey.gymAccess,
      PlanBenefitKey.ptSessions,
      PlanBenefitKey.groupClasses,
      PlanBenefitKey.dietConsultation,
      PlanBenefitKey.locker,
      PlanBenefitKey.guestPasses,
      PlanBenefitKey.freeze,
    ]);
    expect(p.includedCount, 6);
  });

  test('quota benefits: used / remaining / fraction / exhausted', () {
    final p = MemberPlan.fromJson(planJson());
    final pt = p.benefits[1];
    expect(pt.hasQuota, isTrue);
    expect(pt.quota, 4);
    expect(pt.used, 1);
    expect(pt.remaining, 3);
    expect(pt.unit, 'sessions');
    expect(pt.usedFraction, 0.25);
    expect(pt.exhausted, isFalse);

    final classes = p.benefits[2];
    expect(classes.usedFraction, 1);
    expect(classes.exhausted, isTrue);
    expect(classes.note, 'All used');
  });

  test('flag benefits carry no numbers', () {
    final p = MemberPlan.fromJson(planJson());
    final diet = p.benefits[3];
    expect(diet.included, isTrue);
    expect(diet.hasQuota, isFalse);
    expect(diet.quota, isNull);
    expect(diet.usedFraction, 0);
    expect(p.benefits[4].included, isFalse);
  });

  test('uncapped freeze is included with a "No limit" note and no quota', () {
    final freeze = MemberPlan.fromJson(planJson()).benefits.last;
    expect(freeze.included, isTrue);
    expect(freeze.hasQuota, isFalse);
    expect(freeze.note, 'No limit');
  });

  test('branch subset keeps the names', () {
    final gym = MemberPlan.fromJson(planJson()).benefits.first;
    expect(gym.items, ['Bandra', 'Thane']);
    expect(gym.note, '2 branches');
  });

  test('zero quotas / blocked freeze arrive as not included', () {
    final p = MemberPlan.fromJson(barePlanJson());
    expect(p.includedCount, 1);
    expect(
      p.benefits.where((b) => b.included).single.key,
      PlanBenefitKey.gymAccess,
    );
    expect(p.benefits.last.note, 'Not allowed');
    expect(p.category, isNull);
    expect(p.description, isNull);
  });

  test('tolerates junk: unknown key, missing fields, wrong types', () {
    final p = MemberPlan.fromJson({
      'name': '',
      'daysLeft': 'x',
      'benefits': [
        {'key': 'teleport', 'label': 'Teleport', 'included': true},
        'junk',
        {'included': 1},
      ],
    });
    expect(p.name, 'Membership');
    expect(p.daysLeft, 0);
    expect(p.benefits.length, 2);
    expect(p.benefits.first.key, PlanBenefitKey.other);
    expect(p.benefits.last.included, isFalse);
    expect(p.benefits.last.label, 'Benefit');
    expect(p.remainingFraction, 0);
  });

  test('expired plan has no remaining fraction', () {
    final p = MemberPlan.fromJson(planJson(daysLeft: 0, expired: true));
    expect(p.expired, isTrue);
    expect(p.remainingFraction, 0);
  });
}
