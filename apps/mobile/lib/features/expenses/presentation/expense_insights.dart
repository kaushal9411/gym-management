import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/ledger_analytics.dart';
import '../../income/presentation/income_charts.dart';
import '../../income/presentation/income_insights.dart';
import '../../income/presentation/income_ui.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'expense_ui.dart';

/// Web's analytics block on `/expenses`, in the same order: five KPI cards, the
/// "Expenses over time" chart + "Expenses by category" donut, then "Branch
/// comparison" + "Top expenses". All numbers come from
/// `GET /expenses/analytics`; the panels are inline cards (like web) rather
/// than bottom sheets. A drop is good news for expenses, so every delta's
/// colours are flipped (web's `goodWhenDown`).
///
/// The tiles / chart / donut are the same widgets Income uses (web shares one
/// set of ledger panels between the two pages).
///
/// **Dropped vs web**: chart hover tooltips (replaced by tap / drag
/// inspection on the trend chart) and the Recharts legend interactions.
class ExpenseAnalyticsSection extends StatelessWidget {
  const ExpenseAnalyticsSection({
    super.key,
    required this.data,
    required this.loading,
    required this.error,
    required this.compare,
    required this.period,
    required this.onRetry,
  });

  final LedgerAnalytics? data;
  final bool loading;
  final String? error;
  final bool compare;
  final IncomePeriod period;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final a = data;
    if (a == null) {
      if (error != null && !loading) {
        return _Unavailable(message: error!, onRetry: onRetry);
      }
      return const _Skeleton();
    }
    final vs = 'vs ${period.previousLabel.toLowerCase()}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ExpenseKpiStrip(analytics: a, compare: compare, vsLabel: vs),
        const SizedBox(height: 12),
        LedgerTwoUp(
          first: ExpenseTrendPanel(
            analytics: a,
            compare: compare,
            previousLabel: period.previousLabel,
          ),
          second: ExpenseCategoryPanel(analytics: a, compare: compare),
        ),
        const SizedBox(height: 12),
        LedgerTwoUp(
          first: ExpenseBranchPanel(analytics: a, compare: compare),
          second: ExpenseTopEntriesPanel(analytics: a),
        ),
      ],
    );
  }
}

class _Unavailable extends StatelessWidget {
  const _Unavailable({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          Text(
            'Expense analytics are unavailable right now — the list below '
            'still works.',
            textAlign: TextAlign.center,
            style: AppText.body(
              size: 12.5,
              color: AppColors.inkSoft,
              weight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            message,
            textAlign: TextAlign.center,
            style: AppText.body(size: 11.5, color: AppColors.inkFaint),
          ),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    Widget box(double h) => Container(
          height: h,
          decoration: BoxDecoration(
            color: AppColors.surface3,
            borderRadius: BorderRadius.circular(AppRadii.card),
          ),
        );
    return Column(
      key: const ValueKey('expense-analytics-loading'),
      children: [
        Row(
          children: [
            Expanded(child: box(120)),
            const SizedBox(width: 10),
            Expanded(child: box(120)),
          ],
        ),
        const SizedBox(height: 10),
        box(120),
        const SizedBox(height: 12),
        box(230),
      ],
    );
  }
}

// ── KPI strip ───────────────────────────────────────────────────────────────

/// Web's `LedgerKpiStrip` on the Expenses theme: Total expenses, Entries,
/// Average, Largest expense, Net profit — with a sparkline from `daily` on the
/// first three.
class ExpenseKpiStrip extends StatelessWidget {
  const ExpenseKpiStrip({
    super.key,
    required this.analytics,
    required this.compare,
    required this.vsLabel,
  });

  final LedgerAnalytics analytics;
  final bool compare;
  final String vsLabel;

  @override
  Widget build(BuildContext context) {
    final a = analytics;
    final k = a.kpis;
    final vs = compare ? vsLabel : null;
    final largest = k.largest;
    final net = k.netProfit.value;
    final tiles = <LedgerKpiTile>[
      LedgerKpiTile(
        key: const ValueKey('kpi-total'),
        label: 'Total expenses',
        icon: Icons.trending_down_rounded,
        color: kExpenseAccent,
        value: Text(money(k.total.value)),
        caption: compare
            ? IncomeDeltaText(
                pct: pctChange(k.total.value, k.total.previous),
                suffix: vs,
                goodWhenDown: true,
              )
            : null,
        spark: [for (final d in a.daily) d.total],
      ),
      LedgerKpiTile(
        key: const ValueKey('kpi-entries'),
        label: 'Entries',
        icon: Icons.tag_rounded,
        color: TeamColors.indigo,
        value: CountUp(
          value: k.count.value,
          style: AppText.display(size: 22, color: TeamColors.indigo),
        ),
        caption: compare
            ? IncomeDeltaText(
                pct: pctChange(k.count.value, k.count.previous),
                suffix: vs,
              )
            : null,
        spark: [for (final d in a.daily) d.count.toDouble()],
      ),
      LedgerKpiTile(
        key: const ValueKey('kpi-average'),
        label: 'Average',
        icon: Icons.bar_chart_rounded,
        color: TeamColors.violet,
        value: Text(money(k.average.value)),
        caption: compare
            ? IncomeDeltaText(
                pct: pctChange(k.average.value, k.average.previous),
                suffix: vs,
              )
            : null,
        spark: [
          for (final d in a.daily) d.count > 0 ? d.total / d.count : 0.0,
        ],
      ),
      LedgerKpiTile(
        key: const ValueKey('kpi-largest'),
        label: 'Largest expense',
        icon: Icons.workspace_premium_rounded,
        color: TeamColors.amber,
        value: Text(largest == null ? '—' : money(largest.value)),
        caption: Text(
          largest == null
              ? 'No expenses yet'
              : '${largest.description?.isNotEmpty == true ? largest.description! : expenseCategoryLabelOf(largest.category)}'
                  ' · ${shortDay(largest.date)}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppText.body(
            size: 11,
            color: AppColors.inkFaint,
            weight: FontWeight.w700,
          ),
        ),
      ),
      LedgerKpiTile(
        key: const ValueKey('kpi-net'),
        label: 'Net profit',
        icon: Icons.account_balance_wallet_rounded,
        color: net >= 0 ? TeamColors.green : TeamColors.rose,
        value: Text(money(net)),
        caption: compare
            ? IncomeDeltaText(
                pct: pctChange(net, k.netProfit.previous),
                suffix: vs,
              )
            : Text(
                'Income − expenses',
                style: AppText.body(
                  size: 11,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w700,
                ),
              ),
      ),
    ];
    return LayoutBuilder(
      builder: (context, c) {
        const gap = 10.0;
        final cols = c.maxWidth >= 900
            ? 5
            : c.maxWidth >= 560
                ? 3
                : 2;
        final w = (c.maxWidth - gap * (cols - 1)) / cols;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (var i = 0; i < tiles.length; i++)
              FadeUp(
                index: i,
                child: SizedBox(
                  width: cols == 2 && i == tiles.length - 1 ? c.maxWidth : w,
                  height: 128,
                  child: tiles[i],
                ),
              ),
          ],
        );
      },
    );
  }
}

// ── trend ───────────────────────────────────────────────────────────────────

class ExpenseTrendPanel extends StatefulWidget {
  const ExpenseTrendPanel({
    super.key,
    required this.analytics,
    required this.compare,
    required this.previousLabel,
  });

  final LedgerAnalytics analytics;
  final bool compare;
  final String previousLabel;

  @override
  State<ExpenseTrendPanel> createState() => _ExpenseTrendPanelState();
}

class _ExpenseTrendPanelState extends State<ExpenseTrendPanel> {
  IncomeTrendMode _mode = IncomeTrendMode.daily;

  @override
  Widget build(BuildContext context) {
    final a = widget.analytics;
    final empty = a.daily.every((d) => d.total == 0 && d.previousTotal == 0);
    final points = buildTrendSeries(a.daily, _mode);
    return TeamInsightCard(
      icon: Icons.show_chart_rounded,
      title: 'Expenses over time',
      color: kExpenseAccent,
      trailing: '${shortDay(a.range.from)} – ${shortDay(a.range.to)}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Recorded expenses, this period'
            '${widget.compare ? ' vs previous period' : ''}',
            style: AppText.body(
              size: 11.5,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final m in IncomeTrendMode.values)
                TeamFilterChip(
                  label: m.label,
                  selected: _mode == m,
                  color: kExpenseAccent,
                  onTap: () => setState(() => _mode = m),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (empty)
            const LedgerPanelEmpty('No expenses in this period yet.')
          else ...[
            Wrap(
              spacing: 16,
              runSpacing: 4,
              children: [
                LedgerLegendItem(
                  color: kExpenseAccent,
                  text: 'This period · ${money(a.kpis.total.value)}',
                ),
                if (widget.compare)
                  LedgerLegendItem(
                    color: AppColors.inkFaint,
                    dashed: true,
                    text: '${widget.previousLabel} · '
                        '${money(a.kpis.total.previous)}',
                  ),
              ],
            ),
            const SizedBox(height: 8),
            IncomeTrendChart(
              points: points,
              compare: widget.compare,
              color: kExpenseAccent,
              previousLabel: widget.previousLabel,
            ),
          ],
        ],
      ),
    );
  }
}

// ── category ────────────────────────────────────────────────────────────────

class ExpenseCategoryPanel extends StatelessWidget {
  const ExpenseCategoryPanel({
    super.key,
    required this.analytics,
    required this.compare,
  });

  final LedgerAnalytics analytics;
  final bool compare;

  @override
  Widget build(BuildContext context) {
    final rows = [...analytics.categories.where((c) => c.amount > 0)]
      ..sort((a, b) => b.amount.compareTo(a.amount));
    final total = rows.fold<double>(0, (s, c) => s + c.amount);
    return TeamInsightCard(
      icon: Icons.donut_large_rounded,
      title: 'Expenses by category',
      color: TeamColors.indigo,
      child: total <= 0
          ? const LedgerPanelEmpty('No expenses in this period yet.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Share of the period total',
                  style: AppText.body(
                    size: 11.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                Center(
                  child: IncomeDonut(
                    slices: [
                      for (final c in rows)
                        IncomeSlice(
                          value: c.amount,
                          color: expenseCategoryColorOf(c.category),
                        ),
                    ],
                    center: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'TOTAL',
                          style: AppText.body(
                            size: 10,
                            weight: FontWeight.w800,
                            color: AppColors.inkFaint,
                          ),
                        ),
                        Text(
                          Formatters.currencyCompact(total),
                          style: AppText.display(size: 16),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                for (final c in rows) ...[
                  _CategoryRow(category: c, total: total, compare: compare),
                  const SizedBox(height: 10),
                ],
              ],
            ),
    );
  }
}

class _CategoryRow extends StatelessWidget {
  const _CategoryRow({
    required this.category,
    required this.total,
    required this.compare,
  });

  final LedgerCategory category;
  final double total;
  final bool compare;

  @override
  Widget build(BuildContext context) {
    final color = expenseCategoryColorOf(category.category);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                expenseCategoryLabelOf(category.category),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(size: 12.5, weight: FontWeight.w700),
              ),
            ),
            Text(
              '${(category.amount / total * 100).round()}%',
              style: AppText.tabular(size: 12.5, weight: FontWeight.w800),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(left: 16, top: 2),
          child: Row(
            children: [
              Text(
                money(category.amount),
                style: AppText.tabular(
                  size: 11.5,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              if (compare)
                IncomeDeltaText(
                  pct: pctChange(category.amount, category.previousAmount),
                  goodWhenDown: true,
                ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── branches ────────────────────────────────────────────────────────────────

class ExpenseBranchPanel extends StatelessWidget {
  const ExpenseBranchPanel({
    super.key,
    required this.analytics,
    required this.compare,
  });

  final LedgerAnalytics analytics;
  final bool compare;

  @override
  Widget build(BuildContext context) {
    final branches = [...analytics.branches]
      ..sort((a, b) => b.total.compareTo(a.total));
    var max = 1.0;
    for (final b in branches) {
      if (b.total > max) max = b.total;
    }
    return TeamInsightCard(
      icon: Icons.storefront_rounded,
      title: 'Branch comparison',
      color: TeamColors.sky,
      child: branches.isEmpty
          ? const LedgerPanelEmpty('No branch expenses in this period yet.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  compare
                      ? 'Expenses and change vs previous period'
                      : 'Expenses by branch',
                  style: AppText.body(
                    size: 11.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                for (var i = 0; i < branches.length; i++) ...[
                  if (i > 0) const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          branches[i].name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 12.5,
                            weight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        money(branches[i].total),
                        style: AppText.tabular(
                          size: 12.5,
                          weight: FontWeight.w800,
                        ),
                      ),
                      if (compare) ...[
                        const SizedBox(width: 6),
                        IncomeDeltaText(
                          pct: pctChange(
                            branches[i].total,
                            branches[i].previousTotal,
                          ),
                          goodWhenDown: true,
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 5),
                  GrowBar(
                    ratio: branches[i].total / max,
                    height: 9,
                    track: AppColors.surface3,
                    colors: [
                      TeamColors.rotation[i % TeamColors.rotation.length],
                      TeamColors.rotation[i % TeamColors.rotation.length]
                          .withValues(alpha: 0.55),
                    ],
                  ),
                ],
              ],
            ),
    );
  }
}

// ── top entries ─────────────────────────────────────────────────────────────

class ExpenseTopEntriesPanel extends StatelessWidget {
  const ExpenseTopEntriesPanel({super.key, required this.analytics});

  final LedgerAnalytics analytics;

  @override
  Widget build(BuildContext context) {
    final entries = analytics.topEntries.take(5).toList();
    var max = 1.0;
    for (final e in entries) {
      if (e.amount > max) max = e.amount;
    }
    return TeamInsightCard(
      icon: Icons.emoji_events_rounded,
      title: 'Top expenses',
      color: TeamColors.amber,
      child: entries.isEmpty
          ? const LedgerPanelEmpty('No expenses in this period yet.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Largest entries in this period',
                  style: AppText.body(
                    size: 11.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                for (var i = 0; i < entries.length; i++) ...[
                  if (i > 0) const SizedBox(height: 12),
                  Row(
                    children: [
                      Container(
                        width: 24,
                        height: 24,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: AppColors.surface3,
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          '${i + 1}',
                          style: AppText.body(
                            size: 11.5,
                            weight: FontWeight.w800,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              entries[i].description?.isNotEmpty == true
                                  ? entries[i].description!
                                  : expenseCategoryLabelOf(entries[i].category),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.body(
                                size: 12.5,
                                weight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                IncomeTag(
                                  label: expenseCategoryLabelOf(
                                    entries[i].category,
                                  ),
                                  color: expenseCategoryColorOf(
                                    entries[i].category,
                                  ),
                                ),
                                Text(
                                  shortDay(entries[i].date),
                                  style: AppText.body(
                                    size: 11,
                                    color: AppColors.inkFaint,
                                    weight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        money(entries[i].amount),
                        style: AppText.tabular(
                          size: 13.5,
                          weight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 7),
                  Padding(
                    padding: const EdgeInsets.only(left: 34),
                    child: GrowBar(
                      ratio: entries[i].amount / max,
                      height: 6,
                      track: AppColors.surface3,
                      colors: [
                        kExpenseAccent,
                        kExpenseAccent.withValues(alpha: 0.55),
                      ],
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}
