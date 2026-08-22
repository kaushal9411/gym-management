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

/// Section order mirrors web's `NAV_ITEMS` macro order (People/Programs/
/// Finance/Insights/Communication/Administration) — Manager has no People/
/// Insights/Administration-caliber tiles of its own (Team&Access/Branches/
/// Analytics/Gym Settings stay Owner-only per design frame "11. Gym
/// settings"), so only Programs/Finance/Communication/Administration show
/// up here, in that relative order. `Search` is a mobile-only addition
/// (no web sidebar equivalent) and stays first.
const _sections = <String, List<MenuEntry>>{
  'Search': [
    MenuEntry(
      icon: Icons.search_rounded,
      title: 'Global Search',
      subtitle: 'Members, staff & branches',
      route: AppRoutes.globalSearch,
    ),
  ],
  'Programs': [
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
  ],
  'Finance': [
    MenuEntry(
      icon: Icons.account_balance_wallet_outlined,
      title: 'Finance',
      subtitle: 'Revenue vs expenses',
      route: AppRoutes.finance,
      permissions: ['finance:view'],
    ),
  ],
  'Communication': [
    MenuEntry(
      icon: Icons.notifications_outlined,
      title: 'Notifications',
      subtitle: 'Unread alerts',
      route: AppRoutes.notifications,
    ),
  ],
  'Administration': [
    MenuEntry(
      icon: Icons.support_agent_outlined,
      title: 'Support',
      subtitle: 'Open tickets',
      route: AppRoutes.support,
    ),
  ],
};

/// Design frame "4c. Menu" (Manager) — a shorter menu than Owner's: no
/// Team & Access / Billing / Announcements / Gym Settings (those stay
/// Owner-only per design frame "11. Gym settings"'s "Owner only" label).
/// Team/Members/Attendance live in the bottom nav instead of here. Tiles
/// are permission-/feature-flag-gated the same way as Owner's menu.
class ManagerMenuScreen extends StatelessWidget {
  const ManagerMenuScreen({super.key});

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
