import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../../shared/widgets/motion.dart';

/// Painting helpers shared by the kit's `CustomPainter`s.

/// Duration of every "draw in" animation (lines wipe in, bars grow, rings
/// fill).
const kRptDrawDuration = Duration(milliseconds: 900);

/// Gives a `State` a one-shot 0..1 "draw in" animation ([draw]) that plays
/// when the widget first builds (instantly when the OS reduce-motion setting
/// is on) and again on [replay]. Painters listen to [t] through
/// `CustomPainter(repaint:)`, so a frame repaints without rebuilding the
/// widget tree.
mixin RptDrawIn<T extends StatefulWidget>
    on State<T>, SingleTickerProviderStateMixin<T> {
  late final AnimationController draw =
      AnimationController(vsync: this, duration: kRptDrawDuration);

  /// Eased progress, 0..1.
  late final Animation<double> t =
      CurvedAnimation(parent: draw, curve: Curves.easeOutCubic);

  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (reduceMotion(context)) {
      draw.value = 1;
    } else {
      draw.forward();
    }
  }

  /// Plays the draw-in again (e.g. after the data or the mode changed).
  void replay() {
    if (reduceMotion(context)) {
      draw.value = 1;
    } else {
      draw.forward(from: 0);
    }
  }

  @override
  void dispose() {
    draw.dispose();
    super.dispose();
  }
}

/// Lays out and caches [TextPainter]s so a repainting chart does not
/// re-measure the same axis labels every frame. Entries are keyed by text,
/// size, weight and colour, so a theme switch simply misses the cache.
class RptTextCache {
  final Map<String, TextPainter> _cache = {};

  TextPainter get(
    String text, {
    double size = 10,
    Color color = Colors.grey,
    FontWeight weight = FontWeight.w700,
  }) {
    final key = '$text|$size|${weight.value}|${color.toARGB32()}';
    final hit = _cache[key];
    if (hit != null) return hit;
    if (_cache.length > 240) _cache.clear();
    return _cache[key] = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(color: color, fontSize: size, fontWeight: weight),
      ),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout();
  }

  void dispose() {
    for (final p in _cache.values) {
      p.dispose();
    }
    _cache.clear();
  }
}

/// A smooth curve through [pts] that never overshoots (horizontal-tangent
/// cubic between neighbours), so a line chart cannot dip below zero.
Path rptSmoothPath(List<Offset> pts, {bool smooth = true}) {
  final path = Path();
  if (pts.isEmpty) return path;
  path.moveTo(pts.first.dx, pts.first.dy);
  for (var i = 1; i < pts.length; i++) {
    final a = pts[i - 1];
    final b = pts[i];
    if (!smooth) {
      path.lineTo(b.dx, b.dy);
    } else {
      final mx = (a.dx + b.dx) / 2;
      path.cubicTo(mx, a.dy, mx, b.dy, b.dx, b.dy);
    }
  }
  return path;
}

/// Strokes [path] as a dashed line.
void rptDashedPath(
  Canvas canvas,
  Path path,
  Paint paint, {
  double dash = 5,
  double gap = 4,
}) {
  for (final m in path.computeMetrics()) {
    var d = 0.0;
    while (d < m.length) {
      canvas.drawPath(m.extractPath(d, math.min(d + dash, m.length)), paint);
      d += dash + gap;
    }
  }
}

/// A rectangle with rounded top corners (bars).
RRect rptBarRect(
  double x,
  double top,
  double w,
  double bottom, [
  double r = 5,
]) {
  final radius = Radius.circular(math.min(r, math.max(0, w / 2)));
  return RRect.fromLTRBAndCorners(
    x,
    top,
    x + w,
    math.max(top, bottom),
    topLeft: radius,
    topRight: radius,
  );
}

/// Soft vertical gradient shader for area fills.
ui.Shader rptAreaShader(Rect rect, Color c, {double top = 0.30}) {
  return LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [c.withValues(alpha: top), c.withValues(alpha: 0.02)],
  ).createShader(rect);
}
