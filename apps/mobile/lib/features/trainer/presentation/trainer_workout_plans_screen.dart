import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../../models/workout_plan_summary.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

class WorkoutPlanFormArgs {
  const WorkoutPlanFormArgs({required this.member});

  final GymMember member;
}

class WorkoutPlanDetailArgs {
  const WorkoutPlanDetailArgs({required this.planId, required this.member});

  final String planId;
  final GymMember member;
}

/// Reached from [AssignPlanScreen]'s "Workout plan" row — no dedicated
/// design frame of its own (the design jumps straight from "4a. Assign
/// plan" to a specific plan already open in "6. Workout builder"); this
/// picker/create list is the minimal screen needed to get from one to the
/// other when more than one plan exists.
class TrainerWorkoutPlansScreen extends StatefulWidget {
  const TrainerWorkoutPlansScreen({required this.member, super.key});

  final GymMember member;

  @override
  State<TrainerWorkoutPlansScreen> createState() =>
      _TrainerWorkoutPlansScreenState();
}

class _TrainerWorkoutPlansScreenState extends State<TrainerWorkoutPlansScreen> {
  late final _cubit = PaginatedListCubit<WorkoutPlanSummary>(
    (page) => getIt<WorkoutPlanRepository>().list(page: page),
  )..load();

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  Future<void> _createPlan() async {
    final created = await context.push<bool>(
      AppRoutes.trainerWorkoutPlanForm,
      extra: WorkoutPlanFormArgs(member: widget.member),
    );
    if (created == true) _cubit.load();
  }

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
            Text('Assign to ${widget.member.name}', style: AppText.eyebrow()),
            Text('Workout plans', style: AppText.display(size: 18)),
          ],
        ),
        actions: [
          IconButton(
            onPressed: _createPlan,
            icon: const Icon(Icons.add_rounded),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: BlocProvider.value(
          value: _cubit,
          child: BlocBuilder<PaginatedListCubit<WorkoutPlanSummary>,
              PaginatedListState<WorkoutPlanSummary>>(
            builder: (context, state) {
              return switch (state) {
                PaginatedListLoading() => const AppLoadingView(),
                PaginatedListError(:final message) =>
                  AppErrorView(message: message, onRetry: _cubit.load),
                PaginatedListLoaded(:final items) when items.isEmpty =>
                  AppEmptyState(
                    icon: Icons.fitness_center_outlined,
                    title: 'No workout plans yet',
                    message: 'Create one to assign to ${widget.member.name}.',
                  ),
                PaginatedListLoaded(:final items) => ListView.builder(
                    padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                    itemCount: items.length,
                    itemBuilder: (context, i) {
                      final plan = items[i];
                      return _PlanCard(
                        plan: plan,
                        onTap: () => context.push(
                          AppRoutes.trainerWorkoutPlanDetail,
                          extra: WorkoutPlanDetailArgs(
                            planId: plan.id,
                            member: widget.member,
                          ),
                        ),
                      );
                    },
                  ),
              };
            },
          ),
        ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.plan, required this.onTap});

  final WorkoutPlanSummary plan;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      plan.name,
                      style: AppText.body(size: 14, weight: FontWeight.w700),
                    ),
                    Text(
                      '${plan.activeMemberCount} active',
                      style: AppText.body(size: 11, color: AppColors.inkFaint),
                    ),
                  ],
                ),
              ),
              AppPill(label: plan.level, tone: AppPillTone.roleTint),
              const SizedBox(width: 8),
              const Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.inkFaint,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
