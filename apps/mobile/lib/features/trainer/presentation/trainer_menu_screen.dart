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

/// Section order mirrors web's `NAV_ITEMS` macro order (People/Programs
/// before Insights-equivalent "My work" before Communication before
/// Administration) — same `Support`/`Notifications` split into
/// Communication/Administration as Owner's, Manager's, and Receptionist's
/// menus.
///
/// Every tile a Trainer's real permission grants allow on web is now wired
/// here too (Branches/Attendance/Attendance History/Workout Plans/Classes/
/// Diet Plans/Announcements) — this used to be a much shorter list (only
/// Reports), which meant mobile silently hid access the RBAC permission
/// system actually granted, purely because no tile existed yet. `Members`
/// deliberately stays off this list — the Home tab's "My Clients"
/// (`MyClientsScreen`) is the trainer-appropriate scoped view of that same
/// `members:view` grant (their own clients, not the whole gym's roster),
/// not a gap. Same for Workout/Diet Plans below: they're the actual plan
/// *catalog* (`workouts:view`/`diets:view` → `WorkoutPlansScreen`/
/// `DietPlansScreen`, same screens Owner/Manager use), genuinely distinct
/// from the Workouts/Diet tabs' Exercise/Food *libraries*
/// (`ExerciseLibraryScreen`/`FoodLibraryScreen` — individual exercises/
/// foods, not assembled multi-day plans) — reusing the exact same
/// routes/screens Owner's `MenuScreen` already wires up (permission-gated,
/// not role-locked, per this codebase's established reuse convention).
/// Explicit user request to bring mobile to full parity with web's
/// permission-driven access for every staff role, not a design frame.
const _sections = <String, List<MenuEntry>>{
  'People': [
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
      subtitle: 'The plan catalog',
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
      subtitle: 'The plan catalog',
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
  'My work': [
    MenuEntry(
      icon: Icons.bar_chart_outlined,
      title: 'Reports',
      subtitle: 'View only',
      route: AppRoutes.receptionistReports,
      permissions: ['reports:view', 'attendance:view'],
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
      icon: Icons.support_agent_outlined,
      title: 'Support',
      subtitle: 'My tickets',
      route: AppRoutes.support,
    ),
  ],
};

/// Design frame "4b. Menu" (Trainer) — no Money/Programs sections, unlike
/// Manager/Receptionist: Trainer doesn't manage finance or branches.
/// Reports reuses [ReceptionistReportsScreen] (behind `AppRoutes.
/// receptionistReports`) — it's permission-gated (`reports:view`,
/// `attendance:view`), not role-locked, so the same two tiles apply here.
/// No `featureFlag` on the Reports tile since either permission's own
/// underlying flag (`reports` or `attendance`) can satisfy it — mirrors
/// web's own `permission: string[]` "any of" pattern.
class TrainerMenuScreen extends StatelessWidget {
  const TrainerMenuScreen({super.key});

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
