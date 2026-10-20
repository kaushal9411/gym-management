import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/comm_channel.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../manager/presentation/widgets/member_detail_anim.dart'
    show FadeUp, Looping;
import '../../comm_constants.dart';
import '../../comm_logic.dart';

/// Small shared pieces of the Communications screens: press-squish wrapper,
/// channel dots, status pills, chips, the switch, notices, meters, skeletons.

/// Squishes its child to 0.97 while pressed (the design's `:active` scale)
/// and springs back. No animation under reduced motion. Always a real button
/// for accessibility.
class CommPress extends StatefulWidget {
  const CommPress({
    super.key,
    required this.child,
    required this.onTap,
    this.semanticLabel,
    this.scale = 0.97,
    this.selected,
  });

  final Widget child;
  final VoidCallback? onTap;
  final String? semanticLabel;
  final double scale;

  /// Non-null exposes toggle semantics (chips, rows).
  final bool? selected;

  @override
  State<CommPress> createState() => _CommPressState();
}

class _CommPressState extends State<CommPress> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v && mounted) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null;
    final reduce = reduceMotion(context);
    return Semantics(
      button: true,
      enabled: enabled,
      selected: widget.selected,
      label: widget.semanticLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: enabled ? (_) => _set(true) : null,
        onTapCancel: () => _set(false),
        onTapUp: (_) => _set(false),
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: _down && !reduce ? widget.scale : 1,
          duration:
              reduce ? Duration.zero : Duration(milliseconds: _down ? 90 : 260),
          curve: _down ? Curves.easeOut : Curves.elasticOut,
          child: widget.child,
        ),
      ),
    );
  }
}

/// The coloured rounded square with a channel glyph (`P`, `In`, `@`, `S`, `W`).
class ChannelDot extends StatelessWidget {
  const ChannelDot({
    super.key,
    required this.channel,
    this.size = 36,
    this.faded = false,
  });

  final CommChannel channel;
  final double size;
  final bool faded;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: faded ? 0.22 : 1,
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: channel.color,
          borderRadius: BorderRadius.circular(size * 0.33),
        ),
        child: Text(
          channel.short,
          style: AppText.body(
            size: size * 0.36,
            weight: FontWeight.w800,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

/// Status pill in the design's four tones.
class CommPill extends StatelessWidget {
  const CommPill({super.key, required this.text, required this.tone});

  final String text;
  final CommTone tone;

  static (Color, Color) colors(CommTone tone) => switch (tone) {
        CommTone.ok => (AppColors.success, AppColors.successSoft),
        CommTone.warn => (AppColors.warning, AppColors.warningSoft),
        CommTone.run => (kCommBrand, kCommBrand.withValues(alpha: 0.16)),
        CommTone.bad => (AppColors.danger, AppColors.dangerSoft),
        CommTone.neutral => (AppColors.inkSoft, AppColors.surface3),
      };

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = colors(tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppText.body(size: 11.5, weight: FontWeight.w800, color: fg),
      ),
    );
  }
}

/// Pill-shaped choice chip (the design's `.chip`): 36 dp tall, press-squish.
class CommChip extends StatelessWidget {
  const CommChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.color = kCommBrand,
    this.icon,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return CommPress(
      onTap: onTap,
      selected: selected,
      scale: 0.94,
      child: AnimatedContainer(
        duration: reduceMotion(context)
            ? Duration.zero
            : const Duration(milliseconds: 160),
        constraints: const BoxConstraints(minHeight: 36),
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? color : AppColors.surface2,
          borderRadius: BorderRadius.circular(AppRadii.pill),
          border: Border.all(color: selected ? color : AppColors.line),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 14,
                color: selected ? Colors.white : AppColors.inkSoft,
              ),
              const SizedBox(width: 5),
            ],
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(
                  size: 13,
                  weight: FontWeight.w700,
                  color: selected ? Colors.white : AppColors.inkSoft,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The design's `.sw` switch: 42x25, green when on, squishy thumb. [busy]
/// swaps the thumb for a spinner while a save is in flight.
class CommSwitch extends StatelessWidget {
  const CommSwitch({
    super.key,
    required this.value,
    required this.onChanged,
    this.busy = false,
    this.semanticLabel,
  });

  final bool value;
  final ValueChanged<bool>? onChanged;
  final bool busy;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final reduce = reduceMotion(context);
    final enabled = onChanged != null && !busy;
    return Semantics(
      toggled: value,
      enabled: enabled,
      label: semanticLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: enabled ? () => onChanged!(!value) : null,
        child: SizedBox(
          width: 52,
          height: 44,
          child: Center(
            child: Opacity(
              opacity: onChanged == null ? 0.5 : 1,
              child: AnimatedContainer(
                duration:
                    reduce ? Duration.zero : const Duration(milliseconds: 200),
                width: 42,
                height: 25,
                padding: const EdgeInsets.all(3),
                alignment: value ? Alignment.centerRight : Alignment.centerLeft,
                decoration: BoxDecoration(
                  color: value ? AppColors.success : AppColors.surface3,
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Container(
                  width: 19,
                  height: 19,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                  ),
                  child: busy
                      ? const SizedBox(
                          width: 11,
                          height: 11,
                          child: CircularProgressIndicator(
                            strokeWidth: 1.8,
                            color: kCommBrand,
                          ),
                        )
                      : null,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Animated horizontal meter (the design's `.meter`); the fill eases to a new
/// value and the colour can flip to red when over the limit.
class CommMeter extends StatelessWidget {
  const CommMeter({
    super.key,
    required this.fraction,
    required this.color,
    this.height = 5,
    this.track,
  });

  final double fraction;
  final Color color;
  final double height;
  final Color? track;

  @override
  Widget build(BuildContext context) {
    final reduce = reduceMotion(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(9),
      child: Container(
        height: height,
        color: track ?? AppColors.line,
        alignment: Alignment.centerLeft,
        child: TweenAnimationBuilder<double>(
          tween: Tween(end: fraction.clamp(0.0, 1.0)),
          duration: reduce ? Duration.zero : const Duration(milliseconds: 450),
          curve: Curves.easeOutBack,
          builder: (_, v, __) => FractionallySizedBox(
            widthFactor: v.clamp(0.0, 1.0),
            child: Container(
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(9),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Tinted inline notice (the design's `.warnbox`), with an optional action.
class CommNotice extends StatelessWidget {
  const CommNotice({
    super.key,
    required this.text,
    this.tone = CommTone.warn,
    this.icon,
    this.actionLabel,
    this.onAction,
  });

  final String text;
  final CommTone tone;
  final IconData? icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = CommPill.colors(tone);
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (icon != null) ...[
              Padding(
                padding: const EdgeInsets.only(top: 1),
                child: Icon(icon, size: 16, color: fg),
              ),
              const SizedBox(width: 8),
            ],
            Expanded(
              child: Text(
                text,
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w600,
                  color: fg,
                ),
              ),
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(width: 8),
              CommPress(
                onTap: onAction,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Text(
                    actionLabel!,
                    style: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w800,
                      color: fg,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Uppercase section label (`.sec`).
class CommSectionLabel extends StatelessWidget {
  const CommSectionLabel(this.text, {super.key, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, 18, 2, 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              text.toUpperCase(),
              style: AppText.body(
                size: 11,
                weight: FontWeight.w800,
                color: AppColors.inkFaint,
              ).copyWith(letterSpacing: 0.7),
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// Rounded surface card (`.last`, `.rule`, `.bub`).
class CommCard extends StatelessWidget {
  const CommCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(12),
    this.radius = 16,
    this.color,
    this.borderColor,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final Color? color;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? AppColors.surface2,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: borderColor ?? AppColors.line),
      ),
      child: child,
    );
  }
}

/// A pulsing grey block used by loading skeletons. Static under reduced
/// motion.
class CommSkeleton extends StatelessWidget {
  const CommSkeleton({
    super.key,
    this.height = 56,
    this.width,
    this.radius = 16,
  });

  final double height;
  final double? width;
  final double radius;

  @override
  Widget build(BuildContext context) {
    Widget box(double opacity) => Opacity(
          opacity: opacity,
          child: Container(
            height: height,
            width: width,
            decoration: BoxDecoration(
              color: AppColors.surface3,
              borderRadius: BorderRadius.circular(radius),
            ),
          ),
        );
    if (reduceMotion(context)) return box(0.7);
    return Looping(
      duration: const Duration(milliseconds: 1100),
      reverse: true,
      builder: (_, t) => box(0.45 + 0.35 * t),
    );
  }
}

/// A column of skeleton rows (lists while they load).
class CommSkeletonList extends StatelessWidget {
  const CommSkeletonList({super.key, this.rows = 4, this.rowHeight = 64});

  final int rows;
  final double rowHeight;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Loading',
      child: Column(
        children: [
          for (var i = 0; i < rows; i++) ...[
            if (i > 0) const SizedBox(height: 10),
            CommSkeleton(height: rowHeight),
          ],
        ],
      ),
    );
  }
}

/// [FadeUp] that shows its child immediately under reduced motion.
class CommReveal extends StatelessWidget {
  const CommReveal({super.key, required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) =>
      reduceMotion(context) ? child : FadeUp(index: index, child: child);
}
