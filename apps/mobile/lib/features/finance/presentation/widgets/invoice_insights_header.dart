import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/common/period_stats_cubit.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../models/invoice_analytics.dart';
import '../../../../shared/widgets/motion.dart';
import 'analytics_parts.dart';

typedef InvoiceStatsCubit = PeriodStatsCubit<InvoiceAnalytics>;

/// Receivables ageing colours, green (current) -> red (90+).
const _agingColors = [
  AppColors.success,
  Color(0xFFB4D84A),
  AppColors.warning,
  Color(0xFFFF8A4C),
  AppColors.danger,
];

Color _statusColor(String s) => switch (s) {
      'PAID' => AppColors.success,
      'PARTIALLY_PAID' => AppColors.warning,
      'UNPAID' => AppColors.staffB,
      'OVERDUE' => AppColors.danger,
      _ => AppColors.inkFaint,
    };

/// Compact phone version of the web Invoices insights. Driven by
/// [InvoiceStatsCubit]; every number is real `GET /invoices/analytics` data,
/// built from the shared blocks in `analytics_parts.dart` and the motion
/// helpers in `shared/widgets/motion.dart` (all skipped under
/// `MediaQuery.disableAnimations`).
///
/// Hidden completely without `finance:invoice-view` or on HTTP 403.
///
/// Invoiced / Collected / Collection rate / Avg invoice, the trend and the
/// status split follow the period chips; Outstanding, Overdue, the ageing
/// bars and top debtors are current-state receivables. Overdue uses the
/// warning colour whenever it is above zero. The branch block only shows
/// when the tenant has more than one branch.
///
/// Dropped vs web, and why:
///  * Status **donut** -> share bars with amounts: donut + legend don't fit
///    360px.
///  * Invoiced-per-day **column chart** -> the shared two-line trend
///    (this period vs previous) with the peak day printed.
///  * Ageing **stacked chart** -> five coloured bars.
///  * Branch **grouped-bar chart** -> a bar per branch (invoiced) with the
///    collected figure in the sub-line.
///  * Chart hover tooltips -> no hover on touch.
///  * Analytics branch filter -> tenant-wide here.
///  * Tappable debtor rows -> shown as plain rows (no member route is keyed
///    by the debtor's id on mobile staff screens).
///  * Invoice-count KPI -> folded into the Invoiced card sub-line.
class InvoiceInsightsHeader extends StatelessWidget {
  const InvoiceInsightsHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<InvoiceStatsCubit, PeriodStatsState<InvoiceAnalytics>>(
      builder: (context, state) {
        if (state is PeriodStatsForbidden<InvoiceAnalytics>) {
          return const SizedBox.shrink();
        }
        final cubit = context.read<InvoiceStatsCubit>();
        return Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Insights', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              AnalyticsPeriodChips(
                selected: state.period,
                onSelected: cubit.load,
              ),
              const SizedBox(height: 12),
              switch (state) {
                PeriodStatsLoading() => const AnalyticsLoading(),
                PeriodStatsError(:final message) => AnalyticsErrorBlock(
                    title: 'Insights unavailable',
                    message: message,
                    onRetry: cubit.load,
                  ),
                PeriodStatsLoaded(:final data) => _Loaded(
                    key: ValueKey('${data.range.from}_${data.range.to}'),
                    data: data,
                  ),
                PeriodStatsForbidden() => const SizedBox.shrink(),
              },
              const SizedBox(height: 4),
            ],
          ),
        );
      },
    );
  }
}

String _money(double v) => Formatters.currency(v);

class _Loaded extends StatelessWidget {
  const _Loaded({super.key, required this.data});

  final InvoiceAnalytics data;

  @override
  Widget build(BuildContext context) {
    final cards = [
      AnalyticsKpi(
        label: 'Invoiced',
        value: _money(data.invoiced.value),
        numeric: data.invoiced.value,
        formatNumeric: _money,
        delta: data.invoiced.deltaPercent,
        sub: '${data.count.value.round()} invoices',
      ),
      AnalyticsKpi(
        label: 'Collected',
        value: _money(data.collected.value),
        numeric: data.collected.value,
        formatNumeric: _money,
        delta: data.collected.deltaPercent,
        sub: 'vs ${_money(data.collected.previous)} before',
      ),
      AnalyticsKpi(
        label: 'Collection rate',
        value: pctText(data.collectionRate.value),
        numeric: data.collectionRate.value,
        formatNumeric: pctText,
        sub: 'vs ${pctText(data.collectionRate.previous)} before',
      ),
      AnalyticsKpi(
        label: 'Outstanding',
        value: _money(data.outstanding),
        numeric: data.outstanding,
        formatNumeric: _money,
        sub: '${data.outstandingInvoiceCount} invoices',
      ),
      AnalyticsKpi(
        label: 'Overdue',
        value: _money(data.overdue),
        numeric: data.overdue,
        formatNumeric: _money,
        valueColor: data.overdue > 0 ? AppColors.warning : null,
        sub: '${data.overdueCount} invoices',
      ),
      AnalyticsKpi(
        label: 'Avg invoice',
        value: _money(data.avgInvoice.value),
        numeric: data.avgInvoice.value,
        formatNumeric: _money,
        delta: data.avgInvoice.deltaPercent,
        sub: 'per invoice',
      ),
    ];

    var i = 0;
    Widget step(Widget w) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: StaggeredReveal(index: i++, child: w),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var r = 0; r < cards.length; r += 2)
          step(
            Row(
              children: [
                Expanded(child: cards[r]),
                const SizedBox(width: 10),
                Expanded(child: cards[r + 1]),
              ],
            ),
          ),
        step(_Trend(data: data)),
        step(_StatusBlock(items: data.byStatus)),
        step(_AgingBlock(items: data.aging)),
        step(_DebtorsBlock(items: data.topDebtors)),
        if (data.branches.length > 1) step(_BranchBlock(items: data.branches)),
      ],
    );
  }
}

class _Trend extends StatelessWidget {
  const _Trend({required this.data});

  final InvoiceAnalytics data;

  @override
  Widget build(BuildContext context) {
    final days = data.daily;
    final hasData = days.any((d) => d.invoiced > 0 || d.previousInvoiced > 0);
    InvoiceDay? peak;
    for (final d in days) {
      if (d.invoiced > 0 && (peak == null || d.invoiced > peak.invoiced)) {
        peak = d;
      }
    }
    return AnalyticsBlock(
      title: 'Invoiced over time',
      trailing: '${shortDate(data.range.from)} – ${shortDate(data.range.to)}',
      child: !hasData
          ? analyticsEmpty('No invoices in this period or the one before.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                WipeReveal(
                  child: SizedBox(
                    height: 110,
                    width: double.infinity,
                    child: CustomPaint(
                      painter: AnalyticsTrendPainter(
                        current: days.map((d) => d.invoiced).toList(),
                        previous: days.map((d) => d.previousInvoiced).toList(),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const AnalyticsDot(color: AppColors.staffB),
                    Text(
                      '  This period',
                      style: AppText.body(size: 11, color: AppColors.inkSoft),
                    ),
                    const SizedBox(width: 14),
                    const AnalyticsDot(color: AppColors.inkFaint),
                    Flexible(
                      child: Text(
                        '  Previous (${shortDate(data.previousRange.from)} – '
                        '${shortDate(data.previousRange.to)})',
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(size: 11, color: AppColors.inkSoft),
                      ),
                    ),
                  ],
                ),
                if (peak != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Peak day ${shortDate(peak.date)} · ${_money(peak.invoiced)}',
                    style: AppText.body(
                      size: 11,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}

class _StatusBlock extends StatelessWidget {
  const _StatusBlock({required this.items});

  final List<InvoiceStatusStat> items;

  @override
  Widget build(BuildContext context) {
    final total = items.fold<double>(0, (s, e) => s + e.amount);
    final totalCount = items.fold<int>(0, (s, e) => s + e.count);
    return AnalyticsBlock(
      title: 'By status',
      child: totalCount <= 0
          ? analyticsEmpty('No invoices in this period.')
          : Column(
              children: [
                for (final e in items)
                  AnalyticsBar(
                    animate: true,
                    color: _statusColor(e.status),
                    label: prettyEnum(e.status),
                    value: _money(e.amount),
                    fraction: total > 0 ? e.amount / total : 0,
                    sub: '${e.count} invoices'
                        '${total > 0 ? ' · ${pctText(e.amount / total)}' : ''}',
                  ),
              ],
            ),
    );
  }
}

class _AgingBlock extends StatelessWidget {
  const _AgingBlock({required this.items});

  final List<InvoiceAgingBucket> items;

  @override
  Widget build(BuildContext context) {
    var maxV = 0.0;
    for (final e in items) {
      if (e.amount > maxV) maxV = e.amount;
    }
    return AnalyticsBlock(
      title: 'Receivables ageing',
      trailing: 'days past due',
      child: maxV <= 0
          ? analyticsEmpty('Nothing outstanding.')
          : Column(
              children: [
                for (var i = 0; i < items.length; i++)
                  AnalyticsBar(
                    animate: true,
                    color: _agingColors[i.clamp(0, _agingColors.length - 1)],
                    label: items[i].bucket,
                    value: _money(items[i].amount),
                    fraction: items[i].amount / maxV,
                    sub: '${items[i].count} invoices',
                  ),
              ],
            ),
    );
  }
}

class _DebtorsBlock extends StatelessWidget {
  const _DebtorsBlock({required this.items});

  final List<InvoiceDebtor> items;

  @override
  Widget build(BuildContext context) {
    return AnalyticsBlock(
      title: 'Top debtors',
      child: items.isEmpty
          ? analyticsEmpty('No outstanding balances.')
          : Column(
              children: [
                for (final d in items)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                d.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 12.5,
                                  weight: FontWeight.w700,
                                ),
                              ),
                              Text(
                                '${d.memberCode} · ${d.invoiceCount} invoices',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 11,
                                  color: AppColors.inkFaint,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _money(d.outstanding),
                          style: AppText.tabular(
                            size: 12.5,
                            weight: FontWeight.w700,
                            color: AppColors.warning,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}

class _BranchBlock extends StatelessWidget {
  const _BranchBlock({required this.items});

  final List<InvoiceBranchStat> items;

  @override
  Widget build(BuildContext context) {
    var maxV = 0.0;
    for (final b in items) {
      if (b.invoiced > maxV) maxV = b.invoiced;
    }
    return AnalyticsBlock(
      title: 'Branch comparison',
      child: maxV <= 0
          ? analyticsEmpty('No branch figures in this period.')
          : Column(
              children: [
                for (final b in items)
                  AnalyticsBar(
                    animate: true,
                    label: b.name,
                    value: _money(b.invoiced),
                    fraction: b.invoiced / maxV,
                    sub: 'Collected ${_money(b.collected)}',
                  ),
              ],
            ),
    );
  }
}
