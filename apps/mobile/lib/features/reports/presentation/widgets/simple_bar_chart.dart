import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';

class BarDatum {
  const BarDatum({required this.label, required this.value});

  final String label;
  final num value;
}

/// The design's day-column bar charts (attendance/new-member trends) —
/// plain `Row` of proportionally-sized bars, no painter needed.
class SimpleBarChart extends StatelessWidget {
  const SimpleBarChart({
    super.key,
    required this.data,
    this.role = AppRole.staff,
    this.height = 70,
  });

  final List<BarDatum> data;
  final AppRole role;
  final double height;

  @override
  Widget build(BuildContext context) {
    final maxV = data.map((d) => d.value).fold<num>(0, (a, b) => b > a ? b : a);
    return SizedBox(
      height: height + 18,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: data.map((d) {
          final barHeight = maxV <= 0 ? 2.0 : (d.value / maxV) * height;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Container(
                    height: barHeight.clamp(2, height),
                    decoration: BoxDecoration(
                      gradient: role.gradient,
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(5),
                        bottom: Radius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    d.label,
                    style: AppText.body(
                      size: 9,
                      weight: FontWeight.w800,
                      color: AppColors.inkFaint,
                    ),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
