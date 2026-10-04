import 'package:gym_saas_mobile/bloc/finance/payments_analytics_cubit.dart';
import 'package:gym_saas_mobile/models/member_payment.dart';
import 'package:gym_saas_mobile/models/payments_analytics.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('PaymentsAnalytics parses the real API shape', () {
    final a = PaymentsAnalytics.fromJson({
      'range': {'from': '2026-10-01', 'to': '2026-10-02'},
      'previousRange': {'from': '2026-09-29', 'to': '2026-09-30'},
      'kpis': {
        'collected': {'value': '1500.00', 'previous': '1000.00'},
        'todayCollected': {'value': '500.00', 'count': 2},
        'outstanding': {'value': '300.50', 'invoiceCount': 3},
        'refunded': {
          'value': '100.00',
          'previous': '0.00',
          'count': 1,
          'rate': 0.0667,
        },
        'avgPayment': {'value': '750.00', 'previous': '0.00'},
        'paymentCount': {'value': 4, 'previous': 2},
        'successRate': {'value': 0.75, 'previous': 1},
      },
      'daily': [
        {
          'date': '2026-10-01',
          'collected': '1000.00',
          'refunded': '0.00',
          'count': 2,
          'previousCollected': '400.00',
        },
      ],
      'methods': [
        {'method': 'UPI', 'amount': '900.00', 'count': 2},
      ],
      'statuses': [
        {'status': 'SUCCESS', 'count': 3},
      ],
      'branches': [
        {
          'branchId': 'b1',
          'name': 'Main',
          'revenue': '1500.00',
          'previousRevenue': '1000.00',
        },
      ],
      'topPlans': [
        {'planName': 'Gold', 'revenue': '1500.00', 'count': 2},
      ],
      'attention': {
        'pendingOver24h': 1,
        'failed': 2,
        'overdueInvoices': {'count': 3, 'amount': '300.50'},
      },
    });
    expect(a.kpis.collected.value, 1500);
    expect(a.kpis.collected.deltaPercent, 50);
    expect(a.kpis.avgPayment.deltaPercent, isNull); // no baseline
    expect(a.kpis.refundRate, closeTo(0.0667, 1e-9));
    expect(a.kpis.successRate.previous, 1.0); // int 1 -> double
    expect(a.daily.single.previousCollected, 400);
    expect(a.attention.overdueAmount, 300.5);
    expect(a.attention.isClear, isFalse);
  });

  test('PaymentsAnalytics tolerates missing blocks', () {
    final a = PaymentsAnalytics.fromJson({});
    expect(a.daily, isEmpty);
    expect(a.kpis.collected.value, 0);
    expect(a.attention.isClear, isTrue);
  });

  test('statusAfterRefund + canRefund', () {
    MemberPayment p(String status, double total, double refunded) =>
        MemberPayment(
          id: 'i',
          paymentNumber: 'P1',
          memberName: 'm',
          memberCode: 'c',
          branchName: 'b',
          planName: null,
          invoiceId: null,
          finalAmount: total,
          method: 'CASH',
          paymentDate: DateTime(2026),
          status: status,
          totalRefunded: refunded,
        );
    final pay = p('SUCCESS', 1000, 0);
    expect(pay.statusAfterRefund(250), 'PARTIALLY_REFUNDED');
    expect(pay.statusAfterRefund(1000), 'REFUNDED');
    expect(pay.statusAfterRefund(null), 'REFUNDED');
    final part = p('PARTIALLY_REFUNDED', 1000, 400);
    expect(part.canRefund, isTrue);
    expect(part.statusAfterRefund(600), 'REFUNDED');
    expect(p('REFUNDED', 1000, 1000).canRefund, isFalse);
  });

  test('period ranges are UTC YYYY-MM-DD', () {
    final now = DateTime.utc(2026, 10, 3, 12);
    expect(
      PaymentsPeriod.today.range(now),
      (from: '2026-10-03', to: '2026-10-03'),
    );
    expect(
      PaymentsPeriod.days7.range(now),
      (from: '2026-09-27', to: '2026-10-03'),
    );
    expect(
      PaymentsPeriod.thisMonth.range(now),
      (from: '2026-10-01', to: '2026-10-03'),
    );
    expect(
      PaymentsPeriod.lastMonth.range(now),
      (from: '2026-09-01', to: '2026-09-30'),
    );
    expect(PaymentsPeriod.days90.range(now).from, '2026-07-06');
    expect(
      PaymentsPeriod.lastMonth.range(DateTime.utc(2026, 1, 15)),
      (from: '2025-12-01', to: '2025-12-31'),
    );
  });
}
