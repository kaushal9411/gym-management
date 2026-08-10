import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/branch_option.dart';
import '../../../models/branch_performance_row.dart';
import '../../../models/revenue_trend_point.dart';
import '../../../repositories/analytics_repository.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/reports_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../owner/presentation/widgets/revenue_sparkline.dart';
import 'widgets/report_filter_bar.dart';

/// Design frame "9a. Revenue report" — 30-day trend (filterable by date
/// range + branch) + per-branch breakdown (`/reports/branch-performance`,
/// always all-branch — filtering that list down to one branch would just
/// show one row). "Export CSV" isn't wired to a real download (would need
/// `share_plus`/file-write support not yet in the app) — omitted rather than faked.
class RevenueReportScreen extends StatefulWidget {
  const RevenueReportScreen({super.key});

  @override
  State<RevenueReportScreen> createState() => _RevenueReportScreenState();
}

class _RevenueReportScreenState extends State<RevenueReportScreen> {
  List<RevenueTrendPoint>? _trend;
  List<BranchPerformanceRow>? _branchBreakdown;
  List<BranchOption> _branchOptions = [];
  String? _error;

  DateTimeRange _range = DateTimeRange(
    start: DateTime.now().subtract(const Duration(days: 29)),
    end: DateTime.now(),
  );
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
      // Filter bar just shows "All branches" only — not worth blocking the whole screen for this.
    }
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final trendFuture = getIt<AnalyticsRepository>().revenueTrends(
        from: _range.start,
        to: _range.end,
        branchId: _branchId,
      );
      final branchesFuture = getIt<ReportsRepository>().branchPerformance();
      final trend = await trendFuture;
      final branches = await branchesFuture;
      if (!mounted) return;
      setState(() {
        _trend = trend;
        _branchBreakdown = branches;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _pickDateRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      initialDateRange: _range,
    );
    if (picked == null) return;
    setState(() => _range = picked);
    _load();
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
            Text('Filtered', style: AppText.eyebrow()),
            Text('Revenue Report', style: AppText.display(size: 18)),
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
                dateRange: _range,
                onDateRangeTap: _pickDateRange,
              ),
            ),
            Expanded(
              child: _error != null
                  ? AppErrorView(message: _error!, onRetry: _load)
                  : _trend == null || _branchBreakdown == null
                      ? const AppLoadingView()
                      : _buildContent(_trend!, _branchBreakdown!),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(
    List<RevenueTrendPoint> trend,
    List<BranchPerformanceRow> branches,
  ) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        GlassCard(
          padding: const EdgeInsets.all(16),
          child: trend.isEmpty
              ? const SizedBox(height: 90)
              : RevenueSparkline(points: trend),
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('By branch', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              if (branches.isEmpty)
                Text(
                  'No branch data yet.',
                  style: AppText.body(color: AppColors.inkFaint),
                )
              else
                ...branches.map(
                  (b) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          b.branch,
                          style:
                              AppText.body(size: 13, weight: FontWeight.w700),
                        ),
                        Text(
                          Formatters.currency(b.monthlyRevenue),
                          style: AppText.tabular(
                            size: 13,
                            weight: FontWeight.w700,
                            color: AppColors.success,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
