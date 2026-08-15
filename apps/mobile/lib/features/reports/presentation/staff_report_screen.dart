import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/staff_report_row.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/reports_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'widgets/load_more_button.dart';
import 'widgets/report_filter_bar.dart';

const _roleColors = {
  'MANAGER': AppColors.staffB,
  'TRAINER': AppColors.success,
  'RECEPTIONIST': AppColors.warning,
};

const _roleLabels = {
  'MANAGER': 'Manager',
  'TRAINER': 'Trainer',
  'RECEPTIONIST': 'Receptionist',
};

String _fmtIsoDate(String? iso) {
  if (iso == null) return '—';
  final parts = iso.split('-');
  return '${parts[2]}/${parts[1]}/${parts[0]}';
}

/// Reports Center's "Staff Report" — "Managers, trainers, and
/// receptionists," matching web's report of the same name
/// (`GET /reports/staff`). No date-range or role filter server side — only
/// `branchId` is applied, matching what the backend actually supports.
class StaffReportScreen extends StatefulWidget {
  const StaffReportScreen({super.key});

  @override
  State<StaffReportScreen> createState() => _StaffReportScreenState();
}

class _StaffReportScreenState extends State<StaffReportScreen> {
  final _items = <StaffReportRow>[];
  List<BranchOption> _branchOptions = [];
  String? _error;
  String? _branchId;
  bool _loading = true;
  bool _loadingMore = false;
  int _page = 1;
  int _total = 0;
  int _totalPages = 1;

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
      final result =
          await getIt<ReportsRepository>().staff(branchId: _branchId);
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
      final result = await getIt<ReportsRepository>()
          .staff(branchId: _branchId, page: _page + 1);
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
            Text(
              'Managers, trainers & receptionists',
              style: AppText.eyebrow(),
            ),
            Text('Staff Report', style: AppText.display(size: 18)),
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
              child: _error != null && _items.isEmpty
                  ? AppErrorView(message: _error!, onRetry: _load)
                  : _loading
                      ? const AppLoadingView()
                      : _items.isEmpty
                          ? const AppEmptyState(
                              icon: Icons.badge_outlined,
                              title: 'No staff found',
                              message: 'Try a different branch.',
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
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
                                return _StaffRow(row: _items[i]);
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StaffRow extends StatelessWidget {
  const _StaffRow({required this.row});

  final StaffReportRow row;

  @override
  Widget build(BuildContext context) {
    final roleColor = _roleColors[row.role] ?? AppColors.inkFaint;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: roleColor.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(AppRadii.tile),
            ),
            alignment: Alignment.center,
            child:
                Icon(Icons.person_outline_rounded, size: 18, color: roleColor),
          ),
          const SizedBox(width: 12),
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
                  '${row.branch ?? 'No branch'} · Joined ${_fmtIsoDate(row.joiningDate)}',
                  style: AppText.body(size: 11, color: AppColors.inkFaint),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              AppPill(
                label: _roleLabels[row.role] ?? row.role,
                tone: AppPillTone.roleTint,
              ),
              const SizedBox(height: 4),
              Text(
                row.status,
                style: AppText.body(
                  size: 10,
                  color: row.status == 'ACTIVE'
                      ? AppColors.success
                      : AppColors.inkFaint,
                  weight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
