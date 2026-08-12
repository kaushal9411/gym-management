import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';

/// Design frame "4a. Assign plan" — two chevron rows leading into the
/// Workout/Diet plan pickers (built in the workout/diet-plan sub-chunks),
/// each carrying [member] forward as `extra` so the picker knows who it's
/// assigning to.
class AssignPlanScreen extends StatelessWidget {
  const AssignPlanScreen({required this.member, super.key});

  final GymMember member;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(member.name, style: AppText.display(size: 18)),
            Text(member.memberId, style: AppText.eyebrow()),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          children: [
            _AssignRow(
              icon: Icons.fitness_center_outlined,
              title: 'Workout plan',
              subtitle: 'Build from exercise library',
              onTap: () => context.push(
                AppRoutes.trainerWorkoutPlans,
                extra: member,
              ),
            ),
            const SizedBox(height: 10),
            _AssignRow(
              icon: Icons.restaurant_outlined,
              title: 'Diet plan',
              subtitle: 'Build from food library',
              onTap: () => context.push(
                AppRoutes.trainerDietPlans,
                extra: member,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AssignRow extends StatelessWidget {
  const _AssignRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.staffSoft,
                  borderRadius: BorderRadius.circular(AppRadii.tile),
                ),
                alignment: Alignment.center,
                child: Icon(icon, size: 20, color: AppColors.staffPillFg),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppText.body(size: 15, weight: FontWeight.w700),
                    ),
                    Text(
                      subtitle,
                      style: AppText.body(
                        size: 12,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: AppColors.inkFaint,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
