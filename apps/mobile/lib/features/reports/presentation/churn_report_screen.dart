import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/active_vs_inactive_row.dart';
import '../../../models/branch_option.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/reports_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'widgets/donut_chart.dart';
import 'widgets/report_filter_bar.dart';

const _statusColors = {
  'ACTIVE': AppColors.success,
  'INACTIVE': AppColors.danger,
  'FROZEN': AppColors.warning,
  'EXPIRED': AppColors.inkFaint,
};

/// The Reports Center's "Churn" tile has no detail mockup and the backend
/// has no true churn-rate-over-time endpoint — this shows the real data
/// that's closest to it, `GET /reports/active-vs-inactive` (a point-in-time
/// member status split), titled honestly rather than dressed up as churn.
/// Branch-filterable only, same reasoning as Staff Performance.
class ChurnReportScreen extends StatefulWidget {
  const ChurnReportScreen({super.key});

  @override
  State<ChurnReportScreen> createState() => _ChurnReportScreenState();
}

class _ChurnReportScreenState extends State<ChurnReportScreen> {
  List<ActiveVsInactiveRow>? _rows;
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
          .activeVsInactive(branchId: _branchId);
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
            Text('Point-in-time snapshot', style: AppText.eyebrow()),
            Text('Active vs Inactive', style: AppText.display(size: 18)),
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
                      : _buildContent(_rows!),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(List<ActiveVsInactiveRow> rows) {
    final withCounts = rows.where((r) => r.count > 0).toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        AppCard(
          child: withCounts.isEmpty
              ? Text(
                  'No members yet.',
                  style: AppText.body(color: AppColors.inkFaint),
                )
              : DonutChart(
                  slices: withCounts
                      .map(
                        (r) => DonutSlice(
                          label: r.status,
                          value: r.count,
                          color: _statusColors[r.status] ?? AppColors.inkFaint,
                        ),
                      )
                      .toList(),
                ),
        ),
      ],
    );
  }
}
