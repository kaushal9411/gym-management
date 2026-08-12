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
import '../../../models/staff_member.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

const _roleTones = {
  StaffRole.manager: AppPillTone.success,
  StaffRole.trainer: AppPillTone.roleTint,
  StaffRole.receptionist: AppPillTone.warning,
};

/// Design frame "5. Team" — the manager's staff roster (`GET /staff`,
/// scoped server-side to branches the manager can see).
class TeamScreen extends StatelessWidget {
  const TeamScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<StaffMember>>(
      create: (_) => PaginatedListCubit<StaffMember>(
        (page) => getIt<StaffRepository>().list(page: page),
      )..load(),
      child: const _TeamView(),
    );
  }
}

class _TeamView extends StatelessWidget {
  const _TeamView();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: BlocBuilder<PaginatedListCubit<StaffMember>,
                    PaginatedListState<StaffMember>>(
                  builder: (context, state) {
                    final count = state is PaginatedListLoaded<StaffMember>
                        ? '${state.items.length} staff'
                        : '';
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(count, style: AppText.eyebrow()),
                        Text('Team', style: AppText.display(size: 22)),
                      ],
                    );
                  },
                ),
              ),
              Container(
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
                        context.read<PaginatedListCubit<StaffMember>>();
                    context.push(AppRoutes.staffForm).then((_) => cubit.load());
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: BlocBuilder<PaginatedListCubit<StaffMember>,
                PaginatedListState<StaffMember>>(
              builder: (context, state) {
                return switch (state) {
                  PaginatedListLoading() => const AppLoadingView(),
                  PaginatedListError(:final message) => AppErrorView(
                      message: message,
                      onRetry: () => context
                          .read<PaginatedListCubit<StaffMember>>()
                          .load(),
                    ),
                  PaginatedListLoaded(:final items) when items.isEmpty =>
                    const AppEmptyState(
                      icon: Icons.groups_outlined,
                      title: 'No staff yet',
                      message: 'Tap + to invite a Manager, Trainer or '
                          'Receptionist.',
                    ),
                  PaginatedListLoaded(:final items) => RefreshIndicator(
                      color: AppColors.staffB,
                      backgroundColor: AppColors.surface2,
                      onRefresh: () => context
                          .read<PaginatedListCubit<StaffMember>>()
                          .load(),
                      child: ListView.builder(
                        padding: const EdgeInsets.only(bottom: 90),
                        itemCount: items.length,
                        itemBuilder: (context, i) =>
                            _StaffCard(staff: items[i]),
                      ),
                    ),
                };
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _StaffCard extends StatelessWidget {
  const _StaffCard({required this.staff});

  final StaffMember staff;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: () => context.push(AppRoutes.staffDetail, extra: staff.id),
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: const BoxDecoration(
                  color: AppColors.staffSoft,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  staff.name.isEmpty ? '?' : staff.name[0].toUpperCase(),
                  style: AppText.body(
                    size: 13,
                    weight: FontWeight.w800,
                    color: AppColors.staffPillFg,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      staff.name,
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                    Text(
                      staff.primaryBranch?.branchName ?? '—',
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              AppPill(
                label: staff.role.label,
                tone: _roleTones[staff.role] ?? AppPillTone.neutral,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
