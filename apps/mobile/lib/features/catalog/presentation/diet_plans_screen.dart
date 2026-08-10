import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/diet_plan_summary.dart';
import '../../../repositories/diet_plan_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "7c. Diet plans" — read-only catalog, same reasoning as
/// [WorkoutPlansScreen].
class DietPlansScreen extends StatelessWidget {
  const DietPlansScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<DietPlanSummary>>(
      create: (_) => PaginatedListCubit<DietPlanSummary>(
        (page) => getIt<DietPlanRepository>().list(page: page),
      )..load(),
      child: const _DietPlansView(),
    );
  }
}

class _DietPlansView extends StatelessWidget {
  const _DietPlansView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: BlocBuilder<PaginatedListCubit<DietPlanSummary>,
            PaginatedListState<DietPlanSummary>>(
          builder: (context, state) {
            final count = state is PaginatedListLoaded<DietPlanSummary>
                ? state.items.length
                : null;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  count == null ? 'Loading…' : '$count plans',
                  style: AppText.eyebrow(),
                ),
                Text('Diet Plans', style: AppText.display(size: 18)),
              ],
            );
          },
        ),
      ),
      body: BlocBuilder<PaginatedListCubit<DietPlanSummary>,
          PaginatedListState<DietPlanSummary>>(
        builder: (context, state) {
          return switch (state) {
            PaginatedListLoading() => const AppLoadingView(),
            PaginatedListError(:final message) => AppErrorView(
                message: message,
                onRetry: () =>
                    context.read<PaginatedListCubit<DietPlanSummary>>().load(),
              ),
            PaginatedListLoaded(:final items) when items.isEmpty =>
              const AppEmptyState(
                icon: Icons.restaurant_outlined,
                title: 'No diet plans yet',
                message: 'Trainers build these from their own app.',
              ),
            PaginatedListLoaded(:final items) => RefreshIndicator(
                color: AppColors.staffB,
                backgroundColor: AppColors.surface2,
                onRefresh: () =>
                    context.read<PaginatedListCubit<DietPlanSummary>>().load(),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                  itemCount: items.length,
                  itemBuilder: (context, i) {
                    final plan = items[i];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              plan.name,
                              style: AppText.body(
                                size: 14,
                                weight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              [
                                plan.trainerName ?? 'Unassigned',
                                if (plan.dailyCalories != null)
                                  '${plan.dailyCalories} kcal',
                                '${plan.activeMemberCount} assigned',
                              ].join(' · '),
                              style: AppText.body(
                                size: 11,
                                color: AppColors.inkFaint,
                                weight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
          };
        },
      ),
    );
  }
}
