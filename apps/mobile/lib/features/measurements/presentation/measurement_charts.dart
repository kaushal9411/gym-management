import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/body_measurement.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'measurement_ui.dart';

/// One plotted line. [values] is aligned with the chart's x labels; a null
/// leaves a gap that the line simply bridges (web's `connectNulls`).
class ChartSeries {
  const ChartSeries({
    required this.label,
    required this.color,
    required this.values,
    required this.unit,
    this.fill = false,
  });

  final String label;
  final Color color;
  final List<double?> values;

  /// `kg`, `%`, `cm` — shown in the readout.
  final String unit;

  /// Area gradient under the line.
  final bool fill;

  bool get hasData => values.any((v) => v != null);
}

/// A drawn-in line chart with tap / drag inspection — the mobile counterpart
/// of web's recharts trend charts. With [separateScales] the first series
/// uses the left axis and the second its own right axis (weight vs body fat);
/// otherwise every series shares one axis (girths).
class MeasurementLineChart extends StatefulWidget {
  const MeasurementLineChart({
    super.key,
    required this.labels,
    required this.series,
    this.separateScales = false,
    this.height = 190,
  });

  final List<String> labels;
  final List<ChartSeries> series;
  final bool separateScales;
  final double height;

  @override
  State<MeasurementLineChart> createState() => _MeasurementLineChartState();
}

class _MeasurementLineChartState extends State<MeasurementLineChart> {
  int? _selected;

  static const _leftPad = 38.0;
  static const _topPad = 10.0;
  static const _bottomPad = 22.0;

  double get _rightPad => widget.separateScales ? 38.0 : 10.0;

  void _pick(double dx, double width) {
    final n = widget.labels.length;
    if (n == 0) return;
    final inner = width - _leftPad - _rightPad;
    final t = inner <= 0 ? 0.0 : ((dx - _leftPad) / inner).clamp(0.0, 1.0);
    final i = n == 1 ? 0 : (t * (n - 1)).round();
    if (i != _selected) setState(() => _selected = i);
  }

  @override
  Widget build(BuildContext context) {
    final sel = _selected;
    final series = widget.series.where((s) => s.hasData).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 36,
          child: sel == null || sel >= widget.labels.length
              ? Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Tap the chart to inspect a check-in',
                    style: AppText.body(
                      size: 11.5,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
                )
              : Wrap(
                  spacing: 10,
                  runSpacing: 2,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      widget.labels[sel],
                      style: AppText.body(size: 12, weight: FontWeight.w800),
                    ),
                    for (final s in series)
                      if (sel < s.values.length && s.values[sel] != null)
                        Text(
                          '${s.label} ${fmtNum(s.values[sel]!)}${s.unit == '%' ? '%' : ' ${s.unit}'}',
                          style: AppText.body(
                            size: 12,
                            weight: FontWeight.w800,
                            color: s.color,
                          ),
                        ),
                  ],
                ),
        ),
        LayoutBuilder(
          builder: (context, c) => GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (d) => _pick(d.localPosition.dx, c.maxWidth),
            onHorizontalDragUpdate: (d) =>
                _pick(d.localPosition.dx, c.maxWidth),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 1400),
              curve: Curves.easeOutCubic,
              builder: (context, t, _) => CustomPaint(
                size: Size(c.maxWidth, widget.height),
                painter: _LinePainter(
                  labels: widget.labels,
                  series: series,
                  separate: widget.separateScales && series.length > 1,
                  progress: t,
                  selected: sel,
                  grid: AppColors.line,
                  text: AppColors.inkFaint,
                  surface: AppColors.surface,
                  leftPad: _leftPad,
                  rightPad: _rightPad,
                  topPad: _topPad,
                  bottomPad: _bottomPad,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 14,
          runSpacing: 4,
          children: [
            for (final s in series)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 9,
                    height: 9,
                    decoration: BoxDecoration(
                      color: s.color,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    '${s.label} (${s.unit})',
                    style: AppText.body(
                      size: 11.5,
                      weight: FontWeight.w700,
                      color: AppColors.inkSoft,
                    ),
                  ),
                ],
              ),
          ],
        ),
      ],
    );
  }
}

class _Axis {
  _Axis(this.min, this.max);
  final double min;
  final double max;
  double y(double v, double top, double h) =>
      top + (1 - (v - min) / (max - min)) * h;
}

_Axis _axisFor(Iterable<ChartSeries> series) {
  var lo = double.infinity;
  var hi = double.negativeInfinity;
  for (final s in series) {
    for (final v in s.values) {
      if (v == null) continue;
      lo = math.min(lo, v);
      hi = math.max(hi, v);
    }
  }
  if (lo == double.infinity) return _Axis(0, 1);
  if (hi - lo < 0.0001) return _Axis(lo - 1, hi + 1);
  final pad = (hi - lo) * 0.1;
  return _Axis(lo - pad, hi + pad);
}

class _LinePainter extends CustomPainter {
  _LinePainter({
    required this.labels,
    required this.series,
    required this.separate,
    required this.progress,
    required this.selected,
    required this.grid,
    required this.text,
    required this.surface,
    required this.leftPad,
    required this.rightPad,
    required this.topPad,
    required this.bottomPad,
  });

  final List<String> labels;
  final List<ChartSeries> series;
  final bool separate;
  final double progress;
  final int? selected;
  final Color grid;
  final Color text;
  final Color surface;
  final double leftPad;
  final double rightPad;
  final double topPad;
  final double bottomPad;

  void _label(
    Canvas canvas,
    String s,
    Offset at, {
    TextAlign align = TextAlign.left,
    Color? color,
  }) {
    final tp = TextPainter(
      text: TextSpan(
        text: s,
        style: TextStyle(
          fontSize: 10,
          color: color ?? text,
          fontWeight: FontWeight.w600,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final dx = switch (align) {
      TextAlign.right => at.dx - tp.width,
      TextAlign.center => at.dx - tp.width / 2,
      _ => at.dx,
    };
    tp.paint(canvas, Offset(dx, at.dy - tp.height / 2));
  }

  String _tick(double v, double span) =>
      span >= 8 ? v.round().toString() : v.toStringAsFixed(1);

  @override
  void paint(Canvas canvas, Size size) {
    final n = labels.length;
    if (n == 0 || series.isEmpty) return;
    final w = size.width - leftPad - rightPad;
    final h = size.height - topPad - bottomPad;
    if (w <= 0 || h <= 0) return;

    final left = _axisFor(separate ? [series.first] : series);
    final right = separate ? _axisFor(series.skip(1)) : null;

    double x(int i) => leftPad + (n == 1 ? w / 2 : i * w / (n - 1));

    // Grid + y ticks.
    final gridPaint = Paint()
      ..color = grid
      ..strokeWidth = 1;
    for (var k = 0; k <= 3; k++) {
      final gy = topPad + h * k / 3;
      canvas.drawLine(Offset(leftPad, gy), Offset(leftPad + w, gy), gridPaint);
      final lv = left.max - (left.max - left.min) * k / 3;
      _label(
        canvas,
        _tick(lv, left.max - left.min),
        Offset(leftPad - 6, gy),
        align: TextAlign.right,
        color: separate ? series.first.color : null,
      );
      if (right != null) {
        final rv = right.max - (right.max - right.min) * k / 3;
        _label(
          canvas,
          _tick(rv, right.max - right.min),
          Offset(leftPad + w + 6, gy),
          color: series[1].color,
        );
      }
    }

    // x labels: first, last and a couple in between.
    final ticks = n <= 4
        ? List.generate(n, (i) => i)
        : <int>{0, (n - 1) ~/ 3, 2 * (n - 1) ~/ 3, n - 1}.toList();
    for (final i in ticks) {
      _label(
        canvas,
        labels[i],
        Offset(x(i), size.height - 8),
        align: i == 0
            ? TextAlign.left
            : i == n - 1
                ? TextAlign.right
                : TextAlign.center,
      );
    }

    // Lines, drawn left to right.
    canvas.save();
    canvas
        .clipRect(Rect.fromLTWH(0, 0, leftPad + w * progress + 6, size.height));
    for (var si = 0; si < series.length; si++) {
      final s = series[si];
      final axis = separate && si > 0 ? right! : left;
      final pts = <Offset>[
        for (var i = 0; i < n && i < s.values.length; i++)
          if (s.values[i] != null)
            Offset(x(i), axis.y(s.values[i]!, topPad, h)),
      ];
      if (pts.isEmpty) continue;
      final path = Path()..moveTo(pts.first.dx, pts.first.dy);
      for (var i = 1; i < pts.length; i++) {
        final p0 = pts[i - 1];
        final p1 = pts[i];
        final mx = (p0.dx + p1.dx) / 2;
        path.cubicTo(mx, p0.dy, mx, p1.dy, p1.dx, p1.dy);
      }
      if (s.fill && pts.length > 1) {
        final area = Path.from(path)
          ..lineTo(pts.last.dx, topPad + h)
          ..lineTo(pts.first.dx, topPad + h)
          ..close();
        canvas.drawPath(
          area,
          Paint()
            ..shader = LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                s.color.withValues(alpha: 0.32),
                s.color.withValues(alpha: 0.02),
              ],
            ).createShader(Rect.fromLTWH(leftPad, topPad, w, h)),
        );
      }
      canvas.drawPath(
        path,
        Paint()
          ..color = s.color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.6
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round,
      );
      for (final p in pts) {
        canvas.drawCircle(p, 3.6, Paint()..color = surface);
        canvas.drawCircle(
          p,
          3.6,
          Paint()
            ..color = s.color
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2,
        );
      }
    }
    canvas.restore();

    // Selection guide.
    final sel = selected;
    if (sel != null && sel < n) {
      canvas.drawLine(
        Offset(x(sel), topPad),
        Offset(x(sel), topPad + h),
        Paint()
          ..color = text.withValues(alpha: 0.5)
          ..strokeWidth = 1,
      );
      for (var si = 0; si < series.length; si++) {
        final s = series[si];
        if (sel >= s.values.length || s.values[sel] == null) continue;
        final axis = separate && si > 0 ? right! : left;
        canvas.drawCircle(
          Offset(x(sel), axis.y(s.values[sel]!, topPad, h)),
          5.4,
          Paint()..color = s.color,
        );
      }
    }
  }

  @override
  bool shouldRepaint(_LinePainter old) =>
      old.progress != progress ||
      old.selected != selected ||
      old.series != series ||
      old.labels != labels ||
      old.grid != grid ||
      old.text != text;
}

// ── the staff trend card body ───────────────────────────────────────────────

/// Weight + body-fat trend over every recorded entry (web's
/// `MeasurementTrendChart`). [entries] are newest first, as the API returns
/// them; the chart reads oldest to newest.
class MeasurementTrendBody extends StatelessWidget {
  const MeasurementTrendBody({super.key, required this.entries});

  final List<BodyMeasurement> entries;

  @override
  Widget build(BuildContext context) {
    final asc = entries.reversed.toList();
    final weights = [for (final e in asc) e.weightKg];
    final fats = [for (final e in asc) e.bodyFatPercent];
    final hasWeight = weights.any((v) => v != null);
    final hasFat = fats.any((v) => v != null);
    if (!hasWeight || asc.length < 2) {
      return SizedBox(
        height: 150,
        child: Center(
          child: Text(
            entries.isEmpty
                ? 'No measurements recorded yet.'
                : 'Record at least two entries with weight to see a trend.',
            textAlign: TextAlign.center,
            style: AppText.body(size: 13, color: AppColors.inkFaint),
          ),
        ),
      );
    }
    return MeasurementLineChart(
      labels: [for (final e in asc) shortDay(e.recordedAt)],
      separateScales: hasFat,
      series: [
        ChartSeries(
          label: 'Weight',
          color: TeamColors.teal,
          values: weights,
          unit: 'kg',
          fill: true,
        ),
        if (hasFat)
          ChartSeries(
            label: 'Body fat',
            color: TeamColors.fuchsia,
            values: fats,
            unit: '%',
          ),
      ],
    );
  }
}
