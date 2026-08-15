import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/branch_option.dart';
import '../../../models/payment_report_row.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/reports_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../finance/presentation/payments_screen.dart'
    show paymentStatusTones;
import 'widgets/load_more_button.dart';
import 'widgets/report_filter_bar.dart';

const _statusFilters = [
  (label: 'All', value: null),
  (label: 'Success', value: 'SUCCESS'),
  (label: 'Pending', value: 'PENDING'),
  (label: 'Failed', value: 'FAILED'),
  (label: 'Refunded', value: 'REFUNDED'),
];

String _fmtIsoDate(String iso) {
  final parts = iso.split('-');
  return '${parts[2]}/${parts[1]}/${parts[0]}';
}

/// Reports Center's "Payment Report" — "Every payment, with status,"
/// matching web's report of the same name (`GET /reports/payments`). The
/// only one of the 12 reports that's inherently a per-transaction list
/// rather than a chart/summary — that's what "every payment" means.
class PaymentReportScreen extends StatefulWidget {
  const PaymentReportScreen({super.key});

  @override
  State<PaymentReportScreen> createState() => _PaymentReportScreenState();
}

class _PaymentReportScreenState extends State<PaymentReportScreen> {
  final _items = <PaymentReportRow>[];
  List<BranchOption> _branchOptions = [];
  String? _error;
  String? _branchId;
  String? _status;
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
      final result = await getIt<ReportsRepository>().payments(
        from: _range.start,
        to: _range.end,
        branchId: _branchId,
        paymentStatus: _status,
      );
      if (!mounted) return;
      setState(() {
        _items
          ..clear()
          ..addAll(result.items);
        _page = result.page;
        _total = result.total;
        _totalPages = result.totalPages;
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
      final result = await getIt<ReportsRepository>().payments(
        from: _range.start,
        to: _range.end,
        branchId: _branchId,
        paymentStatus: _status,
        page: _page + 1,
      );
      if (!mounted) return;
      setState(() {
        _items.addAll(result.items);
        _page = result.page;
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

  void _onStatusChanged(String? status) {
    setState(() => _status = status);
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
            Text('Every payment', style: AppText.eyebrow()),
            Text('Payment Report', style: AppText.display(size: 18)),
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
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final f in _statusFilters) ...[
                      _StatusChip(
                        label: f.label,
                        selected: _status == f.value,
                        onTap: () => _onStatusChanged(f.value),
                      ),
                      const SizedBox(width: 8),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _error != null && _items.isEmpty
                  ? AppErrorView(message: _error!, onRetry: _load)
                  : _loading
                      ? const AppLoadingView()
                      : _items.isEmpty
                          ? const AppEmptyState(
                              icon: Icons.receipt_long_outlined,
                              title: 'No payments found',
                              message: 'Try a different range or filter.',
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
                              itemCount:
                                  _items.length + (_page < _totalPages ? 1 : 0),
                              itemBuilder: (context, i) {
                                if (i == _items.length) {
                                  return LoadMoreButton(
                                    loading: _loadingMore,
                                    onPressed: _loadMore,
                                    shownCount: _items.length,
                                    totalCount: _total,
                                  );
                                }
                                return _PaymentRow(row: _items[i]);
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? AppColors.staffSoft : AppColors.surface3,
          borderRadius: BorderRadius.circular(AppRadii.pill),
          border: Border.all(
            color: selected ? AppColors.staffB : Colors.transparent,
          ),
        ),
        child: Text(
          label,
          style: AppText.body(
            size: 11,
            weight: FontWeight.w700,
            color: selected ? AppColors.staffPillFg : AppColors.inkSoft,
          ),
        ),
      ),
    );
  }
}

class _PaymentRow extends StatelessWidget {
  const _PaymentRow({required this.row});

  final PaymentReportRow row;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.name,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  '${row.paymentNumber} · ${row.memberCode} · ${row.branch}',
                  style: AppText.body(size: 11, color: AppColors.inkFaint),
                ),
                const SizedBox(height: 4),
                Text(
                  '${_fmtIsoDate(row.paymentDate)} · '
                  '${row.method.replaceAll('_', ' ')}',
                  style: AppText.body(
                    size: 11,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                Formatters.currency(row.finalAmount),
                style: AppText.tabular(size: 14, weight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              AppPill(
                label: row.status.replaceAll('_', ' '),
                tone: paymentStatusTones[row.status] ?? AppPillTone.neutral,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
