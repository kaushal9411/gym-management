import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../repositories/analytics_repository.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/reports_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'widgets/donut_chart.dart';
import 'widgets/report_filter_bar.dart';
import 'widgets/simple_bar_chart.dart';

const _monthLabels = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov',
  'Dec', // ignore: prefer_const_declarations
];
const _methodColors = {
  'UPI': AppColors.staffB,
  'CASH': AppColors.success,
  'CREDIT_CARD': AppColors.staffA,
  'DEBIT_CARD': AppColors.staffA,
  'BANK_TRANSFER': AppColors.memberB,
  'CHEQUE': AppColors.warning,
  'ONLINE_GATEWAY': AppColors.memberA,
};

/// Design frame "10. Analytics" — new-member growth (aggregated from daily
/// points into 6 monthly buckets, client-side) + revenue-by-method donut
/// (see `ReportsRepository.revenueByMethod` for its sampling caveat).
/// Branch-filterable; the 6-month window itself is fixed (the monthly
/// bucketing logic below assumes it) rather than also date-range-filterable.
class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  List<BarDatum>? _monthlyNewMembers;
  Map<String, double>? _byMethod;
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
      final to = DateTime.now();
      final from = DateTime(to.year, to.month - 5, 1);
      final growthFuture = getIt<AnalyticsRepository>()
          .newMemberGrowth(from: from, to: to, branchId: _branchId);
      final methodFuture = getIt<ReportsRepository>()
          .revenueByMethod(from: from, to: to, branchId: _branchId);

      final growth = await growthFuture;
      final byMonth = <String, int>{};
      for (var i = 0; i < 6; i++) {
        final m = DateTime(from.year, from.month + i, 1);
        byMonth['${m.year}-${m.month.toString().padLeft(2, '0')}'] = 0;
      }
      for (final point in growth) {
        final key = point.date.substring(0, 7);
        if (byMonth.containsKey(key)) {
          byMonth[key] = byMonth[key]! + point.value;
        }
      }
      final bars = byMonth.entries.map((e) {
        final month = int.parse(e.key.split('-')[1]);
        return BarDatum(label: _monthLabels[month - 1], value: e.value);
      }).toList();

      final byMethod = await methodFuture;
      if (!mounted) return;
      setState(() {
        _monthlyNewMembers = bars;
        _byMethod = byMethod;
      });
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
            Text('Last 6 months', style: AppText.eyebrow()),
            Text('Analytics', style: AppText.display(size: 18)),
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
                  : _monthlyNewMembers == null || _byMethod == null
                      ? const AppLoadingView()
                      : _buildContent(_monthlyNewMembers!, _byMethod!),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(
    List<BarDatum> monthlyNewMembers,
    Map<String, double> byMethod,
  ) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        GlassCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('New members / month', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              SimpleBarChart(data: monthlyNewMembers),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Revenue by payment method', style: AppText.eyebrow()),
              const SizedBox(height: 12),
              if (byMethod.isEmpty)
                Text(
                  'No payments recorded yet.',
                  style: AppText.body(color: AppColors.inkFaint),
                )
              else
                DonutChart(
                  slices: byMethod.entries
                      .map(
                        (e) => DonutSlice(
                          label: e.key,
                          value: e.value,
                          color: _methodColors[e.key] ?? AppColors.inkFaint,
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
