import 'package:flutter/material.dart';

/// Redraws the exact dumbbell glyph from the approved design
/// (fitcloud-mobile-design.html's SVG path
/// `M6 4v16M18 4v16M2 9h4M2 15h4M18 9h4M18 15h4M9 4h6M9 20h6`)
/// stroke-for-stroke, instead of substituting a generic Material icon.
class BrandMark extends StatelessWidget {
  final double size;
  final Color color;
  final double strokeWidth;

  const BrandMark({
    super.key,
    this.size = 24,
    required this.color,
    this.strokeWidth = 1.7,
  });

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: _DumbbellPainter(color: color, strokeWidth: strokeWidth),
    );
  }
}

class _DumbbellPainter extends CustomPainter {
  final Color color;
  final double strokeWidth;

  const _DumbbellPainter({required this.color, required this.strokeWidth});

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 24;
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth * scale
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    Offset p(double x, double y) => Offset(x * scale, y * scale);

    canvas
      ..drawLine(p(6, 4), p(6, 20), paint)
      ..drawLine(p(18, 4), p(18, 20), paint)
      ..drawLine(p(2, 9), p(6, 9), paint)
      ..drawLine(p(2, 15), p(6, 15), paint)
      ..drawLine(p(18, 9), p(22, 9), paint)
      ..drawLine(p(18, 15), p(22, 15), paint)
      ..drawLine(p(9, 4), p(15, 4), paint)
      ..drawLine(p(9, 20), p(15, 20), paint);
  }

  @override
  bool shouldRepaint(covariant _DumbbellPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.strokeWidth != strokeWidth;
}
