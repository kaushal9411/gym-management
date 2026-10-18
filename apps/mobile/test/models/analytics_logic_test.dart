import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/reports/presentation/analytics/analytics_logic.dart';
import 'package:gym_saas_mobile/models/revenue_trend_point.dart';
import 'package:gym_saas_mobile/models/trend_point.dart';

void main() {
  group('previousRange', () {
    test('is the equal-length range ending the day before', () {
      final r = previousRange('2026-10-01', '2026-10-18');
      expect(r.from, '2026-09-13');
      expect(r.to, '2026-09-30');
    });

    test('a single day maps to the day before', () {
      final r = previousRange('2026-10-18', '2026-10-18');
      expect(r.from, '2026-10-17');
      expect(r.to, '2026-10-17');
    });

    test('crosses a year boundary', () {
      final r = previousRange('2026-01-01', '2026-01-31');
      expect(r.from, '2025-12-01');
      expect(r.to, '2025-12-31');
    });
  });

  group('mergeSeries / computeStats', () {
    final current = [
      const AnalyticsPoint('2026-10-01', 10, 4),
      const AnalyticsPoint('2026-10-02', 30, 6),
      const AnalyticsPoint('2026-10-03', 20, 5),
    ];
    final previous = [
      const AnalyticsPoint('2026-09-28', 20, 2),
      const AnalyticsPoint('2026-09-29', 10, 2),
      const AnalyticsPoint('2026-09-30', 10, 2),
    ];

    test('aligns previous values by position and labels days', () {
      final rows = mergeSeries(current, previous);
      expect(rows.first.label, '1 Oct');
      expect(rows[1].pa, 10);
      expect(rows[2].pb, 2);
    });

    test('flow stats total, average, peak and % change', () {
      final s = computeStats(mergeSeries(current, previous), snapshot: false);
      expect(s.total, 60);
      expect(s.average, 20);
      expect(s.peak, 30);
      expect(s.peakDate, '2026-10-02');
      expect(s.prevTotal, 40);
      expect(s.change, closeTo(50, 0.001));
      expect(s.totalB, 15);
      expect(s.prevTotalB, 6);
    });

    test('snapshot stats compare the latest level, never a sum', () {
      final s = computeStats(mergeSeries(current, previous), snapshot: true);
      expect(s.latest, 20);
      expect(s.prevLatest, 10);
      expect(s.change, closeTo(100, 0.001));
    });

    test('no previous data -> no change and no previous totals', () {
      final s = computeStats(mergeSeries(current, null), snapshot: false);
      expect(s.prevTotal, isNull);
      expect(s.change, isNull);
    });

    test('empty series does not divide by zero', () {
      final s = computeStats(const [], snapshot: false);
      expect(s.total, 0);
      expect(s.average, 0);
      expect(s.peakDate, '');
    });
  });

  group('analyticsPct', () {
    test('matches web pctChange', () {
      expect(analyticsPct(150, 100), 50);
      expect(analyticsPct(50, 100), -50);
      expect(analyticsPct(0, 0), 0);
      expect(analyticsPct(5, 0), isNull); // "New"
      expect(analyticsPct(5, null), isNull); // nothing to compare with
    });
  });

  test('API points normalise (decimal-safe money, int counts)', () {
    final counts = AnalyticsPoint.fromCounts(const [
      TrendPoint(date: '2026-10-01', value: 7),
    ]);
    expect(counts.single.a, 7);
    expect(counts.single.b, isNull);
    final money = AnalyticsPoint.fromMoney(const [
      RevenueTrendPoint(date: '2026-10-01', income: 1200.5, expenses: 300),
    ]);
    expect(money.single.a, 1200.5);
    expect(money.single.b, 300);
  });

  test('formatters', () {
    expect(formatAnalytics(AnalyticsFormat.number, 12345), '12,345');
    expect(compactAnalytics(AnalyticsFormat.number, 12345), '12k');
    expect(compactAnalytics(AnalyticsFormat.number, 950), '950');
    expect(formatAnalytics(AnalyticsFormat.percent, 12.345), '12.3%');
  });

  test('views: seven, retention is the only snapshot, two are dual', () {
    expect(AnalyticsView.values.length, 7);
    expect(AnalyticsView.values.where((v) => v.isSnapshot), [
      AnalyticsView.retention,
    ]);
    expect(AnalyticsView.values.where((v) => v.dual != null), [
      AnalyticsView.revenue,
      AnalyticsView.collection,
    ]);
    expect(AnalyticsView.branches.isSeries, isFalse);
  });
}
