import 'dart:math' as math;

import 'rpt_format.dart';

/// Pure chart maths for the report kit (scales, ticks, series building,
/// hit-testing, heatmap matrices). No Flutter widgets in here, so every
/// function is unit-tested directly (`test/models/rpt_chart_math_test.dart`).

// ── axis ────────────────────────────────────────────────────────────────────

/// A y axis: `0 .. max` with evenly spaced "nice" [ticks] (1/2/2.5/5 x 10^n).
class RptAxis {
  const RptAxis(this.max, this.ticks);

  final double max;
  final List<double> ticks;
}

/// Builds a nice axis that covers [dataMax]. With [integers] the step never
/// drops below 1 (counts must not get `0.5` ticks).
RptAxis rptNiceAxis(
  double dataMax, {
  int divisions = 4,
  bool integers = false,
}) {
  if (!dataMax.isFinite || dataMax <= 0) {
    return RptAxis(1, [for (var i = 0; i <= 1; i++) i.toDouble()]);
  }
  final rough = dataMax / divisions;
  final mag = math.pow(10, (math.log(rough) / math.ln10).floor()).toDouble();
  final residual = rough / mag;
  final nice = residual <= 1
      ? 1.0
      : residual <= 2
          ? 2.0
          : residual <= 2.5
              ? 2.5
              : residual <= 5
                  ? 5.0
                  : 10.0;
  var step = nice * mag;
  if (integers && step < 1) step = 1;
  final steps = (dataMax / step).ceil().clamp(1, 12);
  return RptAxis(step * steps, [for (var i = 0; i <= steps; i++) step * i]);
}

// ── series ──────────────────────────────────────────────────────────────────

/// One x position of a this-vs-previous chart. [label] is the axis text,
/// [tip] the longer heading shown when inspecting, [previous] the same slot
/// in the previous period (null = no previous data).
class RptPoint {
  const RptPoint({
    required this.label,
    required this.value,
    this.previous,
    String? tip,
  }) : tip = tip ?? label;

  final String label;
  final String tip;
  final double value;
  final double? previous;
}

/// How a trend is bucketed (web's Daily / Weekly / Cumulative).
enum RptTrendMode { daily, weekly, cumulative }

extension RptTrendModeX on RptTrendMode {
  String get label => switch (this) {
        RptTrendMode.daily => 'Daily',
        RptTrendMode.weekly => 'Weekly',
        RptTrendMode.cumulative => 'Cumulative',
      };
}

/// Re-buckets a daily series: [RptTrendMode.daily] as is, weekly = chunks of
/// 7 days (summed, labelled `Wk 1..`), cumulative = running totals. A
/// previous value stays null when none of its inputs were known.
List<RptPoint> rptBuildTrend(List<RptPoint> daily, RptTrendMode mode) {
  switch (mode) {
    case RptTrendMode.daily:
      return daily;
    case RptTrendMode.weekly:
      final out = <RptPoint>[];
      for (var i = 0; i < daily.length; i += 7) {
        final chunk = daily.sublist(i, math.min(i + 7, daily.length));
        final hasPrev = chunk.any((p) => p.previous != null);
        out.add(
          RptPoint(
            label: 'Wk ${i ~/ 7 + 1}',
            tip: chunk.length == 1
                ? chunk.first.tip
                : '${chunk.first.tip} – ${chunk.last.tip}',
            value: chunk.fold(0.0, (s, p) => s + p.value),
            previous: hasPrev
                ? chunk.fold<double>(0, (s, p) => s + (p.previous ?? 0))
                : null,
          ),
        );
      }
      return out;
    case RptTrendMode.cumulative:
      var cur = 0.0;
      var prev = 0.0;
      return [
        for (final p in daily)
          () {
            cur += p.value;
            if (p.previous != null) prev += p.previous!;
            return RptPoint(
              label: p.label,
              tip: p.tip,
              value: cur,
              previous: p.previous == null ? null : prev,
            );
          }(),
      ];
  }
}

/// Share (0..1) of each value in the total; all zeros when the total is 0.
List<double> rptShares(List<double> values) {
  final total = values.fold<double>(0, (s, v) => s + math.max(v, 0));
  if (total <= 0) return List<double>.filled(values.length, 0);
  return [for (final v in values) math.max(v, 0) / total];
}

// ── hit testing ─────────────────────────────────────────────────────────────

/// Index of the point nearest to [dx] on a line chart whose first / last
/// point sit on the plot's left / right edge.
int rptPickLineIndex(
  double dx, {
  required double left,
  required double right,
  required double width,
  required int n,
}) {
  if (n <= 1) return 0;
  final inner = width - left - right;
  final t = inner <= 0 ? 0.0 : ((dx - left) / inner).clamp(0.0, 1.0);
  return (t * (n - 1)).round();
}

/// Index of the band containing [dx] on a bar chart with [n] equal bands.
int rptPickBandIndex(
  double dx, {
  required double left,
  required double right,
  required double width,
  required int n,
}) {
  if (n <= 1) return 0;
  final inner = width - left - right;
  if (inner <= 0) return 0;
  final t = ((dx - left) / inner).clamp(0.0, 0.999999);
  return (t * n).floor().clamp(0, n - 1);
}

/// Staggered 0..1 progress for the [i]-th of [n] bars while the whole chart
/// animates [t] 0..1 (bars grow one after another).
double rptStagger(double t, int i, int n, {double spread = 0.4}) {
  if (n <= 1 || t >= 1) return t.clamp(0.0, 1.0);
  final shifted = t * (1 + spread) - (i / (n - 1)) * spread;
  return shifted.clamp(0.0, 1.0);
}

// ── heatmap matrices ────────────────────────────────────────────────────────

/// Values for a heatmap: `values[row][col]`, with optional per-cell [titles].
class RptHeatMatrix {
  const RptHeatMatrix({
    required this.rows,
    required this.cols,
    required this.values,
    required this.titles,
  });

  final List<String> rows;
  final List<String> cols;
  final List<List<double>> values;
  final List<List<String>> titles;

  double get max {
    var m = 0.0;
    for (final r in values) {
      for (final v in r) {
        if (v > m) m = v;
      }
    }
    return m;
  }
}

/// A single-row matrix of 24 hours (counts indexed 0..23): axis ticks `12a`,
/// `1a` .. `11p`, titles `6 PM`.
RptHeatMatrix rptHourMatrix(List<double> byHour, {String row = 'Check-ins'}) {
  final counts = List<double>.generate(
    24,
    (h) => h < byHour.length ? byHour[h] : 0,
  );
  return RptHeatMatrix(
    rows: [row],
    cols: [for (var h = 0; h < 24; h++) rptHourTick(h)],
    values: [counts],
    titles: [
      [for (var h = 0; h < 24; h++) rptHourLabel(h)],
    ],
  );
}

/// Dated values -> Monday-first weekday rows x week columns (a calendar
/// heatmap). Dates are `YYYY-MM-DD` strings; missing days are 0.
RptHeatMatrix rptCalendarMatrix(List<({String date, double value})> points) {
  const rows = kRptWeekdays;
  if (points.isEmpty) {
    return RptHeatMatrix(
      rows: rows,
      cols: const [],
      values: [for (final _ in rows) <double>[]],
      titles: [for (final _ in rows) <String>[]],
    );
  }
  DateTime parse(String s) {
    final p = s.substring(0, 10).split('-');
    return DateTime.utc(int.parse(p[0]), int.parse(p[1]), int.parse(p[2]));
  }

  String key(DateTime d) => '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';
  final sorted = [...points]..sort((a, b) => a.date.compareTo(b.date));
  final byDate = {for (final p in sorted) p.date.substring(0, 10): p.value};
  final first = parse(sorted.first.date);
  final last = parse(sorted.last.date);
  final start = first.subtract(Duration(days: first.weekday - 1));
  final weeks = last.difference(start).inDays ~/ 7 + 1;
  final values = [for (final _ in rows) List<double>.filled(weeks, 0)];
  final titles = [for (final _ in rows) List<String>.filled(weeks, '')];
  final cols = <String>[];
  for (var w = 0; w < weeks; w++) {
    final wk = start.add(Duration(days: w * 7));
    cols.add(rptShortDate(key(wk)));
    for (var d = 0; d < 7; d++) {
      final day = wk.add(Duration(days: d));
      values[d][w] = byDate[key(day)] ?? 0;
      titles[d][w] = '${kRptWeekdays[d]} ${rptShortDate(key(day))}';
    }
  }
  return RptHeatMatrix(rows: rows, cols: cols, values: values, titles: titles);
}

/// Colour strength (0.14 .. 0.94) of a heatmap cell with [v] out of [max];
/// an empty cell is 0.
double rptHeatAlpha(double v, double max) {
  if (v <= 0 || max <= 0) return 0;
  return 0.14 + (v / max).clamp(0.0, 1.0) * 0.8;
}
