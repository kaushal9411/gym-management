import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/branch_option.dart';
import '../../../models/expense_report_row.dart';
import '../../../repositories/analytics_repository.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/reports_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../owner/presentation/widgets/trend_chart.dart';
import 'widgets/donut_chart.dart';
import 'widgets/load_more_button.dart';
import 'widgets/report_filter_bar.dart';

const _categoryColors = [
  AppColors.staffB,
  AppColors.warning,
  AppColors.danger,
  AppColors.success,
  AppColors.memberB,
  AppColors.staffA,
  AppColors.memberA,
  AppColors.inkFaint,
];

String _fmtIsoDate(String iso) {
  final parts = iso.split('-');
  return '${parts[2]}/${parts[1]}/${parts[0]}';
}

/// Reports Center's "Expense Report" — "Recorded expenses over time,"
/// matching web's report of the same name. The trend chart pulls the
/// accurate full-period `expenses` series from
/// `GET /analytics/revenue-trends` (already used by Finance/Dashboard);
/// the category donut is a best-effort client aggregation of the fetched
/// page from `GET /reports/expenses` (same "recent sample" caveat as the
/// Analytics screen's payment-method donut), and the real period total
/// comes from that same endpoint's `totalAmount`.
class ExpenseReportScreen extends StatefulWidget {
  const ExpenseReportScreen({super.key});

  @override
  State<ExpenseReportScreen> createState() => _ExpenseReportScreenState();
}

class _ExpenseReportScreenState extends State<ExpenseReportScreen> {
  List<double>? _trendValues;
  List<String>? _trendLabels;
  final _items = <ExpenseReportRow>[];
  double _totalAmount = 0;
  List<BranchOption> _branchOptions = [];
  String? _error;
  String? _branchId;
  bool _loading = true;
  bool _loadingMore = false;
  int _page = 1;
  int _total = 0;
  int _totalPages = 1;

  DateTimeRange _range = DateTimeRange(
    start: DateTime.now().subtract(const Duration(days: 29)),
    end: DateTime.now(),
  );

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
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final trendFuture = getIt<AnalyticsRepository>().revenueTrends(
        from: _range.start,
        to: _range.end,
        branchId: _branchId,
      );
      final pageFuture = getIt<ReportsRepository>().expenses(
        from: _range.start,
        to: _range.end,
        branchId: _branchId,
      );
      final trend = await trendFuture;
      final result = await pageFuture;
      if (!mounted) return;
      setState(() {
        _trendValues = trend.map((p) => p.expenses).toList();
        _trendLabels = trend.map((p) => p.date.substring(5)).toList();
        _items
          ..clear()
          ..addAll(result.page.items);
        _totalAmount = result.totalAmount;
        _page = result.page.page;
        _total = result.page.total;
        _totalPages = result.page.totalPages;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    setState(() => _loadingMore = true);
    try {
      final result = await getIt<ReportsRepository>().expenses(
        from: _range.start,
        to: _range.end,
        branchId: _branchId,
        page: _page + 1,
      );
      if (!mounted) return;
      setState(() {
        _items.addAll(result.page.items);
        _page = result.page.page;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _loadingMore = false);
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

  Map<String, double> get _byCategory {
    final totals = <String, double>{};
    for (final row in _items) {
      totals[row.category] = (totals[row.category] ?? 0) + row.amount;
    }
    return totals;
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
            Text('Recorded expenses over time', style: AppText.eyebrow()),
            Text('Expense Report', style: AppText.display(size: 18)),
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
                  : _loading
                      ? const AppLoadingView()
                      : _buildContent(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    final byCategory = _byCategory;
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Total this period', style: AppText.eyebrow()),
              const SizedBox(height: 4),
              Text(
                Formatters.currency(_totalAmount),
                style: AppText.tabular(
                  size: 24,
                  weight: FontWeight.w700,
                  color: AppColors.warning,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        GlassCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Daily expenses', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              TrendChart(
                values: _trendValues ?? const [],
                dateLabels: _trendLabels ?? const [],
                color: AppColors.warning,
                type: TrendChartType.bar,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('By category', style: AppText.eyebrow()),
              const SizedBox(height: 12),
              if (byCategory.isEmpty)
                Text(
                  'No expenses recorded in this range.',
                  style: AppText.body(color: AppColors.inkFaint),
                )
              else
                DonutChart(
                  slices: [
                    for (final entry
                        in byCategory.entries.toList()
                          ..sort((a, b) => b.value.compareTo(a.value)))
                      DonutSlice(
                        label: entry.key.replaceAll('_', ' '),
                        value: entry.value,
                        color: _categoryColors[
                            byCategory.keys.toList().indexOf(entry.key) %
                                _categoryColors.length],
                      ),
                  ],
                ),
            ],
          ),
        ),
        if (_items.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('Recent expenses', style: AppText.eyebrow()),
          const SizedBox(height: 10),
          for (final row in _items) ...[
            _ExpenseRow(row: row),
            const SizedBox(height: 8),
          ],
          if (_page < _totalPages)
            LoadMoreButton(
              loading: _loadingMore,
              onPressed: _loadMore,
              shownCount: _items.length,
              totalCount: _total,
            ),
        ],
      ],
    );
  }
}

class _ExpenseRow extends StatelessWidget {
  const _ExpenseRow({required this.row});

  final ExpenseReportRow row;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.description?.isNotEmpty == true
                      ? row.description!
                      : row.category.replaceAll('_', ' '),
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  '${row.category.replaceAll('_', ' ')} · '
                  '${_fmtIsoDate(row.date)} · ${row.branch}',
                  style: AppText.body(size: 11, color: AppColors.inkFaint),
                ),
              ],
            ),
          ),
          Text(
            Formatters.currency(row.amount),
            style: AppText.tabular(size: 14, weight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
