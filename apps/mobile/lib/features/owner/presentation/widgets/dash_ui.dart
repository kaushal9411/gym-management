import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';

/// Accent hues for the Overview (the same set as tenant-web's dashboard:
/// primary indigo, violet, aqua, plus the status colours). Getters, not
/// consts, so the text-sized uses get a darker shade on the light theme.
class Dash {
  Dash._();

  static Color get indigo =>
      AppColors.isLight ? const Color(0xFF4F46E5) : const Color(0xFF7C83FF);
  static Color get violet =>
      AppColors.isLight ? const Color(0xFF7C3AED) : const Color(0xFFA78BFA);
  static Color get aqua =>
      AppColors.isLight ? const Color(0xFF0E9F85) : const Color(0xFF14E0B4);
  static Color get warning =>
      AppColors.isLight ? const Color(0xFFC27803) : AppColors.warning;
  static Color get success =>
      AppColors.isLight ? const Color(0xFF15A05A) : AppColors.success;
  static Color get danger =>
      AppColors.isLight ? const Color(0xFFE11D48) : AppColors.danger;

  /// Web hero gradient (indigo → violet → fuchsia).
  static const heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF4338CA), Color(0xFF7C3AED), Color(0xFFC026D3)],
    stops: [0, 0.62, 1],
  );

  static String initials(String name) {
    final words =
        name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return '?';
    final letters = words.take(2).map((w) => w[0]).join();
    return letters.toUpperCase();
  }
}

/// Counts up to [value] on first build (skipped when the OS asks for reduced
/// motion), like web's `CountUp`.
class DashCountUp extends StatelessWidget {
  const DashCountUp({
    super.key,
    required this.value,
    required this.format,
    required this.style,
  });

  final double value;
  final String Function(double) format;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).disableAnimations) {
      return Text(format(value), style: style);
    }
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value),
      duration: const Duration(milliseconds: 800),
      curve: Curves.easeOut,
      builder: (_, v, __) => Text(
        format(v),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: style,
      ),
    );
  }
}

class DashChip extends StatelessWidget {
  const DashChip(this.label, {super.key, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Text(
          label,
          style: AppText.tabular(size: 11, color: color, weight: FontWeight.w800),
        ),
      );
}

class DashIconChip extends StatelessWidget {
  const DashIconChip(this.icon, {super.key, required this.color, this.size = 30});

  final IconData icon;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(size * 0.33),
        ),
        child: Icon(icon, size: size * 0.5, color: color),
      );
}

/// Card with a tinted header (icon chip, title, optional right-hand chip) —
/// web's `PanelCard`.
class DashPanel extends StatelessWidget {
  const DashPanel({
    super.key,
    required this.icon,
    required this.accent,
    required this.title,
    required this.child,
    this.chip,
    this.trailing,
  });

  final IconData icon;
  final Color accent;
  final String title;
  final String? chip;
  final Widget? trailing;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(14, 13, 14, 11),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [accent.withValues(alpha: 0.16), Colors.transparent],
              ),
            ),
            child: Row(
              children: [
                DashIconChip(icon, color: accent),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.display(size: 15),
                  ),
                ),
                if (chip != null) DashChip(chip!, color: accent),
                if (trailing != null) trailing!,
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
            child: child,
          ),
        ],
      ),
    );
  }
}

/// One of the eight key-figure tiles: tinted gradient, icon chip, optional
/// tag, count-up value, label and a footer (sparkline or progress bar).
class DashTile extends StatelessWidget {
  const DashTile({
    super.key,
    required this.icon,
    required this.accent,
    required this.label,
    required this.value,
    required this.format,
    this.tag,
    this.footer,
    this.onTap,
  });

  final IconData icon;
  final Color accent;
  final String label;
  final double value;
  final String Function(double) format;
  final String? tag;
  final Widget? footer;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tile = Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: accent.withValues(alpha: 0.28)),
        color: AppColors.surface2,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [accent.withValues(alpha: 0.13), Colors.transparent],
          stops: const [0, 0.72],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              DashIconChip(icon, color: accent, size: 28),
              if (tag != null) DashChip(tag!, color: accent),
            ],
          ),
          const SizedBox(height: 8),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: DashCountUp(
              value: value,
              format: format,
              style: AppText.display(size: 24, color: accent),
            ),
          ),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.body(size: 11.5, color: AppColors.inkSoft),
          ),
          if (footer != null) footer!,
        ],
      ),
    );
    if (onTap == null) return tile;
    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: tile,
      ),
    );
  }
}

class DashSumTile extends StatelessWidget {
  const DashSumTile({
    super.key,
    required this.value,
    required this.label,
    required this.color,
  });

  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.22)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(value, style: AppText.display(size: 16)),
            ),
            Text(
              label,
              style: AppText.body(size: 10.5, color: AppColors.inkSoft),
            ),
          ],
        ),
      );
}

class DashProgress extends StatelessWidget {
  const DashProgress({super.key, required this.percent, required this.color});

  final double percent;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        height: 8,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(99),
        ),
        alignment: Alignment.centerLeft,
        child: FractionallySizedBox(
          widthFactor: (percent / 100).clamp(0.0, 1.0),
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color, color.withValues(alpha: 0.55)],
              ),
              borderRadius: BorderRadius.circular(99),
            ),
          ),
        ),
      );
}

class DashAvatar extends StatelessWidget {
  const DashAvatar(this.name, {super.key, this.index = 0, this.size = 34});

  final String name;
  final int index;
  final double size;

  @override
  Widget build(BuildContext context) {
    final tones = [
      Dash.indigo,
      Dash.violet,
      Dash.aqua,
      Dash.warning,
      Dash.danger,
      Dash.success,
    ];
    final c = tones[index % tones.length];
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(colors: [c, Dash.violet]),
      ),
      child: Text(
        Dash.initials(name),
        style: AppText.body(
          size: size * 0.34,
          weight: FontWeight.w800,
          color: Colors.white,
        ),
      ),
    );
  }
}

/// Two-line list row: leading widget, title/subtitle, trailing widget.
class DashRow extends StatelessWidget {
  const DashRow({
    super.key,
    required this.leading,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.last = false,
  });

  final Widget leading;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final bool last;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(
          border: last
              ? null
              : Border(bottom: BorderSide(color: AppColors.surface3)),
        ),
        child: Row(
          children: [
            leading,
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(size: 13, weight: FontWeight.w700),
                  ),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(size: 11, color: AppColors.inkFaint),
                  ),
                ],
              ),
            ),
            if (trailing != null) ...[const SizedBox(width: 8), trailing!],
          ],
        ),
      );
}

class DashEmpty extends StatelessWidget {
  const DashEmpty(this.message, {super.key, this.icon = Icons.inbox_outlined});

  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 18),
        child: Center(
          child: Column(
            children: [
              Icon(icon, size: 24, color: AppColors.inkFaint),
              const SizedBox(height: 6),
              Text(
                message,
                textAlign: TextAlign.center,
                style: AppText.body(size: 12, color: AppColors.inkFaint),
              ),
            ],
          ),
        ),
      );
}

/// Tiny line chart for a KPI tile footer (web's `Sparkline`).
class DashSparkline extends StatelessWidget {
  const DashSparkline({super.key, required this.values, required this.color});

  final List<double> values;
  final Color color;

  @override
  Widget build(BuildContext context) {
    if (values.length < 2) return const SizedBox(height: 36);
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: SizedBox(
        height: 28,
        width: double.infinity,
        child: CustomPaint(painter: _SparkPainter(values, color)),
      ),
    );
  }
}

class _SparkPainter extends CustomPainter {
  _SparkPainter(this.values, this.color);

  final List<double> values;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final maxV = values.reduce(math.max);
    final minV = values.reduce(math.min);
    final span = (maxV - minV) == 0 ? 1.0 : maxV - minV;
    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = size.width * i / (values.length - 1);
      final y = size.height - 3 - (size.height - 6) * (values[i] - minV) / span;
      i == 0 ? path.moveTo(x, y) : path.lineTo(x, y);
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant _SparkPainter old) =>
      old.values != values || old.color != color;
}

/// Ring with a centre child. One or more arcs (fractions of 1.0, in order);
/// the remainder is drawn as a faint track. Used for the Members donut and
/// the health rings.
class DashRing extends StatelessWidget {
  const DashRing({
    super.key,
    required this.segments,
    required this.colors,
    required this.size,
    required this.thickness,
    required this.child,
    this.trackColor,
    this.semanticLabel,
  });

  final List<double> segments;
  final List<Color> colors;
  final double size;
  final double thickness;
  final Widget child;
  final Color? trackColor;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) => Semantics(
        label: semanticLabel,
        child: SizedBox(
          width: size,
          height: size,
          child: CustomPaint(
            painter: _RingPainter(
              segments,
              colors,
              thickness,
              trackColor ?? colors.first.withValues(alpha: 0.16),
            ),
            child: Center(child: child),
          ),
        ),
      );
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.segments, this.colors, this.thickness, this.track);

  final List<double> segments;
  final List<Color> colors;
  final double thickness;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final arcRect = rect.deflate(thickness / 2);
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = thickness;
    canvas.drawArc(arcRect, 0, math.pi * 2, false, base..color = track);
    var start = -math.pi / 2;
    for (var i = 0; i < segments.length; i++) {
      final sweep = math.pi * 2 * segments[i].clamp(0.0, 1.0);
      if (sweep <= 0) continue;
      canvas.drawArc(
        arcRect,
        start,
        sweep,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = thickness
          ..color = colors[i],
      );
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _RingPainter old) =>
      old.segments != segments || old.colors != colors;
}
