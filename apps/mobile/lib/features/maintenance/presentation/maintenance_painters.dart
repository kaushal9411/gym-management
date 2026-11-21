import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

// Painters for the maintenance screen. All of them are driven by a looping
// `t` in 0..1 (one shared controller) — no per-painter tickers — and take
// already-resolved colours, so they stay theme/role agnostic.

/// The maintenance palette. The page is always the same warm gradient
/// (amber -> coral -> magenta -> deep violet, matching the web maintenance
/// page) with white ink on top, in light and dark theme alike — so it is a
/// fixed local palette rather than `AppColors` neutrals.
class MaintenancePalette {
  MaintenancePalette._();

  static const amber = Color(0xFFF59E0B);
  static const coral = Color(0xFFF43F5E);
  static const magenta = Color(0xFFC026D3);
  static const violet = Color(0xFF5B21B6);
  static const stops = [0.0, 0.36, 0.68, 1.0];
  static const colors = [amber, coral, magenta, violet];

  static const ink = Colors.white;
  static final inkSoft = Colors.white.withValues(alpha: 0.82);
  static final inkFaint = Colors.white.withValues(alpha: 0.62);
  static final glass = Colors.white.withValues(alpha: 0.16);
  static final glassBorder = Colors.white.withValues(alpha: 0.30);
  static final rail = Colors.white.withValues(alpha: 0.28);
}

/// The slowly drifting 135deg gradient: the gradient axis sways a few degrees
/// around the topLeft -> bottomRight diagonal, with one soft white bloom.
class MaintenanceBackdropPainter extends CustomPainter {
  MaintenanceBackdropPainter({required this.t});

  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final sway = math.sin(2 * math.pi * t) * 0.22;
    final angle = math.pi / 4 + sway;
    final dir = Offset(math.cos(angle), math.sin(angle));
    final half = (size.width * dir.dx.abs() + size.height * dir.dy.abs()) / 2;
    final c = size.center(Offset.zero);
    final rect = Offset.zero & size;
    canvas.drawRect(
      rect,
      Paint()
        ..shader = ui.Gradient.linear(
          c - dir * half,
          c + dir * half,
          MaintenancePalette.colors,
          MaintenancePalette.stops,
        ),
    );
    final b = Offset(
      size.width * (0.8 - 0.16 * math.cos(2 * math.pi * t)),
      size.height * (0.2 + 0.06 * math.sin(2 * math.pi * t)),
    );
    final r = size.width * 0.8;
    canvas.drawCircle(
      b,
      r,
      Paint()
        ..shader = ui.Gradient.radial(
          b,
          r,
          [
            Colors.white.withValues(alpha: 0.16),
            Colors.white.withValues(alpha: 0),
          ],
        ),
    );
  }

  @override
  bool shouldRepaint(MaintenanceBackdropPainter old) => old.t != t;
}

/// The hero: a barbell being serviced — it rocks on its floor shadow while two
/// meshing gears turn above it — with a heartbeat (ECG) line under it whose
/// bright head sweeps across. [celebrate] (0..1) is the "Back online" beat:
/// the bar lifts, rings burst out, and the ECG turns [success].
class MaintenanceHeroPainter extends CustomPainter {
  MaintenanceHeroPainter({
    required this.t,
    required this.celebrate,
    required this.colorA,
    required this.colorB,
    required this.bar,
    required this.faint,
    required this.success,
  });

  final double t;
  final double celebrate;
  final Color colorA;
  final Color colorB;
  final Color bar;
  final Color faint;
  final Color success;

  static const _tau = 2 * math.pi;

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final barY = size.height * 0.42;
    final bob = math.sin(_tau * t) * 3;
    final lift = Curves.easeOutBack.transform(celebrate.clamp(0, 1)) * 14;

    // Pulsing glow behind the bar.
    final glowColor = Color.lerp(colorB, success, celebrate)!;
    final pulse = 0.85 + 0.15 * math.sin(_tau * t * 2);
    canvas.drawCircle(
      Offset(cx, barY),
      size.height * 0.5 * pulse,
      Paint()
        ..shader = ui.Gradient.radial(
          Offset(cx, barY),
          size.height * 0.5 * pulse,
          [glowColor.withValues(alpha: 0.28), glowColor.withValues(alpha: 0)],
        ),
    );

    // Floor shadow — shrinks as the bar bobs/lifts away from it.
    final floorY = barY + 74;
    final shadowScale = 1 - (bob + lift) / 60;
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(cx, floorY),
        width: size.width * 0.5 * shadowScale,
        height: 8,
      ),
      Paint()
        ..color = bar.withValues(alpha: 0.12)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );

    // Gears (top-right of the bar), meshing: opposite rotation, ratio 3:2.
    final gearAngle = _tau * t * 2;
    _gear(
      canvas,
      Offset(cx + 62, barY - 56),
      20,
      8,
      gearAngle,
      Color.lerp(colorA, success, celebrate)!,
    );
    _gear(
      canvas,
      Offset(cx + 94, barY - 36),
      13,
      6,
      -gearAngle * 1.5 + 0.3,
      Color.lerp(colorB, success, celebrate)!,
    );

    // Barbell.
    canvas.save();
    canvas.translate(cx, barY + bob - lift);
    canvas.rotate(math.sin(_tau * t) * 0.035);
    final half = math.min(size.width * 0.42, 150.0);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTRB(-half, -3, half, 3),
        const Radius.circular(3),
      ),
      Paint()..color = bar.withValues(alpha: 0.9),
    );
    const plates = [(54.0, 14.0), (42.0, 12.0), (30.0, 10.0)];
    for (final side in [-1, 1]) {
      var x = 28.0;
      for (var i = 0; i < plates.length; i++) {
        final (h, w) = plates[i];
        // Plates rattle a hair, out of phase, like they're being tightened.
        final rattle = math.sin(_tau * t * 3 + i * 1.1 + (side == 1 ? 0 : 2)) *
            (1 - celebrate) *
            1.4;
        final left = side == 1 ? x + rattle : -(x + w) - rattle;
        final rect = Rect.fromLTWH(left, -h, w, h * 2);
        final rrect = RRect.fromRectAndRadius(rect, const Radius.circular(5));
        canvas.drawRRect(
          rrect,
          Paint()
            ..shader = ui.Gradient.linear(
              rect.topLeft,
              rect.bottomRight,
              [
                Color.lerp(colorA, success, celebrate)!
                    .withValues(alpha: 1 - i * 0.18),
                Color.lerp(colorB, success, celebrate)!
                    .withValues(alpha: 1 - i * 0.18),
              ],
            ),
        );
        // Highlight edge.
        canvas.drawRRect(
          rrect,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1
            ..color = Colors.white.withValues(alpha: 0.18),
        );
        x += w + 3;
      }
      // End cap.
      canvas.drawCircle(
        Offset(side * (x + 4), 0),
        4,
        Paint()..color = bar,
      );
    }
    canvas.restore();

    // Celebration rings.
    if (celebrate > 0) {
      for (var i = 0; i < 3; i++) {
        final p = ((celebrate * 1.4) - i * 0.18).clamp(0.0, 1.0);
        if (p <= 0) continue;
        canvas.drawCircle(
          Offset(cx, barY - lift),
          30 + p * size.width * 0.34,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.5 * (1 - p)
            ..color = success.withValues(alpha: 0.55 * (1 - p)),
        );
      }
      final rng = math.Random(7);
      for (var i = 0; i < 16; i++) {
        final ang = rng.nextDouble() * _tau;
        final dist = (30 + rng.nextDouble() * 70) * celebrate;
        canvas.drawCircle(
          Offset(
            cx + math.cos(ang) * dist * 1.6,
            barY - lift + math.sin(ang) * dist,
          ),
          2.2 * (1 - celebrate * 0.6),
          Paint()
            ..color = (i.isEven ? colorA : colorB)
                .withValues(alpha: 1 - celebrate * 0.8),
        );
      }
    }

    _ecg(canvas, size, size.height - 22);
  }

  void _gear(
    Canvas canvas,
    Offset c,
    double r,
    int teeth,
    double angle,
    Color color,
  ) {
    final path = Path();
    const steps = 4; // points per tooth
    final n = teeth * steps;
    for (var i = 0; i < n; i++) {
      final a = angle + i * _tau / n;
      final inTooth = (i % steps) == 1 || (i % steps) == 2;
      final rr = inTooth ? r + r * 0.28 : r;
      final p = Offset(c.dx + math.cos(a) * rr, c.dy + math.sin(a) * rr);
      if (i == 0) {
        path.moveTo(p.dx, p.dy);
      } else {
        path.lineTo(p.dx, p.dy);
      }
    }
    path.close();
    canvas.drawPath(path, Paint()..color = color.withValues(alpha: 0.9));
    canvas.drawCircle(c, r * 0.4, Paint()..color = faint);
  }

  /// A flat line with a PQRST-style spike every ~third of the width; a bright
  /// segment (the "head") travels along it.
  void _ecg(Canvas canvas, Size size, double y) {
    final path = Path()..moveTo(0, y);
    const beats = 3;
    final w = size.width;
    for (var i = 0; i < beats; i++) {
      final x0 = w * i / beats;
      final u = w / beats;
      path
        ..lineTo(x0 + u * 0.28, y)
        ..lineTo(x0 + u * 0.34, y - 5)
        ..lineTo(x0 + u * 0.40, y)
        ..lineTo(x0 + u * 0.46, y + 4)
        ..lineTo(x0 + u * 0.52, y - 26)
        ..lineTo(x0 + u * 0.58, y + 12)
        ..lineTo(x0 + u * 0.64, y)
        ..lineTo(x0 + u * 0.74, y - 7)
        ..lineTo(x0 + u * 0.84, y)
        ..lineTo(x0 + u, y);
    }
    final line = Color.lerp(colorB, success, celebrate)!;
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..strokeJoin = StrokeJoin.round
        ..color = faint.withValues(alpha: 0.5),
    );
    final metric = path.computeMetrics().first;
    final head = metric.length * (t * 2 % 1.0);
    final tail = math.max(0.0, head - metric.length * 0.22);
    canvas.drawPath(
      metric.extractPath(tail, head),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = line
        ..maskFilter = const MaskFilter.blur(BlurStyle.solid, 1.5),
    );
    final tangent = metric.getTangentForOffset(head);
    if (tangent != null) {
      canvas.drawCircle(tangent.position, 3.2, Paint()..color = line);
    }
  }

  @override
  bool shouldRepaint(MaintenanceHeroPainter old) =>
      old.t != t ||
      old.celebrate != celebrate ||
      old.colorA != colorA ||
      old.colorB != colorB ||
      old.bar != bar ||
      old.faint != faint ||
      old.success != success;
}

/// The step track: a dim rail, a lit segment, and a glowing "pulse" riding
/// from node to node ([pos] is 0..2 in node units). Nodes themselves are
/// widgets; this only draws the rail between their centres.
class MaintenanceTrackPainter extends CustomPainter {
  MaintenanceTrackPainter({
    required this.pos,
    required this.rail,
    required this.colorA,
    required this.colorB,
    required this.done,
    required this.success,
  });

  final double pos;
  final Color rail;
  final Color colorA;
  final Color colorB;

  /// All steps complete — the whole rail turns [success].
  final bool done;
  final Color success;

  @override
  void paint(Canvas canvas, Size size) {
    // Node centres sit at 1/6, 3/6, 5/6 of the width (three equal columns).
    final x0 = size.width / 6;
    final x1 = size.width * 5 / 6;
    final y = size.height / 2;
    canvas.drawLine(
      Offset(x0, y),
      Offset(x1, y),
      Paint()
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round
        ..color = rail,
    );
    final px = x0 + (x1 - x0) * (pos / 2).clamp(0.0, 1.0);
    final litShader = ui.Gradient.linear(
      Offset(x0, y),
      Offset(x1, y),
      [done ? success : colorA, done ? success : colorB],
    );
    canvas.drawLine(
      Offset(x0, y),
      Offset(done ? x1 : px, y),
      Paint()
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round
        ..shader = litShader,
    );
    if (!done) {
      canvas.drawCircle(
        Offset(px, y),
        9,
        Paint()
          ..shader = ui.Gradient.radial(
            Offset(px, y),
            9,
            [colorB.withValues(alpha: 0.7), colorB.withValues(alpha: 0)],
          ),
      );
      canvas.drawCircle(Offset(px, y), 3.5, Paint()..color = Colors.white);
    }
  }

  @override
  bool shouldRepaint(MaintenanceTrackPainter old) =>
      old.pos != pos || old.done != done || old.rail != rail;
}

/// The countdown ring to the next automatic check.
class MaintenanceRingPainter extends CustomPainter {
  MaintenanceRingPainter({
    required this.progress,
    required this.track,
    required this.colorA,
    required this.colorB,
  });

  /// 0 = just checked, 1 = about to check.
  final double progress;
  final Color track;
  final Color colorA;
  final Color colorB;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 3.5;
    final rect = Offset.zero & size;
    final arc = rect.deflate(stroke / 2);
    canvas.drawArc(
      arc,
      0,
      2 * math.pi,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = track,
    );
    canvas.drawArc(
      arc,
      -math.pi / 2,
      2 * math.pi * progress.clamp(0.0, 1.0),
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..shader = ui.Gradient.sweep(
          rect.center,
          [colorA, colorB],
          [0, 1],
          TileMode.clamp,
          -math.pi / 2,
          3 * math.pi / 2,
        ),
    );
  }

  @override
  bool shouldRepaint(MaintenanceRingPainter old) =>
      old.progress != progress || old.track != track;
}
