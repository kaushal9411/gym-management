import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/motion.dart';
import 'rpt_chart_card.dart';
import 'rpt_format.dart';
import 'rpt_theme.dart';

/// One row of a [RptHBarChart].
class RptHBarDatum {
  const RptHBarDatum({
    required this.label,
    required this.value,
    this.previous,
    this.hint,
    this.color,
  });

  final String label;
  final double value;

  /// Previous-period value — drawn as a tick on the track.
  final double? previous;

  /// Small note after the label (a branch name, "3 converted").
  final String? hint;

  /// Overrides the chart colour for this row.
  final Color? color;
}

/// Ranked horizontal bars (web's `HBarChart`): optional rank badges, a bar
/// that grows in (staggered), the value on the right, and a tick marking the
/// previous period. Sorted descending and capped at [limit] unless
/// [sort] is false (time-ordered buckets such as "expiring in 7 / 15 / 30
/// days").
class RptHBarChart extends StatelessWidget {
  const RptHBarChart({
    super.key,
    required this.data,
    this.format = RptFormat.number,
    this.color = RptColors.indigo,
    this.limit = 8,
    this.sort = true,
    this.rankBadges = false,
    this.onTap,
  });

  final List<RptHBarDatum> data;
  final RptFormat format;
  final Color color;
  final int limit;
  final bool sort;
  final bool rankBadges;

  /// Called with the row's index in the *displayed* order.
  final ValueChanged<int>? onTap;

  @override
  Widget build(BuildContext context) {
    final rows =
        (sort ? ([...data]..sort((a, b) => b.value.compareTo(a.value))) : data)
            .take(limit)
            .toList();
    if (rows.isEmpty ||
        rows.every((r) => r.value == 0 && (r.previous ?? 0) == 0)) {
      return const RptChartEmpty(height: 120);
    }
    var maxV = 1.0;
    for (final r in rows) {
      maxV = math.max(maxV, math.max(r.value, r.previous ?? 0));
    }
    return Column(
      children: [
        for (var i = 0; i < rows.length; i++)
          _Row(
            rank: rankBadges ? i + 1 : null,
            datum: rows[i],
            fraction: rows[i].value / maxV,
            previousFraction:
                rows[i].previous == null ? null : rows[i].previous! / maxV,
            format: format,
            color: rows[i].color ?? color,
            index: i,
            onTap: onTap == null ? null : () => onTap!(i),
          ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.datum,
    required this.fraction,
    required this.format,
    required this.color,
    required this.index,
    this.rank,
    this.previousFraction,
    this.onTap,
  });

  final RptHBarDatum datum;
  final int? rank;
  final double fraction;
  final double? previousFraction;
  final RptFormat format;
  final Color color;
  final int index;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final delay = math.min(index, 8) * 60;
    final animate = !reduceMotion(context);
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (rank != null) ...[
                  Container(
                    width: 22,
                    height: 22,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: rank == 1
                          ? color.withValues(alpha: 0.22)
                          : AppColors.surface3,
                      borderRadius: BorderRadius.circular(7),
                    ),
                    child: Text(
                      '$rank',
                      style: AppText.body(
                        size: 11,
                        weight: FontWeight.w800,
                        color: rank == 1 ? color : AppColors.inkSoft,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      text: datum.label,
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                      children: [
                        if (datum.hint != null)
                          TextSpan(
                            text: '  ${datum.hint}',
                            style: AppText.body(
                              size: 11.5,
                              color: AppColors.inkFaint,
                              weight: FontWeight.w600,
                            ),
                          ),
                      ],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  rptFormatValue(format, datum.value, compact: true),
                  style: AppText.tabular(size: 13, weight: FontWeight.w800),
                ),
              ],
            ),
            const SizedBox(height: 6),
            LayoutBuilder(
              builder: (context, c) => TweenAnimationBuilder<double>(
                tween: Tween(begin: animate ? 0 : 1, end: 1),
                duration: Duration(milliseconds: animate ? 700 + delay : 0),
                curve: Interval(
                  delay / (700 + delay),
                  1,
                  curve: Curves.easeOutCubic,
                ),
                builder: (context, t, _) => SizedBox(
                  height: 10,
                  width: c.maxWidth,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          color: RptColors.track,
                          borderRadius: BorderRadius.circular(99),
                        ),
                      ),
                      FractionallySizedBox(
                        widthFactor: (fraction * t).clamp(0.015, 1.0),
                        child: Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(99),
                            gradient: LinearGradient(
                              colors: [color, color.withValues(alpha: 0.6)],
                            ),
                          ),
                        ),
                      ),
                      if (previousFraction != null)
                        Positioned(
                          left:
                              (c.maxWidth * previousFraction!.clamp(0.0, 1.0) -
                                      1)
                                  .clamp(0.0, c.maxWidth - 2),
                          top: -2,
                          bottom: -2,
                          child: Container(
                            width: 2.5,
                            decoration: BoxDecoration(
                              color: RptColors.previous,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
