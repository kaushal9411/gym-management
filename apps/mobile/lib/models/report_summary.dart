import 'payments_analytics.dart';

/// Mirrors `GET /reports/:type/summary` (perm `reports:view`,
/// `ReportSummaryDto` in `report-summary.util.ts`) — one generic shape for
/// all 11 tabular report types. `range`/`previousRange` are absent for
/// point-in-time types (membership, staff, ...), so they are nullable here.
class ReportSummary {
  const ReportSummary({
    required this.range,
    required this.previousRange,
    required this.kpis,
    required this.breakdowns,
    required this.series,
  });

  final AnalyticsRange? range;
  final AnalyticsRange? previousRange;
  final List<SummaryKpi> kpis;
  final List<SummaryBreakdown> breakdowns;
  final SummarySeries? series;

  bool get isEmpty => kpis.isEmpty && breakdowns.isEmpty && series == null;

  factory ReportSummary.fromJson(Map<String, dynamic> j) {
    final r = j['range'];
    final p = j['previousRange'];
    final s = j['series'];
    return ReportSummary(
      range: r is Map<String, dynamic> ? AnalyticsRange.fromJson(r) : null,
      previousRange:
          p is Map<String, dynamic> ? AnalyticsRange.fromJson(p) : null,
      kpis: jsonList(j['kpis']).map(SummaryKpi.fromJson).toList(),
      breakdowns:
          jsonList(j['breakdowns']).map(SummaryBreakdown.fromJson).toList(),
      series: s is Map<String, dynamic> ? SummarySeries.fromJson(s) : null,
    );
  }
}

enum SummaryFormat { number, money, percent, text }

SummaryFormat _formatOf(Object? v) => switch (v) {
      'money' => SummaryFormat.money,
      'percent' => SummaryFormat.percent,
      'text' => SummaryFormat.text,
      _ => SummaryFormat.number,
    };

class SummaryKpi {
  const SummaryKpi({
    required this.key,
    required this.label,
    required this.format,
    required this.value,
    required this.previous,
    required this.text,
  });

  final String key;
  final String label;
  final SummaryFormat format;

  /// Numeric value (money strings parsed); 0 for `text` KPIs.
  final double value;

  /// Null when the API sent no `previous` (point-in-time KPIs).
  final double? previous;

  /// Raw value as text — what a `text` KPI displays.
  final String text;

  /// Percent change vs previous; null without a baseline (never "+100%").
  double? get deltaPercent {
    final p = previous;
    if (p == null || p <= 0) return null;
    return (value - p) / p * 100;
  }

  /// `percent` KPIs are NOT uniform on the backend: payments' `success-rate`
  /// is a 0..1 ratio, member-progress averages are already 0..100.
  double get percentScale => key == 'success-rate' ? 100 : 1;

  factory SummaryKpi.fromJson(Map<String, dynamic> j) {
    final raw = j['value'];
    final prev = j['previous'];
    return SummaryKpi(
      key: j['key'] as String? ?? '',
      label: j['label'] as String? ?? '',
      format: _formatOf(j['format']),
      value: jsonMoney(raw),
      previous: prev == null ? null : jsonMoney(prev),
      text: raw?.toString() ?? '',
    );
  }
}

class SummaryItem {
  const SummaryItem({
    required this.label,
    required this.value,
    required this.previous,
  });

  final String label;
  final double value;
  final double? previous;

  factory SummaryItem.fromJson(Map<String, dynamic> j) => SummaryItem(
        label: j['label'] as String? ?? '',
        value: jsonMoney(j['value']),
        previous: j['previous'] == null ? null : jsonMoney(j['previous']),
      );
}

class SummaryBreakdown {
  const SummaryBreakdown({
    required this.key,
    required this.title,
    required this.kind,
    required this.items,
  });

  final String key;
  final String title;

  /// `donut` or `bar` — the phone UI renders both as share bars.
  final String kind;
  final List<SummaryItem> items;

  factory SummaryBreakdown.fromJson(Map<String, dynamic> j) => SummaryBreakdown(
        key: j['key'] as String? ?? '',
        title: j['title'] as String? ?? '',
        kind: j['kind'] as String? ?? 'bar',
        items: jsonList(j['items']).map(SummaryItem.fromJson).toList(),
      );
}

class SummaryPoint {
  const SummaryPoint({
    required this.date,
    required this.value,
    required this.previous,
  });

  final String date;
  final double value;
  final double previous;

  factory SummaryPoint.fromJson(Map<String, dynamic> j) => SummaryPoint(
        date: j['date'] as String? ?? '',
        value: jsonMoney(j['value']),
        previous: jsonMoney(j['previous']),
      );
}

class SummarySeries {
  const SummarySeries({required this.title, required this.points});

  final String title;
  final List<SummaryPoint> points;

  factory SummarySeries.fromJson(Map<String, dynamic> j) => SummarySeries(
        title: j['title'] as String? ?? '',
        points: jsonList(j['points']).map(SummaryPoint.fromJson).toList(),
      );
}

/// The filters a report list screen already holds, forwarded to
/// `GET /reports/:type/summary` (same names as the list endpoints, minus
/// paging). All optional; date fields apply only to date-ranged types.
class ReportSummaryFilters {
  const ReportSummaryFilters({
    this.from,
    this.to,
    this.branchId,
    this.planId,
    this.trainerId,
    this.memberStatus,
    this.paymentStatus,
  });

  final DateTime? from;
  final DateTime? to;
  final String? branchId;
  final String? planId;
  final String? trainerId;
  final String? memberStatus;
  final String? paymentStatus;

  @override
  bool operator ==(Object other) =>
      other is ReportSummaryFilters &&
      other.from == from &&
      other.to == to &&
      other.branchId == branchId &&
      other.planId == planId &&
      other.trainerId == trainerId &&
      other.memberStatus == memberStatus &&
      other.paymentStatus == paymentStatus;

  @override
  int get hashCode => Object.hash(
        from,
        to,
        branchId,
        planId,
        trainerId,
        memberStatus,
        paymentStatus,
      );
}
