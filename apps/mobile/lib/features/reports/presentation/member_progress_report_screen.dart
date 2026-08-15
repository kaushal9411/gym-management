import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/member_progress_row.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/reports_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'widgets/load_more_button.dart';
import 'widgets/report_filter_bar.dart';

/// Reports Center's "Member Progress" — "Workout and diet adherence,"
/// matching web's report of the same name (`GET /reports/member-progress`).
/// Each row is one member's *active* workout/diet assignment (either may
/// be absent) — no date-range filter server side, only `branchId`.
class MemberProgressReportScreen extends StatefulWidget {
  const MemberProgressReportScreen({super.key});

  @override
  State<MemberProgressReportScreen> createState() =>
      _MemberProgressReportScreenState();
}

class _MemberProgressReportScreenState
    extends State<MemberProgressReportScreen> {
  final _items = <MemberProgressRow>[];
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
          await getIt<ReportsRepository>().memberProgress(branchId: _branchId);
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
          .memberProgress(branchId: _branchId, page: _page + 1);
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
            Text('Workout & diet adherence', style: AppText.eyebrow()),
            Text('Member Progress', style: AppText.display(size: 18)),
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
                              icon: Icons.trending_up_rounded,
                              title: 'No members found',
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
                                return _ProgressRow(row: _items[i]);
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProgressRow extends StatelessWidget {
  const _ProgressRow({required this.row});

  final MemberProgressRow row;

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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            row.name,
            style: AppText.body(size: 13, weight: FontWeight.w700),
          ),
          Text(
            row.memberCode,
            style: AppText.body(size: 11, color: AppColors.inkFaint),
          ),
          const SizedBox(height: 10),
          _ProgressMeter(
            icon: Icons.fitness_center_rounded,
            label: row.workoutPlan ?? 'No workout plan',
            percent: row.workoutProgressPercent,
            color: AppColors.staffB,
          ),
          const SizedBox(height: 8),
          _ProgressMeter(
            icon: Icons.restaurant_rounded,
            label: row.dietPlan ?? 'No diet plan',
            percent: row.dietProgressPercent,
            color: AppColors.memberB,
          ),
        ],
      ),
    );
  }
}

class _ProgressMeter extends StatelessWidget {
  const _ProgressMeter({
    required this.icon,
    required this.label,
    required this.percent,
    required this.color,
  });

  final IconData icon;
  final String label;
  final int? percent;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final active = percent != null;
    return Row(
      children: [
        Icon(
          icon,
          size: 14,
          color: active ? color : AppColors.inkFaint,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: AppText.body(
                  size: 11,
                  weight: FontWeight.w600,
                  color: active ? AppColors.inkSoft : AppColors.inkFaint,
                ),
              ),
              const SizedBox(height: 4),
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadii.pill),
                child: LinearProgressIndicator(
                  value: active ? (percent! / 100).clamp(0, 1) : 0,
                  minHeight: 5,
                  backgroundColor: AppColors.surface3,
                  color: active ? color : AppColors.surface3,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Text(
          active ? '$percent%' : '—',
          style: AppText.tabular(
            size: 11,
            weight: FontWeight.w700,
            color: active ? color : AppColors.inkFaint,
          ),
        ),
      ],
    );
  }
}
