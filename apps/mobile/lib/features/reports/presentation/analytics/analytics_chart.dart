import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import 'analytics_logic.dart';

/// Area / line chart for one analytics view: one series, or two for revenue
/// and payment collection; a dashed "previous period" overlay when comparing;
/// tap or drag to inspect a day (web shows a hover tooltip instead).
class AnalyticsTrendChart extends StatefulWidget {
  const AnalyticsTrendChart({
    super.key,
    required this.rows,
    required this.format,
    required this.color,
    required this.labelA,
    this.colorB,
    this.labelB,
    this.compare = false,
    this.previousLabel = 'Previous period',
    this.lineOnly = false,
    this.height = 190,
  });

  final List<AnalyticsRow> rows;
  final AnalyticsFormat format;
  final Color color;
  final String labelA;
  final Color? colorB;
  final String? labelB;
  final bool compare;
  final String previousLabel;
  final bool lineOnly;
  final double height;

  @override
  State<AnalyticsTrendChart> createState() => _AnalyticsTrendChartState();
}

class _AnalyticsTrendChartState extends State<AnalyticsTrendChart> {
  int? _selected;

  static const _left = 46.0;
  static const _right = 10.0;

  bool get _dual => widget.labelB != null && widget.colorB != null;

  void _pick(double dx, double width) {
    final n = widget.rows.length;
    if (n == 0) return;
    final inner = width - _left - _right;
    final t = inner <= 0 ? 0.0 : ((dx - _left) / inner).clamp(0.0, 1.0);
    final i = n == 1 ? 0 : (t * (n - 1)).round();
    if (i != _selected) setState(() => _selected = i);
  }

  @override
  void didUpdateWidget(AnalyticsTrendChart old) {
    super.didUpdateWidget(old);
    if (_selected != null && _selected! >= widget.rows.length) {
      _selected = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final sel = _selected;
    final r =
        sel == null || sel >= widget.rows.length ? null : widget.rows[sel];
    String fmt(double v) => formatAnalytics(widget.format, v);
    TextStyle s(Color c) =>
        AppText.body(size: 12, weight: FontWeight.w800, color: c);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 40,
          child: r == null
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
                      analyticsShortDate(r.tip),
                      style: AppText.body(size: 12, weight: FontWeight.w800),
                    ),
                    Text(
                      '${widget.labelA} ${fmt(r.a)}',
                      style: s(widget.color),
                    ),
                    if (_dual && r.b != null)
                      Text(
                        '${widget.labelB} ${fmt(r.b!)}',
                        style: s(widget.colorB!),
                      ),
                    if (widget.compare && r.pa != null)
                      Text(
                        '${widget.previousLabel} ${fmt(r.pa!)}',
                        style: s(AppColors.inkFaint),
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
              key: ValueKey('${widget.rows.length}-${widget.format.name}'),
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 800),
              curve: Curves.easeOutCubic,
              builder: (context, t, _) => CustomPaint(
                size: Size(c.maxWidth, widget.height),
                painter: _TrendPainter(
                  rows: widget.rows,
                  format: widget.format,
                  color: widget.color,
                  colorB: _dual ? widget.colorB : null,
                  compare: widget.compare,
                  lineOnly: widget.lineOnly,
                  progress: t,
                  selected: sel,
                  grid: AppColors.line,
                  text: AppColors.inkFaint,
                  dot: AppColors.surface,
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
    required this.rows,
    required this.format,
    required this.color,
    required this.colorB,
    required this.compare,
    required this.lineOnly,
    required this.progress,
    required this.selected,
    required this.grid,
    required this.text,
    required this.dot,
    required this.left,
    required this.right,
  });

  final List<AnalyticsRow> rows;
  final AnalyticsFormat format;
  final Color color;
  final Color? colorB;
  final bool compare;
  final bool lineOnly;
  final double progress;
  final int? selected;
  final Color grid;
  final Color text;
  final Color dot;
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
    if (rows.isEmpty) return;
    final w = size.width - left - right;
    final h = size.height - _top - _bottom;
    var maxV = 0.0;
    for (final r in rows) {
      maxV = math.max(maxV, r.a);
      if (colorB != null && r.b != null) maxV = math.max(maxV, r.b!);
      if (compare) {
        if (r.pa != null) maxV = math.max(maxV, r.pa!);
        if (colorB != null && r.pb != null) maxV = math.max(maxV, r.pb!);
      }
    }
    if (maxV <= 0) maxV = 1;

    final gridPaint = Paint()
      ..color = grid
      ..strokeWidth = 1;
    for (var i = 0; i <= 3; i++) {
      final y = _top + h - h * i / 3;
      canvas.drawLine(
        Offset(left, y),
        Offset(size.width - right, y),
        gridPaint,
      );
      _label(
        canvas,
        compactAnalytics(format, maxV * i / 3),
        Offset(left - 6, y - 6),
        rightAlign: true,
      );
    }

    final n = rows.length;
    double xAt(int i) => n == 1 ? left + w / 2 : left + w * i / (n - 1);
    double yAt(double v) => _top + h - h * (v / maxV);

    List<Offset> pts(double? Function(AnalyticsRow) pick) {
      final out = <Offset>[];
      for (var i = 0; i < n; i++) {
        final v = pick(rows[i]);
        if (v != null) out.add(Offset(xAt(i), yAt(v)));
      }
      return out;
    }

    Path line(List<Offset> p) {
      final path = Path()..moveTo(p.first.dx, p.first.dy);
      for (var i = 1; i < p.length; i++) {
        path.lineTo(p[i].dx, p[i].dy);
      }
      return path;
    }

    void dashed(List<Offset> p, Color c) {
      if (p.length < 2) return;
      final paint = Paint()
        ..color = c
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.8;
      for (final m in line(p).computeMetrics()) {
        var d = 0.0;
        while (d < m.length * progress) {
          canvas.drawPath(m.extractPath(d, math.min(d + 4, m.length)), paint);
          d += 7;
        }
      }
    }

    void series(List<Offset> p, Color c, {required bool fill}) {
      if (p.isEmpty) return;
      if (p.length == 1) {
        canvas.drawCircle(p.first, 4, Paint()..color = c);
        return;
      }
      canvas.save();
      canvas.clipRect(
        Rect.fromLTWH(0, 0, left + w * progress + right, size.height),
      );
      final path = line(p);
      if (fill && !lineOnly) {
        final area = Path.from(path)
          ..lineTo(p.last.dx, _top + h)
          ..lineTo(p.first.dx, _top + h)
          ..close();
        canvas.drawPath(
          area,
          Paint()
            ..shader = LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [c.withValues(alpha: 0.28), c.withValues(alpha: 0.02)],
            ).createShader(Rect.fromLTWH(left, _top, w, h)),
        );
      }
      canvas.drawPath(
        path,
        Paint()
          ..color = c
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.4
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round,
      );
      canvas.restore();
    }

    if (compare) {
      dashed(pts((r) => r.pa), text);
      if (colorB != null) dashed(pts((r) => r.pb), text.withValues(alpha: 0.6));
    }
    if (colorB != null) series(pts((r) => r.b), colorB!, fill: true);
    series(pts((r) => r.a), color, fill: true);

    final step = (n / 5).ceil().clamp(1, n);
    for (var i = 0; i < n; i += step) {
      _label(canvas, rows[i].label, Offset(xAt(i) - 14, size.height - 16));
    }

    final sel = selected;
    if (sel != null && sel < n) {
      final x = xAt(sel);
      canvas.drawLine(
        Offset(x, _top),
        Offset(x, _top + h),
        Paint()
          ..color = text
          ..strokeWidth = 1,
      );
      void mark(double? v, Color c) {
        if (v == null) return;
        canvas.drawCircle(Offset(x, yAt(v)), 5, Paint()..color = dot);
        canvas.drawCircle(Offset(x, yAt(v)), 3.5, Paint()..color = c);
      }

      mark(rows[sel].a, color);
      if (colorB != null) mark(rows[sel].b, colorB!);
    }
  }

  @override
  bool shouldRepaint(covariant _TrendPainter old) =>
      old.rows != rows ||
      old.compare != compare ||
      old.progress != progress ||
      old.selected != selected ||
      old.color != color ||
      old.grid != grid ||
      old.text != text;
}
