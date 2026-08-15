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
import '../../reports/presentation/widgets/donut_chart.dart';
import '../../reports/presentation/widgets/report_filter_bar.dart';
import 'widgets/revenue_expense_chart.dart';

const _methodColors = {
  'UPI': AppColors.staffB,
  'CASH': AppColors.success,
  'CREDIT_CARD': AppColors.staffA,
  'DEBIT_CARD': AppColors.staffA,
  'BANK_TRANSFER': AppColors.memberB,
  'CHEQUE': AppColors.warning,
  'ONLINE_GATEWAY': AppColors.memberA,
};

/// Design frame "5. Finance" — read-only financial overview: fixed-window
/// stat cards (today's/monthly income, monthly expenses, outstanding
/// billing, all from `GET /finance/summary`) plus three date-range +
/// branch filterable charts (income vs expenses, payment collection,
/// payment method mix), reusing the same `/analytics/*` and
/// `/reports/revenue` endpoints and `ReportFilterBar` widget the Reports
/// tab already uses. Deliberately no transaction list here — that's what
/// Manager's Menu → Money (Income/Expenses/Payments/Invoices screens)
/// already covers; this tab is aggregates and charts only.
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

  Future<void> _pickDateRange(
    BuildContext context,
    DateTimeRange current,
  ) async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      initialDateRange: current,
    );
    if (picked == null || !context.mounted) return;
    context.read<FinanceSummaryCubit>().filter(dateRange: picked);
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: () => context.read<FinanceSummaryCubit>().load(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 90),
        children: [
          Text('Overview', style: AppText.eyebrow()),
          Text('Finance', style: AppText.display(size: 22)),
          const SizedBox(height: 16),
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
                final FinanceSummaryLoaded loaded =>
                  _buildContent(context, loaded),
              };
            },
          ),
        ],
      ),
    );
  }

  Widget _buildContent(BuildContext context, FinanceSummaryLoaded state) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ReportFilterBar(
          branches: state.branches,
          selectedBranchId: state.selectedBranchId,
          onBranchChanged: (branchId) =>
              context.read<FinanceSummaryCubit>().filter(branchId: branchId),
          dateRange: state.dateRange,
          onDateRangeTap: () => _pickDateRange(context, state.dateRange),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _StatCard(
                label: "Today's income",
                value: state.summary.todayIncome,
                color: AppColors.success,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatCard(
                label: 'Monthly income',
                value: state.summary.monthlyIncome,
                color: AppColors.memberB,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _StatCard(
                label: 'Monthly expenses',
                value: state.summary.monthlyExpenses,
                color: AppColors.inkSoft,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _BillingCard(
                amount: state.summary.outstandingPayments,
                count: state.summary.outstandingInvoiceCount,
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
              Text('Income vs expenses', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              state.revenueTrend.isEmpty
                  ? const SizedBox(height: 80)
                  : RevenueExpenseChart(points: state.revenueTrend),
              const SizedBox(height: 8),
              _LegendRow(
                aLabel: 'Income',
                aColor: AppColors.staffPillFg,
                bLabel: 'Expenses',
                bColor: AppColors.inkFaint,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        GlassCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Payment collection', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              state.paymentTrend.isEmpty
                  ? const SizedBox(height: 80)
                  : RevenueExpenseChart(points: state.paymentTrend),
              const SizedBox(height: 8),
              _LegendRow(
                aLabel: 'Collected',
                aColor: AppColors.staffPillFg,
                bLabel: 'Invoiced',
                bColor: AppColors.inkFaint,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Payment methods', style: AppText.eyebrow()),
              const SizedBox(height: 12),
              state.methodBreakdown.isEmpty
                  ? Text(
                      'No payments recorded in this range.',
                      style: AppText.body(color: AppColors.inkFaint),
                    )
                  : DonutChart(
                      slices: state.methodBreakdown.entries
                          .map(
                            (e) => DonutSlice(
                              label: e.key,
                              value: e.value,
                              color: _methodColors[e.key] ?? AppColors.inkFaint,
                            ),
                          )
                          .toList(),
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
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final double value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppText.eyebrow()),
          const SizedBox(height: 4),
          Text(
            Formatters.currency(value),
            style: AppText.tabular(
              size: 18,
              color: color,
              weight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

/// The "Billing" figure the user asked for — outstanding invoices, same
/// window as the other summary cards (whatever `/finance/summary` returns
/// server-side, not affected by the date filter above).
class _BillingCard extends StatelessWidget {
  const _BillingCard({required this.amount, required this.count});

  final double amount;
  final int count;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Billing', style: AppText.eyebrow()),
          const SizedBox(height: 4),
          Text(
            Formatters.currency(amount),
            style: AppText.tabular(
              size: 18,
              color: AppColors.warning,
              weight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '$count outstanding invoice${count == 1 ? '' : 's'}',
            style: AppText.body(
              size: 11,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _LegendRow extends StatelessWidget {
  const _LegendRow({
    required this.aLabel,
    required this.aColor,
    required this.bLabel,
    required this.bColor,
  });

  final String aLabel;
  final Color aColor;
  final String bLabel;
  final Color bColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          '●  $aLabel',
          style: AppText.body(size: 11, weight: FontWeight.w800, color: aColor),
        ),
        const SizedBox(width: 14),
        Text(
          '- -  $bLabel',
          style: AppText.body(size: 11, weight: FontWeight.w800, color: bColor),
        ),
      ],
    );
  }
}
