import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../team/presentation/widgets/team_ui.dart';

/// Full-width "+ Add ..." button at the top of a setup list.
class HrSetupAddButton extends StatelessWidget {
  const HrSetupAddButton({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TeamGradientButton(
          label: label,
          icon: Icons.add_rounded,
          onTap: onTap,
        ),
      );
}

/// "You can view X but not change it" footer for read-only holders.
class HrReadOnlyNote extends StatelessWidget {
  const HrReadOnlyNote(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Text(
          text,
          key: const Key('hr-readonly-note'),
          style: AppText.body(
            size: 12,
            weight: FontWeight.w600,
            color: AppColors.inkFaint,
          ),
        ),
      );
}
