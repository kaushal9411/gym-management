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
import '../../../core/utils/formatters.dart';
import '../../../models/income_entry.dart';
import '../../../repositories/income_repository.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "5a. Income".
class IncomeListScreen extends StatelessWidget {
  const IncomeListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<IncomeEntry>>(
      create: (_) => PaginatedListCubit<IncomeEntry>(
        (page) => getIt<IncomeRepository>().list(page: page),
      )..load(),
      child: const _IncomeListView(),
    );
  }
}

class _IncomeListView extends StatelessWidget {
  const _IncomeListView();

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
            Text('This month', style: AppText.eyebrow()),
            Text('Income', style: AppText.display(size: 18)),
          ],
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
                        context.read<PaginatedListCubit<IncomeEntry>>();
                    context
                        .push(AppRoutes.incomeForm)
                        .then((_) => cubit.load());
                  },
                ),
              ),
            ),
          ),
        ],
      ),
      body: BlocBuilder<PaginatedListCubit<IncomeEntry>,
          PaginatedListState<IncomeEntry>>(
        builder: (context, state) {
          return switch (state) {
            PaginatedListLoading() => const AppLoadingView(),
            PaginatedListError(:final message) => AppErrorView(
                message: message,
                onRetry: () =>
                    context.read<PaginatedListCubit<IncomeEntry>>().load(),
              ),
            PaginatedListLoaded(:final items) when items.isEmpty =>
              const AppEmptyState(
                icon: Icons.payments_outlined,
                title: 'No income recorded yet',
                message: 'Tap + to record your first income entry.',
              ),
            PaginatedListLoaded(:final items) => RefreshIndicator(
                color: AppColors.staffB,
                backgroundColor: AppColors.surface2,
                onRefresh: () =>
                    context.read<PaginatedListCubit<IncomeEntry>>().load(),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                  itemCount: items.length,
                  itemBuilder: (context, i) => _IncomeCard(entry: items[i]),
                ),
              ),
          };
        },
      ),
    );
  }
}

class _IncomeCard extends StatelessWidget {
  const _IncomeCard({required this.entry});

  final IncomeEntry entry;

  @override
  Widget build(BuildContext context) {
    return Container(
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
                  entry.description?.isNotEmpty == true
                      ? entry.description!
                      : entry.category.label,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  '${entry.category.label} · ${entry.incomeDate.day}/${entry.incomeDate.month}/${entry.incomeDate.year}',
                  style: AppText.body(
                    size: 11,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Text(
            Formatters.currency(entry.amount),
            style: AppText.tabular(
              size: 14,
              weight: FontWeight.w800,
              color: AppColors.memberB,
            ),
          ),
        ],
      ),
    );
  }
}
