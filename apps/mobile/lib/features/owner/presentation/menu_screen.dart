import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/user_avatar.dart';

class _MenuEntry {
  const _MenuEntry({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.route,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  /// Null means "not built yet" — the tile still renders (matching the
  /// design's full menu), but taps show a "coming soon" toast instead of navigating.
  final String? route;
}

const _sections = <String, List<_MenuEntry>>{
  'Business': [
    _MenuEntry(
      icon: Icons.storefront_outlined,
      title: 'Branches',
      subtitle: 'Locations & capacity',
      route: AppRoutes.branches,
    ),
    _MenuEntry(
      icon: Icons.card_membership_outlined,
      title: 'Membership Plans',
      subtitle: "The gym's plan catalog",
      route: AppRoutes.membershipPlans,
    ),
    _MenuEntry(
      icon: Icons.fitness_center_outlined,
      title: 'Workout Plans',
      subtitle: 'Trainer catalog',
      route: AppRoutes.workoutPlans,
    ),
    _MenuEntry(
      icon: Icons.restaurant_outlined,
      title: 'Diet Plans',
      subtitle: 'Trainer catalog',
      route: AppRoutes.dietPlans,
    ),
    _MenuEntry(
      icon: Icons.insights_outlined,
      title: 'Analytics',
      subtitle: 'Trends & breakdowns',
      route: AppRoutes.analytics,
    ),
  ],
  'Team': [
    _MenuEntry(
      icon: Icons.groups_outlined,
      title: 'Team & Access',
      subtitle: 'Staff, roles, permissions',
      route: AppRoutes.roles,
    ),
  ],
  'Finance': [
    _MenuEntry(
      icon: Icons.payments_outlined,
      title: 'Income',
      subtitle: 'This month',
      route: AppRoutes.income,
    ),
    _MenuEntry(
      icon: Icons.receipt_long_outlined,
      title: 'Expenses',
      subtitle: 'This month',
      route: AppRoutes.expenses,
    ),
    _MenuEntry(
      icon: Icons.account_balance_wallet_outlined,
      title: 'Payments',
      subtitle: 'Member payment ledger',
      route: AppRoutes.payments,
    ),
    _MenuEntry(
      icon: Icons.credit_card_outlined,
      title: 'Billing',
      subtitle: 'FitCloud subscription',
      route: AppRoutes.billing,
    ),
  ],
  'Communication': [
    _MenuEntry(
      icon: Icons.campaign_outlined,
      title: 'Announcements',
      subtitle: 'Published & drafts',
      route: AppRoutes.announcements,
    ),
    _MenuEntry(
      icon: Icons.support_agent_outlined,
      title: 'Support',
      subtitle: 'Open tickets',
      route: AppRoutes.support,
    ),
  ],
  'Administration': [
    _MenuEntry(
      icon: Icons.settings_outlined,
      title: 'Gym Settings',
      subtitle: 'Profile & business',
      route: AppRoutes.gymSettings,
    ),
    _MenuEntry(
      icon: Icons.notifications_outlined,
      title: 'Notifications',
      subtitle: 'Unread alerts',
      route: AppRoutes.notifications,
    ),
    _MenuEntry(
      icon: Icons.mark_email_unread_outlined,
      title: 'Notification Templates',
      subtitle: '10 system templates',
      route: AppRoutes.notificationTemplates,
    ),
  ],
};

/// Design frame "4a. Menu". Every section/tile from the design is present
/// and wired to a real screen. The `_MenuEntry.route == null` path (an
/// honest "coming soon" toast rather than a fabricated screen) is kept for
/// any tile added ahead of its module, but nothing uses it today.
class MenuScreen extends StatelessWidget {
  const MenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    final tenantName =
        session is SessionAuthenticatedStaff ? session.tenant.name : '';
    final name = session is SessionAuthenticatedStaff ? session.user.name : '';
    final avatarUrl =
        session is SessionAuthenticatedStaff ? session.user.avatarUrl : null;

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 90),
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tenantName, style: AppText.eyebrow()),
                  Text('Menu', style: AppText.display(size: 22)),
                ],
              ),
            ),
            GestureDetector(
              onTap: () => context.push(AppRoutes.myProfile),
              child: UserAvatar(avatarUrl: avatarUrl, name: name),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          name,
          style: AppText.body(
            size: 12,
            color: AppColors.inkFaint,
            weight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 18),
        for (final section in _sections.entries) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 8, top: 6),
            child: Text(section.key, style: AppText.eyebrow()),
          ),
          ...section.value.map((entry) => _MenuTile(entry: entry)),
        ],
      ],
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({required this.entry});

  final _MenuEntry entry;

  @override
  Widget build(BuildContext context) {
    final builtYet = entry.route != null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: () {
            if (builtYet) {
              context.push(entry.route!);
            } else {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('${entry.title} is coming in a future update'),
                ),
              );
            }
          },
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
                Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: builtYet
                      ? AppColors.inkFaint
                      : AppColors.inkFaint.withValues(alpha: 0.35),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
