import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/menu_entry.dart';
import '../../../shared/widgets/user_avatar.dart';

const _sections = <String, List<MenuEntry>>{
  'Search': [
    MenuEntry(
      icon: Icons.search_rounded,
      title: 'Global Search',
      subtitle: 'Members, staff & branches',
      route: AppRoutes.globalSearch,
    ),
  ],
  'Business': [
    MenuEntry(
      icon: Icons.storefront_outlined,
      title: 'Branches',
      subtitle: 'Locations & capacity',
      route: AppRoutes.branches,
      permissions: ['branches:view'],
      featureFlag: 'branches',
    ),
    MenuEntry(
      icon: Icons.card_membership_outlined,
      title: 'Membership Plans',
      subtitle: "The gym's plan catalog",
      route: AppRoutes.membershipPlans,
      permissions: ['memberships:manage'],
      featureFlag: 'membership_plans',
    ),
    MenuEntry(
      icon: Icons.fitness_center_outlined,
      title: 'Workout Plans',
      subtitle: 'Trainer catalog',
      route: AppRoutes.workoutPlans,
      permissions: ['workouts:view'],
      featureFlag: 'workout_plans',
    ),
    MenuEntry(
      icon: Icons.restaurant_outlined,
      title: 'Diet Plans',
      subtitle: 'Trainer catalog',
      route: AppRoutes.dietPlans,
      permissions: ['diets:view'],
      featureFlag: 'diet_plans',
    ),
    MenuEntry(
      icon: Icons.insights_outlined,
      title: 'Analytics',
      subtitle: 'Trends & breakdowns',
      route: AppRoutes.analytics,
      permissions: ['analytics:view'],
      featureFlag: 'reports',
    ),
  ],
  'Team': [
    MenuEntry(
      icon: Icons.groups_outlined,
      title: 'Team & Access',
      subtitle: 'Staff, roles, permissions',
      route: AppRoutes.roles,
      permissions: ['users:read'],
      featureFlag: 'staff',
    ),
  ],
  'Finance': [
    MenuEntry(
      icon: Icons.payments_outlined,
      title: 'Income',
      subtitle: 'This month',
      route: AppRoutes.income,
      permissions: ['finance:view'],
      featureFlag: 'income',
    ),
    MenuEntry(
      icon: Icons.receipt_long_outlined,
      title: 'Expenses',
      subtitle: 'This month',
      route: AppRoutes.expenses,
      permissions: ['finance:view'],
      featureFlag: 'expenses',
    ),
    MenuEntry(
      icon: Icons.account_balance_wallet_outlined,
      title: 'Payments',
      subtitle: 'Member payment ledger',
      route: AppRoutes.payments,
      permissions: ['finance:view'],
      featureFlag: 'payments',
    ),
    MenuEntry(
      icon: Icons.credit_card_outlined,
      title: 'Billing',
      subtitle: 'FitCloud subscription',
      route: AppRoutes.billing,
      permissions: ['billing:read'],
    ),
  ],
  'Communication': [
    MenuEntry(
      icon: Icons.campaign_outlined,
      title: 'Announcements',
      subtitle: 'Published & drafts',
      route: AppRoutes.announcements,
      permissions: ['announcements:view'],
      featureFlag: 'notifications',
    ),
    MenuEntry(
      icon: Icons.support_agent_outlined,
      title: 'Support',
      subtitle: 'Open tickets',
      route: AppRoutes.support,
    ),
  ],
  'Administration': [
    MenuEntry(
      icon: Icons.settings_outlined,
      title: 'Gym Settings',
      subtitle: 'Profile & business',
      route: AppRoutes.gymSettings,
      permissions: ['settings:read'],
    ),
    MenuEntry(
      icon: Icons.notifications_outlined,
      title: 'Notifications',
      subtitle: 'Unread alerts',
      route: AppRoutes.notifications,
    ),
    MenuEntry(
      icon: Icons.mark_email_unread_outlined,
      title: 'Notification Templates',
      subtitle: '10 system templates',
      route: AppRoutes.notificationTemplates,
    ),
  ],
};

/// Design frame "4a. Menu". Every section/tile from the design is wired to
/// a real screen. Tiles are permission- and feature-flag-gated the same
/// way tenant-web's sidebar is (`nav-config.ts` — mirrored per-tile above)
/// rather than always showing the full design regardless of what the
/// signed-in user can do or what the tenant's plan actually includes.
class MenuScreen extends StatelessWidget {
  const MenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    if (session is! SessionAuthenticatedStaff) return const SizedBox.shrink();
    final tenantName = session.tenant.name;
    final name = session.user.name;
    final avatarUrl = session.user.avatarUrl;
    final sections =
        visibleMenuSections(_sections, session.user, session.tenant);

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
        for (final section in sections.entries) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 8, top: 6),
            child: Text(section.key, style: AppText.eyebrow()),
          ),
          ...section.value.map((entry) => MenuTile(entry: entry)),
        ],
      ],
    );
  }
}
