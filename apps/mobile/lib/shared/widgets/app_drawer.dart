import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import 'slide_drawer_scaffold.dart';
import 'menu_entry.dart';
import 'user_avatar.dart';

/// Cycled across sections so each one reads as its own group, the same way
/// the web sidebar visually separates `NAV_GROUPS`. Local to this widget
/// (not `AppColors`) since it's a decorative label-color rotation, not a
/// semantic token — [AppColors.staffB]/`memberB`/`warning`/`success`/
/// `danger` cover 5 of the 6; the 6th (indigo) has no existing token.
const _sectionAccents = [
  Color(0xFF6366F1),
  AppColors.staffB,
  AppColors.memberB,
  AppColors.warning,
  AppColors.success,
  AppColors.danger,
];

/// The role's navigation drawer — a flat, section-labelled list of
/// [MenuEntry] rows, opened via [MenuButton] from any tab's header. Replaces
/// the old full-page "Menu" bottom-nav tab (every role had one); the
/// section/tile DATA is unchanged, only the presentation moved from a page
/// of cards into this slide-out panel.
///
/// [sections] with a single entry whose key is empty renders as one flat
/// list with no section labels, all rows sharing [role]'s own accent
/// ([AppRole.b]) instead of the 6-color cycle — that's the Member shape
/// (no sections, no per-tile permission gating to visually group by).
class AppDrawer extends StatelessWidget {
  const AppDrawer({
    required this.role,
    required this.avatarUrl,
    required this.name,
    required this.subtitle,
    required this.sections,
    required this.onSignOut,
    this.onHeaderTap,
    super.key,
  });

  /// Makes the avatar / name header tappable (Member: opens My Profile).
  final VoidCallback? onHeaderTap;

  final AppRole role;
  final String? avatarUrl;
  final String name;
  final String subtitle;
  final Map<String, List<MenuEntry>> sections;
  final VoidCallback onSignOut;

  bool get _flat => sections.length == 1 && sections.keys.first.isEmpty;

  @override
  Widget build(BuildContext context) {
    return Drawer(
      width: 302,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.only(
          topRight: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
      ),
      child: Column(
        children: [
          _Header(
            role: role,
            avatarUrl: avatarUrl,
            name: name,
            subtitle: subtitle,
            onTap: onHeaderTap,
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 6),
              children: [
                for (final (i, section) in sections.entries.indexed) ...[
                  if (!_flat)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
                      child: Text(
                        section.key.toUpperCase(),
                        style: AppText.body(
                          size: 10,
                          weight: FontWeight.w700,
                          color: _sectionAccents[i % _sectionAccents.length],
                        ).copyWith(letterSpacing: 1.1),
                      ),
                    ),
                  for (final entry in section.value)
                    _DrawerRow(
                      entry: entry,
                      accent: _flat
                          ? role.b
                          : _sectionAccents[i % _sectionAccents.length],
                    ),
                ],
              ],
            ),
          ),
          SafeArea(top: false, child: _SignOutRow(onTap: onSignOut)),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.role,
    required this.avatarUrl,
    required this.name,
    required this.subtitle,
    this.onTap,
  });

  final AppRole role;
  final String? avatarUrl;
  final String name;
  final String subtitle;
  final VoidCallback? onTap;

  Widget _tap(Widget child) => onTap == null
      ? child
      : GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: child,
        );

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 0, 14, 16),
      decoration: BoxDecoration(gradient: role.gradient),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _tap(
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: role.onGradient.withValues(alpha: 0.5),
                      width: 2,
                    ),
                  ),
                  child: UserAvatar(
                    avatarUrl: avatarUrl,
                    name: name,
                    role: role,
                    size: 44,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _tap(
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 14.5,
                            weight: FontWeight.w700,
                            color: role.onGradient,
                          ),
                        ),
                        Text(
                          subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 11.5,
                            color: role.onGradient.withValues(alpha: 0.75),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              GestureDetector(
                onTap: () => SlideDrawerController.of(context)?.close(),
                child: Container(
                  width: 28,
                  height: 28,
                  margin: const EdgeInsets.only(top: 2),
                  decoration: BoxDecoration(
                    color: role.onGradient.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    Icons.close_rounded,
                    size: 15,
                    color: role.onGradient,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DrawerRow extends StatelessWidget {
  const _DrawerRow({required this.entry, required this.accent});

  final MenuEntry entry;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {
        SlideDrawerController.of(context)?.close();
        context.push(entry.route);
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
        child: Row(
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: Icon(entry.icon, size: 16, color: accent),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                entry.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(size: 13.5, weight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SignOutRow extends StatelessWidget {
  const _SignOutRow({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.line)),
      ),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: AppColors.danger.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.logout_rounded,
                  size: 16,
                  color: AppColors.danger,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'Sign out',
                style: AppText.body(
                  size: 13.5,
                  weight: FontWeight.w700,
                  color: AppColors.danger,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
