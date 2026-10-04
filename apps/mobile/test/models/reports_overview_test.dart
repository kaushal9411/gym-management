import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/models/branch_comparison_row.dart';
import 'package:gym_saas_mobile/models/report_summary.dart';
import 'package:gym_saas_mobile/models/reports_overview.dart';

// Fixtures follow `assembleOverview()` / `report-summary.util.ts` in
// apps/api/src/modules/reports/utils (money = decimal STRINGS, ints plain).
// No live API response was available when these were written.
void main() {
  group('ReportsOverview', () {
    final json = <String, dynamic>{
      'range': {'from': '2026-10-01', 'to': '2026-10-02'},
      'previousRange': {'from': '2026-09-29', 'to': '2026-09-30'},
      'kpis': {
        'revenue': {'value': '1500.00', 'previous': '1000.00'},
        'expenses': {'value': '200.00', 'previous': '0.00'},
        'netProfit': {'value': '1300.00', 'previous': '1000.00'},
        'newMembers': {'value': 4, 'previous': 2},
        'activeMembers': {'value': 120},
        'checkIns': {'value': 30, 'previous': 40},
        'avgDailyCheckIns': {'value': 15, 'previous': 20.5},
        'expiringIn30d': {'value': 7},
        'churned': {'value': 1, 'previous': 3},
      },
      'daily': [
        {
          'date': '2026-10-01',
          'revenue': '1000.00',
          'expenses': '200.00',
          'checkIns': 10,
          'newMembers': 2,
          'prevRevenue': '400.00',
          'prevExpenses': '0.00',
          'prevCheckIns': 5,
          'prevNewMembers': 1,
        },
      ],
      'weekdayAttendance': [
        {'weekday': 0, 'count': 3, 'previousCount': 1},
        {'weekday': 1, 'count': 0, 'previousCount': 0},
      ],
      'hourlyAttendance': [
        {'hour': 6, 'count': 9},
      ],
      'memberStatus': [
        {'status': 'ACTIVE', 'count': 100},
        {'status': 'INACTIVE', 'count': 15},
        {'status': 'FROZEN', 'count': 5},
      ],
      'planDistribution': [
        {'planName': 'Gold', 'activeCount': 60, 'revenue': '90000.00'},
      ],
      'paymentMethods': [
        {'method': 'UPI', 'amount': '1200.50', 'count': 8},
      ],
      'branches': [
        {
          'branchId': 'b1',
          'name': 'Main',
          'revenue': '1500.00',
          'previousRevenue': '1000.00',
          'newMembers': 4,
          'checkIns': 30,
          'activeMembers': 120,
        },
      ],
      'topTrainers': [
        {'trainerId': 't1', 'name': 'Asha', 'assignedMembers': 18},
      ],
      'expiringBuckets': [
        {'label': '0-7 days', 'count': 3},
        {'label': '8-14 days', 'count': 4},
      ],
    };

    test('parses every block with money strings and mixed int/double', () {
      final o = ReportsOverview.fromJson(json);
      expect(o.range.from, '2026-10-01');
      expect(o.previousRange.to, '2026-09-30');
      expect(o.kpis.revenue.value, 1500);
      expect(o.kpis.revenue.deltaPercent, closeTo(50, 1e-9));
      expect(o.kpis.expenses.deltaPercent, isNull); // previous == 0
      expect(o.kpis.avgDailyCheckIns.previous, 20.5);
      expect(o.kpis.activeMembers, 120);
      expect(o.kpis.expiringIn30d, 7);
      expect(o.kpis.churned.deltaPercent, closeTo(-66.666, 1e-2));
      expect(o.daily.single.prevRevenue, 400);
      expect(o.weekdayAttendance.first.previousCount, 1);
      expect(o.hourlyAttendance.single.hour, 6);
      expect(o.memberStatus.map((s) => s.count), [100, 15, 5]);
      expect(o.planDistribution.single.revenue, 90000);
      expect(o.paymentMethods.single.amount, 1200.5);
      expect(o.branches.single.previousRevenue, 1000);
      expect(o.topTrainers.single.name, 'Asha');
      expect(o.expiringBuckets.last.count, 4);
    });

    test('empty / malformed payload degrades to zeros instead of throwing', () {
      final o = ReportsOverview.fromJson(const {});
      expect(o.kpis.revenue.value, 0);
      expect(o.kpis.activeMembers, 0);
      expect(o.daily, isEmpty);
      expect(o.branches, isEmpty);
      final odd = ReportsOverview.fromJson({
        'kpis': {'revenue': 'oops', 'activeMembers': null},
        'daily': ['not-a-map', 3],
      });
      expect(odd.kpis.revenue.value, 0);
      expect(odd.daily, isEmpty);
    });
  });

  group('ReportSummary', () {
    test('revenue summary: money kpis, donut breakdown, series', () {
      final s = ReportSummary.fromJson({
        'range': {'from': '2026-10-01', 'to': '2026-10-02'},
        'previousRange': {'from': '2026-09-29', 'to': '2026-09-30'},
        'kpis': [
          {
            'key': 'total',
            'label': 'Total revenue',
            'value': '1500.00',
            'previous': '1000.00',
            'format': 'money',
          },
          {
            'key': 'payments',
            'label': 'Payments',
            'value': 3,
            'previous': 0,
            'format': 'number',
          },
        ],
        'breakdowns': [
          {
            'key': 'by-method',
            'title': 'Revenue by method',
            'kind': 'donut',
            'items': [
              {'label': 'UPI', 'value': 1200.5},
              {'label': 'CASH', 'value': 299.5, 'previous': 10},
            ],
          },
        ],
        'series': {
          'title': 'Daily revenue',
          'points': [
            {'date': '2026-10-01', 'value': 1000, 'previous': 400},
            {'date': '2026-10-02', 'value': 500},
          ],
        },
      });
      expect(s.isEmpty, isFalse);
      expect(s.range!.from, '2026-10-01');
      final total = s.kpis.first;
      expect(total.format, SummaryFormat.money);
      expect(total.value, 1500);
      expect(total.previous, 1000);
      expect(total.deltaPercent, closeTo(50, 1e-9));
      expect(s.kpis[1].deltaPercent, isNull); // previous == 0
      expect(s.breakdowns.single.kind, 'donut');
      expect(s.breakdowns.single.items.last.previous, 10);
      expect(s.breakdowns.single.items.first.previous, isNull);
      expect(s.series!.points.last.previous, 0);
    });

    test('point-in-time summary: no ranges, null series, no previous', () {
      final s = ReportSummary.fromJson({
        'kpis': [
          {
            'key': 'total',
            'label': 'Total members',
            'value': 9,
            'format': 'number',
          },
        ],
        'breakdowns': <Map<String, dynamic>>[],
        'series': null,
      });
      expect(s.range, isNull);
      expect(s.series, isNull);
      expect(s.kpis.single.previous, isNull);
      expect(s.kpis.single.deltaPercent, isNull);
    });

    test('percent scale: success-rate is a 0..1 ratio, others already 0..100',
        () {
      SummaryKpi k(String key, Object v) => SummaryKpi.fromJson(
            {'key': key, 'label': key, 'value': v, 'format': 'percent'},
          );
      expect(k('success-rate', 0.5).percentScale * 0.5, 50);
      expect(k('avg-workout', 42.5).percentScale * 42.5, 42.5);
    });

    test('text kpi keeps its raw value; unknown format falls back to number',
        () {
      final t = SummaryKpi.fromJson(
        {'key': 'k', 'label': 'L', 'value': 'Gold', 'format': 'text'},
      );
      expect(t.text, 'Gold');
      expect(t.value, 0);
      final u = SummaryKpi.fromJson(
        {'key': 'k', 'label': 'L', 'value': 2, 'format': 'weird'},
      );
      expect(u.format, SummaryFormat.number);
    });

    test('empty body is flagged empty', () {
      expect(ReportSummary.fromJson(const {}).isEmpty, isTrue);
    });

    test('ReportSummaryFilters value equality drives reloads', () {
      final a = ReportSummaryFilters(branchId: 'b', from: DateTime(2026, 10));
      final b = ReportSummaryFilters(branchId: 'b', from: DateTime(2026, 10));
      expect(a, b);
      expect(a.hashCode, b.hashCode);
      expect(a == const ReportSummaryFilters(branchId: 'b'), isFalse);
    });
  });

  test('BranchComparisonRow parses numeric revenue (API sends a number)', () {
    final r = BranchComparisonRow.fromJson({
      'branchId': 'b1',
      'branch': 'Main',
      'members': 12,
      'revenue': 4500.5,
      'attendance': 77,
    });
    expect(r.branch, 'Main');
    expect(r.revenue, 4500.5);
    expect(r.attendance, 77);
    expect(BranchComparisonRow.fromJson({'revenue': '10.00'}).revenue, 10);
  });
}
