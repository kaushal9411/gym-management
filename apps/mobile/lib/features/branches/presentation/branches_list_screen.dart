import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/branches/branch_list_cubit.dart';
import '../../../bloc/branches/branch_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "8. Branches".
class BranchesListScreen extends StatelessWidget {
  const BranchesListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<BranchListCubit>(
      create: (_) => getIt<BranchListCubit>()..load(),
      child: const _BranchesListView(),
    );
  }
}

class _BranchesListView extends StatefulWidget {
  const _BranchesListView();

  @override
  State<_BranchesListView> createState() => _BranchesListViewState();
}

class _BranchesListViewState extends State<_BranchesListView> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(() {
      if (_scrollController.position.pixels >
          _scrollController.position.maxScrollExtent - 200) {
        context.read<BranchListCubit>().loadMore();
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: BlocBuilder<BranchListCubit, BranchListState>(
          builder: (context, state) {
            final count = state is BranchListLoaded ? state.items.length : null;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  count == null ? 'Loading…' : '$count branches',
                  style: AppText.eyebrow(),
                ),
                Text('Branches', style: AppText.display(size: 18)),
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
                  onPressed: () => context.push(AppRoutes.branchForm),
                ),
              ),
            ),
          ),
        ],
      ),
      body: BlocBuilder<BranchListCubit, BranchListState>(
        builder: (context, state) {
          return switch (state) {
            BranchListLoading() => const AppLoadingView(),
            BranchListError(:final message) => AppErrorView(
                message: message,
                onRetry: () => context.read<BranchListCubit>().load(),
              ),
            BranchListLoaded(:final items) when items.isEmpty =>
              const AppEmptyState(
                icon: Icons.storefront_outlined,
                title: 'No branches yet',
                message: 'Tap + to add your first branch.',
              ),
            BranchListLoaded(:final items, :final loadingMore) =>
              RefreshIndicator(
                color: AppColors.staffB,
                backgroundColor: AppColors.surface2,
                onRefresh: () => context.read<BranchListCubit>().load(),
                child: ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                  itemCount: items.length + (loadingMore ? 1 : 0),
                  itemBuilder: (context, i) {
                    if (i >= items.length) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: 16),
                        child: Center(
                          child: CircularProgressIndicator(
                            color: AppColors.staffB,
                            strokeWidth: 2,
                          ),
                        ),
                      );
                    }
                    return _BranchCard(branch: items[i]);
                  },
                ),
              ),
          };
        },
      ),
    );
  }
}

class _BranchCard extends StatelessWidget {
  const _BranchCard({required this.branch});

  final Branch branch;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: () => context.push(AppRoutes.branchDetail, extra: branch.id),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      branch.name,
                      style: AppText.body(size: 15, weight: FontWeight.w700),
                    ),
                    if (branch.isDefault)
                      const AppPill(
                        label: 'Default',
                        tone: AppPillTone.roleTint,
                      )
                    else if (branch.isActive)
                      const AppPill(label: 'Active', tone: AppPillTone.success)
                    else
                      const AppPill(
                        label: 'Inactive',
                        tone: AppPillTone.danger,
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    branch.branchCode,
                    if (branch.city != null && branch.city!.isNotEmpty)
                      branch.city,
                    if (branch.capacity != null) 'cap. ${branch.capacity}',
                  ].join(' · '),
                  style: AppText.body(
                    size: 12,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
