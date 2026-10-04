import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/finance/ledger_analytics_cubit.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../models/ledger_analytics.dart';
import 'analytics_parts.dart';

/// Compact phone version of the web Income / Expenses analytics. Driven by
/// [LedgerAnalyticsCubit]; every number is real `GET /income|expenses/analytics`
/// data. Shares its building blocks with `PaymentsAnalyticsHeader`
/// (`analytics_parts.dart`).
///
/// Dropped vs web, and why:
///  * Category **donut** → ranked share bars with a delta vs the previous
///    period: a 6-8 slice donut + legend is unreadable at phone width.
///  * Branch comparison **grouped bar chart** → one row per branch (this
///    period bar + previous figure).
///  * Chart hover tooltips → no hover on touch; the chart shows the range
///    endpoints and the peak day instead.
///  * Branch filter → the endpoint supports `branchId`, but this screen is
///    tenant-wide (the Finance tab owns branch scoping).
///  * Top entries are not tappable — mobile has no income/expense detail
///    screen to open.
///  * Net profit is the same number on both screens (income − expenses over
///    the range); expense deltas are colour-inverted (spending up = bad).
class LedgerAnalyticsHeader extends StatelessWidget {
  const LedgerAnalyticsHeader({super.key, required this.kind});

  final LedgerKind kind;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<LedgerAnalyticsCubit, LedgerAnalyticsState>(
      builder: (context, state) {
        if (state is LedgerAnalyticsForbidden) return const SizedBox.shrink();
        final cubit = context.read<LedgerAnalyticsCubit>();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AnalyticsPeriodChips(
              selected: state.period,
              onSelected: cubit.load,
            ),
            const SizedBox(height: 12),
            switch (state) {
              LedgerAnalyticsLoading() => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 36),
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.staffB),
                  ),
                ),
              LedgerAnalyticsError(:final message) => AnalyticsBlock(
                  title: 'Analytics unavailable',
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          message,
                          style: AppText.body(
                            size: 12,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: cubit.load,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              LedgerAnalyticsLoaded(:final data) =>
                _Loaded(data: data, kind: kind),
              LedgerAnalyticsForbidden() => const SizedBox.shrink(),
            },
          ],
        );
      },
    );
  }
}

class _Loaded extends StatelessWidget {
  const _Loaded({required this.data, required this.kind});

  final LedgerAnalytics data;
  final LedgerKind kind;

  @override
  Widget build(BuildContext context) {
    final k = data.kpis;
    final isExpense = kind == LedgerKind.expense;
    final largest = k.largest;
    final cards = [
      AnalyticsKpi(
        label: 'Total ${kind.title.toLowerCase()}',
        value: Formatters.currencyCompact(k.total.value),
        delta: k.total.deltaPercent,
        invertDelta: isExpense,
        sub: 'vs ${Formatters.currencyCompact(k.total.previous)} before',
      ),
      AnalyticsKpi(
        label: 'Entries',
        value: '${k.count.value.toInt()}',
        delta: k.count.deltaPercent,
        invertDelta: isExpense,
        sub: 'vs ${k.count.previous.toInt()} before',
      ),
      AnalyticsKpi(
        label: 'Average',
        value: Formatters.currencyCompact(k.average.value),
        delta: k.average.deltaPercent,
        invertDelta: isExpense,
        sub: 'vs ${Formatters.currencyCompact(k.average.previous)} before',
      ),
      AnalyticsKpi(
        label: 'Largest',
        value:
            largest == null ? '—' : Formatters.currencyCompact(largest.value),
        sub: largest == null
            ? 'No entries'
            : (largest.description?.isNotEmpty == true
                ? largest.description!
                : kind.categoryLabel(largest.category)),
      ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < cards.length; i += 2)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: [
                Expanded(child: cards[i]),
                const SizedBox(width: 10),
                Expanded(child: cards[i + 1]),
              ],
            ),
          ),
        AnalyticsKpi(
          label: 'Net profit (income − expenses)',
          value: Formatters.currencyCompact(k.netProfit.value),
          delta: k.netProfit.deltaPercent,
          sub: 'vs ${Formatters.currencyCompact(k.netProfit.previous)} before',
        ),
        const SizedBox(height: 10),
        _TrendChart(data: data, kind: kind),
        const SizedBox(height: 10),
        _CategoryBlock(data: data, kind: kind),
        const SizedBox(height: 10),
        _BranchBlock(branches: data.branches),
        const SizedBox(height: 10),
        _TopEntriesBlock(entries: data.topEntries, kind: kind),
        const SizedBox(height: 14),
      ],
    );
  }
}

class _TrendChart extends StatelessWidget {
  const _TrendChart({required this.data, required this.kind});

  final LedgerAnalytics data;
  final LedgerKind kind;

  @override
  Widget build(BuildContext context) {
    final days = data.daily;
    final hasData = days.any((d) => d.total > 0 || d.previousTotal > 0);
    LedgerDay? peak;
    for (final d in days) {
      if (d.total > 0 && (peak == null || d.total > peak.total)) peak = d;
    }
    final noun = kind.title.toLowerCase();
    return AnalyticsBlock(
      title: '${kind.title} over time',
      trailing: '${shortDate(data.range.from)} – ${shortDate(data.range.to)}',
      child: !hasData
          ? analyticsEmpty('No $noun in this period or the one before.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  height: 110,
                  width: double.infinity,
                  child: CustomPaint(
                    painter: AnalyticsTrendPainter(
                      current: days.map((d) => d.total).toList(),
                      previous: days.map((d) => d.previousTotal).toList(),
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
                    'Peak day ${shortDate(peak.date)} · '
                    '${Formatters.currency(peak.total)}',
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

class _CategoryBlock extends StatelessWidget {
  const _CategoryBlock({required this.data, required this.kind});

  final LedgerAnalytics data;
  final LedgerKind kind;

  @override
  Widget build(BuildContext context) {
    final total = data.categories.fold<double>(0, (s, c) => s + c.amount);
    final sorted = [...data.categories]
      ..sort((a, b) => b.amount.compareTo(a.amount));
    return AnalyticsBlock(
      title: 'By category',
      child: total <= 0
          ? analyticsEmpty('No ${kind.title.toLowerCase()} in this period.')
          : Column(
              children: [
                for (final c in sorted)
                  AnalyticsBar(
                    label: kind.categoryLabel(c.category),
                    value: Formatters.currency(c.amount),
                    fraction: c.amount / total,
                    sub: '${pctText(c.amount / total)} · ${c.count} '
                        '${c.count == 1 ? 'entry' : 'entries'}'
                        '${c.deltaPercent == null ? '' : ' · ${c.deltaPercent! >= 0 ? '▲' : '▼'}${c.deltaPercent!.abs().toStringAsFixed(0)}% vs before'}',
                  ),
              ],
            ),
    );
  }
}

class _BranchBlock extends StatelessWidget {
  const _BranchBlock({required this.branches});

  final List<LedgerBranch> branches;

  @override
  Widget build(BuildContext context) {
    var maxV = 0.0;
    for (final b in branches) {
      if (b.total > maxV) maxV = b.total;
    }
    return AnalyticsBlock(
      title: 'Branch comparison',
      child: branches.isEmpty || maxV <= 0
          ? analyticsEmpty('No branch figures in this period.')
          : Column(
              children: [
                for (final b in branches)
                  AnalyticsBar(
                    label: b.name,
                    value: Formatters.currency(b.total),
                    fraction: b.total / maxV,
                    sub: 'Previous ${Formatters.currency(b.previousTotal)}',
                  ),
              ],
            ),
    );
  }
}

class _TopEntriesBlock extends StatelessWidget {
  const _TopEntriesBlock({required this.entries, required this.kind});

  final List<LedgerTopEntry> entries;
  final LedgerKind kind;

  @override
  Widget build(BuildContext context) {
    return AnalyticsBlock(
      title: 'Top entries',
      child: entries.isEmpty
          ? analyticsEmpty('No entries in this period.')
          : Column(
              children: [
                for (final e in entries)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                e.description?.isNotEmpty == true
                                    ? e.description!
                                    : kind.categoryLabel(e.category),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 12.5,
                                  weight: FontWeight.w700,
                                ),
                              ),
                              Text(
                                '${kind.categoryLabel(e.category)} · '
                                '${shortDate(e.date)}',
                                style: AppText.body(
                                  size: 10.5,
                                  color: AppColors.inkFaint,
                                  weight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          Formatters.currency(e.amount),
                          style: AppText.tabular(
                            size: 12.5,
                            weight: FontWeight.w800,
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
