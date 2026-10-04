import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/models/invoice_analytics.dart';

// Fixtures are derived from the backend contract (invoice analytics DTO /
// util), not from a live response.
void main() {
  test('parses the full analytics payload (money as strings)', () {
    final a = InvoiceAnalytics.fromJson({
      'range': {'from': '2026-10-01', 'to': '2026-10-02'},
      'previousRange': {'from': '2026-09-29', 'to': '2026-09-30'},
      'kpis': {
        'invoiced': {'value': '5000.00', 'previous': '2500.00'},
        'count': {'value': 4, 'previous': 2},
        'collected': {'value': '3000.00', 'previous': '0.00'},
        'avgInvoice': {'value': '1250.00', 'previous': '1250.00'},
        'collectionRate': {'value': 0.6, 'previous': 0},
        'outstanding': {'value': '2000.00', 'invoiceCount': 3},
        'overdue': {'value': '800.00', 'count': 1},
      },
      'daily': [
        {
          'date': '2026-10-01',
          'invoiced': '3000.00',
          'count': 2,
          'previousInvoiced': '0.00',
        },
      ],
      'byStatus': [
        {'status': 'PAID', 'count': 2, 'amount': '3000.00'},
      ],
      'aging': [
        {'bucket': 'Current', 'count': 2, 'amount': '1200.00'},
        {'bucket': '90+', 'count': 1, 'amount': '800.00'},
      ],
      'topDebtors': [
        {
          'memberId': 'm1',
          'memberCode': 'M-001',
          'name': 'Asha',
          'outstanding': '800.00',
          'invoiceCount': 1,
        },
      ],
      'branches': [
        {
          'branchId': 'b1',
          'name': 'Main',
          'invoiced': '5000.00',
          'collected': '3000.00',
        },
      ],
    });
    expect(a.invoiced.value, 5000);
    expect(a.invoiced.deltaPercent, 100);
    expect(a.collected.deltaPercent, isNull);
    expect(a.collectionRate.value, 0.6);
    expect(a.outstanding, 2000);
    expect(a.outstandingInvoiceCount, 3);
    expect(a.overdue, 800);
    expect(a.overdueCount, 1);
    expect(a.daily.single.invoiced, 3000);
    expect(a.byStatus.single.amount, 3000);
    expect(a.aging.map((e) => e.bucket), ['Current', '90+']);
    expect(a.topDebtors.single.memberCode, 'M-001');
    expect(a.branches.single.collected, 3000);
  });

  test('empty payload degrades to zeros / empty lists', () {
    final a = InvoiceAnalytics.fromJson({});
    expect(a.invoiced.value, 0);
    expect(a.outstanding, 0);
    expect(a.aging, isEmpty);
    expect(a.branches, isEmpty);
  });

  test('list summary and counts', () {
    final s = InvoiceListSummary.fromJson({
      'invoiced': '100.50',
      'collected': '40',
      'outstanding': '60.50',
      'count': 3,
    });
    expect(s.outstanding, 60.5);
    expect(s.count, 3);
    final c = InvoiceCounts.fromJson({
      'all': 10,
      'unpaid': 2,
      'partiallyPaid': 1,
      'paid': 5,
      'overdue': 1,
      'cancelled': 1,
    });
    expect(c.partiallyPaid, 1);
    expect(c.all, 10);
  });
}
