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

/// Section order mirrors web's `NAV_ITEMS` macro order (Insights-equivalent
/// "My work" before Communication before Administration) — same
/// `Support`/`Notifications` split into Communication/Administration as
/// Owner's, Manager's, and Receptionist's menus.
const _sections = <String, List<MenuEntry>>{
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
