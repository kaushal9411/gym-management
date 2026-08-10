import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/trend_point.dart';
import '../../../repositories/analytics_repository.dart';
import '../../../repositories/branch_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'widgets/report_filter_bar.dart';
import 'widgets/simple_bar_chart.dart';

/// Design frame "9c. Attendance report" — daily check-ins, filterable by
/// date range + branch. The design's "Peak hours" card is dropped: no
/// hour-of-day aggregation endpoint exists to back it honestly.
class AttendanceReportScreen extends StatefulWidget {
  const AttendanceReportScreen({super.key});

  @override
  State<AttendanceReportScreen> createState() => _AttendanceReportScreenState();
}

class _AttendanceReportScreenState extends State<AttendanceReportScreen> {
  List<TrendPoint>? _trend;
  List<BranchOption> _branchOptions = [];
  String? _error;

  DateTimeRange _range = DateTimeRange(
    start: DateTime.now().subtract(const Duration(days: 6)),
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
      // Non-fatal — filter bar just shows "All branches" only.
    }
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final trend = await getIt<AnalyticsRepository>().attendanceTrends(
        from: _range.start,
        to: _range.end,
        branchId: _branchId,
      );
      if (!mounted) return;
      setState(() => _trend = trend);
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
            Text('Attendance Report', style: AppText.display(size: 18)),
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
                  : _trend == null
                      ? const AppLoadingView()
                      : _buildContent(_trend!),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(List<TrendPoint> trend) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        GlassCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Daily check-ins', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              if (trend.isEmpty)
                Text(
                  'No data for this range.',
                  style: AppText.body(color: AppColors.inkFaint),
                )
              else
                SimpleBarChart(
                  data: trend
                      .map(
                        (p) => BarDatum(
                          label: p.date.substring(8, 10),
                          value: p.value,
                        ),
                      )
                      .toList(),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
