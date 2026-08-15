import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_card.dart';

/// `.card` KPI tile — `.eyebrow` label + `.display` value, plus an optional
/// icon badge (mirrors web's `StatisticCard` icon treatment). The design's
/// mockup also shows a fabricated "▲ 4.2%" trend pill on each KPI card, but
/// the real `KpiMetricsDto` has no prior-period comparison to compute that
/// from, so it's omitted here rather than invented.
class KpiCard extends StatelessWidget {
  const KpiCard({
    super.key,
    required this.label,
    required this.value,
    this.valueColor,
    this.icon,
    this.iconColor,
  });

  final String label;
  final String value;
  final Color? valueColor;
  final IconData? icon;

  /// Icon + badge-background accent. Ignored if [icon] is null.
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: AppText.eyebrow()),
                const SizedBox(height: 4),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.tabular(
                    size: 26,
                    color: valueColor ?? AppColors.ink,
                    weight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          if (icon != null) ...[
            const SizedBox(width: 8),
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: (iconColor ?? AppColors.staffB).withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(11),
              ),
              alignment: Alignment.center,
              child: Icon(
                icon,
                size: 18,
                color: iconColor ?? AppColors.staffB,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
