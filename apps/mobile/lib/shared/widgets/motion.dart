import 'package:flutter/material.dart';

/// Small, package-free motion helpers (Flutter core only — the app has no
/// animation package). Every widget collapses to its final state instantly
/// when the OS "remove animations" / reduce-motion setting is on
/// (`MediaQuery.disableAnimations`).

bool reduceMotion(BuildContext context) =>
    MediaQuery.maybeOf(context)?.disableAnimations ?? false;

/// Fade + 12px rise on first build, delayed by [index] * [step] so a column
/// of blocks enters one after another. Plays once per mount.
class StaggeredReveal extends StatefulWidget {
  const StaggeredReveal({
    super.key,
    required this.child,
    this.index = 0,
    this.step = const Duration(milliseconds: 70),
  });

  final Widget child;
  final int index;
  final Duration step;

  @override
  State<StaggeredReveal> createState() => _StaggeredRevealState();
}

class _StaggeredRevealState extends State<StaggeredReveal>
    with SingleTickerProviderStateMixin {
  static const _body = Duration(milliseconds: 380);
  AnimationController? _c;
  late final Animation<double> _t;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (reduceMotion(context)) return;
    // Cap the stagger so a long column never feels slow.
    final delay = widget.step * widget.index.clamp(0, 8);
    final total = delay + _body;
    final c = AnimationController(vsync: this, duration: total);
    _t = CurvedAnimation(
      parent: c,
      curve: Interval(
        delay.inMilliseconds / total.inMilliseconds,
        1,
        curve: Curves.easeOutCubic,
      ),
    );
    _c = c..forward();
  }

  @override
  void dispose() {
    _c?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_c == null) return widget.child;
    return AnimatedBuilder(
      animation: _t,
      child: widget.child,
      builder: (context, child) => Opacity(
        opacity: _t.value,
        child: Transform.translate(
          offset: Offset(0, 12 * (1 - _t.value)),
          child: child,
        ),
      ),
    );
  }
}

/// Counts up from 0 (and re-targets smoothly when [value] changes).
class AnimatedNumber extends StatelessWidget {
  const AnimatedNumber({
    super.key,
    required this.value,
    required this.format,
    this.style,
  });

  final double value;
  final String Function(double) format;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    if (reduceMotion(context)) return Text(format(value), style: style);
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: value),
      duration: const Duration(milliseconds: 650),
      curve: Curves.easeOutCubic,
      builder: (context, v, _) => Text(format(v), style: style),
    );
  }
}

/// Left-to-right wipe used to "draw" a chart in once.
class WipeReveal extends StatelessWidget {
  const WipeReveal({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (reduceMotion(context)) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: 1),
      duration: const Duration(milliseconds: 700),
      curve: Curves.easeOutCubic,
      child: child,
      builder: (context, t, child) => ClipRect(
        child: Align(
          alignment: Alignment.centerLeft,
          widthFactor: t.clamp(0.001, 1),
          child: child,
        ),
      ),
    );
  }
}

/// Animates a 0..1 fraction (share/progress bars grow on first paint).
class AnimatedFraction extends StatelessWidget {
  const AnimatedFraction({
    super.key,
    required this.fraction,
    required this.builder,
  });

  final double fraction;
  final Widget Function(BuildContext, double) builder;

  @override
  Widget build(BuildContext context) {
    if (reduceMotion(context)) return builder(context, fraction);
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: fraction),
      duration: const Duration(milliseconds: 550),
      curve: Curves.easeOutCubic,
      builder: (context, v, _) => builder(context, v),
    );
  }
}
