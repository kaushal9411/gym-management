import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/member/presentation/widgets/member_insights.dart';
import 'package:gym_saas_mobile/models/gym_info.dart';
import 'package:gym_saas_mobile/models/member_invoice_detail.dart';
import 'package:gym_saas_mobile/models/member_overview.dart';
import 'package:gym_saas_mobile/models/portal_payment.dart';

/// 84 consecutive days ending 2026-10-04 (a Sunday), visits on a few days.
List<Map<String, dynamic>> daily84({Map<String, int> visits = const {}}) {
  final end = DateTime.utc(2026, 10, 4);
  return [
    for (var i = 83; i >= 0; i--)
      () {
        final d = end.subtract(Duration(days: i));
        final iso = d.toIso8601String().substring(0, 10);
        return {'date': iso, 'visits': visits[iso] ?? 0};
      }(),
  ];
}

/// Full shape from the backend DTO / util spec.
Map<String, dynamic> fullFixture() => {
      'member': {
        'id': 'm1',
        'memberId': 'MEM-0001',
        'name': 'Asha Rao',
        'photoUrl': null,
        'joiningDate': '2026-01-05',
        'branch': {'id': 'b1', 'name': 'Main Branch'},
        'trainer': {'id': 't1', 'name': 'Ravi'},
      },
      'membership': {
        'planName': 'Quarterly',
        'status': 'ACTIVE',
        'startDate': '2026-09-01',
        'endDate': '2026-12-01',
        'daysLeft': 58,
        'expired': false,
        'totalDays': 91,
        'price': '5000.00',
        'amountPaid': '5900.00',
      },
      'attendance': {
        'thisMonth': {'visits': 6, 'previous': 4},
        'currentStreakDays': 3,
        'bestStreakDays': 9,
        'totalVisits': 41,
        'avgVisitMinutes': 72,
        'lastVisitAt': '2026-10-03T08:47:05.115Z',
        'weekday': [
          for (var i = 0; i < 7; i++) {'weekday': i, 'count': i == 6 ? 9 : i},
        ],
        'daily': daily84(visits: {'2026-10-03': 2, '2026-10-01': 1}),
      },
      'workout': {
        'planName': 'Strength',
        'progressPercent': 40,
        'completedExercises': 4,
        'totalExercises': 10,
        'completedThisWeek': 2,
      },
      'diet': {
        'planName': 'Lean',
        'dailyCalories': 2200,
        'loggedToday': true,
        'waterTodayMl': 1500,
        'latestWeightKg': '71.4',
      },
      'billing': {
        'outstanding': {'value': '1200.50', 'invoiceCount': 2},
        'nextDueDate': '2026-10-10',
        'paidLast90Days': {'value': '5900.00', 'count': 2},
      },
      'classes': {
        'upcoming': [
          {
            'sessionId': 's1',
            'name': 'Yoga',
            'date': '2026-10-06',
            'startTime': '07:00',
            'endTime': '08:00',
            'trainerName': null,
            'bookingStatus': 'CONFIRMED',
          },
        ],
      },
      'notifications': {'unread': 3},
    };

/// Sanitised copy of a REAL `GET /portal/overview` response (new member:
/// no trainer, no workout/diet, one visit, null avg minutes).
Map<String, dynamic> realFixture() => {
      'member': {
        'id': 'real-id',
        'memberId': 'MEM-0001',
        'name': 'Test Member',
        'photoUrl': 'http://localhost:4000/uploads/public/member-photos/x.jpg',
        'joiningDate': '2026-10-03',
        'branch': {'id': 'b', 'name': 'Main Branch'},
        'trainer': null,
      },
      'membership': {
        'planName': 'Monthly Plan',
        'status': 'ACTIVE',
        'startDate': '2026-10-03',
        'endDate': '2026-11-03',
        'daysLeft': 30,
        'expired': false,
        'totalDays': 31,
        'price': '2173.50',
        'amountPaid': '2300.00',
      },
      'attendance': {
        'thisMonth': {'visits': 1, 'previous': 0},
        'currentStreakDays': 1,
        'bestStreakDays': 1,
        'totalVisits': 1,
        'avgVisitMinutes': null,
        'lastVisitAt': '2026-10-03T08:47:05.115Z',
        'weekday': [
          for (var i = 0; i < 7; i++) {'weekday': i, 'count': i == 6 ? 1 : 0},
        ],
        'daily': daily84(visits: {'2026-10-03': 1}),
      },
      'workout': null,
      'diet': null,
      'billing': {
        'outstanding': {'value': '0.00', 'invoiceCount': 0},
        'nextDueDate': null,
        'paidLast90Days': {'value': '2300.00', 'count': 2},
      },
      'classes': {'upcoming': <dynamic>[]},
      'notifications': {'unread': 6},
    };

void main() {
  test('MemberOverview parses the full DTO shape', () {
    final o = MemberOverview.fromJson(fullFixture());
    expect(o.member.trainerName, 'Ravi');
    expect(o.membership!.price, 5000.0);
    expect(o.membership!.remainingFraction, closeTo(58 / 91, 1e-9));
    expect(o.attendance.deltaPercent, 50);
    expect(o.attendance.avgVisitMinutes, 72);
    expect(o.attendance.daily, hasLength(84));
    expect(o.attendance.maxWeekday, 9);
    expect(o.workout!.progressPercent, 40);
    expect(o.diet!.latestWeightKg, 71.4);
    expect(o.billing.outstanding, 1200.5);
    expect(o.billing.nextDueDate, '2026-10-10');
    expect(o.upcomingClasses.single.trainerName, isNull);
    expect(o.unreadNotifications, 3);
  });

  test('MemberOverview parses a real (sanitised) response, nullable-aware', () {
    final o = MemberOverview.fromJson(realFixture());
    expect(o.workout, isNull);
    expect(o.diet, isNull);
    expect(o.member.trainerName, isNull);
    expect(o.attendance.avgVisitMinutes, isNull);
    expect(o.attendance.deltaPercent, isNull); // previous == 0: no fake %
    expect(o.billing.nextDueDate, isNull);
    expect(o.billing.paidLast90Days, 2300);
    expect(o.upcomingClasses, isEmpty);
  });

  test('MemberOverview survives an empty / malformed payload', () {
    final o = MemberOverview.fromJson({'membership': 'x', 'attendance': 5});
    expect(o.membership, isNull);
    expect(o.attendance.daily, isEmpty);
    expect(o.billing.outstanding, 0);
  });

  test('expired membership has an empty ring', () {
    final j = fullFixture();
    (j['membership'] as Map<String, dynamic>)
      ..['expired'] = true
      ..['daysLeft'] = -4;
    final m = MemberOverview.fromJson(j).membership!;
    expect(m.expired, isTrue);
    expect(m.remainingFraction, 0);
  });

  test('heatmapWeeks lays 84 days into Monday-first columns', () {
    final weeks = heatmapWeeks(
      MemberOverview.fromJson(fullFixture()).attendance.daily,
    );
    expect(weeks.every((w) => w.length == 7), isTrue);
    expect(weeks.expand((w) => w).whereType<OverviewDay>(), hasLength(84));
    // Ends on Sunday 2026-10-04 -> last slot of last column.
    expect(weeks.last[6]!.date, '2026-10-04');
    expect(weeks.length, inInclusiveRange(12, 13));
  });

  test('PortalPayment parses the real list row', () {
    final p = PortalPayment.fromJson({
      'id': 'p1',
      'paymentNumber': 'PAY-0002',
      'amount': '2200.00',
      'method': 'ONLINE_GATEWAY',
      'status': 'SUCCESS',
      'paymentDate': '2026-10-03',
      'invoiceId': 'i1',
      'invoiceNumber': 'INV-0002',
      'totalRefunded': '0.00',
    });
    expect(p.amount, 2200);
    expect(p.hasRefund, isFalse);
    final r = PortalPayment.fromJson({
      'paymentNumber': 'PAY-3',
      'amount': '500.00',
      'status': 'PARTIALLY_REFUNDED',
      'totalRefunded': '150.00',
      'invoiceId': null,
    });
    expect(r.hasRefund, isTrue);
    expect(r.invoiceNumber, isNull);
  });

  test('MemberInvoiceDetail parses items/payments/paid/balance', () {
    final d = MemberInvoiceDetail.fromJson({
      'id': 'i',
      'invoiceNumber': 'INV-0001',
      'invoiceDate': '2026-10-03',
      'dueDate': '2026-10-03',
      'status': 'PARTIALLY_PAID',
      'subtotal': '100.00',
      'taxAmount': '18.00',
      'discountAmount': '10.00',
      'totalAmount': '108.00',
      'items': [
        {
          'description': 'Membership',
          'quantity': 2,
          'unitPrice': '50.00',
          'amount': '100.00',
        },
      ],
      'payments': [
        {
          'paymentNumber': 'PAY-0001',
          'finalAmount': '40.00',
          'status': 'SUCCESS',
          'paymentDate': '2026-10-03',
        },
      ],
      'paid': '40.00',
      'balance': '68.00',
      'branch': {'name': 'Main'},
    });
    expect(d.items.single.unitPrice, 50);
    expect(d.payments.single.finalAmount, 40);
    expect(d.balance, 68);
    expect(d.discountAmount, 10);
    expect(d.branchName, 'Main');
  });

  test('GymInfo: all-null real response and a full DTO', () {
    final real = GymInfo.fromJson({
      'name': 'Test Gym',
      'logoUrl': null,
      'address': null,
      'phone': null,
      'email': null,
      'website': null,
      'businessHours': null,
      'social': null,
      'branch': {
        'name': 'Main',
        'phone': null,
        'email': null,
        'address': null,
        'businessHours': null,
      },
    });
    expect(real.address, isNull);
    expect(real.businessHours, isNull);
    expect(real.social, isEmpty);
    expect(real.branch!.address, isNull);

    final full = GymInfo.fromJson({
      'name': 'Gym',
      'address': {'line1': '1 Road', 'city': 'Pune', 'state': null},
      'phone': '+911234567890',
      'email': 'a@b.co',
      'website': 'gym.example',
      'businessHours': [
        {'day': 'monday', 'open': '06:00', 'close': '22:00', 'closed': false},
        {'day': 'sunday', 'open': null, 'close': null, 'closed': true},
      ],
      'social': {'instagram': 'https://i.example/x', 'x': ''},
      'branch': null,
    });
    expect(full.address!.oneLine, '1 Road, Pune');
    expect(full.businessHours, hasLength(2));
    expect(full.businessHours!.last.closed, isTrue);
    expect(full.social.keys, ['instagram']);
    expect(full.branch, isNull);
  });
}
