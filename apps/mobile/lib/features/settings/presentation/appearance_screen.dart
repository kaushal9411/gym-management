import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/theme/theme_cubit.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Appearance — Light, Dark, or follow the phone. A per-device choice stored
/// on this device (no backend field; the same toggle web keeps in its header),
/// shared by the staff and member planes, kept across sign-out. Distinct from
/// the gym's *default* theme under Gym Settings > Branding, which is the gym's
/// setting for everyone.
///
/// Each option is a small preview of that look so the choice is visible before
/// it is made.
class AppearanceScreen extends StatelessWidget {
  const AppearanceScreen({super.key});

  static const _options = [
    (
      mode: ThemeMode.light,
      title: 'Light',
      subtitle: 'Bright surfaces, dark text',
      icon: Icons.light_mode_rounded,
      color: TeamColors.amber,
    ),
    (
      mode: ThemeMode.dark,
      title: 'Dark',
      subtitle: 'The default FitCloud look',
      icon: Icons.dark_mode_rounded,
      color: TeamColors.indigo,
    ),
    (
      mode: ThemeMode.system,
      title: 'System',
      subtitle: 'Match this phone’s setting',
      icon: Icons.brightness_auto_rounded,
      color: TeamColors.teal,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final selected = context.watch<ThemeCubit>().state;
    final top = MediaQuery.of(context).padding.top;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: ListHero(
              title: 'Appearance',
              subtitle: 'Choose how FitCloud looks on this device.',
              topInset: top,
              side: 18 + teamSideInset(context),
              leading: ListHeroButton(
                icon: Icons.arrow_back_rounded,
                onTap: () => context.pop(),
              ),
              chips: [
                ListHeroChip(
                  icon: Icons.palette_outlined,
                  label: switch (selected) {
                    ThemeMode.light => 'Light',
                    ThemeMode.dark => 'Dark',
                    ThemeMode.system => 'Follows your phone',
                  },
                ),
              ],
            ),
          ),
          SliverToBoxAdapter(
            child: TeamCenter(
              maxWidth: 760,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < _options.length; i++)
                      FadeUp(
                        index: i,
                        child: _OptionCard(
                          title: _options[i].title,
                          subtitle: _options[i].subtitle,
                          icon: _options[i].icon,
                          color: _options[i].color,
                          mode: _options[i].mode,
                          selected: selected == _options[i].mode,
                          onTap: () => context
                              .read<ThemeCubit>()
                              .setMode(_options[i].mode),
                        ),
                      ),
                    const SizedBox(height: 4),
                    Text(
                      "This only changes this device. The gym's default theme "
                      'is set under Gym Settings > Branding.',
                      style: AppText.body(
                        size: 11.5,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OptionCard extends StatelessWidget {
  const _OptionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.mode,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final ThemeMode mode;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Semantics(
        button: true,
        selected: selected,
        label: '$title theme',
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  color.withValues(alpha: selected ? 0.2 : 0.08),
                  Colors.transparent,
                ],
              ),
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(
                color: selected ? color : AppColors.line,
                width: selected ? 2 : 1,
              ),
            ),
            child: Row(
              children: [
                _Preview(mode: mode),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(icon, size: 18, color: color),
                          const SizedBox(width: 6),
                          Text(title, style: AppText.display(size: 16)),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        subtitle,
                        style: AppText.body(
                          size: 12,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  selected
                      ? Icons.check_circle_rounded
                      : Icons.radio_button_unchecked_rounded,
                  color: selected ? color : AppColors.inkFaint,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A tiny mock screen in the given theme: header bar, a card and a pill.
class _Preview extends StatelessWidget {
  const _Preview({required this.mode});

  final ThemeMode mode;

  @override
  Widget build(BuildContext context) {
    Widget half(bool dark) {
      final bg = dark ? const Color(0xFF120E1A) : const Color(0xFFF6F5FB);
      final card = dark ? const Color(0xFF241C33) : Colors.white;
      final ink = dark ? const Color(0xFFF5F1FA) : const Color(0xFF16132B);
      return Container(
        color: bg,
        padding: const EdgeInsets.all(6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 5,
              width: 24,
              decoration: BoxDecoration(
                color: ink,
                borderRadius: BorderRadius.circular(9),
              ),
            ),
            const SizedBox(height: 5),
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: card,
                  borderRadius: BorderRadius.circular(6),
                ),
                padding: const EdgeInsets.all(4),
                alignment: Alignment.bottomLeft,
                child: Container(
                  height: 5,
                  width: 18,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                    ),
                    borderRadius: BorderRadius.circular(9),
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        width: 74,
        height: 74,
        child: switch (mode) {
          ThemeMode.light => half(false),
          ThemeMode.dark => half(true),
          ThemeMode.system => Row(
              children: [
                Expanded(child: half(false)),
                Expanded(child: half(true)),
              ],
            ),
        },
      ),
    );
  }
}
