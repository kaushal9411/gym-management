import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "7. Membership plans".
class MembershipPlansScreen extends StatelessWidget {
  const MembershipPlansScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<MembershipPlan>>(
      create: (_) => PaginatedListCubit<MembershipPlan>(
        (page) => getIt<MembershipPlanRepository>().list(page: page),
      )..load(),
      child: const _MembershipPlansView(),
    );
  }
}

class _MembershipPlansView extends StatelessWidget {
  const _MembershipPlansView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: BlocBuilder<PaginatedListCubit<MembershipPlan>,
            PaginatedListState<MembershipPlan>>(
          builder: (context, state) {
            final count = state is PaginatedListLoaded<MembershipPlan>
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
                Text('Membership Plans', style: AppText.display(size: 18)),
              ],
            );
          },
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: Container(
                width: 36,
                height: 36,
                decoration: const BoxDecoration(
                  gradient: AppColors.staffGrad,
                  shape: BoxShape.circle,
                ),
                child: IconButton(
                  padding: EdgeInsets.zero,
                  icon: const Icon(
                    Icons.add_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                  onPressed: () {
                    final cubit =
                        context.read<PaginatedListCubit<MembershipPlan>>();
                    context
                        .push(AppRoutes.membershipPlanForm)
                        .then((_) => cubit.load());
                  },
                ),
              ),
            ),
          ),
        ],
      ),
      body: BlocBuilder<PaginatedListCubit<MembershipPlan>,
          PaginatedListState<MembershipPlan>>(
        builder: (context, state) {
          return switch (state) {
            PaginatedListLoading() => const AppLoadingView(),
            PaginatedListError(:final message) => AppErrorView(
                message: message,
                onRetry: () =>
                    context.read<PaginatedListCubit<MembershipPlan>>().load(),
              ),
            PaginatedListLoaded(:final items) when items.isEmpty =>
              const AppEmptyState(
                icon: Icons.card_membership_outlined,
                title: 'No plans yet',
                message: 'Tap + to create your first membership plan.',
              ),
            PaginatedListLoaded(:final items) => RefreshIndicator(
                color: AppColors.staffB,
                backgroundColor: AppColors.surface2,
                onRefresh: () =>
                    context.read<PaginatedListCubit<MembershipPlan>>().load(),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                  itemCount: items.length,
                  itemBuilder: (context, i) => _PlanCard(plan: items[i]),
                ),
              ),
          };
        },
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.plan});

  final MembershipPlan plan;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  plan.name,
                  style: AppText.body(size: 15, weight: FontWeight.w700),
                ),
                AppPill(
                  label: plan.isActive ? 'Active' : 'Inactive',
                  tone:
                      plan.isActive ? AppPillTone.success : AppPillTone.danger,
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${Formatters.currency(plan.price)} · ${plan.durationLabel} · ${plan.perksSummary}',
              style: AppText.body(
                size: 12,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
