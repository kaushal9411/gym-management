import 'package:flutter/material.dart';

/// Redraws the design's revenue-trend sparkline exactly: three faint
/// horizontal gridlines, a soft area fill under the line, a rounded
/// stroke, and one emphasized endpoint dot — not a bare line chart.
class SparklineChart extends StatelessWidget {
  final List<double> values;
  final Color lineColor;
  final Color gridColor;
  final double height;

  const SparklineChart({
    super.key,
    required this.values,
    required this.lineColor,
    required this.gridColor,
    this.height = 70,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(
        painter: _SparklinePainter(
          values: values,
          lineColor: lineColor,
          gridColor: gridColor,
        ),
      ),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  final List<double> values;
  final Color lineColor;
  final Color gridColor;

  const _SparklinePainter({
    required this.values,
    required this.lineColor,
    required this.gridColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 1;
    for (final fraction in [0.25, 0.5, 0.75]) {
      final y = size.height * fraction;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    if (values.isEmpty) return;
    final maxValue = values.reduce((a, b) => a > b ? a : b);
    final minValue = values.reduce((a, b) => a < b ? a : b);
    final range =
        (maxValue - minValue).abs() < 1e-9 ? 1.0 : maxValue - minValue;
    final stepX = values.length > 1 ? size.width / (values.length - 1) : 0.0;

    Offset pointAt(int i) {
      final normalized = (values[i] - minValue) / range;
      final y =
          size.height - (normalized * size.height * 0.85) - size.height * 0.1;
      return Offset(stepX * i, y);
    }

    final linePath = Path()..moveTo(pointAt(0).dx, pointAt(0).dy);
    for (var i = 1; i < values.length; i++) {
      linePath.lineTo(pointAt(i).dx, pointAt(i).dy);
    }

    final areaPath = Path.from(linePath)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(
      areaPath,
      Paint()..color = lineColor.withValues(alpha: .12),
    );

    canvas.drawPath(
      linePath,
      Paint()
        ..color = lineColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.25
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );

    canvas.drawCircle(
      pointAt(values.length - 1),
      4,
      Paint()..color = lineColor,
    );
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter oldDelegate) =>
      oldDelegate.values != values;
}
