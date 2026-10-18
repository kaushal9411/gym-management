import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/ledger_analytics.dart';
import 'income_ui.dart';

/// Web's trend-chart modes (all derived on the device from `analytics.daily`).
enum IncomeTrendMode { daily, weekly, cumulative }

extension IncomeTrendModeX on IncomeTrendMode {
  String get label => switch (this) {
        IncomeTrendMode.daily => 'Daily',
        IncomeTrendMode.weekly => 'Weekly',
        IncomeTrendMode.cumulative => 'Cumulative',
      };
}

/// One plotted x position: this period vs the previous one.
class TrendPoint {
  const TrendPoint({
    required this.label,
    required this.tip,
    required this.current,
    required this.previous,
  });

  final String label;
  final String tip;
  final double current;
  final double previous;
}

/// web's `buildSeries`: daily as-is, weekly = chunks of 7 days, cumulative =
/// running totals.
List<TrendPoint> buildTrendSeries(List<LedgerDay> daily, IncomeTrendMode mode) {
  if (mode == IncomeTrendMode.weekly) {
    final out = <TrendPoint>[];
    for (var i = 0; i < daily.length; i += 7) {
      final chunk = daily.sublist(i, math.min(i + 7, daily.length));
      out.add(
        TrendPoint(
          label: 'Wk ${i ~/ 7 + 1}',
          tip: '${shortDay(chunk.first.date)} – ${shortDay(chunk.last.date)}',
          current: chunk.fold(0.0, (s, d) => s + d.total),
          previous: chunk.fold(0.0, (s, d) => s + d.previousTotal),
        ),
      );
    }
    return out;
  }
  var cur = 0.0;
  var prev = 0.0;
  return [
    for (final d in daily)
      () {
        cur += d.total;
        prev += d.previousTotal;
        return TrendPoint(
          label: shortDay(d.date),
          tip: shortDay(d.date),
          current: mode == IncomeTrendMode.cumulative ? cur : d.total,
          previous: mode == IncomeTrendMode.cumulative ? prev : d.previousTotal,
        );
      }(),
  ];
}

/// This-vs-previous area chart with tap / drag inspection — the mobile
/// counterpart of web's recharts hover tooltip.
class IncomeTrendChart extends StatefulWidget {
  const IncomeTrendChart({
    super.key,
    required this.points,
    required this.compare,
    required this.color,
    this.previousLabel = 'Previous period',
    this.height = 190,
  });

  final List<TrendPoint> points;
  final bool compare;
  final Color color;
  final String previousLabel;
  final double height;

  @override
  State<IncomeTrendChart> createState() => _IncomeTrendChartState();
}

class _IncomeTrendChartState extends State<IncomeTrendChart> {
  int? _selected;

  static const _left = 46.0;
  static const _right = 10.0;

  void _pick(double dx, double width) {
    final n = widget.points.length;
    if (n == 0) return;
    final inner = width - _left - _right;
    final t = inner <= 0 ? 0.0 : ((dx - _left) / inner).clamp(0.0, 1.0);
    final i = n == 1 ? 0 : (t * (n - 1)).round();
    if (i != _selected) setState(() => _selected = i);
  }

  @override
  void didUpdateWidget(IncomeTrendChart old) {
    super.didUpdateWidget(old);
    if (_selected != null && _selected! >= widget.points.length) {
      _selected = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final sel = _selected;
    final p =
        sel == null || sel >= widget.points.length ? null : widget.points[sel];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 38,
          child: p == null
              ? Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Tap the chart to inspect a day',
                    style: AppText.body(
                      size: 11.5,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
                )
              : Wrap(
                  spacing: 12,
                  runSpacing: 2,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      p.tip,
                      style: AppText.body(size: 12, weight: FontWeight.w800),
                    ),
                    Text(
                      'This period ${money(p.current)}',
                      style: AppText.body(
                        size: 12,
                        weight: FontWeight.w800,
                        color: widget.color,
                      ),
                    ),
                    if (widget.compare)
                      Text(
                        '${widget.previousLabel} ${money(p.previous)}',
                        style: AppText.body(
                          size: 12,
                          weight: FontWeight.w700,
                          color: AppColors.inkFaint,
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
              key: ValueKey(widget.points.length),
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 900),
              curve: Curves.easeOutCubic,
              builder: (context, t, _) => CustomPaint(
                size: Size(c.maxWidth, widget.height),
                painter: _TrendPainter(
                  points: widget.points,
                  compare: widget.compare,
                  color: widget.color,
                  progress: t,
                  selected: sel,
                  grid: AppColors.line,
                  text: AppColors.inkFaint,
                  muted: AppColors.inkFaint,
                  surface: AppColors.surface,
                  left: _left,
                  right: _right,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _TrendPainter extends CustomPainter {
  _TrendPainter({
    required this.points,
    required this.compare,
    required this.color,
    required this.progress,
    required this.selected,
    required this.grid,
    required this.text,
    required this.muted,
    required this.surface,
    required this.left,
    required this.right,
  });

  final List<TrendPoint> points;
  final bool compare;
  final Color color;
  final double progress;
  final int? selected;
  final Color grid;
  final Color text;
  final Color muted;
  final Color surface;
  final double left;
  final double right;

  static const _top = 8.0;
  static const _bottom = 22.0;

  void _label(Canvas canvas, String s, Offset at, {bool rightAlign = false}) {
    final tp = TextPainter(
      text: TextSpan(
        text: s,
        style:
            TextStyle(color: text, fontSize: 10, fontWeight: FontWeight.w700),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, rightAlign ? Offset(at.dx - tp.width, at.dy) : at);
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;
    final w = size.width - left - right;
    final h = size.height - _top - _bottom;
    var maxV = 0.0;
    for (final p in points) {
      maxV = math.max(maxV, p.current);
      if (compare) maxV = math.max(maxV, p.previous);
    }
    if (maxV <= 0) maxV = 1;

    // grid + y labels (4 lines)
    final gridPaint = Paint()
      ..color = grid
      ..strokeWidth = 1;
    for (var i = 0; i <= 3; i++) {
      final y = _top + h * i / 3;
      canvas.drawLine(
        Offset(left, y),
        Offset(size.width - right, y),
        gridPaint,
      );
      _label(
        canvas,
        Formatters.currencyCompact(maxV * (1 - i / 3)),
        Offset(left - 6, y - 6),
        rightAlign: true,
      );
    }

    double xAt(int i) =>
        points.length == 1 ? left + w / 2 : left + w * i / (points.length - 1);
    double yAt(double v) => _top + h * (1 - (v / maxV) * progress);

    Path pathOf(double Function(TrendPoint) value) {
      final path = Path();
      for (var i = 0; i < points.length; i++) {
        final o = Offset(xAt(i), yAt(value(points[i])));
        if (i == 0) {
          path.moveTo(o.dx, o.dy);
        } else {
          path.lineTo(o.dx, o.dy);
        }
      }
      return path;
    }

    // previous (dashed)
    if (compare && points.length > 1) {
      final prev = pathOf((p) => p.previous);
      final paint = Paint()
        ..color = muted
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2;
      for (final m in prev.computeMetrics()) {
        var d = 0.0;
        while (d < m.length) {
          canvas.drawPath(m.extractPath(d, math.min(d + 5, m.length)), paint);
          d += 10;
        }
      }
    }

    // current: area + line
    final line = pathOf((p) => p.current);
    if (points.length > 1) {
      final area = Path.from(line)
        ..lineTo(xAt(points.length - 1), _top + h)
        ..lineTo(xAt(0), _top + h)
        ..close();
      canvas
        ..drawPath(
          area,
          Paint()
            ..shader = LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                color.withValues(alpha: 0.30),
                color.withValues(alpha: 0),
              ],
            ).createShader(Offset.zero & size),
        )
        ..drawPath(
          line,
          Paint()
            ..color = color
            ..style = PaintingStyle.stroke
            ..strokeWidth = 3
            ..strokeJoin = StrokeJoin.round
            ..strokeCap = StrokeCap.round,
        );
    } else {
      canvas.drawCircle(
        Offset(xAt(0), yAt(points.first.current)),
        5,
        Paint()..color = color,
      );
    }

    // x labels: first / middle / last
    final idx = <int>{0, points.length ~/ 2, points.length - 1}.toList()
      ..sort();
    for (final i in idx) {
      final tp = TextPainter(
        text: TextSpan(
          text: points[i].label,
          style:
              TextStyle(color: text, fontSize: 10, fontWeight: FontWeight.w700),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final x = (xAt(i) - tp.width / 2)
          .clamp(left - 4, size.width - right - tp.width + 4);
      tp.paint(canvas, Offset(x, size.height - _bottom + 6));
    }

    // selection
    final s = selected;
    if (s != null && s < points.length) {
      final x = xAt(s);
      canvas
        ..drawLine(
          Offset(x, _top),
          Offset(x, _top + h),
          Paint()
            ..color = color.withValues(alpha: 0.5)
            ..strokeWidth = 1.2,
        )
        ..drawCircle(
          Offset(x, yAt(points[s].current)),
          5.5,
          Paint()..color = surface,
        )
        ..drawCircle(
          Offset(x, yAt(points[s].current)),
          4,
          Paint()..color = color,
        );
      if (compare) {
        canvas.drawCircle(
          Offset(x, yAt(points[s].previous)),
          3.5,
          Paint()..color = muted,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _TrendPainter old) =>
      old.progress != progress ||
      old.selected != selected ||
      old.compare != compare ||
      old.points != points ||
      old.color != color ||
      old.grid != grid;
}

/// One slice of the category donut.
class IncomeSlice {
  const IncomeSlice({required this.value, required this.color});

  final double value;
  final Color color;
}

/// Category-share ring with [center] stacked in the middle.
class IncomeDonut extends StatelessWidget {
  const IncomeDonut({
    super.key,
    required this.slices,
    required this.center,
    this.size = 132,
  });

  final List<IncomeSlice> slices;
  final Widget center;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: const Duration(milliseconds: 900),
            curve: Curves.easeOutCubic,
            builder: (context, t, _) => CustomPaint(
              size: Size(size, size),
              painter: _DonutPainter(slices, t, AppColors.surface3),
            ),
          ),
          center,
        ],
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter(this.slices, this.progress, this.track);

  final List<IncomeSlice> slices;
  final double progress;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.width * 0.16;
    final rect = Rect.fromLTWH(
      stroke / 2,
      stroke / 2,
      size.width - stroke,
      size.height - stroke,
    );
    canvas.drawArc(
      rect,
      0,
      math.pi * 2,
      false,
      Paint()
        ..color = track
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke,
    );
    final total = slices.fold<double>(0, (s, e) => s + e.value);
    if (total <= 0) return;
    var start = -math.pi / 2;
    for (final s in slices) {
      final sweep = s.value / total * math.pi * 2 * progress;
      canvas.drawArc(
        rect,
        start,
        math.max(0, sweep - (slices.length > 1 ? 0.04 : 0)),
        false,
        Paint()
          ..color = s.color
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke,
      );
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter old) =>
      old.progress != progress || old.slices != slices || old.track != track;
}
