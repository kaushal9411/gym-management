import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../models/tenant_branding.dart';
import '../../models/user_profile.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_text_styles.dart';

/// One tile in a role's Menu screen. [permissions]/[featureFlag] mirror
/// tenant-web's `nav-config.ts` (`permission?: string | string[]` — an
/// array means "any of" — and `featureFlag?: string`, gating on
/// `tenant.featureFlags`) so a tile is hidden here exactly when the
/// equivalent web sidebar item would be, instead of every role's menu
/// unconditionally showing all of its tiles regardless of what the
/// signed-in user can actually do or what the tenant's plan includes.
///
/// Left `null`/empty when there's no clean web equivalent to mirror (e.g.
/// Global Search, Notifications) — deliberately not gated on a guessed
/// permission key, since hiding a real capability behind a wrong key is
/// worse than leaving it always-visible.
class MenuEntry {
  const MenuEntry({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.route,
    this.permissions = const [],
    this.featureFlag,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String route;
  final List<String> permissions;
  final String? featureFlag;

  bool visibleFor(UserProfile user, TenantBranding tenant) {
    if (permissions.isNotEmpty && !user.hasAnyPermission(permissions)) {
      return false;
    }
    if (featureFlag != null && !tenant.featureFlags.contains(featureFlag)) {
      return false;
    }
    return true;
  }
}

/// Filters a role's `Map<section, List<MenuEntry>>` down to what [user] can
/// actually see on [tenant]'s plan, dropping any section left empty after
/// filtering rather than showing a bare header with nothing under it.
Map<String, List<MenuEntry>> visibleMenuSections(
  Map<String, List<MenuEntry>> sections,
  UserProfile user,
  TenantBranding tenant,
) {
  final result = <String, List<MenuEntry>>{};
  for (final section in sections.entries) {
    final visible =
        section.value.where((e) => e.visibleFor(user, tenant)).toList();
    if (visible.isNotEmpty) result[section.key] = visible;
  }
  return result;
}

class MenuTile extends StatelessWidget {
  const MenuTile({required this.entry, super.key});

  final MenuEntry entry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: () => context.push(entry.route),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.line),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.staffSoft,
                    borderRadius: BorderRadius.circular(AppRadii.tile),
                  ),
                  alignment: Alignment.center,
                  child:
                      Icon(entry.icon, size: 18, color: AppColors.staffPillFg),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        entry.title,
                        style: AppText.body(size: 13, weight: FontWeight.w700),
                      ),
                      Text(
                        entry.subtitle,
                        style: AppText.body(
                          size: 11,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: AppColors.inkFaint,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
