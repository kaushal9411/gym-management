import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';

enum TrendChartType { area, bar }

/// Owner dashboard's 30-day trend charts (Attendance/Revenue/Member Growth)
/// — mirrors web's `ChartsGrid` (`recharts` `AreaChart`/`BarChart`) with a
/// Y-axis of "nice" rounded ticks and a sparse X-axis (not one label per
/// day — 30 would never fit), reimplemented as a `CustomPainter` instead of
/// pulling in a charting package, same convention as `RevenueSparkline`.
class TrendChart extends StatelessWidget {
  const TrendChart({
    super.key,
    required this.values,
    required this.dateLabels,
    required this.color,
    this.type = TrendChartType.area,
    this.height = 150,
  });

  /// Same length as [dateLabels].
  final List<double> values;

  /// `MM-DD`-formatted, same length as [values].
  final List<String> dateLabels;
  final Color color;
  final TrendChartType type;
  final double height;

  static List<double> _niceTicks(double maxValue, {int targetCount = 4}) {
    if (maxValue <= 0) return const [0, 1, 2, 3, 4];
    final rawStep = maxValue / targetCount;
    final magnitude =
        math.pow(10, (math.log(rawStep) / math.ln10).floor()).toDouble();
    final residual = rawStep / magnitude;
    final niceStep = residual > 5
        ? 10 * magnitude
        : residual > 2
            ? 5 * magnitude
            : residual > 1
                ? 2 * magnitude
                : magnitude;
    final ticks = <double>[];
    for (var v = 0.0; v <= maxValue + niceStep * 0.5; v += niceStep) {
      ticks.add(v);
    }
    return ticks;
  }

  static String _formatTick(double t) {
    if (t >= 1000) {
      return '${(t / 1000).toStringAsFixed(t % 1000 == 0 ? 0 : 1)}k';
    }
    return t.round().toString();
  }

  @override
  Widget build(BuildContext context) {
    if (values.isEmpty || values.every((v) => v == 0)) {
      return SizedBox(
        height: height,
        child: Center(
          child: Text(
            'No data recorded in this period yet.',
            style: AppText.body(size: 12, color: AppColors.inkFaint),
          ),
        ),
      );
    }

    final maxValue = values.reduce((a, b) => a > b ? a : b);
    final ticks = _niceTicks(maxValue);
    final axisMax = ticks.last <= 0 ? 1.0 : ticks.last;
    final labelStep = (values.length / 7).ceil().clamp(1, values.length);
    // Only the axis+plot area is height-capped — the date-label row below
    // it gets whatever height its text actually needs, so the widget's
    // real total height is `height` plus that (a few px), never clipped.
    final chartHeight = height;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 32,
          height: chartHeight,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: ticks.reversed
                .map(
                  (t) => Text(
                    _formatTick(t),
                    style: AppText.body(size: 9, color: AppColors.inkFaint),
                  ),
                )
                .toList(),
          ),
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Column(
            children: [
              SizedBox(
                height: chartHeight,
                width: double.infinity,
                child: CustomPaint(
                  painter: type == TrendChartType.area
                      ? _AreaPainter(
                          values: values,
                          axisMax: axisMax,
                          color: color,
                        )
                      : _BarPainter(
                          values: values,
                          axisMax: axisMax,
                          color: color,
                        ),
                ),
              ),
              const SizedBox(height: 4),
              Row(
                children: List.generate(values.length, (i) {
                  final show = i % labelStep == 0 || i == values.length - 1;
                  return Expanded(
                    child: show
                        ? Text(
                            dateLabels[i],
                            textAlign: TextAlign.center,
                            style: AppText.body(
                              size: 8,
                              color: AppColors.inkFaint,
                            ),
                          )
                        : const SizedBox.shrink(),
                  );
                }),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _AreaPainter extends CustomPainter {
  _AreaPainter({
    required this.values,
    required this.axisMax,
    required this.color,
  });

  final List<double> values;
  final double axisMax;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final dx = values.length > 1 ? size.width / (values.length - 1) : 0.0;
    Offset pointAt(int i) {
      final normalized = (values[i] / axisMax).clamp(0.0, 1.0);
      return Offset(dx * i, size.height - normalized * size.height);
    }

    final linePath = Path()..moveTo(pointAt(0).dx, pointAt(0).dy);
    for (var i = 1; i < values.length; i++) {
      linePath.lineTo(pointAt(i).dx, pointAt(i).dy);
    }

    final fillPath = Path.from(linePath)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();

    canvas.drawPath(
      fillPath,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            color.withValues(alpha: 0.28),
            color.withValues(alpha: 0.02),
          ],
        ).createShader(Rect.fromLTWH(0, 0, size.width, size.height)),
    );

    canvas.drawPath(
      linePath,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant _AreaPainter oldDelegate) =>
      oldDelegate.values != values ||
      oldDelegate.axisMax != axisMax ||
      oldDelegate.color != color;
}

class _BarPainter extends CustomPainter {
  _BarPainter({
    required this.values,
    required this.axisMax,
    required this.color,
  });

  final List<double> values;
  final double axisMax;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final slot = size.width / values.length;
    final barWidth = (slot * 0.55).clamp(1.0, 12.0);
    final paint = Paint()..color = color;
    for (var i = 0; i < values.length; i++) {
      final normalized = (values[i] / axisMax).clamp(0.0, 1.0);
      final barHeight = (normalized * size.height).clamp(1.0, size.height);
      final left = slot * i + (slot - barWidth) / 2;
      canvas.drawRRect(
        RRect.fromRectAndCorners(
          Rect.fromLTWH(left, size.height - barHeight, barWidth, barHeight),
          topLeft: const Radius.circular(2),
          topRight: const Radius.circular(2),
        ),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _BarPainter oldDelegate) =>
      oldDelegate.values != values ||
      oldDelegate.axisMax != axisMax ||
      oldDelegate.color != color;
}
