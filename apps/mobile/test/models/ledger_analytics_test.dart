import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/models/ledger_analytics.dart';

void main() {
  test('LedgerAnalytics parses the API shape (decimal strings)', () {
    final a = LedgerAnalytics.fromJson({
      'range': {'from': '2026-10-01', 'to': '2026-10-02'},
      'previousRange': {'from': '2026-09-29', 'to': '2026-09-30'},
      'kpis': {
        'total': {'value': '1500.00', 'previous': '1000.00'},
        'count': {'value': 3, 'previous': 0},
        'average': {'value': '500.00', 'previous': '0.00'},
        'largest': {
          'value': '900.00',
          'description': 'Rent',
          'category': 'RENT',
          'date': '2026-10-01',
        },
        'netProfit': {'value': '-200.50', 'previous': '10.00'},
      },
      'daily': [
        {
          'date': '2026-10-01',
          'total': '1000.00',
          'count': 2,
          'previousTotal': '300.00',
        },
      ],
      'categories': [
        {
          'category': 'RENT',
          'amount': '900.00',
          'count': 1,
          'previousAmount': '600.00',
        },
        {
          'category': 'OFFICE_SUPPLIES',
          'amount': '10.00',
          'count': 1,
          'previousAmount': '0.00',
        },
      ],
      'branches': [
        {
          'branchId': 'b1',
          'name': 'Main',
          'total': '1500.00',
          'previousTotal': '0.00',
        },
      ],
      'topEntries': [
        {
          'id': 'e1',
          'description': null,
          'category': 'RENT',
          'amount': '900.00',
          'date': '2026-10-01T00:00:00.000Z',
        },
      ],
    });
    expect(a.kpis.total.value, 1500);
    expect(a.kpis.total.deltaPercent, 50);
    expect(a.kpis.count.deltaPercent, isNull);
    expect(a.kpis.largest!.category, 'RENT');
    expect(a.kpis.netProfit.value, -200.5);
    expect(a.daily.single.previousTotal, 300);
    expect(a.categories.first.deltaPercent, 50);
    expect(a.categories.last.deltaPercent, isNull);
    expect(a.branches.single.name, 'Main');
    expect(a.topEntries.single.description, isNull);
    expect(
        LedgerKind.expense.categoryLabel('OFFICE_SUPPLIES'),
      'Office Supplies',
    );
    expect(LedgerKind.income.categoryLabel('PERSONAL_TRAINING'), 'PT add-on');
  });

  test('empty / malformed payload degrades instead of throwing', () {
    final a = LedgerAnalytics.fromJson({
      'kpis': {
        'largest': null,
        'total': {'value': 'abc'},
      },
      'daily': 'nope',
    });
    expect(a.kpis.largest, isNull);
    expect(a.kpis.total.value, 0);
    expect(a.daily, isEmpty);
    expect(a.categories, isEmpty);
    expect(a.range.from, '');
  });

  test('LedgerListSummary parses', () {
    final s = LedgerListSummary.fromJson(
      {'total': '2500.50', 'count': 4, 'average': '625.13'},
    );
    expect(s.total, 2500.5);
    expect(s.count, 4);
    expect(s.average, 625.13);
  });
}
