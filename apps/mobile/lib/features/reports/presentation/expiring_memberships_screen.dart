import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/expiring_membership_row.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/reports_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'widgets/load_more_button.dart';
import 'widgets/report_filter_bar.dart';

String _fmtIsoDate(String iso) {
  final parts = iso.split('-');
  return '${parts[2]}/${parts[1]}/${parts[0]}';
}

Color _urgencyColor(int daysRemaining) {
  if (daysRemaining <= 7) return AppColors.danger;
  if (daysRemaining <= 15) return AppColors.warning;
  return AppColors.staffPillFg;
}

/// Reports Center's "Expiring Memberships" — "Memberships ending within 30
/// days," matching web's report of the same name
/// (`GET /reports/expiring-memberships`, sorted soonest-first server side).
/// The 30-day window is the server's default and isn't exposed as a filter
/// on web either — only `branchId` is filterable here.
class ExpiringMembershipsScreen extends StatefulWidget {
  const ExpiringMembershipsScreen({super.key});

  @override
  State<ExpiringMembershipsScreen> createState() =>
      _ExpiringMembershipsScreenState();
}

class _ExpiringMembershipsScreenState extends State<ExpiringMembershipsScreen> {
  final _items = <ExpiringMembershipRow>[];
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
      final result = await getIt<ReportsRepository>()
          .expiringMemberships(branchId: _branchId);
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
          .expiringMemberships(branchId: _branchId, page: _page + 1);
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
            Text('Ending within 30 days', style: AppText.eyebrow()),
            Text('Expiring Memberships', style: AppText.display(size: 18)),
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
                              icon: Icons.event_available_rounded,
                              title: 'Nothing expiring soon',
                              message:
                                  'No memberships end in the next 30 days.',
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
                                return _ExpiringRow(row: _items[i]);
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExpiringRow extends StatelessWidget {
  const _ExpiringRow({required this.row});

  final ExpiringMembershipRow row;

  @override
  Widget build(BuildContext context) {
    final color = _urgencyColor(row.daysRemaining);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.14),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${row.daysRemaining}',
                  style: AppText.tabular(
                    size: 14,
                    weight: FontWeight.w800,
                    color: color,
                  ),
                ),
                Text(
                  'days',
                  style: AppText.body(
                    size: 8,
                    weight: FontWeight.w700,
                    color: color,
                  ),
                ),
              ],
            ),
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
                  '${row.memberCode} · ${row.branch}',
                  style: AppText.body(size: 11, color: AppColors.inkFaint),
                ),
                const SizedBox(height: 4),
                Text(
                  '${row.plan} · ends ${_fmtIsoDate(row.endDate)}',
                  style: AppText.body(
                    size: 11,
                    weight: FontWeight.w600,
                    color: AppColors.inkSoft,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
