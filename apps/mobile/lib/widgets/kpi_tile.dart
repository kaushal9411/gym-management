import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class KpiTile extends StatelessWidget {
  final String label;
  final String value;
  final String? delta;
  final Color? deltaColor;

  const KpiTile({
    super.key,
    required this.label,
    required this.value,
    this.delta,
    this.deltaColor,
  });

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
      decoration: BoxDecoration(
        border: Border.all(color: colors.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: .6,
              color: colors.inkFaint,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontFamily: 'Bebas Neue',
              fontSize: 26,
              height: 1.0,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          if (delta != null) ...[
            const SizedBox(height: 4),
            Text(
              delta!,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: deltaColor ?? colors.success,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
