import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/active_vs_inactive_row.dart';
import '../../../models/paginated_result.dart';
import '../../../repositories/reports_repository.dart';
import '../../../shared/widgets/motion.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'kit/kit.dart';
import 'people/people_report_page.dart';
import 'people/people_ui.dart';

/// `/reports/active-vs-inactive` — the report-type id (summary + list +
/// export). This is the report behind the Hub's "Active vs Inactive" tile
/// and `AppRoutes.churnReport` (there is no churn-rate-over-time endpoint).
const kChurnReportType = 'active-vs-inactive';

IconData _statusIcon(String status) => switch (status.toUpperCase()) {
      'ACTIVE' => Icons.check_circle_rounded,
      'FROZEN' => Icons.ac_unit_rounded,
      'EXPIRED' => Icons.event_busy_rounded,
      'SUSPENDED' => Icons.block_rounded,
      'INACTIVE' => Icons.pause_circle_rounded,
      _ => Icons.circle_outlined,
    };

/// Reports Center's "Active vs Inactive" — "Member count by status",
/// matching web's report: a point-in-time snapshot (branch scope only), the
/// summary (**Total members** + **Members by status** donut in status
/// colours) and one animated row per status with its count and share of all
/// members (largest first). `ChurnReportScreen` / `AppRoutes.churnReport`
/// keep their names. Export + Print: `PeopleReportPage`.
class ChurnReportScreen extends StatefulWidget {
  const ChurnReportScreen({super.key});

  @override
  State<ChurnReportScreen> createState() => _ChurnReportScreenState();
}

class _ChurnReportScreenState extends State<ChurnReportScreen> {
  /// Total members of the rows last fetched (rows are built after the fetch
  /// resolves, so the field is current by then).
  int _total = 0;

  @override
  Widget build(BuildContext context) {
    return PeopleReportPage<ActiveVsInactiveRow>(
      type: kChurnReportType,
      title: 'Active vs Inactive',
      subtitle: 'Member count by status',
      accent: RptAccent.members,
      noun: 'statuses',
      resultsTitle: 'By status',
      emptyTitle: 'No members yet',
      emptyMessage: 'Members will appear here once they join.',
      emptyIcon: Icons.pie_chart_outline_rounded,
      fetch: (q, page, limit) async {
        final rows = await getIt<ReportsRepository>()
            .activeVsInactive(branchId: q.branchId);
        final sorted = [...rows]..sort((a, b) => b.count.compareTo(a.count));
        _total = sorted.fold<int>(0, (s, r) => s + r.count);
        return PaginatedResult(
          items: sorted,
          total: sorted.length,
          page: 1,
          limit: sorted.length,
          totalPages: 1,
        );
      },
      itemBuilder: (context, row, i) =>
          _StatusCard(row: row, total: _total, index: i),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.row,
    required this.total,
    required this.index,
  });

  final ActiveVsInactiveRow row;
  final int total;
  final int index;

  @override
  Widget build(BuildContext context) {
    final color = peopleStatusColor(row.status);
    final share = total > 0 ? row.count / total : 0.0;
    final pct = share * 100;
    return RptReveal(
      index: index,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(_statusIcon(row.status), color: color, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        prettyEnum(row.status),
                        style: AppText.body(size: 14, weight: FontWeight.w800),
                      ),
                      Text(
                        '${pct.toStringAsFixed(pct >= 10 || pct == 0 ? 0 : 1)}% of members',
                        style: AppText.body(
                          size: 11.5,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ],
                  ),
                ),
                AnimatedNumber(
                  value: row.count.toDouble(),
                  format: (v) => rptGrouped(v),
                  style: AppText.display(size: 24, color: color),
                ),
              ],
            ),
            const SizedBox(height: 12),
            PeopleBar(value: share, color: color, height: 8),
          ],
        ),
      ),
    );
  }
}
