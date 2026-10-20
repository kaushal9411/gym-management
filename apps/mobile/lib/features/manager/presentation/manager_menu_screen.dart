import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/platform/platform_config_cubit.dart';
import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/app_drawer.dart';
import '../../../shared/widgets/menu_entry.dart';
import '../../../shared/widgets/staff_logout_dialog.dart';

/// Section order mirrors web's `NAV_ITEMS` macro order (People/Programs/
/// Finance/Insights/Communication/Administration). `Search` is a
/// mobile-only addition (no web sidebar equivalent) and stays first.
///
/// A Manager's real permission grants are near-identical to an Owner's
/// (same `branches:*`/`billing:*`/`settings:*`/`analytics:view`/
/// `announcements:*`/`users:read` — only missing `roles:manage-custom`),
/// so every tile Owner's `MenuScreen` shows is now wired here too where
/// the permission actually matches, reusing the exact same routes/screens
/// (permission-gated, not role-locked, per this codebase's established
/// reuse convention). This section used to say these tiles were
/// "Owner-only per design frame '11. Gym settings'" — that was true of the
/// original Kinetic design, but explicit user request now is full parity
/// with web's permission-driven access for every staff role, which
/// supersedes it. `Team`/`Members`/`Attendance` (today's view) stay off
/// this list — they're already bottom-nav tabs one level up; `Finance`'s
/// existing tile below already covers Income/Expenses/Payments/Invoices
/// (see `FinanceTab`'s own doc comment) — only the separate FitCloud
/// subscription `Billing` page (a different concept from that screen's own
/// outstanding-payments card) was actually missing.
Map<String, List<MenuEntry>> _sections(String appName) =>
    <String, List<MenuEntry>>{
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
          icon: Icons.person_search_outlined,
          title: 'Leads & Enquiries',
          subtitle: 'Pipeline, follow-ups, conversions',
          route: AppRoutes.leads,
          permissions: ['leads:view'],
        ),
        MenuEntry(
          icon: Icons.groups_outlined,
          title: 'Team & Access',
          subtitle: 'Staff, roles, permissions',
          route: AppRoutes.roles,
          permissions: ['users:read'],
          featureFlag: 'staff',
        ),
        MenuEntry(
          icon: Icons.badge_outlined,
          title: 'Staff',
          subtitle: 'Directory, employment & branches',
          route: AppRoutes.staffRoster,
          permissions: ['staff:view'],
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
          title: 'Finance',
          subtitle: 'Revenue vs expenses',
          route: AppRoutes.finance,
          permissions: ['finance:view'],
        ),
        MenuEntry(
          icon: Icons.credit_card_outlined,
          title: 'Billing',
          subtitle: '$appName subscription',
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
          icon: Icons.forum_outlined,
          title: 'Communications',
          subtitle: 'Send messages & reminders',
          route: AppRoutes.communications,
          permissions: ['notifications:view'],
          featureFlag: 'notifications',
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
          icon: Icons.brightness_6_outlined,
          title: 'Appearance',
          subtitle: 'Light or dark theme',
          route: AppRoutes.appearance,
        ),
        MenuEntry(
          icon: Icons.support_agent_outlined,
          title: 'Support',
          subtitle: 'Open tickets',
          route: AppRoutes.support,
        ),
      ],
    };

/// Design frame "4c. Menu" (Manager), extended to full parity with
/// Owner's — see the `_sections` doc comment above for why. Now the
/// content of the role's navigation [AppDrawer] rather than a bottom-nav
/// tab/page (see [ManagerShell]). Team/Members/Attendance (today's view)
/// live in the bottom nav instead of here. Tiles are permission-/
/// feature-flag-gated the same way as Owner's menu.
class ManagerMenuScreen extends StatelessWidget {
  const ManagerMenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    if (session is! SessionAuthenticatedStaff) return const SizedBox.shrink();
    final appName = context.watch<PlatformConfigCubit>().state.appName;
    final sections =
        visibleMenuSections(_sections(appName), session.user, session.tenant);

    return AppDrawer(
      role: AppRole.staff,
      avatarUrl: session.user.avatarUrl,
      name: session.user.name,
      subtitle: 'Manager · ${session.tenant.name}',
      sections: sections,
      onSignOut: () => showStaffLogoutDialog(context),
    );
  }
}
