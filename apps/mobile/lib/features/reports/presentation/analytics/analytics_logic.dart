import 'package:flutter/material.dart';

import '../../../../core/utils/formatters.dart';
import '../../../../models/revenue_trend_point.dart';
import '../../../../models/trend_point.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../kit/kit.dart' show RptFormat, rptPreviousRange;

/// How a view's numbers are written (web's `ValueFormat`).
enum AnalyticsFormat { money, number, percent }

extension AnalyticsFormatX on AnalyticsFormat {
  /// The report kit's equivalent.
  RptFormat get rpt => switch (this) {
        AnalyticsFormat.money => RptFormat.money,
        AnalyticsFormat.number => RptFormat.number,
        AnalyticsFormat.percent => RptFormat.percent,
      };
}

String formatAnalytics(AnalyticsFormat f, double v) => switch (f) {
      AnalyticsFormat.money => Formatters.currency(v),
      AnalyticsFormat.percent => '${v.toStringAsFixed(1)}%',
      AnalyticsFormat.number => _grouped(v),
    };

/// Short form for axis ticks and tight tiles.
String compactAnalytics(AnalyticsFormat f, double v) => switch (f) {
      AnalyticsFormat.money => Formatters.currencyCompact(v),
      AnalyticsFormat.percent => '${v.round()}%',
      AnalyticsFormat.number => v.abs() >= 1000
          ? '${(v / 1000).toStringAsFixed(v.abs() >= 10000 ? 0 : 1)}k'
          : v.round().toString(),
    };

String _grouped(double v) {
  final s = v.round().abs().toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(',');
    b.write(s[i]);
  }
  return '${v < 0 ? '-' : ''}$b';
}

/// The seven analytics views of web's `/analytics`, in display order.
///
/// `flow` views are per-day amounts that add up; `snapshot` (retention) is a
/// level measured each day and is never summed. Titles and labels are the
/// web's corrected ones: the API returns the *invoiced* total in a field
/// named `expenses` for payment collection, and retention is a daily
/// active-member count, not a rate.
enum AnalyticsView {
  revenue,
  attendance,
  membershipGrowth,
  newMembers,
  retention,
  collection,
  branches,
}

extension AnalyticsViewX on AnalyticsView {
  String get title => switch (this) {
        AnalyticsView.revenue => 'Revenue Trends',
        AnalyticsView.attendance => 'Attendance Trends',
        AnalyticsView.membershipGrowth => 'Membership Growth',
        AnalyticsView.newMembers => 'New Member Growth',
        AnalyticsView.retention => 'Member Retention',
        AnalyticsView.collection => 'Payment Collection',
        AnalyticsView.branches => 'Branch Comparison',
      };

  String get subtitle => switch (this) {
        AnalyticsView.revenue => 'Income vs expenses per day',
        AnalyticsView.attendance => 'Check-ins per day',
        AnalyticsView.membershipGrowth => 'New memberships assigned per day',
        AnalyticsView.newMembers => 'Members who joined per day',
        AnalyticsView.retention => 'Active members, counted each day',
        AnalyticsView.collection =>
          'Collected payments vs invoiced amounts per day',
        AnalyticsView.branches => 'Members, revenue and attendance by branch',
      };

  IconData get icon => switch (this) {
        AnalyticsView.revenue => Icons.trending_up_rounded,
        AnalyticsView.attendance => Icons.monitor_heart_outlined,
        AnalyticsView.membershipGrowth => Icons.groups_rounded,
        AnalyticsView.newMembers => Icons.person_add_alt_1_rounded,
        AnalyticsView.retention => Icons.repeat_rounded,
        AnalyticsView.collection => Icons.account_balance_wallet_outlined,
        AnalyticsView.branches => Icons.compare_arrows_rounded,
      };

  /// Accent per view (web's catalogue accents: finance green, attendance
  /// teal, members indigo, analytics violet, operations amber).
  Color get color => switch (this) {
        AnalyticsView.revenue => TeamColors.green,
        AnalyticsView.attendance => TeamColors.teal,
        AnalyticsView.membershipGrowth => TeamColors.indigo,
        AnalyticsView.newMembers => TeamColors.violet,
        AnalyticsView.retention => TeamColors.fuchsia,
        AnalyticsView.collection => TeamColors.sky,
        AnalyticsView.branches => TeamColors.amber,
      };

  /// The export endpoint's report type (web: `analytics-${slug}`).
  String get exportType => switch (this) {
        AnalyticsView.revenue => 'analytics-revenue-trends',
        AnalyticsView.attendance => 'analytics-attendance-trends',
        AnalyticsView.membershipGrowth => 'analytics-membership-growth',
        AnalyticsView.newMembers => 'analytics-new-member-growth',
        AnalyticsView.retention => 'analytics-retention',
        AnalyticsView.collection => 'analytics-payment-collection',
        AnalyticsView.branches => 'analytics-branch-comparison',
      };

  bool get isSnapshot => this == AnalyticsView.retention;
  bool get isSeries => this != AnalyticsView.branches;

  AnalyticsFormat get format =>
      (this == AnalyticsView.revenue || this == AnalyticsView.collection)
          ? AnalyticsFormat.money
          : AnalyticsFormat.number;

  /// Two-series views: labels of the API's `income` (a) and `expenses` (b).
  (String a, String b)? get dual => switch (this) {
        AnalyticsView.revenue => ('Income', 'Expenses'),
        AnalyticsView.collection => ('Collected', 'Invoiced'),
        _ => null,
      };

  /// Label of the single (or first) series.
  String get seriesLabel => switch (this) {
        AnalyticsView.revenue => 'Income',
        AnalyticsView.attendance => 'Check-ins',
        AnalyticsView.membershipGrowth => 'New memberships',
        AnalyticsView.newMembers => 'New members',
        AnalyticsView.retention => 'Active members (daily)',
        AnalyticsView.collection => 'Collected',
        AnalyticsView.branches => 'Revenue',
      };

  /// Retention is a level, so it is drawn as a line; the rest as areas.
  bool get lineOnly => this == AnalyticsView.retention;
}

/// One plotted day: current (`a`, optional `b`) and the aligned
/// previous-period values (`pa`, `pb`).
class AnalyticsRow {
  const AnalyticsRow({
    required this.label,
    required this.tip,
    required this.a,
    this.b,
    this.pa,
    this.pb,
  });

  final String label;
  final String tip;
  final double a;
  final double? b;
  final double? pa;
  final double? pb;
}

/// Raw API points, normalised: counts (`{date,value}`) become `a`; money
/// pairs (`{date,income,expenses}`) become `a` and `b`.
class AnalyticsPoint {
  const AnalyticsPoint(this.date, this.a, [this.b]);

  final String date;
  final double a;
  final double? b;

  static List<AnalyticsPoint> fromCounts(List<TrendPoint> raw) =>
      [for (final p in raw) AnalyticsPoint(p.date, p.value.toDouble())];

  static List<AnalyticsPoint> fromMoney(List<RevenueTrendPoint> raw) =>
      [for (final p in raw) AnalyticsPoint(p.date, p.income, p.expenses)];
}

const _months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov',
  'Dec', //
];

/// "18 Oct" from `YYYY-MM-DD` (no timezone maths).
String analyticsShortDate(String iso) {
  final p = (iso.length > 10 ? iso.substring(0, 10) : iso).split('-');
  if (p.length != 3) return iso;
  final m = int.tryParse(p[1]);
  final d = int.tryParse(p[2]);
  if (m == null || d == null || m < 1 || m > 12) return iso;
  return '$d ${_months[m - 1]}';
}

/// Web's `mergeSeries`: previous values are matched to current ones by
/// position (both ranges have the same length).
List<AnalyticsRow> mergeSeries(
  List<AnalyticsPoint> current,
  List<AnalyticsPoint>? previous,
) =>
    [
      for (var i = 0; i < current.length; i++)
        AnalyticsRow(
          label: analyticsShortDate(current[i].date),
          tip: current[i].date,
          a: current[i].a,
          b: current[i].b,
          pa: previous != null && i < previous.length ? previous[i].a : null,
          pb: previous != null && i < previous.length ? previous[i].b : null,
        ),
    ];

/// The range of equal length that ends the day before [from] (web's
/// `previousRange`). Inputs and outputs are `YYYY-MM-DD`.
({String from, String to}) previousRange(String from, String to) =>
    rptPreviousRange(from, to);

/// Summary numbers for the stats row (web's `computeStats`).
class AnalyticsStats {
  const AnalyticsStats({
    required this.total,
    required this.average,
    required this.latest,
    required this.peak,
    required this.peakDate,
    this.prevTotal,
    this.prevAverage,
    this.prevLatest,
    this.totalB,
    this.prevTotalB,
    this.change,
  });

  final double total;
  final double average;
  final double latest;
  final double peak;
  final String peakDate;
  final double? prevTotal;
  final double? prevAverage;
  final double? prevLatest;
  final double? totalB;
  final double? prevTotalB;

  /// % change of the total (flow) or latest (snapshot) vs previous; null
  /// without a previous period or when it was 0.
  final double? change;
}

AnalyticsStats computeStats(List<AnalyticsRow> rows, {required bool snapshot}) {
  final n = rows.isEmpty ? 1 : rows.length;
  final hasPrev = rows.any((r) => r.pa != null);
  final total = rows.fold<double>(0, (s, r) => s + r.a);
  final prevTotal =
      hasPrev ? rows.fold<double>(0, (s, r) => s + (r.pa ?? 0)) : null;
  final latest = rows.isEmpty ? 0.0 : rows.last.a;
  final prevWithValue = rows.where((r) => r.pa != null).toList();
  final prevLatest =
      hasPrev && prevWithValue.isNotEmpty ? prevWithValue.last.pa : null;
  var peak = 0.0;
  var peakDate = '';
  for (final r in rows) {
    if (r.a > peak || peakDate.isEmpty) {
      peak = r.a;
      peakDate = r.tip;
    }
  }
  final basis = snapshot ? latest : total;
  final prevBasis = snapshot ? prevLatest : prevTotal;
  final hasB = rows.any((r) => r.b != null);
  return AnalyticsStats(
    total: total,
    prevTotal: prevTotal,
    average: total / n,
    prevAverage: prevTotal != null ? prevTotal / n : null,
    latest: latest,
    prevLatest: prevLatest,
    peak: peak,
    peakDate: peakDate,
    change: prevBasis != null && prevBasis != 0
        ? (basis - prevBasis) / prevBasis * 100
        : null,
    totalB: hasB ? rows.fold<double>(0, (s, r) => s + (r.b ?? 0)) : null,
    prevTotalB: hasB && hasPrev
        ? rows.fold<double>(0, (s, r) => s + (r.pb ?? 0))
        : null,
  );
}

/// Web's `pctChange`: null when there is no baseline to compare with.
double? analyticsPct(double value, double? previous) {
  if (previous == null) return null;
  if (previous <= 0) return value > 0 ? null : 0;
  return (value - previous) / previous * 100;
}
