import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_text_styles.dart';

/// Staff / Member switch shown at the top of the shared Find Gym and Login
/// screens — the same entry point serves both roles (per the design's two
/// parallel color-coded flows), and this is how a user picks which one.
class RoleToggle extends StatelessWidget {
  const RoleToggle({super.key, required this.value, required this.onChanged});

  final AppRole value;
  final ValueChanged<AppRole> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: AppRole.values.map((role) {
          final selected = role == value;
          return Expanded(
            child: GestureDetector(
              onTap: () => onChanged(role),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOut,
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  gradient: selected ? role.gradient : null,
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                ),
                alignment: Alignment.center,
                child: Text(
                  role == AppRole.staff ? 'Staff' : 'Member',
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w800,
                    color: selected ? role.onGradient : AppColors.inkFaint,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
