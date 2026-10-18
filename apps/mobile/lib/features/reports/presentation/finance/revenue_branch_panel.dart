import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/branch_comparison_row.dart';
import '../../../../repositories/analytics_repository.dart';
import '../../../../repositories/reports_repository.dart';
import '../kit/kit.dart';

/// "Revenue by branch" on the Revenue report: ranked bars of every branch's
/// revenue for the SELECTED range, plus members / visits per branch.
///
/// Kept from the pre-redesign screen (web's revenue report has no such
/// panel, but mobile always had it): `GET /analytics/branch-comparison`
/// (date-aware, perm `analytics:view`); a 403 falls back to the month-to-date
/// `GET /reports/branch-performance` figures so the block never fails just
/// for a missing permission. Tenant-wide on purpose — the block compares
/// branches, so the screen's branch filter does not narrow it.
class RevenueBranchPanel extends StatefulWidget {
  const RevenueBranchPanel({super.key, required this.from, required this.to});

  /// Local `YYYY-MM-DD` days.
  final String from;
  final String to;

  @override
  State<RevenueBranchPanel> createState() => _RevenueBranchPanelState();
}

class _RevenueBranchPanelState extends State<RevenueBranchPanel> {
  List<BranchComparisonRow>? _rows;
  bool _monthToDate = false;
  bool _loading = true;
  String? _error;
  int _gen = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void didUpdateWidget(RevenueBranchPanel old) {
    super.didUpdateWidget(old);
    if (old.from != widget.from || old.to != widget.to) unawaited(_load());
  }

  Future<void> _load() async {
    final gen = ++_gen;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      var monthToDate = false;
      List<BranchComparisonRow> rows;
      try {
        rows = await getIt<AnalyticsRepository>().branchComparison(
          from: DateTime.parse(widget.from),
          to: DateTime.parse(widget.to),
        );
      } on ApiException catch (e) {
        if (e.statusCode != 403) rethrow;
        monthToDate = true;
        final perf = await getIt<ReportsRepository>().branchPerformance();
        rows = [
          for (final r in perf)
            BranchComparisonRow(
              branchId: r.branchId,
              branch: r.branch,
              members: r.activeMembers,
              revenue: r.monthlyRevenue,
              attendance: r.monthlyAttendance,
            ),
        ];
      }
      if (!mounted || gen != _gen) return;
      setState(() {
        _rows = rows;
        _monthToDate = monthToDate;
      });
    } on ApiException catch (e) {
      if (!mounted || gen != _gen) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted || gen != _gen) return;
      setState(() => _error = 'Could not load branch revenue.');
    } finally {
      if (mounted && gen == _gen) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _rows ?? const <BranchComparisonRow>[];
    return RptChartCard(
      title: 'Revenue by branch',
      subtitle: _monthToDate ? 'Month to date' : 'Selected period',
      icon: Icons.storefront_rounded,
      color: RptColors.sky,
      loading: _loading && _rows == null,
      error: _error != null && _rows == null,
      errorText: _error ?? 'Could not load branch revenue.',
      onRetry: () => unawaited(_load()),
      empty: !_loading && _error == null && rows.isEmpty,
      emptyText: 'No branch data yet.',
      minHeight: 160,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          RptHBarChart(
            rankBadges: true,
            limit: 8,
            color: RptColors.sky,
            format: RptFormat.money,
            data: [
              for (final b in rows)
                RptHBarDatum(label: b.branch, value: b.revenue),
            ],
          ),
          const SizedBox(height: 10),
          for (final b in rows)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      b.branch,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 12.5,
                        weight: FontWeight.w800,
                        color: AppColors.inkSoft,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  RptStatPill(
                    value: rptGrouped(b.members.toDouble()),
                    label: 'Members',
                    icon: Icons.groups_rounded,
                    color: RptColors.indigo,
                  ),
                  const SizedBox(width: 6),
                  RptStatPill(
                    value: rptGrouped(b.attendance.toDouble()),
                    label: 'Visits',
                    icon: Icons.login_rounded,
                    color: RptColors.teal,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
