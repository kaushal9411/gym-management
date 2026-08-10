import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../models/revenue_trend_point.dart';

/// Design's "Revenue vs expenses" dual-line chart (solid income line +
/// dashed expenses line) — `CustomPainter`, same reasoning as `RevenueSparkline`.
class RevenueExpenseChart extends StatelessWidget {
  const RevenueExpenseChart({super.key, required this.points});

  final List<RevenueTrendPoint> points;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 80,
      width: double.infinity,
      child: CustomPaint(
        painter: _DualLinePainter(
          income: points.map((p) => p.income).toList(),
          expenses: points.map((p) => p.expenses).toList(),
        ),
      ),
    );
  }
}

class _DualLinePainter extends CustomPainter {
  _DualLinePainter({required this.income, required this.expenses});

  final List<double> income;
  final List<double> expenses;

  @override
  void paint(Canvas canvas, Size size) {
    if (income.isEmpty) return;
    final all = [...income, ...expenses];
    final maxV = all.reduce((a, b) => a > b ? a : b);
    final minV = all.reduce((a, b) => a < b ? a : b);
    final range = (maxV - minV).abs() < 0.01 ? 1.0 : maxV - minV;
    final dx = income.length > 1 ? size.width / (income.length - 1) : 0.0;

    Offset pointFor(List<double> series, int i) {
      final normalized = (series[i] - minV) / range;
      final y = size.height - (normalized * (size.height - 10)) - 5;
      return Offset(dx * i, y);
    }

    Path pathFor(List<double> series) {
      final path = Path()
        ..moveTo(pointFor(series, 0).dx, pointFor(series, 0).dy);
      for (var i = 1; i < series.length; i++) {
        final p = pointFor(series, i);
        path.lineTo(p.dx, p.dy);
      }
      return path;
    }

    canvas.drawPath(
      pathFor(income),
      Paint()
        ..color = AppColors.staffB
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );

    _drawDashedPath(
      canvas,
      pathFor(expenses),
      Paint()
        ..color = AppColors.inkFaint
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
  }

  void _drawDashedPath(Canvas canvas, Path path, Paint paint) {
    const dashWidth = 4.0;
    const dashSpace = 3.0;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(
          metric.extractPath(distance, distance + dashWidth),
          paint,
        );
        distance += dashWidth + dashSpace;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DualLinePainter oldDelegate) =>
      oldDelegate.income != income || oldDelegate.expenses != expenses;
}
