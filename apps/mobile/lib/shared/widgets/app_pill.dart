import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_text_styles.dart';

enum AppPillTone { success, warning, danger, roleTint, neutral }

/// `.pill` + tone variants (`.pill-success/-warning/-danger/-staff/-member`).
class AppPill extends StatelessWidget {
  const AppPill({
    super.key,
    required this.label,
    this.tone = AppPillTone.neutral,
    this.role = AppRole.staff,
  });

  final String label;
  final AppPillTone tone;
  final AppRole role;

  @override
  Widget build(BuildContext context) {
    late final Color bg;
    late final Color fg;
    switch (tone) {
      case AppPillTone.success:
        bg = AppColors.successSoft;
        fg = AppColors.success;
      case AppPillTone.warning:
        bg = AppColors.warningSoft;
        fg = AppColors.warning;
      case AppPillTone.danger:
        bg = AppColors.dangerSoft;
        fg = AppColors.danger;
      case AppPillTone.roleTint:
        bg = role.soft;
        fg = role.pillFg;
      case AppPillTone.neutral:
        bg = AppColors.surface3;
        fg = AppColors.inkSoft;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        label,
        style: AppText.body(size: 11, weight: FontWeight.w800, color: fg),
      ),
    );
  }
}
