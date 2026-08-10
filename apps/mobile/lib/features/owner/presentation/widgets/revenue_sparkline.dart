import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../models/revenue_trend_point.dart';

/// The design's dashboard sparkline (`<svg>` gradient-fill area + stroked
/// line, `viewBox="0 0 300 90"`) — reimplemented as a `CustomPainter`
/// instead of pulling in a charting package for one small line chart.
class RevenueSparkline extends StatelessWidget {
  const RevenueSparkline({
    super.key,
    required this.points,
    this.role = AppRole.staff,
  });

  final List<RevenueTrendPoint> points;
  final AppRole role;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 90,
      width: double.infinity,
      child: CustomPaint(
        painter: _SparklinePainter(
          values: points.map((p) => p.income).toList(),
          color: role.b,
        ),
      ),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  _SparklinePainter({required this.values, required this.color});

  final List<double> values;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    final maxV = values.reduce((a, b) => a > b ? a : b);
    final minV = values.reduce((a, b) => a < b ? a : b);
    final range = (maxV - minV).abs() < 0.01 ? 1.0 : maxV - minV;
    final dx = values.length > 1 ? size.width / (values.length - 1) : 0.0;

    Offset pointAt(int i) {
      final normalized = (values[i] - minV) / range;
      final y = size.height - (normalized * (size.height - 10)) - 5;
      return Offset(dx * i, y);
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
          colors: [color.withValues(alpha: 0.35), color.withValues(alpha: 0)],
        ).createShader(Rect.fromLTWH(0, 0, size.width, size.height)),
    );

    canvas.drawPath(
      linePath,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );

    canvas.drawCircle(
      pointAt(values.length - 1),
      5,
      Paint()..color = AppColors.staffA,
    );
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter oldDelegate) =>
      oldDelegate.values != values || oldDelegate.color != color;
}
