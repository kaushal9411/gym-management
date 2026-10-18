import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import 'analytics_logic.dart';

/// Web's `DeltaBadge`: a % change chip vs the previous period. [invert]
/// makes a decrease green (expenses). Shows "New" when there was nothing
/// before; renders nothing without a previous value.
class AnalyticsDeltaChip extends StatelessWidget {
  const AnalyticsDeltaChip({
    super.key,
    required this.value,
    required this.previous,
    this.invert = false,
  });

  final double value;
  final double? previous;
  final bool invert;

  @override
  Widget build(BuildContext context) {
    if (previous == null) return const SizedBox.shrink();
    final pct = analyticsPct(value, previous);
    final flat = pct == 0;
    final up = (pct ?? 1) >= 0;
    final good = invert ? !up : up;
    final color = (flat || pct == null)
        ? TeamColors.slate
        : good
            ? TeamColors.green
            : TeamColors.rose;
    final icon = (flat || pct == null)
        ? Icons.remove_rounded
        : up
            ? Icons.arrow_upward_rounded
            : Icons.arrow_downward_rounded;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 2),
          Text(
            pct == null ? 'New' : '${pct.abs().toStringAsFixed(1)}%',
            style: AppText.tabular(
              size: 11,
              color: color,
              weight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

/// Card with a tinted gradient header band (icon chip, title, subtitle and an
/// optional trailing widget) — web's `ChartCard`. Handles its own loading,
/// error (with Retry) and empty states.
class AnalyticsCard extends StatelessWidget {
  const AnalyticsCard({
    super.key,
    required this.title,
    required this.color,
    required this.icon,
    required this.child,
    this.subtitle,
    this.trailing,
    this.loading = false,
    this.error = false,
    this.empty = false,
    this.emptyText = 'No data for this period.',
    this.onRetry,
  });

  final String title;
  final String? subtitle;
  final Color color;
  final IconData icon;
  final Widget? trailing;
  final bool loading;
  final bool error;
  final bool empty;
  final String emptyText;
  final VoidCallback? onRetry;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (loading) {
      body = const Padding(
        padding: EdgeInsets.symmetric(vertical: 44),
        child: Center(
          child: SizedBox(
            width: 26,
            height: 26,
            child: CircularProgressIndicator(strokeWidth: 3),
          ),
        ),
      );
    } else if (error) {
      body = Padding(
        padding: const EdgeInsets.symmetric(vertical: 18),
        child: Row(
          children: [
            Expanded(
              child: Text(
                'Could not load this view.',
                style: AppText.body(size: 12.5, color: AppColors.inkFaint),
              ),
            ),
            if (onRetry != null)
              TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      );
    } else if (empty) {
      body = Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Center(
          child: Text(
            emptyText,
            style: AppText.body(size: 12.5, color: AppColors.inkFaint),
          ),
        ),
      );
    } else {
      body = child;
    }
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
            padding: const EdgeInsets.fromLTRB(14, 12, 12, 10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color.withValues(alpha: 0.18), Colors.transparent],
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [color, color.withValues(alpha: 0.65)],
                    ),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, size: 16, color: Colors.white),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.display(size: 15),
                      ),
                      if (subtitle != null)
                        Text(
                          subtitle!,
                          maxLines: 1,
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
                if (trailing != null) ...[const SizedBox(width: 8), trailing!],
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 6, 14, 14),
            child: body,
          ),
        ],
      ),
    );
  }
}
