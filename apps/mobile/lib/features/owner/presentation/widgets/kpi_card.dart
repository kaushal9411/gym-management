import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_card.dart';

/// `.card` KPI tile — `.eyebrow` label + `.display` value. The design's
/// mockup also shows a fabricated "▲ 4.2%" trend pill on each KPI card, but
/// the real `KpiMetricsDto` has no prior-period comparison to compute that
/// from, so it's omitted here rather than invented.
class KpiCard extends StatelessWidget {
  const KpiCard({
    super.key,
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppText.eyebrow()),
          const SizedBox(height: 4),
          Text(
            value,
            style: AppText.tabular(
              size: 26,
              color: valueColor ?? AppColors.ink,
              weight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
