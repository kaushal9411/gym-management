import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/member_payment.dart' show paymentMethodLabel;
import '../../../models/report_summary.dart';
import '../../../models/revenue_report_row.dart';
import '../../../repositories/reports_repository.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../finance/presentation/payments_ui.dart' show PayColors;
import 'finance/fin_report_parts.dart';
import 'finance/fin_report_state.dart';
import 'finance/revenue_branch_panel.dart';
import 'kit/kit.dart';

/// Report type id (`GET /reports/revenue`, `/reports/revenue/summary`, the
/// export endpoint `GET /reports/revenue/export`).
const kRevenueReportType = 'revenue';

/// Reports Center's "Revenue Report" — successful payments over time, built
/// on the report kit like web's `ReportViewer`:
///
///  * hero chips = the first three summary KPIs (web builds its hero stats
///    the same way), falling back to the period total / result count;
///  * [RptPeriodBar] (period, custom range <= 366 days, branch, compare);
///  * `GET /reports/revenue/summary` via [RptSummaryPanel]: KPIs (Total
///    revenue / Payments / Average payment with deltas), "Daily revenue"
///    trend (Daily / Cumulative, dashed previous period) and the "Revenue by
///    method" donut;
///  * "Revenue by branch" ([RevenueBranchPanel], kept from the old screen);
///  * the result rows (web's table: date, branch, method, amount) as cards
///    with Load more and a detail sheet.
///
/// Export: the hero "Export" pill + the results-header icon (CSV / Excel / PDF
/// / Print, `reports:export`) via `exportSpec`, with the period + branch the
/// screen shows. Dropped vs web: the table's numbered pagination (Load more
/// instead).
///
/// Permissions are unchanged: route/tile gating lives in the Reports hub
/// (`reports:view`); the summary hides itself without `reports:view` / on a
/// 403; the branch block needs `analytics:view` and falls back on a 403.
class RevenueReportScreen extends StatefulWidget {
  const RevenueReportScreen({super.key});

  @override
  State<RevenueReportScreen> createState() => _RevenueReportScreenState();
}

class _RevenueReportScreenState extends State<RevenueReportScreen>
    with FinReportState<RevenueReportScreen, RevenueReportRow> {
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
  Future<FinPage<RevenueReportRow>> fetchPage(int page) async {
    final d = rangeDates;
    final r = await getIt<ReportsRepository>().revenue(
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
            icon: Icons.payments_rounded,
            label: '${Formatters.currencyCompact(rows.totalAmount!)} · Revenue',
          ),
        if (!rows.loading && rows.error == null)
          ListHeroChip(
            icon: Icons.receipt_long_rounded,
            label: '${rows.total} results',
          ),
      ];

  void _open(RevenueReportRow r) {
    final color = PayColors.method(r.method);
    showFinDetailSheet(
      context,
      icon: finMethodIcon(r.method),
      title: paymentMethodLabel(r.method),
      subtitle: finDate(r.date),
      color: color,
      amount: Formatters.currency(r.amount),
      rows: [
        ('Date', finDate(r.date)),
        ('Branch', r.branch),
        ('Method', paymentMethodLabel(r.method)),
        ('Amount', Formatters.currency(r.amount)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final ready = controls.rangeReady;
    final range = controls.range;
    return RptViewerScaffold<RevenueReportRow>(
      title: 'Revenue Report',
      subtitle: 'Successful payments over time',
      heroChips: finHeroChips(_summary, _fallbackChips),
      filters: RptPeriodBar(controller: controls, accent: RptColors.green),
      summary: ready
          ? RptSummaryPanel(
              key: ValueKey('revenue-summary-$refreshTick'),
              type: kRevenueReportType,
              filters: finSummaryFilters(controls),
              accent: RptAccent.finance,
              compare: controls.compare,
              labelFor: finBreakdownLabel,
              colorFor: finBreakdownColor,
              onLoaded: (s) {
                if (mounted) setState(() => _summary = s);
              },
            )
          : null,
      panels: [
        if (ready)
          RptPanel(
            RevenueBranchPanel(
              key: ValueKey('revenue-branches-$refreshTick'),
              from: range.from,
              to: range.to,
            ),
            full: true,
          ),
      ],
      resultsTitle: 'Payments received',
      exportSpec: RptExportSpec(
        reportType: kRevenueReportType,
        title: 'Revenue Report',
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
      emptyTitle: 'No revenue in this period',
      emptyMessage: ready
          ? 'Try a wider period or another branch.'
          : 'Pick a valid date range (start before end, up to 366 days).',
      emptyIcon: Icons.payments_outlined,
      itemBuilder: (context, r, i) => FinRowCard(
        index: i,
        color: PayColors.method(r.method),
        icon: finMethodIcon(r.method),
        title: paymentMethodLabel(r.method),
        subtitle: finDate(r.date),
        caption: r.branch,
        amount: Formatters.currency(r.amount),
        amountColor: RptColors.green,
        tags: [
          finTag(paymentMethodLabel(r.method), PayColors.method(r.method)),
          finTag(r.branch, RptColors.sky, icon: Icons.storefront_rounded),
        ],
        onTap: () => _open(r),
      ),
    );
  }
}
