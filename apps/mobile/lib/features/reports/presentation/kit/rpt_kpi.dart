import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/motion.dart';
import 'rpt_chart_card.dart';
import 'rpt_format.dart';
import 'rpt_gauge.dart';
import 'rpt_theme.dart';

/// "% change vs previous" chip (web's `DeltaBadge`). [invert] makes a
/// decrease green (expenses, churn, outstanding). Shows "New" when there was
/// nothing before; renders nothing without a [previous] value.
class RptDeltaBadge extends StatelessWidget {
  const RptDeltaBadge({
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
    final pct = rptPctChange(value, previous);
    final flat = pct == 0;
    final up = (pct ?? 1) >= 0;
    final good = invert ? !up : up;
    final color = (flat || pct == null)
        ? RptColors.slate
        : good
            ? RptColors.good
            : RptColors.bad;
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

/// Data for one [RptKpiTile].
class RptKpi {
  const RptKpi({
    required this.label,
    required this.value,
    this.format = RptFormat.number,
    this.previous,
    this.invert = false,
    this.icon,
    this.color = RptColors.indigo,
    this.sparkline,
    this.hint,
    this.text,
    this.compact = false,
    this.onTap,
  });

  final String label;
  final double value;
  final RptFormat format;

  /// Previous-period value — drives the delta badge (null hides it).
  final double? previous;

  /// A rise is bad (expenses, churn).
  final bool invert;
  final IconData? icon;
  final Color color;

  /// Daily values for the tiny area chart under the figure.
  final List<double>? sparkline;

  /// Small caption next to the delta ("right now", "memberships").
  final String? hint;

  /// Shown instead of the number (a `text` KPI such as a plan name).
  final String? text;

  /// Use the short money / count form (`₹3.8L`, `12k`).
  final bool compact;
  final VoidCallback? onTap;
}

/// KPI card: gradient wash, icon chip, count-up figure, delta badge vs the
/// previous period, optional sparkline. Money uses the gym's currency and a
/// count never shows a symbol.
class RptKpiTile extends StatelessWidget {
  const RptKpiTile({
    super.key,
    required this.kpi,
    this.loading = false,
    this.height,
  });

  final RptKpi kpi;
  final bool loading;

  /// Fixed height (the grid passes one so a row is even).
  final double? height;

  @override
  Widget build(BuildContext context) {
    final c = kpi.color;
    final hasSpark = (kpi.sparkline?.length ?? 0) > 1;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: loading ? null : kpi.onTap,
        child: Container(
          height: height,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [c.withValues(alpha: 0.16), Colors.transparent],
            ),
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: c.withValues(alpha: 0.24)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      kpi.label.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.eyebrow(),
                    ),
                  ),
                  if (kpi.icon != null)
                    Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        color: c.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: Icon(kpi.icon, size: 14, color: c),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              if (loading)
                const RptSkeleton(height: 24, width: 84, radius: 7)
              else if (kpi.text != null)
                Text(
                  kpi.text!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.display(size: 19, color: c),
                )
              else
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: AnimatedNumber(
                    value: kpi.value,
                    style: AppText.display(size: 24, color: c),
                    format: (v) =>
                        rptFormatValue(kpi.format, v, compact: kpi.compact),
                  ),
                ),
              const SizedBox(height: 6),
              if (!loading)
                SizedBox(
                  height: 22,
                  child: Row(
                    children: [
                      RptDeltaBadge(
                        value: kpi.value,
                        previous: kpi.previous,
                        invert: kpi.invert,
                      ),
                      if (kpi.hint != null) ...[
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            kpi.hint!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 11,
                              color: AppColors.inkFaint,
                              weight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              if (hasSpark && !loading) ...[
                const SizedBox(height: 4),
                RptSparkArea(values: kpi.sparkline!, color: c, height: 30),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Number of KPI columns for a content width: 2 on phones, then 3 / 4 / 5.
int rptKpiColumns(double width) {
  if (width >= 1100) return 5;
  if (width >= 840) return 4;
  if (width >= 560) return 3;
  return 2;
}

/// Responsive grid of [RptKpiTile]s (2 / 3 / 4 / 5 columns, tiles staggered
/// in). On the two-column phone layout a lone last tile spans the row.
/// While [loading] the tiles show skeleton figures.
class RptKpiGrid extends StatelessWidget {
  const RptKpiGrid({
    super.key,
    required this.kpis,
    this.loading = false,
    this.columns,
  });

  final List<RptKpi> kpis;
  final bool loading;

  /// Forces the column count (default: by width).
  final int? columns;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final cols = columns ?? rptKpiColumns(box.maxWidth);
        const gap = 10.0;
        final w = (box.maxWidth - gap * (cols - 1)) / cols;
        final spark = kpis.any((k) => (k.sparkline?.length ?? 0) > 1);
        final h = spark ? 150.0 : 120.0;
        final lastAlone = cols == 2 && kpis.length.isOdd;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (var i = 0; i < kpis.length; i++)
              SizedBox(
                width: lastAlone && i == kpis.length - 1 ? box.maxWidth : w,
                child: RptReveal(
                  index: i,
                  child: RptKpiTile(kpi: kpis[i], loading: loading, height: h),
                ),
              ),
          ],
        );
      },
    );
  }
}
