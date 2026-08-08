import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Reproduces the design's upgraded `.kpi`/`.k-icon`/`.kpi::before` — a
/// colored icon chip, a 3px top accent stripe, real elevation and a solid
/// surface background, instead of a flat bordered box with just a label and
/// a number (which is what read as empty dead space on a tablet).
class KpiTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final String? delta;
  final Color? deltaColor;

  /// Mirrors the design's `.kpi.warn` variant — tints the icon chip and top
  /// stripe with the warning color instead of the theme accent, for KPIs
  /// that represent something the user should keep an eye on.
  final bool warn;

  const KpiTile({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.delta,
    this.deltaColor,
    this.warn = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    final tint = warn ? colors.warning : colors.accent;
    final tintSoft = warn ? colors.warningSoft : colors.accentSoft;

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(14),
        boxShadow: AppShadows.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(height: 3, color: tint),
          Padding(
            padding: const EdgeInsets.fromLTRB(13, 11, 13, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 26,
                  height: 26,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: tintSoft,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, size: 15, color: tint),
                ),
                const SizedBox(height: 8),
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
                  style: const TextStyle(
                    fontFamily: 'Bebas Neue',
                    fontSize: 26,
                    height: 1.0,
                    fontFeatures: [FontFeature.tabularFigures()],
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
          ),
        ],
      ),
    );
  }
}
