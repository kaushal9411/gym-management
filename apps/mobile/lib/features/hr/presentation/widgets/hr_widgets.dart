import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/app_clock.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../manager/presentation/widgets/member_detail_anim.dart';

/// Design kit for the HR screens (My HR + the HR admin area): shimmer
/// skeletons, status chips, the live clock ring, the month heatmap calendar,
/// leave-balance rings and a few small section primitives.
///
/// Everything here takes plain data (colours, labels, numbers) — no models, no
/// repositories — so the screens stay thin and the pieces are unit-testable.
/// Looping animations (clock sweep, button pulse, shimmer) collapse to a still
/// frame when the OS reduce-motion setting is on (`reduceMotion(context)`).

// ── skeletons ───────────────────────────────────────────────────────────────

/// One shimmering placeholder block. Static when reduce-motion is on.
class HrShimmerBox extends StatelessWidget {
  const HrShimmerBox({
    super.key,
    this.width,
    this.height = 16,
    this.radius = 10,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    Widget box(double t) => Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(radius),
            gradient: LinearGradient(
              begin: Alignment(-1.4 + 2.8 * t, 0),
              end: Alignment(-0.4 + 2.8 * t, 0),
              colors: [
                AppColors.surface3,
                AppColors.line.withValues(alpha: 0.9),
                AppColors.surface3,
              ],
            ),
          ),
        );
    if (reduceMotion(context)) return box(0.2);
    return Looping(
      duration: const Duration(milliseconds: 1400),
      builder: (context, t) => box(t),
    );
  }
}

/// A column of [count] skeleton cards — the loading state of every HR list.
class HrSkeletonList extends StatelessWidget {
  const HrSkeletonList({super.key, this.count = 4, this.height = 76});

  final int count;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Loading',
      child: Column(
        children: [
          for (var i = 0; i < count; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: HrShimmerBox(
                height: height,
                radius: AppRadii.card,
              ),
            ),
        ],
      ),
    );
  }
}

// ── status chip ─────────────────────────────────────────────────────────────

/// Pill with a tinted fill, a glyph and a label. [dense] is the in-row size.
class HrChip extends StatelessWidget {
  const HrChip({
    super.key,
    required this.label,
    required this.color,
    this.icon,
    this.dense = false,
    this.filled = false,
  });

  final String label;
  final Color color;
  final IconData? icon;
  final bool dense;

  /// Solid [color] background with white ink (used on gradients).
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? 8 : 11,
        vertical: dense ? 3 : 5,
      ),
      decoration: BoxDecoration(
        color: filled ? color : color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: filled
            ? null
            : Border.all(color: color.withValues(alpha: 0.35), width: 0.8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(
              icon,
              size: dense ? 11 : 13,
              color: filled ? Colors.white : color,
            ),
            SizedBox(width: dense ? 3 : 5),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: dense ? 10.5 : 11.5,
                weight: FontWeight.w800,
                color: filled ? Colors.white : color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── section primitives ──────────────────────────────────────────────────────

class HrSectionHeader extends StatelessWidget {
  const HrSectionHeader({
    super.key,
    required this.title,
    this.trailing,
    this.onTrailingTap,
  });

  final String title;
  final String? trailing;
  final VoidCallback? onTrailingTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, 6, 2, 10),
      child: Row(
        children: [
          Expanded(
            child: Semantics(
              header: true,
              child: Text(title, style: AppText.display(size: 16)),
            ),
          ),
          if (trailing != null)
            Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: onTrailingTap,
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Text(
                    trailing!,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w800,
                      color: AppColors.staffPillFg,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Plain surface card used by every HR block.
class HrCard extends StatelessWidget {
  const HrCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(14),
    this.accent,
    this.onTap,
  });

  final Widget child;
  final EdgeInsets padding;

  /// Tints the border + a faint corner wash.
  final Color? accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final body = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: AppColors.surface,
        gradient: accent == null
            ? null
            : LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [accent!.withValues(alpha: 0.12), Colors.transparent],
              ),
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(
          color:
              accent == null ? AppColors.line : accent!.withValues(alpha: 0.28),
        ),
      ),
      child: child,
    );
    if (onTap == null) return body;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: body,
      ),
    );
  }
}

/// Tinted tile with an icon, an animated number and a caption. Used for the
/// HR overview tiles and the month stats strip.
class HrStatTile extends StatelessWidget {
  const HrStatTile({
    super.key,
    required this.label,
    required this.color,
    required this.icon,
    this.value,
    this.text,
    this.onTap,
    this.index = 0,
    this.badge,
  });

  final String label;
  final Color color;
  final IconData icon;

  /// Animated (count-up) figure; ignored when [text] is set.
  final num? value;

  /// Pre-formatted figure (e.g. `9.5 h`, `₹42,000`), shown as-is.
  final String? text;
  final VoidCallback? onTap;
  final int index;

  /// Small red dot count over the icon (pending approvals).
  final int? badge;

  @override
  Widget build(BuildContext context) {
    final style = AppText.display(size: 24, color: color);
    final Widget figure;
    if (text != null) {
      figure = Text(text!, style: style, maxLines: 1);
    } else if (value == null) {
      figure = Text('–', style: style);
    } else if (reduceMotion(context)) {
      figure = Text('${value!.round()}', style: style);
    } else {
      figure = CountUp(value: value!, style: style);
    }
    return Semantics(
      container: true,
      label: '$label: ${text ?? value ?? '-'}',
      excludeSemantics: true,
      button: onTap != null,
      child: FadeUp(
        index: index,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    color.withValues(alpha: 0.18),
                    Colors.transparent,
                  ],
                ),
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: color.withValues(alpha: 0.26)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(9),
                            ),
                            child: Icon(icon, size: 15, color: color),
                          ),
                          if (badge != null && badge! > 0)
                            Positioned(
                              right: -6,
                              top: -6,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 5,
                                  vertical: 1,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.danger,
                                  borderRadius: BorderRadius.circular(9),
                                ),
                                child: Text(
                                  '$badge',
                                  style: AppText.body(
                                    size: 9.5,
                                    weight: FontWeight.w900,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                      const Spacer(),
                      if (onTap != null)
                        Icon(
                          Icons.chevron_right_rounded,
                          size: 16,
                          color: AppColors.inkFaint,
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  figure,
                  const SizedBox(height: 2),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 10.5,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── live clock ring ─────────────────────────────────────────────────────────

/// Rebuilds [builder] every second with India's wall-clock time.
class HrLiveClock extends StatefulWidget {
  const HrLiveClock({super.key, required this.builder});

  final Widget Function(BuildContext context, DateTime now) builder;

  @override
  State<HrLiveClock> createState() => _HrLiveClockState();
}

class _HrLiveClockState extends State<HrLiveClock> {
  late DateTime _now = AppClock.now();
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = AppClock.now());
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, _now);
}

/// The check-in clock face: 60 tick marks (the seconds hand lights them up as
/// it sweeps), an outer progress arc ([progress] = worked share of the shift),
/// and a soft glow. The time itself is laid on top by [child].
class HrClockRing extends StatelessWidget {
  const HrClockRing({
    super.key,
    required this.size,
    required this.seconds,
    required this.progress,
    required this.color,
    this.child,
    this.animateSweep = true,
  });

  final double size;
  final int seconds;

  /// 0..1 — drawn as the bright outer arc.
  final double progress;
  final Color color;
  final Widget? child;
  final bool animateSweep;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: progress.clamp(0.0, 1.0)),
      duration: reduceMotion(context)
          ? Duration.zero
          : const Duration(milliseconds: 900),
      curve: Curves.easeOutCubic,
      builder: (context, p, _) => SizedBox(
        width: size,
        height: size,
        child: CustomPaint(
          painter: HrClockRingPainter(
            seconds: animateSweep ? seconds : 0,
            progress: p,
            color: color,
            track: Colors.white.withValues(alpha: 0.16),
          ),
          child: Center(child: child),
        ),
      ),
    );
  }
}

class HrClockRingPainter extends CustomPainter {
  HrClockRingPainter({
    required this.seconds,
    required this.progress,
    required this.color,
    required this.track,
  });

  final int seconds;
  final double progress;
  final Color color;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2;
    final stroke = r * 0.075;
    final arcRect = Rect.fromCircle(center: c, radius: r - stroke / 2 - 2);

    // Glow behind the arc.
    canvas.drawCircle(
      c,
      r * 0.92,
      Paint()
        ..shader = RadialGradient(
          colors: [color.withValues(alpha: 0.22), color.withValues(alpha: 0)],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );

    // Track + progress arc.
    canvas.drawArc(
      arcRect,
      0,
      math.pi * 2,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = track,
    );
    if (progress > 0) {
      canvas.drawArc(
        arcRect,
        -math.pi / 2,
        math.pi * 2 * progress,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke
          ..strokeCap = StrokeCap.round
          ..shader = SweepGradient(
            startAngle: 0,
            endAngle: math.pi * 2,
            colors: [color.withValues(alpha: 0.55), color, Colors.white],
            transform: const GradientRotation(-math.pi / 2),
          ).createShader(arcRect),
      );
    }

    // 60 ticks; the ones behind the seconds hand stay lit.
    final inner = r - stroke - 10;
    for (var i = 0; i < 60; i++) {
      final a = -math.pi / 2 + i / 60 * math.pi * 2;
      final major = i % 5 == 0;
      final len = major ? 9.0 : 5.0;
      final lit = i <= seconds;
      final p1 = c + Offset(math.cos(a), math.sin(a)) * inner;
      final p2 = c + Offset(math.cos(a), math.sin(a)) * (inner - len);
      canvas.drawLine(
        p1,
        p2,
        Paint()
          ..strokeCap = StrokeCap.round
          ..strokeWidth = major ? 2.2 : 1.4
          ..color = lit
              ? Colors.white.withValues(alpha: major ? 0.95 : 0.7)
              : Colors.white.withValues(alpha: major ? 0.32 : 0.18),
      );
    }

    // Seconds-hand dot.
    final a = -math.pi / 2 + seconds / 60 * math.pi * 2;
    final dot = c + Offset(math.cos(a), math.sin(a)) * (inner - 14);
    canvas.drawCircle(dot, 3.2, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(HrClockRingPainter old) =>
      old.seconds != seconds ||
      old.progress != progress ||
      old.color != color ||
      old.track != track;
}

/// The big round action button under the clock: gradient disc with an
/// expanding "sonar" pulse while it is actionable, a press-scale, a spinner
/// while [busy], and a tick when [done].
class HrPunchButton extends StatefulWidget {
  const HrPunchButton({
    super.key,
    required this.label,
    required this.icon,
    required this.colors,
    required this.onTap,
    this.busy = false,
    this.done = false,
    this.size = 108,
  });

  final String label;
  final IconData icon;
  final List<Color> colors;

  /// `null` = not actionable (already done today / not allowed).
  final VoidCallback? onTap;
  final bool busy;
  final bool done;
  final double size;

  @override
  State<HrPunchButton> createState() => _HrPunchButtonState();
}

class _HrPunchButtonState extends State<HrPunchButton> {
  bool _down = false;

  bool get _enabled => widget.onTap != null && !widget.busy;

  void _tap() {
    if (!_enabled) return;
    HapticFeedback.mediumImpact();
    widget.onTap!();
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size;
    final reduce = reduceMotion(context);
    final disc = AnimatedScale(
      scale: _down ? 0.93 : 1,
      duration: const Duration(milliseconds: 110),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 350),
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: widget.onTap == null && !widget.busy
                ? [
                    widget.colors.first.withValues(alpha: 0.45),
                    widget.colors.last.withValues(alpha: 0.45),
                  ]
                : widget.colors,
          ),
          boxShadow: _enabled
              ? [
                  BoxShadow(
                    color: widget.colors.last.withValues(alpha: 0.5),
                    blurRadius: 26,
                    offset: const Offset(0, 10),
                  ),
                ]
              : null,
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.55),
            width: 2,
          ),
        ),
        alignment: Alignment.center,
        child: widget.busy
            ? const SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 3,
                  color: Colors.white,
                ),
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    transitionBuilder: (c, a) =>
                        ScaleTransition(scale: a, child: c),
                    child: Icon(
                      widget.done ? Icons.check_circle_rounded : widget.icon,
                      key: ValueKey(widget.done ? 'done' : widget.icon),
                      size: size * 0.3,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    widget.label,
                    textAlign: TextAlign.center,
                    style: AppText.body(
                      size: 13,
                      weight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
      ),
    );

    final pulsing = _enabled && !reduce
        ? Looping(
            duration: const Duration(milliseconds: 2200),
            builder: (context, t) => SizedBox(
              width: size * 1.5,
              height: size * 1.5,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  for (final off in const [0.0, 0.5])
                    Builder(
                      builder: (context) {
                        final p = (t + off) % 1.0;
                        return Container(
                          width: size * (1 + 0.5 * p),
                          height: size * (1 + 0.5 * p),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: widget.colors.last
                                  .withValues(alpha: 0.55 * (1 - p)),
                              width: 2,
                            ),
                          ),
                        );
                      },
                    ),
                  disc,
                ],
              ),
            ),
          )
        : SizedBox(
            width: size * 1.5,
            height: size * 1.5,
            child: Center(child: disc),
          );

    return Semantics(
      button: true,
      enabled: _enabled,
      label: widget.label,
      excludeSemantics: true,
      onTap: _enabled ? _tap : null,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: _enabled ? (_) => setState(() => _down = true) : null,
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) => setState(() => _down = false),
        onTap: _tap,
        child: pulsing,
      ),
    );
  }
}

// ── month calendar heatmap ──────────────────────────────────────────────────

/// One day on the heatmap.
class HrCalendarCell {
  const HrCalendarCell({
    required this.color,
    this.glyph,
    this.semantics,
    this.muted = false,
  });

  final Color color;
  final IconData? glyph;

  /// Spoken description ("Present, checked in 9:02 AM").
  final String? semantics;

  /// Greyed (future day, no data).
  final bool muted;
}

/// Month grid, Monday-first. Each cell is tinted with its status colour and
/// carries a small glyph (so colour is never the only signal). Cells scale in
/// with a diagonal stagger whenever [month] changes; tapping selects a day.
class HrMonthCalendar extends StatelessWidget {
  const HrMonthCalendar({
    super.key,
    required this.month,
    required this.cells,
    required this.onDayTap,
    this.selectedDay,
    this.todayDay,
  });

  /// Any date inside the month to show.
  final DateTime month;

  /// Day-of-month → cell. Missing days render as blank/neutral.
  final Map<int, HrCalendarCell> cells;
  final ValueChanged<int> onDayTap;
  final int? selectedDay;

  /// Day-of-month that is "today" (only when [month] is the current month).
  final int? todayDay;

  static const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  static int daysInMonth(DateTime m) => DateTime(m.year, m.month + 1, 0).day;

  @override
  Widget build(BuildContext context) {
    final first = DateTime(month.year, month.month);
    final lead = first.weekday - 1; // Monday = 0
    final days = daysInMonth(month);
    final rows = ((lead + days) / 7).ceil();
    final reduce = reduceMotion(context);

    return Column(
      children: [
        Row(
          children: [
            for (final w in weekdays)
              Expanded(
                child: Center(
                  child: Text(
                    w,
                    style: AppText.body(
                      size: 11,
                      weight: FontWeight.w800,
                      color: AppColors.inkFaint,
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 6),
        for (var r = 0; r < rows; r++)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              children: [
                for (var col = 0; col < 7; col++)
                  Expanded(
                    child: Builder(
                      builder: (context) {
                        final day = r * 7 + col - lead + 1;
                        if (day < 1 || day > days) {
                          return const SizedBox(height: 44);
                        }
                        return _DayCell(
                          key: ValueKey('${month.year}-${month.month}-$day'),
                          day: day,
                          cell: cells[day],
                          selected: day == selectedDay,
                          today: day == todayDay,
                          delay: reduce
                              ? Duration.zero
                              : Duration(milliseconds: (r + col) * 28),
                          onTap: () => onDayTap(day),
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    super.key,
    required this.day,
    required this.cell,
    required this.selected,
    required this.today,
    required this.delay,
    required this.onTap,
  });

  final int day;
  final HrCalendarCell? cell;
  final bool selected;
  final bool today;
  final Duration delay;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = cell;
    final color = c?.color ?? AppColors.line;
    final muted = c == null || c.muted;
    final total = delay + const Duration(milliseconds: 320);
    final cellBody = AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      height: 44,
      margin: const EdgeInsets.symmetric(horizontal: 2),
      decoration: BoxDecoration(
        color: muted ? AppColors.surface2 : color.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: selected
              ? AppColors.ink
              : today
                  ? AppColors.staffA
                  : muted
                      ? AppColors.line.withValues(alpha: 0.6)
                      : color.withValues(alpha: 0.5),
          width: selected || today ? 1.8 : 1,
        ),
        boxShadow: selected && !muted
            ? [
                BoxShadow(
                  color: color.withValues(alpha: 0.4),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ]
            : null,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            '$day',
            style: AppText.tabular(
              size: 12.5,
              weight: FontWeight.w800,
              color: muted ? AppColors.inkFaint : AppColors.ink,
            ),
          ),
          if (c?.glyph != null)
            Icon(c!.glyph, size: 11, color: color)
          else
            const SizedBox(height: 11),
        ],
      ),
    );

    final animated = total.inMilliseconds <= 320
        ? cellBody
        : TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: total,
            curve: Interval(
              delay.inMilliseconds / total.inMilliseconds,
              1,
              curve: Curves.easeOutBack,
            ),
            child: cellBody,
            builder: (context, t, child) => Opacity(
              opacity: t.clamp(0.0, 1.0),
              child: Transform.scale(scale: 0.6 + 0.4 * t, child: child),
            ),
          );

    return Semantics(
      button: true,
      selected: selected,
      label: 'Day $day. ${c?.semantics ?? 'No record'}',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: animated,
      ),
    );
  }
}

/// Colour key under a calendar: `(label, colour, glyph)` swatches in a wrap.
class HrLegend extends StatelessWidget {
  const HrLegend({super.key, required this.items});

  final List<(String, Color, IconData)> items;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 6,
      children: [
        for (final i in items)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  color: i.$2.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: i.$2.withValues(alpha: 0.6)),
                ),
                child: Icon(i.$3, size: 9, color: i.$2),
              ),
              const SizedBox(width: 5),
              Text(
                i.$1,
                style: AppText.body(
                  size: 10.5,
                  weight: FontWeight.w700,
                  color: AppColors.inkSoft,
                ),
              ),
            ],
          ),
      ],
    );
  }
}

// ── leave balance ring ──────────────────────────────────────────────────────

/// Leave-type ring: arc = remaining ÷ allowance, remaining days in the middle,
/// type name + "used / total" underneath.
class HrBalanceRing extends StatelessWidget {
  const HrBalanceRing({
    super.key,
    required this.label,
    required this.remaining,
    required this.total,
    required this.used,
    required this.color,
    this.size = 84,
    this.unlimited = false,
  });

  final String label;
  final double remaining;
  final double total;
  final double used;
  final Color color;
  final double size;

  /// No fixed allowance (renders ∞ and a full ring).
  final bool unlimited;

  @override
  Widget build(BuildContext context) {
    final frac = unlimited ? 1.0 : (total <= 0 ? 0.0 : remaining / total);
    final shown = unlimited ? '∞' : hrDays(remaining);
    final ring = AnimatedRing(
      value: frac,
      size: size,
      stroke: 9,
      colors: [color.withValues(alpha: 0.55), color],
      track: color.withValues(alpha: 0.14),
      child:
          Text(shown, style: AppText.display(size: size * 0.27, color: color)),
    );
    return Semantics(
      container: true,
      label: unlimited
          ? '$label: unlimited, ${hrDays(used)} days used'
          : '$label: ${hrDays(remaining)} of ${hrDays(total)} days left',
      excludeSemantics: true,
      child: SizedBox(
        width: size + 18,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ring,
            const SizedBox(height: 6),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(size: 11.5, weight: FontWeight.w800),
            ),
            Text(
              unlimited
                  ? '${hrDays(used)} used'
                  : '${hrDays(used)}/${hrDays(total)} used',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 10,
                weight: FontWeight.w700,
                color: AppColors.inkFaint,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── formatting helpers ──────────────────────────────────────────────────────

/// `1`, `0.5`, `2.5` — days with a trailing `.0` trimmed.
String hrDays(num v) {
  final d = v.toDouble();
  if (d == d.roundToDouble()) return d.round().toString();
  return d.toStringAsFixed(1);
}

const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const _monthsLong = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const _weekdaysShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/// `22 Nov`
String hrDate(DateTime d) => '${d.day} ${_months[d.month - 1]}';

/// `22 Nov 2026`
String hrDateY(DateTime d) => '${d.day} ${_months[d.month - 1]} ${d.year}';

/// `Sun, 22 Nov`
String hrDateWd(DateTime d) =>
    '${_weekdaysShort[d.weekday - 1]}, ${d.day} ${_months[d.month - 1]}';

/// `November 2026`
String hrMonthLabel(int year, int month) => '${_monthsLong[month - 1]} $year';

/// `9:05 AM` — 12-hour clock for an India wall-clock [d].
String hrTime(DateTime d) {
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final m = d.minute.toString().padLeft(2, '0');
  return '$h:$m ${d.hour < 12 ? 'AM' : 'PM'}';
}

/// `HH:mm:ss` for the big clock.
String hrClock(DateTime d) {
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(d.hour % 12 == 0 ? 12 : d.hour % 12)}:${two(d.minute)}';
}

/// `YYYY-MM-DD` of an India calendar date (the API's date format).
String hrIso(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// `7h 30m` from minutes.
String hrDuration(int minutes) {
  if (minutes <= 0) return '0m';
  final h = minutes ~/ 60;
  final m = minutes % 60;
  if (h == 0) return '${m}m';
  if (m == 0) return '${h}h';
  return '${h}h ${m}m';
}

/// Announces [message] to screen readers (used after optimistic-safe actions).
void hrAnnounce(BuildContext context, String message) {
  SemanticsService.sendAnnouncement(
    View.of(context),
    message,
    Directionality.of(context),
  );
}

/// `2026-11` -> `November 2026` (the API's month key).
String hrMonthLabelFromKey(String key) {
  final p = key.split('-');
  final y = p.isNotEmpty ? int.tryParse(p[0]) : null;
  final m = p.length > 1 ? int.tryParse(p[1]) : null;
  if (y == null || m == null || m < 1 || m > 12) return key;
  return hrMonthLabel(y, m);
}

/// An instant (UTC from the API) as India wall-clock time, for display only.
DateTime hrToIst(DateTime instant) =>
    instant.toUtc().add(const Duration(hours: 5, minutes: 30));
