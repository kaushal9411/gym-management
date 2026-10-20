import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/app_drawer.dart';
import '../../../shared/widgets/menu_entry.dart';
import '../../../shared/widgets/staff_logout_dialog.dart';

/// Section order mirrors web's `NAV_ITEMS` macro order (People/Programs/
/// Finance/"My work" before Communication before Administration) — same
/// `Support`/`Notifications` split into Communication/Administration as
/// Owner's and Manager's menus.
///
/// Every tile a Receptionist's real permission grants allow on web is now
/// wired here too (Branches/Memberships/Attendance/Attendance History/
/// Workout Plans/Diet Plans/Income/Expenses/Announcements) — this used to
/// be a much shorter list (only Invoices/Reports), which meant mobile
/// silently hid access the RBAC permission system actually granted, purely
/// because no tile existed yet. Fixed by reusing the exact same
/// routes/screens Owner's `MenuScreen` already wires up (permission-gated,
/// not role-locked, per this codebase's established reuse convention) —
/// explicit user request to bring mobile to full parity with web's
/// permission-driven access for every staff role, not a design frame.
const _sections = <String, List<MenuEntry>>{
  'People': [
    MenuEntry(
      icon: Icons.person_search_outlined,
      title: 'Leads & Enquiries',
      subtitle: 'Pipeline, follow-ups, conversions',
      route: AppRoutes.leads,
      permissions: ['leads:view'],
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
      icon: Icons.receipt_long_outlined,
      title: 'Invoices',
      subtitle: 'Search & email',
      route: AppRoutes.invoices,
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
  ],
  'My work': [
    MenuEntry(
      icon: Icons.bar_chart_outlined,
      title: 'Reports',
      subtitle: 'View only',
      route: AppRoutes.receptionistReports,
      permissions: ['reports:view', 'attendance:view'],
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
      icon: Icons.brightness_6_outlined,
      title: 'Appearance',
      subtitle: 'Light or dark theme',
      route: AppRoutes.appearance,
    ),
    MenuEntry(
      icon: Icons.support_agent_outlined,
      title: 'Support',
      subtitle: 'My tickets',
      route: AppRoutes.support,
    ),
  ],
};

/// Design frame "4c. Menu" (Receptionist). Tiles are permission-/
/// feature-flag-gated the same way as Owner's menu.
class ReceptionistMenuScreen extends StatelessWidget {
  const ReceptionistMenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    if (session is! SessionAuthenticatedStaff) return const SizedBox.shrink();
    final sections =
        visibleMenuSections(_sections, session.user, session.tenant);

    return AppDrawer(
      role: AppRole.staff,
      avatarUrl: session.user.avatarUrl,
      name: session.user.name,
      subtitle: 'Receptionist · ${session.tenant.name}',
      sections: sections,
      onSignOut: () => showStaffLogoutDialog(context),
    );
  }
}
