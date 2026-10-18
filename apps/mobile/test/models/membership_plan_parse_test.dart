import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/models/membership_plan.dart';

Map<String, dynamic> _raw() => {
      'id': 'p1',
      'name': 'Quarterly Pro',
      'planCode': 'PLAN-0001',
      'description': 'Best value',
      'category': 'Premium',
      'durationValue': 3,
      'durationType': 'MONTHS',
      'durationDays': 90,
      // Prisma DECIMALs arrive as strings.
      'price': '5000',
      'joiningFee': '500.00',
      'taxPercentage': '18',
      'discountPercentage': '10.5',
      'isActive': true,
      'displayOrder': 2,
      'notes': null,
      'gymAccessAllBranches': false,
      'accessBranchIds': ['b1', 'b2'],
      'ptSessionsIncluded': 4,
      'groupClassesIncluded': 0,
      'dietConsultationIncluded': true,
      'lockerAccess': false,
      'guestPasses': 2,
      'freezeAllowed': true,
      'freezeDaysLimit': null,
      'memberCount': 12,
      'createdAt': '2026-01-01T10:00:00.000Z',
      'updatedAt': '2026-02-01T10:00:00.000Z',
      'deletedAt': null,
    };

void main() {
  test('parses decimal strings, lists and dates', () {
    final p = MembershipPlan.fromJson(_raw());
    expect(p.price, 5000);
    expect(p.joiningFee, 500);
    expect(p.taxPercentage, 18);
    expect(p.discountPercentage, 10.5);
    expect(p.accessBranchIds, ['b1', 'b2']);
    expect(p.freezeDaysLimit, isNull);
    expect(p.createdAt, isNotNull);
    expect(p.isDeleted, isFalse);
    expect(p.durationLabel, '3 months');
    expect(p.approxDays, 90);
  });

  test('is tolerant of numbers, nulls and missing keys', () {
    final p = MembershipPlan.fromJson({
      'id': 'p2',
      'name': 'Basic',
      'durationValue': '1',
      'durationType': 'YEARS',
      'price': 1200,
      'accessBranchIds': null,
      'deletedAt': '2026-03-01T00:00:00.000Z',
    });
    expect(p.price, 1200);
    expect(p.durationValue, 1);
    expect(p.durationLabel, '1 year');
    expect(p.joiningFee, 0);
    expect(p.accessBranchIds, isEmpty);
    expect(p.isDeleted, isTrue);
    expect(p.memberCount, 0);
  });

  test('breakdown matches the discount-then-tax getters', () {
    final p = MembershipPlan.fromJson(_raw());
    final b = p.breakdown;
    expect(b.discountAmount, closeTo(525, 1e-9));
    expect(b.taxable, closeTo(4475, 1e-9));
    expect(b.taxAmount, closeTo(805.5, 1e-9));
    expect(b.finalPrice, closeTo(5280.5, 1e-9));
    expect(b.totalWithJoiningFee, closeTo(5780.5, 1e-9));
    expect(b.finalPrice, closeTo(p.finalPrice, 1e-9));
    expect(b.discountAmount, closeTo(p.discountAmount, 1e-9));
    expect(b.taxAmount, closeTo(p.taxAmount, 1e-9));
    expect(b.totalWithJoiningFee, closeTo(p.totalWithJoiningFee, 1e-9));
    expect(b.hasAdjustment, isTrue);
    expect(
      const PlanPriceBreakdown(
        basePrice: 100,
        discountPercentage: 0,
        taxPercentage: 0,
        joiningFee: 0,
      ).hasAdjustment,
      isFalse,
    );
  });

  test('perks summary and duration helpers', () {
    final p = MembershipPlan.fromJson(_raw());
    expect(p.perksSummary, 'PT + diet included');
    expect(MembershipDurationType.weeks.approxDays(2), 14);
    expect(
      MembershipDurationTypeX.fromApi('DAYS'),
      MembershipDurationType.days,
    );
    expect(
      MembershipDurationTypeX.fromApi(null),
      MembershipDurationType.months,
    );
  });
}
