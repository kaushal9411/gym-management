import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/branch_option.dart';
import '../../../models/branch_performance_row.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/reports_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'widgets/report_filter_bar.dart';

/// Reports Center's "Branch Performance" — "Members, revenue, and
/// attendance per branch," matching web's report of the same name
/// (`GET /reports/branch-performance`). Point-in-time (this month's
/// revenue/attendance) — no date-range filter on web either.
class BranchPerformanceScreen extends StatefulWidget {
  const BranchPerformanceScreen({super.key});

  @override
  State<BranchPerformanceScreen> createState() =>
      _BranchPerformanceScreenState();
}

class _BranchPerformanceScreenState extends State<BranchPerformanceScreen> {
  List<BranchPerformanceRow>? _rows;
  List<BranchOption> _branchOptions = [];
  String? _error;
  String? _branchId;

  @override
  void initState() {
    super.initState();
    _loadBranchOptions();
    _load();
  }

  Future<void> _loadBranchOptions() async {
    try {
      final options = await getIt<BranchRepository>().assignable();
      if (!mounted) return;
      setState(() => _branchOptions = options);
    } on ApiException {
      // Non-fatal — filter bar just shows "All branches" only.
    }
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final rows = await getIt<ReportsRepository>()
          .branchPerformance(branchId: _branchId);
      if (!mounted) return;
      setState(() => _rows = rows);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  void _onBranchChanged(String? branchId) {
    setState(() => _branchId = branchId);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('This month, per branch', style: AppText.eyebrow()),
            Text('Branch Performance', style: AppText.display(size: 18)),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 8),
              child: ReportFilterBar(
                branches: _branchOptions,
                selectedBranchId: _branchId,
                onBranchChanged: _onBranchChanged,
              ),
            ),
            Expanded(
              child: _error != null
                  ? AppErrorView(message: _error!, onRetry: _load)
                  : _rows == null
                      ? const AppLoadingView()
                      : _rows!.isEmpty
                          ? const AppEmptyState(
                              icon: Icons.storefront_outlined,
                              title: 'No branches found',
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                              itemCount: _rows!.length,
                              itemBuilder: (context, i) =>
                                  _BranchCard(row: _rows![i]),
                            ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BranchCard extends StatelessWidget {
  const _BranchCard({required this.row});

  final BranchPerformanceRow row;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.staffSoft,
                    borderRadius: BorderRadius.circular(AppRadii.tile),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.storefront_rounded,
                    size: 18,
                    color: AppColors.staffPillFg,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    row.branch,
                    style: AppText.body(size: 14, weight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: _Stat(
                    icon: Icons.groups_rounded,
                    label: 'Members',
                    value: '${row.activeMembers}/${row.totalMembers}',
                    color: AppColors.staffPillFg,
                  ),
                ),
                Expanded(
                  child: _Stat(
                    icon: Icons.payments_rounded,
                    label: 'Revenue',
                    value: Formatters.currencyCompact(row.monthlyRevenue),
                    color: AppColors.success,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _Stat(
                    icon: Icons.check_circle_outline_rounded,
                    label: 'Visits',
                    value: '${row.monthlyAttendance}',
                    color: AppColors.memberB,
                  ),
                ),
                Expanded(
                  child: _Stat(
                    icon: Icons.badge_outlined,
                    label: 'Staff',
                    value: '${row.staffCount}',
                    color: AppColors.warning,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 15, color: color),
        const SizedBox(width: 6),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: AppText.tabular(
                size: 14,
                weight: FontWeight.w800,
                color: color,
              ),
            ),
            Text(
              label,
              style: AppText.body(size: 10, color: AppColors.inkFaint),
            ),
          ],
        ),
      ],
    );
  }
}
