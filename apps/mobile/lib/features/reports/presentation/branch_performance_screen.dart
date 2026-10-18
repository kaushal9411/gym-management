import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/branch_performance_row.dart';
import '../../../models/report_summary.dart';
import '../../../repositories/reports_repository.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../../shared/widgets/motion.dart';
import 'finance/fin_report_parts.dart';
import 'finance/fin_report_state.dart';
import 'kit/kit.dart';

/// Report type id (`GET /reports/branch-performance`,
/// `/reports/branch-performance/summary`, the export endpoint
/// `GET /reports/branch-performance/export`).
const kBranchPerformanceReportType = 'branch-performance';

/// Reports Center's "Branch Performance" — members, revenue and attendance
/// per branch, on the report kit like web's `ReportViewer`. A point-in-time
/// report (this month's revenue / attendance; web has no date range for it
/// either), so the filter bar is the branch-only [RptPeriodBar].
///
///  * hero chips = the first three summary KPIs (Branches / Total revenue /
///    Total members), falling back to the branch count / revenue total;
///  * `GET /reports/branch-performance/summary` via [RptSummaryPanel]: the
///    three KPIs and the "Revenue per branch" ranked bars;
///  * the result rows (web's table: branch, total / active members, monthly
///    revenue, monthly attendance, staff), richest branch first, as cards: a
///    rank badge, an animated active-members ring, revenue-share bar and
///    stat tiles, with a detail sheet. The endpoint is not paginated.
///
/// Export: the hero "Export" pill + the results-header icon (CSV / Excel / PDF
/// / Print, `reports:export`) via `exportSpec`, scoped to the branch filter.
/// Permissions unchanged (hub tile `reports:view`; summary hides itself
/// without it / on 403).
class BranchPerformanceScreen extends StatefulWidget {
  const BranchPerformanceScreen({super.key});

  @override
  State<BranchPerformanceScreen> createState() =>
      _BranchPerformanceScreenState();
}

class _BranchPerformanceScreenState extends State<BranchPerformanceScreen>
    with FinReportState<BranchPerformanceScreen, BranchPerformanceRow> {
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
  Future<FinPage<BranchPerformanceRow>> fetchPage(int page) async {
    final list = await getIt<ReportsRepository>()
        .branchPerformance(branchId: controls.branchId);
    final sorted = [...list]
      ..sort((a, b) => b.monthlyRevenue.compareTo(a.monthlyRevenue));
    return FinPage(
      items: sorted,
      page: 1,
      total: sorted.length,
      totalPages: 1,
    );
  }

  double get _totalRevenue =>
      rows.items.fold(0, (s, r) => s + r.monthlyRevenue);

  List<Widget> get _fallbackChips => [
        if (!rows.loading && rows.error == null) ...[
          ListHeroChip(
            icon: Icons.storefront_rounded,
            label: '${rows.total} branches',
          ),
          ListHeroChip(
            icon: Icons.payments_rounded,
            label: '${Formatters.currencyCompact(_totalRevenue)} · Revenue',
          ),
        ],
      ];

  void _open(BranchPerformanceRow r, int rank) {
    showFinDetailSheet(
      context,
      icon: Icons.storefront_rounded,
      title: r.branch,
      subtitle: 'Rank #$rank by revenue · this month',
      color: RptColors.sky,
      amount: Formatters.currency(r.monthlyRevenue),
      rows: [
        ('Branch', r.branch),
        ('Total members', rptGrouped(r.totalMembers.toDouble())),
        ('Active members', rptGrouped(r.activeMembers.toDouble())),
        ('Monthly revenue', Formatters.currency(r.monthlyRevenue)),
        ('Monthly attendance', rptGrouped(r.monthlyAttendance.toDouble())),
        ('Staff', rptGrouped(r.staffCount.toDouble())),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final total = _totalRevenue;
    return RptViewerScaffold<BranchPerformanceRow>(
      title: 'Branch Performance',
      subtitle: 'Members, revenue and attendance per branch',
      heroChips: finHeroChips(_summary, _fallbackChips),
      filters: RptPeriodBar(
        controller: controls,
        showPeriod: false,
        showCompare: false,
        accent: RptColors.sky,
      ),
      summary: RptSummaryPanel(
        key: ValueKey('branch-summary-$refreshTick'),
        type: kBranchPerformanceReportType,
        filters: ReportSummaryFilters(branchId: controls.branchId),
        accent: RptAccent.operations,
        compare: false,
        onLoaded: (s) {
          if (mounted) setState(() => _summary = s);
        },
      ),
      resultsTitle: 'Branches',
      exportSpec: RptExportSpec(
        reportType: kBranchPerformanceReportType,
        title: 'Branch Performance',
        filters: () => ReportSummaryFilters(branchId: controls.branchId),
      ),
      items: rows.items,
      total: rows.total,
      loading: rows.loading,
      error: rows.error,
      onRetry: () => rows.reload(),
      onRefresh: refreshAll,
      emptyTitle: 'No branches found',
      emptyIcon: Icons.storefront_outlined,
      itemBuilder: (context, r, i) => _BranchCard(
        row: r,
        rank: i + 1,
        revenueShare: total <= 0 ? 0 : r.monthlyRevenue / total,
        onTap: () => _open(r, i + 1),
      ),
    );
  }
}

class _BranchCard extends StatelessWidget {
  const _BranchCard({
    required this.row,
    required this.rank,
    required this.revenueShare,
    required this.onTap,
  });

  final BranchPerformanceRow row;
  final int rank;

  /// 0..1 share of the listed branches' revenue.
  final double revenueShare;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final active = row.totalMembers <= 0
        ? 0.0
        : (row.activeMembers / row.totalMembers).clamp(0.0, 1.0);
    Widget tile(IconData icon, String value, String label, Color color) =>
        Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, size: 14, color: color),
                const SizedBox(height: 4),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    value,
                    style: AppText.tabular(
                      size: 14,
                      weight: FontWeight.w800,
                      color: color,
                    ),
                  ),
                ),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 10.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        );
    return RptReveal(
      index: (rank - 1).clamp(0, 6),
      child: Material(
        color: AppColors.surface2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.card),
          side: BorderSide(color: AppColors.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: rank == 1
                              ? const [RptColors.amber, RptColors.rose]
                              : const [RptColors.sky, RptColors.indigo],
                        ),
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '$rank',
                        style: AppText.display(size: 13, color: Colors.white),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        row.branch,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style:
                            AppText.body(size: 14.5, weight: FontWeight.w800),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      Formatters.currencyCompact(row.monthlyRevenue),
                      style: AppText.tabular(
                        size: 15,
                        weight: FontWeight.w800,
                        color: RptColors.green,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    RptRadialGauge(
                      value: active * 100,
                      size: 70,
                      thickness: 8,
                      color: RptColors.teal,
                      label: 'Active',
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${rptGrouped(row.activeMembers.toDouble())} of '
                            '${rptGrouped(row.totalMembers.toDouble())} members active',
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w700,
                              color: AppColors.inkSoft,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Share of revenue · '
                            '${rptFormatValue(RptFormat.percent, revenueShare * 100)}',
                            style: AppText.body(
                              size: 11,
                              weight: FontWeight.w700,
                              color: AppColors.inkFaint,
                            ),
                          ),
                          const SizedBox(height: 5),
                          AnimatedFraction(
                            fraction: revenueShare.clamp(0.0, 1.0),
                            builder: (context, v) => ClipRRect(
                              borderRadius: BorderRadius.circular(99),
                              child: LinearProgressIndicator(
                                value: v,
                                minHeight: 7,
                                backgroundColor: RptColors.track,
                                valueColor: const AlwaysStoppedAnimation(
                                  RptColors.green,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    tile(
                      Icons.groups_rounded,
                      rptGrouped(row.totalMembers.toDouble()),
                      'Members',
                      RptColors.indigo,
                    ),
                    const SizedBox(width: 8),
                    tile(
                      Icons.login_rounded,
                      rptGrouped(row.monthlyAttendance.toDouble()),
                      'Visits',
                      RptColors.violet,
                    ),
                    const SizedBox(width: 8),
                    tile(
                      Icons.badge_outlined,
                      rptGrouped(row.staffCount.toDouble()),
                      'Staff',
                      RptColors.amber,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
