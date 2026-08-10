import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';

class DonutSlice {
  const DonutSlice({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final num value;
  final Color color;
}

/// The design's plan-distribution / payment-method donuts — stacked
/// `CircularProgressIndicator` arcs (each slice is its own ring segment via
/// `strokeAlign`), plus a legend.
class DonutChart extends StatelessWidget {
  const DonutChart({super.key, required this.slices, this.size = 72});

  final List<DonutSlice> slices;
  final double size;

  @override
  Widget build(BuildContext context) {
    final total = slices.fold<num>(0, (a, b) => a + b.value);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SizedBox(
          width: size,
          height: size,
          child: total <= 0
              ? CircularProgressIndicator(
                  value: 1,
                  strokeWidth: size * 0.16,
                  color: AppColors.surface3,
                )
              : CustomPaint(
                  painter: _DonutPainter(slices: slices, total: total),
                ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: slices.map((s) {
              final pct = total <= 0 ? 0 : (s.value / total * 100).round();
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: s.color,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        '${s.label} · $pct%',
                        style: AppText.body(
                          size: 11,
                          weight: FontWeight.w700,
                          color: s.color,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({required this.slices, required this.total});

  final List<DonutSlice> slices;
  final num total;

  @override
  void paint(Canvas canvas, Size size) {
    final strokeWidth = size.width * 0.18;
    final rect = Rect.fromLTWH(
      strokeWidth / 2,
      strokeWidth / 2,
      size.width - strokeWidth,
      size.height - strokeWidth,
    );
    var startAngle = -1.5708; // -90deg
    for (final slice in slices) {
      final sweep = (slice.value / total) * 6.28319;
      canvas.drawArc(
        rect,
        startAngle,
        sweep,
        false,
        Paint()
          ..color = slice.color
          ..style = PaintingStyle.stroke
          ..strokeWidth = strokeWidth
          ..strokeCap = StrokeCap.butt,
      );
      startAngle += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter oldDelegate) =>
      oldDelegate.slices != slices;
}
