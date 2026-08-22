import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/attendance_summary.dart';
import '../../../models/branch_option.dart';
import '../../../repositories/attendance_repository.dart';
import '../../../repositories/branch_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'widgets/load_more_button.dart';
import 'widgets/report_filter_bar.dart';

const _statusFilters = [
  (label: 'All', value: null),
  (label: 'Inside', value: 'CHECKED_IN'),
  (label: 'Checked out', value: 'CHECKED_OUT'),
];

String _fmtDateTime(DateTime d) => '${d.day.toString().padLeft(2, '0')}/'
    '${d.month.toString().padLeft(2, '0')}/${d.year}, '
    '${d.hour.toString().padLeft(2, '0')}:'
    '${d.minute.toString().padLeft(2, '0')}';

String _fmtTime(DateTime d) => '${d.hour.toString().padLeft(2, '0')}:'
    '${d.minute.toString().padLeft(2, '0')}';

String _methodLabel(String? method) => switch (method) {
      'MANUAL' => 'Manual',
      'QR_CODE' => 'QR code',
      'BIOMETRIC' => 'Biometric',
      'FACE_RECOGNITION' => 'Face recognition',
      'NFC' => 'NFC',
      'RFID' => 'RFID',
      _ => 'Unknown',
    };

/// Owner Menu's "Attendance History" — matching web's `/attendance/history`
/// (`GET /attendance`): tenant-wide, filterable by search, branch, status,
/// and date range. Read-only — web's row Edit/Delete actions and CSV/Excel
/// export aren't built here (no file-saving package in this app, same
/// documented limitation as every other report screen's "Export" omission).
class AttendanceHistoryScreen extends StatefulWidget {
  const AttendanceHistoryScreen({super.key});

  @override
  State<AttendanceHistoryScreen> createState() =>
      _AttendanceHistoryScreenState();
}

class _AttendanceHistoryScreenState extends State<AttendanceHistoryScreen> {
  final _searchController = TextEditingController();
  final _items = <AttendanceRecord>[];
  List<BranchOption> _branchOptions = [];
  String? _error;
  String? _branchId;
  String? _status;
  Timer? _debounce;
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

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
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
      final result = await getIt<AttendanceRepository>().list(
        search: _searchController.text.trim(),
        branchId: _branchId,
        status: _status,
        dateFrom: _range.start,
        dateTo: _range.end,
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
      final result = await getIt<AttendanceRepository>().list(
        page: _page + 1,
        search: _searchController.text.trim(),
        branchId: _branchId,
        status: _status,
        dateFrom: _range.start,
        dateTo: _range.end,
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

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _load);
  }

  void _onBranchChanged(String? branchId) {
    setState(() => _branchId = branchId);
    _load();
  }

  void _onStatusChanged(String? status) {
    setState(() => _status = status);
    _load();
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
            Text('Tenant-wide', style: AppText.eyebrow()),
            Text('Attendance History', style: AppText.display(size: 18)),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: _searchController,
                    onChanged: _onSearchChanged,
                    style: AppText.body(size: 14, weight: FontWeight.w600),
                    decoration: InputDecoration(
                      hintText: 'Search member name or ID…',
                      hintStyle:
                          AppText.body(size: 14, color: AppColors.inkFaint),
                      prefixIcon: const Icon(
                        Icons.search_rounded,
                        color: AppColors.inkFaint,
                      ),
                      filled: true,
                      fillColor: AppColors.surface2,
                      contentPadding: const EdgeInsets.symmetric(vertical: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadii.field),
                        borderSide: const BorderSide(color: AppColors.line),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(AppRadii.field),
                        borderSide: const BorderSide(color: AppColors.line),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  ReportFilterBar(
                    branches: _branchOptions,
                    selectedBranchId: _branchId,
                    onBranchChanged: _onBranchChanged,
                    dateRange: _range,
                    onDateRangeTap: _pickDateRange,
                  ),
                  const SizedBox(height: 8),
                  Row(
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
                ],
              ),
            ),
            Expanded(
              child: _error != null && _items.isEmpty
                  ? AppErrorView(message: _error!, onRetry: _load)
                  : _loading
                      ? const AppLoadingView()
                      : _items.isEmpty
                          ? const AppEmptyState(
                              icon: Icons.event_busy_rounded,
                              title: 'No visits found',
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
                                return _HistoryRow(record: _items[i]);
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

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.record});

  final AttendanceRecord record;

  @override
  Widget build(BuildContext context) {
    final checkedIn = record.status == 'CHECKED_IN';
    final checkOut = record.checkOutTime;
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
                  record.memberName,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  '${record.memberCode ?? '—'} · '
                  '${record.branchName ?? 'Unknown branch'}',
                  style: AppText.body(size: 11, color: AppColors.inkFaint),
                ),
                const SizedBox(height: 4),
                Text(
                  checkOut == null
                      ? _fmtDateTime(record.checkInTime)
                      : '${_fmtDateTime(record.checkInTime)} – '
                          '${_fmtTime(checkOut)}',
                  style: AppText.body(
                    size: 11,
                    weight: FontWeight.w600,
                    color: AppColors.inkSoft,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _methodLabel(record.method),
                  style: AppText.body(size: 11, color: AppColors.inkFaint),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          AppPill(
            label: checkedIn ? 'Inside' : 'Checked out',
            tone: checkedIn ? AppPillTone.warning : AppPillTone.success,
          ),
        ],
      ),
    );
  }
}
