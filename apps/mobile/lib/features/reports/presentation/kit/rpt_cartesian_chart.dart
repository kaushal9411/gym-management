import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import 'rpt_chart_math.dart';
import 'rpt_format.dart';
import 'rpt_paint.dart';
import 'rpt_theme.dart';

/// How a series is drawn.
enum RptSeriesType { bar, line, area }

/// One data series of a [RptCartesianChart]. [values] has one entry per
/// x label (null = no value, the line breaks there). A [dashed] series is a
/// "previous period" overlay: drawn first, thin, dashed (lines) or muted
/// (bars).
class RptSeries {
  const RptSeries({
    required this.key,
    required this.label,
    required this.values,
    required this.color,
    this.type = RptSeriesType.line,
    this.dashed = false,
  });

  final String key;
  final String label;
  final List<double?> values;
  final Color color;
  final RptSeriesType type;
  final bool dashed;
}

/// The shared engine behind [RptTrendChart], [RptMultiSeriesChart] and
/// [RptGroupedBarChart]: a categorical x axis, a "nice" y axis, any mix of
/// bars / lines / areas, dashed previous-period overlays, a draw-in
/// animation (areas wipe in, bars grow one after another) and tap / drag
/// inspection (crosshair + a readout row above the plot).
///
/// Everything is painted by one `CustomPainter` that repaints from the
/// animation only; axis labels are cached `TextPainter`s.
class RptCartesianChart extends StatefulWidget {
  const RptCartesianChart({
    super.key,
    required this.labels,
    required this.series,
    this.tips,
    this.format = RptFormat.number,
    this.height = 220,
    this.replayKey,
    this.inspectHint = 'Tap the chart to inspect',
    this.showReadout = true,
  });

  /// X axis text, one per point.
  final List<String> labels;

  /// Longer heading per point for the readout (defaults to [labels]).
  final List<String>? tips;

  /// Series to draw — already filtered for hidden legend items.
  final List<RptSeries> series;

  /// Unit of the y axis and the readout.
  final RptFormat format;

  /// Plot height (the readout row is extra).
  final double height;

  /// Changing this value replays the draw-in animation.
  final Object? replayKey;

  final String inspectHint;

  /// False hides the readout row above the plot (still inspectable by tap
  /// but nothing is shown — use only when the chart sits in a tight spot).
  final bool showReadout;

  @override
  State<RptCartesianChart> createState() => _RptCartesianChartState();
}

class _RptCartesianChartState extends State<RptCartesianChart>
    with
        SingleTickerProviderStateMixin<RptCartesianChart>,
        RptDrawIn<RptCartesianChart> {
  final _text = RptTextCache();
  int? _selected;

  static const _right = 8.0;

  bool get _hasBars => widget.series.any((s) => s.type == RptSeriesType.bar);
  int get _n => widget.labels.length;

  @override
  void didUpdateWidget(RptCartesianChart old) {
    super.didUpdateWidget(old);
    if (old.replayKey != widget.replayKey) replay();
    final sel = _selected;
    if (sel != null && sel >= _n) _selected = null;
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  double _dataMax() {
    var m = 0.0;
    for (final s in widget.series) {
      for (final v in s.values) {
        if (v != null && v > m) m = v;
      }
    }
    return m;
  }

  void _pick(double dx, double width, double left) {
    if (_n == 0) return;
    final i = _hasBars
        ? rptPickBandIndex(
            dx,
            left: left,
            right: _right,
            width: width,
            n: _n,
          )
        : rptPickLineIndex(
            dx,
            left: left,
            right: _right,
            width: width,
            n: _n,
          );
    if (i != _selected) setState(() => _selected = i);
  }

  @override
  Widget build(BuildContext context) {
    final integers = widget.format != RptFormat.money &&
        widget.series.every(
          (s) => s.values.every((v) => v == null || v == v.roundToDouble()),
        );
    final axis = rptNiceAxis(_dataMax(), integers: integers);
    var longest = 1;
    for (final tk in axis.ticks) {
      longest = math.max(
        longest,
        rptFormatValue(widget.format, tk, compact: true).length,
      );
    }
    final left = (longest * 6.0 + 12).clamp(30.0, 72.0);
    final sel = _selected;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.showReadout) _readout(sel),
        LayoutBuilder(
          builder: (context, c) => GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (d) => _pick(d.localPosition.dx, c.maxWidth, left),
            onHorizontalDragUpdate: (d) =>
                _pick(d.localPosition.dx, c.maxWidth, left),
            child: CustomPaint(
              size: Size(c.maxWidth, widget.height),
              painter: _CartesianPainter(
                labels: widget.labels,
                series: widget.series,
                format: widget.format,
                axis: axis,
                left: left,
                right: _right,
                selected: sel,
                progress: t,
                text: _text,
                grid: RptColors.grid,
                axisColor: RptColors.axis,
                dot: AppColors.surface,
                hasBars: _hasBars,
                highlight: AppColors.surface3,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _readout(int? sel) {
    final tips = widget.tips ?? widget.labels;
    return SizedBox(
      height: 40,
      child: sel == null || sel >= _n
          ? Align(
              alignment: Alignment.centerLeft,
              child: Text(
                widget.inspectHint,
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
                  sel < tips.length ? tips[sel] : widget.labels[sel],
                  style: AppText.body(size: 12, weight: FontWeight.w800),
                ),
                for (final s in widget.series)
                  if (sel < s.values.length && s.values[sel] != null)
                    Text(
                      '${s.label} ${rptFormatValue(widget.format, s.values[sel]!)}',
                      style: AppText.body(
                        size: 12,
                        weight: s.dashed ? FontWeight.w700 : FontWeight.w800,
                        color: s.dashed ? AppColors.inkFaint : s.color,
                      ),
                    ),
              ],
            ),
    );
  }
}

class _CartesianPainter extends CustomPainter {
  _CartesianPainter({
    required this.labels,
    required this.series,
    required this.format,
    required this.axis,
    required this.left,
    required this.right,
    required this.selected,
    required this.progress,
    required this.text,
    required this.grid,
    required this.axisColor,
    required this.dot,
    required this.hasBars,
    required this.highlight,
  }) : super(repaint: progress);

  final List<String> labels;
  final List<RptSeries> series;
  final RptFormat format;
  final RptAxis axis;
  final double left;
  final double right;
  final int? selected;
  final Animation<double> progress;
  final RptTextCache text;
  final Color grid;
  final Color axisColor;
  final Color dot;
  final bool hasBars;
  final Color highlight;

  static const _top = 8.0;
  static const _bottom = 22.0;
  static const _maxBar = 22.0;

  @override
  void paint(Canvas canvas, Size size) {
    final n = labels.length;
    if (n == 0) return;
    final t = progress.value;
    final plotW = size.width - left - right;
    final plotH = size.height - _top - _bottom;
    if (plotW <= 0 || plotH <= 0) return;
    final base = _top + plotH;
    final band = plotW / n;

    double xAt(int i) {
      if (hasBars) return left + band * (i + 0.5);
      return n == 1 ? left + plotW / 2 : left + plotW * i / (n - 1);
    }

    double yAt(double v) => base - plotH * (v / axis.max).clamp(0.0, 1.0);

    // grid + y labels
    final gridPaint = Paint()
      ..color = grid
      ..strokeWidth = 1;
    for (final tk in axis.ticks) {
      final y = yAt(tk);
      canvas.drawLine(
        Offset(left, y),
        Offset(size.width - right, y),
        gridPaint,
      );
      final tp = text.get(
        rptFormatValue(format, tk, compact: true),
        color: axisColor,
      );
      tp.paint(canvas, Offset(left - 6 - tp.width, y - tp.height / 2));
    }

    // x labels
    final maxLabels = math.max(1, (plotW / 46).floor());
    final step = math.max(1, (n / maxLabels).ceil());
    for (var i = 0; i < n; i += step) {
      final tp = text.get(labels[i], color: axisColor);
      final x = (xAt(i) - tp.width / 2)
          .clamp(left - 4, size.width - right - tp.width + 4);
      tp.paint(canvas, Offset(x, base + 6));
    }

    // selection backdrop for bar charts
    final sel = selected;
    if (sel != null && sel < n && hasBars) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(left + band * sel, _top, band, plotH),
          const Radius.circular(6),
        ),
        Paint()..color = highlight.withValues(alpha: 0.55),
      );
    }

    // bars
    final bars = [
      for (final s in series)
        if (s.type == RptSeriesType.bar) s,
    ];
    if (bars.isNotEmpty) {
      final groupW = math.min(
        band * 0.78,
        bars.length * _maxBar + 3.0 * (bars.length - 1),
      );
      final barW =
          math.max(2.0, (groupW - 3.0 * (bars.length - 1)) / bars.length);
      final fill = Paint();
      for (var i = 0; i < n; i++) {
        final grow = Curves.easeOutCubic.transform(rptStagger(t, i, n));
        final gx = xAt(i) - groupW / 2;
        for (var b = 0; b < bars.length; b++) {
          final v = i < bars[b].values.length ? bars[b].values[i] : null;
          if (v == null || v <= 0) continue;
          final y = yAt(v);
          final h = (base - y) * grow;
          final x = gx + b * (barW + 3);
          fill.color = bars[b].dashed
              ? bars[b].color.withValues(alpha: 0.5)
              : bars[b].color;
          canvas.drawRRect(rptBarRect(x, base - h, barW, base), fill);
        }
      }
    }

    // lines / areas (previous first, so current sits on top)
    final lines = [
      for (final s in series)
        if (s.type != RptSeriesType.bar && s.dashed) s,
      for (final s in series)
        if (s.type != RptSeriesType.bar && !s.dashed) s,
    ];
    canvas.save();
    canvas.clipRect(
      Rect.fromLTWH(0, 0, left + plotW * t + right * t, size.height),
    );
    for (final s in lines) {
      for (final run in _runs(s, n, xAt, yAt)) {
        if (run.length == 1) {
          canvas.drawCircle(run.first, 3.5, Paint()..color = s.color);
          continue;
        }
        final path = rptSmoothPath(run);
        if (s.dashed) {
          rptDashedPath(
            canvas,
            path,
            Paint()
              ..color = s.color.withValues(alpha: 0.9)
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1.8,
            dash: 4,
            gap: 3.5,
          );
          continue;
        }
        if (s.type == RptSeriesType.area) {
          final area = rptSmoothPath(run)
            ..lineTo(run.last.dx, base)
            ..lineTo(run.first.dx, base)
            ..close();
          canvas.drawPath(
            area,
            Paint()
              ..shader = rptAreaShader(
                Rect.fromLTWH(left, _top, plotW, plotH),
                s.color,
              ),
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
      }
    }
    canvas.restore();

    // crosshair + markers
    if (sel != null && sel < n) {
      final x = xAt(sel);
      if (!hasBars) {
        canvas.drawLine(
          Offset(x, _top),
          Offset(x, base),
          Paint()
            ..color = axisColor.withValues(alpha: 0.7)
            ..strokeWidth = 1,
        );
      }
      for (final s in series) {
        if (s.type == RptSeriesType.bar) continue;
        final v = sel < s.values.length ? s.values[sel] : null;
        if (v == null) continue;
        final p = Offset(x, yAt(v));
        canvas
          ..drawCircle(p, s.dashed ? 4 : 5.5, Paint()..color = dot)
          ..drawCircle(p, s.dashed ? 2.6 : 3.8, Paint()..color = s.color);
      }
    }
  }

  /// Contiguous runs of non-null values as screen points.
  List<List<Offset>> _runs(
    RptSeries s,
    int n,
    double Function(int) xAt,
    double Function(double) yAt,
  ) {
    final out = <List<Offset>>[];
    var cur = <Offset>[];
    for (var i = 0; i < n; i++) {
      final v = i < s.values.length ? s.values[i] : null;
      if (v == null) {
        if (cur.isNotEmpty) out.add(cur);
        cur = <Offset>[];
      } else {
        cur.add(Offset(xAt(i), yAt(v)));
      }
    }
    if (cur.isNotEmpty) out.add(cur);
    return out;
  }

  @override
  bool shouldRepaint(covariant _CartesianPainter old) =>
      old.series != series ||
      old.labels != labels ||
      old.selected != selected ||
      old.axis.max != axis.max ||
      old.format != format ||
      old.grid != grid ||
      old.axisColor != axisColor ||
      old.left != left;
}
