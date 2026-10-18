import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Small, dependency-free animation primitives for the redesigned Member
/// detail screen (hero, tiles, rings, bars). Each one plays once on first
/// build, except the explicitly looping ones (spin / pulse / float / shimmer).

class FadeUp extends StatelessWidget {
  const FadeUp({super.key, required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final delay = (index * 70).clamp(0, 900);
    final total = 650 + delay;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: total),
      curve: Interval(delay / total, 1, curve: Curves.easeOutCubic),
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(0, 16 * (1 - t)),
          child: child,
        ),
      ),
      child: child,
    );
  }
}

class CountUp extends StatelessWidget {
  const CountUp({
    super.key,
    required this.value,
    required this.style,
    this.prefix = '',
    this.suffix = '',
  });

  final num value;
  final TextStyle style;
  final String prefix;
  final String suffix;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.toDouble()),
      duration: const Duration(milliseconds: 1300),
      curve: Curves.easeOutCubic,
      builder: (context, v, _) =>
          Text('$prefix${v.round()}$suffix', style: style),
    );
  }
}

class GrowBar extends StatelessWidget {
  const GrowBar({
    super.key,
    required this.ratio,
    required this.colors,
    this.height = 8,
    this.track,
  });

  final double ratio;
  final List<Color> colors;
  final double height;
  final Color? track;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: track ?? Colors.grey.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(9),
      ),
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: ratio.clamp(0.02, 1.0)),
        duration: const Duration(milliseconds: 1200),
        curve: Curves.easeOutCubic,
        builder: (context, v, _) => FractionallySizedBox(
          alignment: Alignment.centerLeft,
          widthFactor: v,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(9),
              gradient: LinearGradient(colors: colors),
            ),
          ),
        ),
      ),
    );
  }
}

/// Circular progress that fills in on first build, with a gradient stroke.
class AnimatedRing extends StatelessWidget {
  const AnimatedRing({
    super.key,
    required this.value,
    required this.size,
    required this.colors,
    required this.track,
    this.stroke = 12,
    this.child,
  });

  final double value;
  final double size;
  final List<Color> colors;
  final Color track;
  final double stroke;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.clamp(0.0, 1.0)),
      duration: const Duration(milliseconds: 1500),
      curve: Curves.easeOutCubic,
      builder: (context, v, _) => SizedBox(
        width: size,
        height: size,
        child: CustomPaint(
          painter: _RingPainter(v, colors, track, stroke),
          child: Center(child: child),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.value, this.colors, this.track, this.stroke);

  final double value;
  final List<Color> colors;
  final Color track;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset(stroke / 2, stroke / 2) &
        Size(size.width - stroke, size.height - stroke);
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = track;
    canvas.drawArc(rect, 0, math.pi * 2, false, base);
    if (value <= 0) return;
    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..shader = SweepGradient(
        startAngle: 0,
        endAngle: math.pi * 2,
        colors: colors.length == 1 ? [colors.first, colors.first] : colors,
        transform: const GradientRotation(-math.pi / 2),
      ).createShader(rect);
    canvas.drawArc(rect, -math.pi / 2, math.pi * 2 * value, false, arc);
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.value != value || old.colors != colors || old.track != track;
}

/// Looping controller helper — drives spin / pulse / float / shimmer / mesh.
class Looping extends StatefulWidget {
  const Looping({
    super.key,
    required this.duration,
    required this.builder,
    this.reverse = false,
  });

  final Duration duration;
  final bool reverse;
  final Widget Function(BuildContext context, double t) builder;

  @override
  State<Looping> createState() => _LoopingState();
}

class _LoopingState extends State<Looping> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: widget.duration,
  )..repeat(reverse: widget.reverse);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (c, _) => widget.builder(c, _c.value),
      );
}

/// Gradient hero background whose gradient slowly drifts, with two soft
/// colour blobs floating behind the content.
class MeshHeroBackground extends StatelessWidget {
  const MeshHeroBackground({super.key, required this.child, this.radius});

  final Widget child;
  final BorderRadius? radius;

  @override
  Widget build(BuildContext context) {
    return Looping(
      duration: const Duration(seconds: 10),
      reverse: true,
      builder: (context, t) {
        return ClipRRect(
          borderRadius: radius ?? BorderRadius.zero,
          child: Stack(
            fit: StackFit.passthrough,
            children: [
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment(-1 + t * 0.6, -1),
                      end: Alignment(1 - t * 0.6, 1),
                      colors: const [
                        Color(0xFF312E81),
                        Color(0xFF4338CA),
                        Color(0xFF7C3AED),
                        Color(0xFFC026D3),
                        Color(0xFFEC4899),
                      ],
                    ),
                  ),
                ),
              ),
              Positioned(
                right: -60 + 22 * t,
                top: -70 - 14 * t,
                child: _blob(220, const Color(0x8CFBBF24)),
              ),
              Positioned(
                left: -70 - 18 * t,
                bottom: 30 + 16 * t,
                child: _blob(200, const Color(0x7322D3EE)),
              ),
              SizedBox(width: double.infinity, child: child),
            ],
          ),
        );
      },
    );
  }

  Widget _blob(double size, Color color) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [color, color.withValues(alpha: 0)]),
        ),
      );
}

/// Avatar wrapped in a slowly rotating rainbow ring.
class SpinningRing extends StatelessWidget {
  const SpinningRing({super.key, required this.size, required this.child});

  final double size;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Looping(
      duration: const Duration(seconds: 6),
      builder: (context, t) => Container(
        width: size,
        height: size,
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: SweepGradient(
            transform: GradientRotation(t * math.pi * 2),
            colors: const [
              Color(0xFFFDE68A),
              Color(0xFFF9A8D4),
              Color(0xFFA5B4FC),
              Color(0xFF6EE7B7),
              Color(0xFFFDE68A),
            ],
          ),
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.9),
              width: 3,
            ),
          ),
          child: ClipOval(child: child),
        ),
      ),
    );
  }
}

class PulseDot extends StatelessWidget {
  const PulseDot({super.key, required this.color, this.size = 10});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Looping(
      duration: const Duration(milliseconds: 1800),
      builder: (context, t) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.7 * (1 - t)),
              spreadRadius: 10 * t,
            ),
          ],
        ),
      ),
    );
  }
}

class Floating extends StatelessWidget {
  const Floating({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Looping(
      duration: const Duration(seconds: 4),
      reverse: true,
      builder: (context, t) => Transform.translate(
        offset: Offset(0, -9 * Curves.easeInOut.transform(t)),
        child: child,
      ),
    );
  }
}

/// Gradient CTA with a light sweep that periodically crosses it.
class ShimmerButton extends StatelessWidget {
  const ShimmerButton({
    super.key,
    required this.child,
    required this.colors,
    required this.onTap,
    this.padding = const EdgeInsets.symmetric(vertical: 13),
  });

  final Widget child;
  final List<Color> colors;
  final VoidCallback? onTap;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Looping(
        duration: const Duration(milliseconds: 3200),
        builder: (context, t) => Container(
          width: double.infinity,
          padding: padding,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: LinearGradient(colors: colors),
            boxShadow: [
              BoxShadow(
                color: colors.last.withValues(alpha: 0.4),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Positioned.fill(
                  child: FractionallySizedBox(
                    widthFactor: 0.3,
                    alignment: Alignment(-1.6 + 4.2 * t, 0),
                    child:
                        Container(color: Colors.white.withValues(alpha: 0.28)),
                  ),
                ),
                child,
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Pop-in wrapper for calendar days / chips.
class PopIn extends StatelessWidget {
  const PopIn({super.key, required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final delay = (index * 35).clamp(0, 900);
    final total = 450 + delay;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: total),
      curve: Interval(delay / total, 1, curve: Curves.easeOutBack),
      builder: (context, t, child) => Opacity(
        opacity: t.clamp(0.0, 1.0),
        child: Transform.scale(scale: 0.4 + 0.6 * t, child: child),
      ),
      child: child,
    );
  }
}

/// Line chart with an area fill that draws itself in. [values] in
/// chronological order; at least two points.
class DrawnSparkline extends StatelessWidget {
  const DrawnSparkline({
    super.key,
    required this.values,
    required this.colors,
    this.height = 80,
  });

  final List<double> values;
  final List<Color> colors;
  final double height;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 1800),
      curve: Curves.easeOutCubic,
      builder: (context, t, _) => SizedBox(
        height: height,
        width: double.infinity,
        child: CustomPaint(painter: _SparkPainter(values, colors, t)),
      ),
    );
  }
}

class _SparkPainter extends CustomPainter {
  _SparkPainter(this.values, this.colors, this.t);

  final List<double> values;
  final List<Color> colors;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;
    final minV = values.reduce(math.min);
    final maxV = values.reduce(math.max);
    final span = (maxV - minV) == 0 ? 1 : (maxV - minV);
    const pad = 8.0;
    Offset pt(int i) => Offset(
          pad + (size.width - pad * 2) * i / (values.length - 1),
          pad + (size.height - pad * 2) * (1 - (values[i] - minV) / span),
        );
    final path = Path()..moveTo(pt(0).dx, pt(0).dy);
    for (var i = 1; i < values.length; i++) {
      path.lineTo(pt(i).dx, pt(i).dy);
    }
    final shader =
        LinearGradient(colors: colors).createShader(Offset.zero & size);

    final metric = path.computeMetrics().first;
    final drawn = metric.extractPath(0, metric.length * t);

    final area = Path.from(drawn);
    final end = metric.getTangentForOffset(metric.length * t)?.position;
    if (end != null) {
      area
        ..lineTo(end.dx, size.height)
        ..lineTo(pt(0).dx, size.height)
        ..close();
      canvas.drawPath(
        area,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              colors.last.withValues(alpha: 0.25),
              colors.last.withValues(alpha: 0),
            ],
          ).createShader(Offset.zero & size),
      );
    }
    canvas.drawPath(
      drawn,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.5
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..shader = shader,
    );
    if (end != null && t > 0.98) {
      canvas.drawCircle(
        pt(values.length - 1),
        4.5,
        Paint()..color = colors.last,
      );
    }
  }

  @override
  bool shouldRepaint(_SparkPainter old) => old.t != t || old.values != values;
}
