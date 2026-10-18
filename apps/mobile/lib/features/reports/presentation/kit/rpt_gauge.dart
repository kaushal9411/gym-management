import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/motion.dart';
import 'rpt_paint.dart';
import 'rpt_theme.dart';

/// Progress ring (web's `RadialGauge`): [value] of [max] fills a rounded
/// gradient stroke around the centre. The centre shows the percentage
/// (counting up) unless [child] is given. Use for ratios — net margin,
/// success rate, "active share".
class RptRadialGauge extends StatefulWidget {
  const RptRadialGauge({
    super.key,
    required this.value,
    this.max = 100,
    this.size = 96,
    this.thickness = 10,
    this.color = RptColors.indigo,
    this.label,
    this.child,
  });

  final double value;
  final double max;
  final double size;
  final double thickness;
  final Color color;

  /// Small caption under the percentage.
  final String? label;

  /// Replaces the centre content.
  final Widget? child;

  @override
  State<RptRadialGauge> createState() => _RptRadialGaugeState();
}

class _RptRadialGaugeState extends State<RptRadialGauge>
    with
        SingleTickerProviderStateMixin<RptRadialGauge>,
        RptDrawIn<RptRadialGauge> {
  double get _fraction =>
      widget.max <= 0 ? 0 : (widget.value / widget.max).clamp(0.0, 1.0);

  @override
  void didUpdateWidget(RptRadialGauge old) {
    super.didUpdateWidget(old);
    if (old.value != widget.value || old.max != widget.max) replay();
  }

  @override
  Widget build(BuildContext context) {
    final pct = _fraction * 100;
    return Semantics(
      label: '${widget.label ?? 'Progress'} ${pct.round()}%',
      child: SizedBox(
        width: widget.size,
        height: widget.size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            CustomPaint(
              size: Size.square(widget.size),
              painter: _GaugePainter(
                fraction: _fraction,
                color: widget.color,
                thickness: widget.thickness,
                progress: t,
                track: RptColors.track,
              ),
            ),
            widget.child ??
                Padding(
                  padding: EdgeInsets.all(widget.thickness + 4),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: AnimatedNumber(
                          value: pct,
                          format: (v) => '${v.round()}%',
                          style: AppText.display(size: widget.size * 0.22),
                        ),
                      ),
                      if (widget.label != null)
                        Text(
                          widget.label!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.eyebrow(),
                        ),
                    ],
                  ),
                ),
          ],
        ),
      ),
    );
  }
}

class _GaugePainter extends CustomPainter {
  _GaugePainter({
    required this.fraction,
    required this.color,
    required this.thickness,
    required this.progress,
    required this.track,
  }) : super(repaint: progress);

  final double fraction;
  final Color color;
  final double thickness;
  final Animation<double> progress;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(
      thickness / 2,
      thickness / 2,
      size.width - thickness,
      size.height - thickness,
    );
    canvas.drawArc(
      rect,
      0,
      math.pi * 2,
      false,
      Paint()
        ..color = track
        ..style = PaintingStyle.stroke
        ..strokeWidth = thickness,
    );
    final sweep = math.pi * 2 * fraction * progress.value;
    if (sweep <= 0) return;
    canvas.drawArc(
      rect,
      -math.pi / 2,
      sweep,
      false,
      Paint()
        ..shader = SweepGradient(
          endAngle: math.max(sweep, 0.01),
          colors: [color.withValues(alpha: 0.55), color],
          transform: const GradientRotation(-math.pi / 2),
        ).createShader(rect)
        ..style = PaintingStyle.stroke
        ..strokeWidth = thickness
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(covariant _GaugePainter old) =>
      old.fraction != fraction ||
      old.color != color ||
      old.track != track ||
      old.thickness != thickness;
}

/// Tiny axis-less area sparkline for KPI tiles (web's `SparkArea`): the line
/// draws itself in. Renders nothing for fewer than two values.
class RptSparkArea extends StatefulWidget {
  const RptSparkArea({
    super.key,
    required this.values,
    this.color = RptColors.indigo,
    this.height = 34,
  });

  final List<double> values;
  final Color color;
  final double height;

  @override
  State<RptSparkArea> createState() => _RptSparkAreaState();
}

class _RptSparkAreaState extends State<RptSparkArea>
    with SingleTickerProviderStateMixin<RptSparkArea>, RptDrawIn<RptSparkArea> {
  @override
  Widget build(BuildContext context) {
    if (widget.values.length < 2) return SizedBox(height: widget.height);
    return SizedBox(
      height: widget.height,
      width: double.infinity,
      child: CustomPaint(
        painter: _SparkPainter(widget.values, widget.color, t),
      ),
    );
  }
}

class _SparkPainter extends CustomPainter {
  _SparkPainter(this.values, this.color, this.progress)
      : super(repaint: progress);

  final List<double> values;
  final Color color;
  final Animation<double> progress;

  @override
  void paint(Canvas canvas, Size size) {
    final minV = math.min(0.0, values.reduce(math.min));
    final maxV = values.reduce(math.max);
    final span = maxV - minV == 0 ? 1.0 : maxV - minV;
    const padY = 3.0;
    final n = values.length;
    final pts = [
      for (var i = 0; i < n; i++)
        Offset(
          size.width * i / (n - 1),
          padY + (size.height - padY * 2) * (1 - (values[i] - minV) / span),
        ),
    ];
    canvas.save();
    canvas.clipRect(
      Rect.fromLTWH(0, 0, size.width * progress.value, size.height),
    );
    final line = rptSmoothPath(pts);
    final area = rptSmoothPath(pts)
      ..lineTo(pts.last.dx, size.height)
      ..lineTo(pts.first.dx, size.height)
      ..close();
    canvas
      ..drawPath(
        area,
        Paint()..shader = rptAreaShader(Offset.zero & size, color, top: 0.34),
      )
      ..drawPath(
        line,
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round,
      );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _SparkPainter old) =>
      old.values != values || old.color != color;
}
