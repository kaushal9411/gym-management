import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../plans/presentation/plan_ui.dart' show PlanHeroShell;
import '../../team/presentation/widgets/team_ui.dart';

/// Design frame "4a. Assign plan", redesigned: the client in the gradient
/// hero and two big tiles leading into the Workout / Diet plan pickers, each
/// carrying [member] forward as `extra` so the picker knows who it is
/// assigning to. Destinations and `extra` types are unchanged.
class AssignPlanScreen extends StatelessWidget {
  const AssignPlanScreen({required this.member, super.key});

  final GymMember member;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final side = 16 + teamSideInset(context, maxWidth: 840);
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Assign plan'),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          PlanHeroShell(
            topInset: top,
            child: Column(
              children: [
                FadeUp(
                  index: 0,
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: UserAvatar(
                      avatarUrl: member.profilePhotoUrl,
                      name: member.name,
                      size: 76,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                FadeUp(
                  index: 1,
                  child: Text(
                    member.name,
                    textAlign: TextAlign.center,
                    style: AppText.display(size: 24, color: Colors.white),
                  ),
                ),
                const SizedBox(height: 4),
                FadeUp(
                  index: 2,
                  child: Text(
                    member.memberId,
                    style: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w700,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(side, 18, side, 0),
            child: LayoutBuilder(
              builder: (context, c) {
                final tiles = [
                  _AssignTile(
                    icon: Icons.fitness_center_rounded,
                    title: 'Workout plan',
                    subtitle: 'Build from exercise library',
                    colors: const [TeamColors.indigo, TeamColors.violet],
                    onTap: () => context.push(
                      AppRoutes.trainerWorkoutPlans,
                      extra: member,
                    ),
                  ),
                  _AssignTile(
                    icon: Icons.restaurant_rounded,
                    title: 'Diet plan',
                    subtitle: 'Build from food library',
                    colors: const [TeamColors.teal, TeamColors.green],
                    onTap: () => context.push(
                      AppRoutes.trainerDietPlans,
                      extra: member,
                    ),
                  ),
                ];
                if (c.maxWidth < 560) {
                  return Column(
                    children: [
                      for (var i = 0; i < tiles.length; i++) ...[
                        if (i > 0) const SizedBox(height: 12),
                        FadeUp(index: i, child: tiles[i]),
                      ],
                    ],
                  );
                }
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (var i = 0; i < tiles.length; i++) ...[
                      if (i > 0) const SizedBox(width: 12),
                      Expanded(child: FadeUp(index: i, child: tiles[i])),
                    ],
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _AssignTile extends StatelessWidget {
  const _AssignTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.colors,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final List<Color> colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Ink(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: colors,
            ),
            boxShadow: [
              BoxShadow(
                color: colors.first.withValues(alpha: 0.30),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: Colors.white, size: 26),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppText.display(size: 18, color: Colors.white),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: AppText.body(
                        size: 12.5,
                        weight: FontWeight.w600,
                        color: Colors.white.withValues(alpha: 0.88),
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.arrow_forward_rounded,
                color: Colors.white,
                size: 22,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
