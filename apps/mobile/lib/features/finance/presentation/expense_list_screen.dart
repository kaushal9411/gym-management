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
import '../../../models/expense_entry.dart';
import '../../../repositories/expense_repository.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "5c. Expenses".
class ExpenseListScreen extends StatelessWidget {
  const ExpenseListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<ExpenseEntry>>(
      create: (_) => PaginatedListCubit<ExpenseEntry>(
        (page) => getIt<ExpenseRepository>().list(page: page),
      )..load(),
      child: const _ExpenseListView(),
    );
  }
}

class _ExpenseListView extends StatelessWidget {
  const _ExpenseListView();

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
            Text('Expenses', style: AppText.display(size: 18)),
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
                        context.read<PaginatedListCubit<ExpenseEntry>>();
                    context
                        .push(AppRoutes.expenseForm)
                        .then((_) => cubit.load());
                  },
                ),
              ),
            ),
          ),
        ],
      ),
      body: BlocBuilder<PaginatedListCubit<ExpenseEntry>,
          PaginatedListState<ExpenseEntry>>(
        builder: (context, state) {
          return switch (state) {
            PaginatedListLoading() => const AppLoadingView(),
            PaginatedListError(:final message) => AppErrorView(
                message: message,
                onRetry: () =>
                    context.read<PaginatedListCubit<ExpenseEntry>>().load(),
              ),
            PaginatedListLoaded(:final items) when items.isEmpty =>
              const AppEmptyState(
                icon: Icons.receipt_long_outlined,
                title: 'No expenses recorded yet',
                message: 'Tap + to record your first expense.',
              ),
            PaginatedListLoaded(:final items) => RefreshIndicator(
                color: AppColors.staffB,
                backgroundColor: AppColors.surface2,
                onRefresh: () =>
                    context.read<PaginatedListCubit<ExpenseEntry>>().load(),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                  itemCount: items.length,
                  itemBuilder: (context, i) => _ExpenseCard(entry: items[i]),
                ),
              ),
          };
        },
      ),
    );
  }
}

class _ExpenseCard extends StatelessWidget {
  const _ExpenseCard({required this.entry});

  final ExpenseEntry entry;

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
                  '${entry.category.label} · ${entry.expenseDate.day}/${entry.expenseDate.month}/${entry.expenseDate.year}',
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
            style: AppText.tabular(size: 14, weight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}
