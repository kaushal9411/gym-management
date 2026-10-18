import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/motion.dart';
import 'rpt_theme.dart';

/// Placeholder shown inside a chart when there is nothing to plot.
class RptChartEmpty extends StatelessWidget {
  const RptChartEmpty({
    super.key,
    this.height = 160,
    this.message = 'No data for this period',
    this.icon = Icons.bar_chart_rounded,
  });

  final double height;
  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      alignment: Alignment.center,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 22, color: AppColors.inkFaint),
          const SizedBox(height: 6),
          Text(
            message,
            textAlign: TextAlign.center,
            style: AppText.body(
              size: 12.5,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// A pulsing grey block — the loading state of a card / tile. Static when the
/// OS reduce-motion setting is on.
class RptSkeleton extends StatefulWidget {
  const RptSkeleton({
    super.key,
    this.height = 120,
    this.width,
    this.radius = 14,
  });

  final double height;
  final double? width;
  final double radius;

  @override
  State<RptSkeleton> createState() => _RptSkeletonState();
}

class _RptSkeletonState extends State<RptSkeleton>
    with SingleTickerProviderStateMixin<RptSkeleton> {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!reduceMotion(context)) _c.repeat(reverse: true);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) => Container(
        height: widget.height,
        width: widget.width ?? double.infinity,
        decoration: BoxDecoration(
          color: AppColors.surface3.withValues(alpha: 0.55 + 0.45 * _c.value),
          borderRadius: BorderRadius.circular(widget.radius),
        ),
      ),
    );
  }
}

/// Panel shell for charts and lists (web's `ChartCard`): a tinted header
/// band (gradient icon chip, title, subtitle, [actions]), an optional
/// [legend] row and a body that handles its own **loading** (skeleton),
/// **error** (message + Retry) and **empty** states, so a chart widget never
/// has to. [minHeight] keeps the card from jumping while it loads.
class RptChartCard extends StatelessWidget {
  const RptChartCard({
    super.key,
    required this.child,
    this.title,
    this.subtitle,
    this.icon,
    this.color = RptColors.violet,
    this.actions,
    this.legend,
    this.footer,
    this.loading = false,
    this.error = false,
    this.errorText = 'Could not load this panel.',
    this.empty = false,
    this.emptyText = 'No data for this period',
    this.onRetry,
    this.onTap,
    this.minHeight = 180,
    this.padding = const EdgeInsets.fromLTRB(14, 8, 14, 14),
  });

  final String? title;
  final String? subtitle;
  final IconData? icon;
  final Color color;

  /// Trailing widget(s) in the header: a [RptSegmented], a [RptStatPill], a
  /// "View report" link ...
  final Widget? actions;

  /// Row between the header and the body (a [RptLegend]); hidden while the
  /// card is loading / failed / empty.
  final Widget? legend;

  /// Row under the body (notes, a link).
  final Widget? footer;
  final bool loading;
  final bool error;
  final String errorText;
  final bool empty;
  final String emptyText;
  final VoidCallback? onRetry;
  final VoidCallback? onTap;
  final double minHeight;
  final EdgeInsets padding;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final showBody = !loading && !error && !empty;
    final Widget body;
    if (loading) {
      body = RptSkeleton(height: minHeight);
    } else if (error) {
      body = Container(
        constraints: BoxConstraints(minHeight: minHeight * 0.6),
        padding: const EdgeInsets.symmetric(vertical: 18),
        child: Row(
          children: [
            Icon(Icons.error_outline_rounded, size: 18, color: RptColors.rose),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                errorText,
                style: AppText.body(size: 12.5, color: AppColors.inkFaint),
              ),
            ),
            if (onRetry != null)
              TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      );
    } else if (empty) {
      body = RptChartEmpty(height: minHeight * 0.8, message: emptyText);
    } else {
      body = child;
    }
    final hasHeader = title != null || actions != null;
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (hasHeader)
                Container(
                  padding: const EdgeInsets.fromLTRB(14, 12, 12, 10),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        color.withValues(alpha: 0.18),
                        Colors.transparent,
                      ],
                    ),
                  ),
                  child: Row(
                    children: [
                      if (icon != null) ...[
                        Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [color, color.withValues(alpha: 0.62)],
                            ),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(icon, size: 16, color: Colors.white),
                        ),
                        const SizedBox(width: 10),
                      ],
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (title != null)
                              Text(
                                title!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.display(size: 15),
                              ),
                            if (subtitle != null)
                              Text(
                                subtitle!,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 11,
                                  color: AppColors.inkFaint,
                                  weight: FontWeight.w600,
                                ),
                              ),
                          ],
                        ),
                      ),
                      if (actions != null) ...[
                        const SizedBox(width: 8),
                        Flexible(flex: 0, child: actions!),
                      ],
                    ],
                  ),
                ),
              Padding(
                padding: padding,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (legend != null && showBody) ...[
                      legend!,
                      const SizedBox(height: 6),
                    ],
                    body,
                    if (footer != null && showBody) ...[
                      const SizedBox(height: 10),
                      footer!,
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Entrance animation for the n-th block of a page: a fade + rise, staggered
/// by [index] (capped). Honors reduce-motion.
class RptReveal extends StatelessWidget {
  const RptReveal({super.key, required this.child, this.index = 0});

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) =>
      StaggeredReveal(index: index, child: child);
}
