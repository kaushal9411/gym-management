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

/// Section names/order and each tile's placement mirror web's
/// `NAV_ITEMS` (`nav-config.ts`) exactly — same section headers
/// (People/Programs/Finance/Insights/Communication/Administration) in the
/// same order, and tiles within each section in the same order web lists
/// them. `Members`, `Reports`, and `Dashboard` have no menu tile here
/// because they're already a bottom-nav tab one level up (Home/Members/
/// Reports) — same reasoning web doesn't need since it has no separate
/// tab bar. Web's `Staff` (`/staff`) nav item has no mobile screen yet, so
/// isn't listed (never wire a tile to a screen that doesn't exist).
/// `Search` is a mobile-only addition (no web sidebar equivalent) and
/// stays first since it's the most-used shortcut.
const _sections = <String, List<MenuEntry>>{
  'Search': [
    MenuEntry(
      icon: Icons.search_rounded,
      title: 'Global Search',
      subtitle: 'Members, staff & branches',
      route: AppRoutes.globalSearch,
    ),
  ],
  'People': [
    MenuEntry(
      icon: Icons.groups_outlined,
      title: 'Team & Access',
      subtitle: 'Staff, roles, permissions',
      route: AppRoutes.roles,
      permissions: ['users:read'],
      featureFlag: 'staff',
    ),
    MenuEntry(
      icon: Icons.storefront_outlined,
      title: 'Branches',
      subtitle: 'Locations & capacity',
      route: AppRoutes.branches,
      permissions: ['branches:view'],
      featureFlag: 'branches',
    ),
  ],
  'Programs': [
    MenuEntry(
      icon: Icons.card_membership_outlined,
      title: 'Membership Plans',
      subtitle: "The gym's plan catalog",
      route: AppRoutes.membershipPlans,
      permissions: ['memberships:manage'],
      featureFlag: 'membership_plans',
    ),
    MenuEntry(
      icon: Icons.fact_check_outlined,
      title: 'Attendance',
      subtitle: "Who's checked in today",
      route: AppRoutes.attendance,
      permissions: ['attendance:view'],
      featureFlag: 'attendance',
    ),
    MenuEntry(
      icon: Icons.history_rounded,
      title: 'Attendance History',
      subtitle: 'Every visit, filterable',
      route: AppRoutes.attendanceHistory,
      permissions: ['attendance:view'],
      featureFlag: 'attendance',
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
      icon: Icons.calendar_month_outlined,
      title: 'Classes',
      subtitle: 'Group class catalog & schedule',
      route: AppRoutes.classes,
      permissions: ['classes:view'],
      featureFlag: 'live_classes',
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
      icon: Icons.straighten_outlined,
      title: 'Body Measurements',
      subtitle: 'Member history log',
      route: AppRoutes.measuredMembers,
      permissions: ['measurements:view'],
    ),
  ],
  'Finance': [
    MenuEntry(
      icon: Icons.account_balance_wallet_outlined,
      title: 'Payments',
      subtitle: 'Member payment ledger',
      route: AppRoutes.payments,
      permissions: ['finance:view'],
      featureFlag: 'payments',
    ),
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
      icon: Icons.credit_card_outlined,
      title: 'Billing',
      subtitle: 'FitCloud subscription',
      route: AppRoutes.billing,
      permissions: ['billing:read'],
    ),
  ],
  'Insights': [
    MenuEntry(
      icon: Icons.insights_outlined,
      title: 'Analytics',
      subtitle: 'Trends & breakdowns',
      route: AppRoutes.analytics,
      permissions: ['analytics:view'],
      featureFlag: 'reports',
    ),
  ],
  'Communication': [
    MenuEntry(
      icon: Icons.notifications_outlined,
      title: 'Notifications',
      subtitle: 'Unread alerts',
      route: AppRoutes.notifications,
    ),
    MenuEntry(
      icon: Icons.campaign_outlined,
      title: 'Announcements',
      subtitle: 'Published & drafts',
      route: AppRoutes.announcements,
      permissions: ['announcements:view'],
      featureFlag: 'notifications',
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
      icon: Icons.support_agent_outlined,
      title: 'Support',
      subtitle: 'Open tickets',
      route: AppRoutes.support,
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
