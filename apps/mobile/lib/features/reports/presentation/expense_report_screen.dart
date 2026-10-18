import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/expense_entry.dart';
import '../../../models/expense_report_row.dart';
import '../../../models/report_summary.dart';
import '../../../repositories/reports_repository.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../expenses/presentation/expense_ui.dart'
    show expenseCategoryColor, expenseCategoryIcon, kExpenseAccent;
import 'finance/fin_report_parts.dart';
import 'finance/fin_report_state.dart';
import 'kit/kit.dart';

/// Report type id (`GET /reports/expenses`, `/reports/expenses/summary`, the
/// export endpoint `GET /reports/expenses/export`).
const kExpenseReportType = 'expenses';

/// Reports Center's "Expense Report" — recorded expenses over time, on the
/// report kit like web's `ReportViewer`:
///
///  * hero chips = the first three summary KPIs, falling back to the period
///    total / result count (rose, the expenses colour);
///  * [RptPeriodBar] (period, custom range <= 366 days, branch, compare);
///  * `GET /reports/expenses/summary` via [RptSummaryPanel] with every delta
///    colour-inverted (lower spend is good): KPIs (Total expenses / Expense
///    entries / Average expense), "Daily expenses" trend (Daily / Cumulative,
///    dashed previous period) and the "Expenses by category" ranked bars with
///    previous-period ticks. The category chart now covers the WHOLE period
///    (it used to be a client-side tally of the first page);
///  * the result rows (web's table: date, branch, category, amount,
///    description) as cards with Load more and a detail sheet.
///
/// Export: the hero "Export" pill + the results-header icon (CSV / Excel / PDF
/// / Print, `reports:export`) via `exportSpec`, with the period + branch the
/// screen shows. Dropped vs web: numbered pagination.
/// Permissions unchanged (hub tile `reports:view`; summary hides itself
/// without it / on 403).
class ExpenseReportScreen extends StatefulWidget {
  const ExpenseReportScreen({super.key});

  @override
  State<ExpenseReportScreen> createState() => _ExpenseReportScreenState();
}

class _ExpenseReportScreenState extends State<ExpenseReportScreen>
    with FinReportState<ExpenseReportScreen, ExpenseReportRow> {
  ReportSummary? _summary;

  @override
  void initState() {
    super.initState();
    initFin();
  }

  @override
  void dispose() {
    disposeFin();
    super.dispose();
  }

  @override
  Future<FinPage<ExpenseReportRow>> fetchPage(int page) async {
    final d = rangeDates;
    final r = await getIt<ReportsRepository>().expenses(
      from: d.from,
      to: d.to,
      branchId: controls.branchId,
      page: page,
    );
    return FinPage(
      items: r.page.items,
      page: r.page.page,
      total: r.page.total,
      totalPages: r.page.totalPages,
      totalAmount: r.totalAmount,
    );
  }

  List<Widget> get _fallbackChips => [
        if (rows.totalAmount != null)
          ListHeroChip(
            icon: Icons.south_west_rounded,
            label: '${Formatters.currencyCompact(rows.totalAmount!)} · Spent',
          ),
        if (!rows.loading && rows.error == null)
          ListHeroChip(
            icon: Icons.receipt_long_rounded,
            label: '${rows.total} results',
          ),
      ];

  static String _title(ExpenseReportRow r) => r.description?.isNotEmpty == true
      ? r.description!
      : ExpenseCategoryX.fromApi(r.category).label;

  void _open(ExpenseReportRow r) {
    final cat = ExpenseCategoryX.fromApi(r.category);
    final color = expenseCategoryColor(cat);
    showFinDetailSheet(
      context,
      icon: expenseCategoryIcon(cat),
      title: cat.label,
      subtitle: finDate(r.date),
      color: color,
      amount: Formatters.currency(r.amount),
      tags: [
        finTag(cat.label, color),
        finTag(r.branch, RptColors.sky, icon: Icons.storefront_rounded),
      ],
      rows: [
        ('Date', finDate(r.date)),
        ('Branch', r.branch),
        ('Category', cat.label),
        ('Amount', Formatters.currency(r.amount)),
        ('Description', r.description ?? ''),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final ready = controls.rangeReady;
    return RptViewerScaffold<ExpenseReportRow>(
      title: 'Expense Report',
      subtitle: 'Recorded expenses over time',
      heroChips: finHeroChips(_summary, _fallbackChips),
      filters: RptPeriodBar(controller: controls, accent: kExpenseAccent),
      summary: ready
          ? RptSummaryPanel(
              key: ValueKey('expense-summary-$refreshTick'),
              type: kExpenseReportType,
              filters: finSummaryFilters(controls),
              accent: RptAccent.finance,
              tint: kExpenseAccent,
              compare: controls.compare,
              invertDeltas: true,
              labelFor: finBreakdownLabel,
              colorFor: finBreakdownColor,
              onLoaded: (s) {
                if (mounted) setState(() => _summary = s);
              },
            )
          : null,
      resultsTitle: 'Expenses',
      exportSpec: RptExportSpec(
        reportType: kExpenseReportType,
        title: 'Expense Report',
        filters: () => finSummaryFilters(controls),
        enabled: ready,
      ),
      items: rows.items,
      total: rows.total,
      loading: rows.loading,
      error: rows.error,
      onRetry: () => rows.reload(),
      hasMore: rows.hasMore,
      loadingMore: rows.loadingMore,
      onLoadMore: rows.more,
      onRefresh: refreshAll,
      emptyTitle: 'No expenses in this period',
      emptyMessage: ready
          ? 'Try a wider period or another branch.'
          : 'Pick a valid date range (start before end, up to 366 days).',
      emptyIcon: Icons.receipt_long_outlined,
      itemBuilder: (context, r, i) {
        final cat = ExpenseCategoryX.fromApi(r.category);
        final color = expenseCategoryColor(cat);
        return FinRowCard(
          index: i,
          color: color,
          icon: expenseCategoryIcon(cat),
          title: _title(r),
          subtitle: finDate(r.date),
          amount: Formatters.currency(r.amount),
          amountColor: kExpenseAccent,
          tags: [
            finTag(cat.label, color),
            finTag(r.branch, RptColors.sky, icon: Icons.storefront_rounded),
          ],
          onTap: () => _open(r),
        );
      },
    );
  }
}
