import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/finance/finance_summary_cubit.dart';
import '../../../bloc/finance/finance_summary_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'widgets/revenue_expense_chart.dart';

/// Design frame "5. Finance".
class FinanceTab extends StatelessWidget {
  const FinanceTab({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<FinanceSummaryCubit>(
      create: (_) => getIt<FinanceSummaryCubit>()..load(),
      child: const _FinanceTabView(),
    );
  }
}

class _FinanceTabView extends StatelessWidget {
  const _FinanceTabView();

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: () => context.read<FinanceSummaryCubit>().load(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 90),
        children: [
          Text('This month', style: AppText.eyebrow()),
          Text('Finance', style: AppText.display(size: 22)),
          const SizedBox(height: 18),
          BlocBuilder<FinanceSummaryCubit, FinanceSummaryState>(
            builder: (context, state) {
              return switch (state) {
                FinanceSummaryLoading() => const Padding(
                    padding: EdgeInsets.only(top: 60),
                    child: AppLoadingView(),
                  ),
                FinanceSummaryError(:final message) => Padding(
                    padding: const EdgeInsets.only(top: 40),
                    child: AppErrorView(
                      message: message,
                      onRetry: () => context.read<FinanceSummaryCubit>().load(),
                    ),
                  ),
                FinanceSummaryLoaded(:final summary) => Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: AppCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Revenue', style: AppText.eyebrow()),
                                  const SizedBox(height: 4),
                                  Text(
                                    Formatters.currency(summary.monthlyIncome),
                                    style: AppText.tabular(
                                      size: 22,
                                      color: AppColors.memberB,
                                      weight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: AppCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Expenses', style: AppText.eyebrow()),
                                  const SizedBox(height: 4),
                                  Text(
                                    Formatters.currency(
                                      summary.monthlyExpenses,
                                    ),
                                    style: AppText.tabular(size: 22),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      GlassCard(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Revenue vs expenses',
                              style: AppText.eyebrow(),
                            ),
                            const SizedBox(height: 10),
                            summary.revenueTrend.isEmpty
                                ? const SizedBox(height: 80)
                                : RevenueExpenseChart(
                                    points: summary.revenueTrend,
                                  ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Text(
                                  '●  Revenue',
                                  style: AppText.body(
                                    size: 11,
                                    weight: FontWeight.w800,
                                    color: AppColors.staffPillFg,
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Text(
                                  '- -  Expenses',
                                  style: AppText.body(
                                    size: 11,
                                    weight: FontWeight.w800,
                                    color: AppColors.inkFaint,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      AppButton(
                        label: 'Record payment',
                        onPressed: () => context.push(AppRoutes.recordPayment),
                      ),
                    ],
                  ),
              };
            },
          ),
        ],
      ),
    );
  }
}
