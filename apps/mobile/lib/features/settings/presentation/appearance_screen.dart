import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/theme/theme_cubit.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/app_card.dart';

/// Settings → Appearance. Light, Dark, or follow the phone. Stored on this
/// device only (no backend field exists or is needed), shared by the staff
/// and member planes, and it survives sign-out.
class AppearanceScreen extends StatelessWidget {
  const AppearanceScreen({super.key});

  static const _options = [
    (
      mode: ThemeMode.light,
      title: 'Light',
      subtitle: 'Bright surfaces, dark text',
      icon: Icons.light_mode_outlined,
    ),
    (
      mode: ThemeMode.dark,
      title: 'Dark',
      subtitle: 'The default FitCloud look',
      icon: Icons.dark_mode_outlined,
    ),
    (
      mode: ThemeMode.system,
      title: 'System',
      subtitle: 'Match this phone’s setting',
      icon: Icons.brightness_auto_outlined,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final selected = context.watch<ThemeCubit>().state;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: AppColors.ink,
        title: Text('Appearance', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          children: [
            Text(
              'Choose how FitCloud looks on this device.',
              style: AppText.body(size: 13, color: AppColors.inkSoft),
            ),
            const SizedBox(height: 14),
            ..._options.map(
              (o) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Semantics(
                  button: true,
                  selected: selected == o.mode,
                  label: '${o.title} theme',
                  child: InkWell(
                    borderRadius: BorderRadius.circular(AppRadii.card),
                    onTap: () => context.read<ThemeCubit>().setMode(o.mode),
                    child: AppCard(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: AppColors.staffB.withValues(alpha: 0.16),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(o.icon, color: AppColors.staffB),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  o.title,
                                  style: AppText.body(
                                    size: 14,
                                    weight: FontWeight.w700,
                                  ),
                                ),
                                Text(
                                  o.subtitle,
                                  style: AppText.body(
                                    size: 12,
                                    color: AppColors.inkFaint,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Icon(
                            selected == o.mode
                                ? Icons.radio_button_checked_rounded
                                : Icons.radio_button_off_rounded,
                            color: selected == o.mode
                                ? AppColors.staffB
                                : AppColors.inkFaint,
                          ),
                        ],
                      ),
                    ),
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
