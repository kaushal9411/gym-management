import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/dashboard/dashboard_cubit.dart';
import '../../../bloc/dashboard/dashboard_state.dart';
import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_performance_row.dart';
import '../../../core/utils/formatters.dart';
import '../../../repositories/reports_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../owner/presentation/widgets/kpi_card.dart';
import '../../owner/presentation/widgets/recent_activity_tile.dart';

/// Design frame "4. Dashboard" (Manager) — "Operations" overview, scoped to
/// the manager's own branch access automatically (same
/// `/reports/dashboard/kpis` + `/recent-activities` the Owner dashboard
/// uses; `resolveBranchScope` on the backend restricts it server-side, no
/// client-side filtering needed). Reuses [DashboardCubit] as-is.
///
/// The design's "Staff on shift" stat and "Approvals waiting" card (leave
/// request / refund request) have no backing data model — there's no shift
/// tracking and no pending-approval queue in the backend — so they're
/// replaced with real equivalents: total staff count and recent activity.
class ManagerDashboardScreen extends StatelessWidget {
  const ManagerDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<DashboardCubit>(
      create: (_) => getIt<DashboardCubit>()..load(),
      child: const _ManagerDashboardView(),
    );
  }
}

class _ManagerDashboardView extends StatefulWidget {
  const _ManagerDashboardView();

  @override
  State<_ManagerDashboardView> createState() => _ManagerDashboardViewState();
}

class _ManagerDashboardViewState extends State<_ManagerDashboardView> {
  List<BranchPerformanceRow>? _branchPerformance;
  String? _branchError;

  @override
  void initState() {
    super.initState();
    _loadBranchPerformance();
  }

  Future<void> _loadBranchPerformance() async {
    try {
      final rows = await getIt<ReportsRepository>().branchPerformance();
      if (!mounted) return;
      setState(() => _branchPerformance = rows);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _branchError = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    final tenantName =
        session is SessionAuthenticatedStaff ? session.tenant.name : '';
    final initials =
        session is SessionAuthenticatedStaff ? session.user.initials : '';

    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: () async {
        context.read<DashboardCubit>().load();
        await _loadBranchPerformance();
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 90),
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tenantName, style: AppText.eyebrow()),
                    Text('Operations', style: AppText.display(size: 22)),
                  ],
                ),
              ),
              Container(
                width: 38,
                height: 38,
                decoration: const BoxDecoration(
                  gradient: AppColors.staffGrad,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  initials,
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          BlocBuilder<DashboardCubit, DashboardState>(
            builder: (context, state) {
              return switch (state) {
                DashboardLoading() => const Padding(
                    padding: EdgeInsets.only(top: 60),
                    child: AppLoadingView(),
                  ),
                DashboardError(:final message) => Padding(
                    padding: const EdgeInsets.only(top: 40),
                    child: AppErrorView(
                      message: message,
                      onRetry: () => context.read<DashboardCubit>().load(),
                    ),
                  ),
                DashboardLoaded(:final kpis, :final activities) => Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: KpiCard(
                              label: 'Total staff',
                              value: '${kpis.totalStaff}',
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: KpiCard(
                              label: 'Expiring in 30d',
                              value: '${kpis.expiringMemberships}',
                              valueColor: kpis.expiringMemberships > 0
                                  ? AppColors.warning
                                  : null,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      AppCard(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Recent activity', style: AppText.eyebrow()),
                            const SizedBox(height: 10),
                            if (activities.isEmpty)
                              Padding(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 12),
                                child: Text(
                                  'Nothing yet today.',
                                  style:
                                      AppText.body(color: AppColors.inkFaint),
                                ),
                              )
                            else
                              ...activities
                                  .map((a) => RecentActivityTile(activity: a)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Branch performance',
                              style: AppText.eyebrow(),
                            ),
                            const SizedBox(height: 10),
                            if (_branchError != null)
                              Text(
                                _branchError!,
                                style: AppText.body(color: AppColors.danger),
                              )
                            else if (_branchPerformance == null)
                              const Padding(
                                padding: EdgeInsets.symmetric(vertical: 12),
                                child: Center(child: AppLoadingView()),
                              )
                            else if (_branchPerformance!.isEmpty)
                              Text(
                                'No branch data yet.',
                                style: AppText.body(color: AppColors.inkFaint),
                              )
                            else
                              ..._branchPerformance!.map(
                                (b) => Padding(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 6),
                                  child: Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        b.branch,
                                        style: AppText.body(
                                          size: 13,
                                          weight: FontWeight.w700,
                                        ),
                                      ),
                                      Text(
                                        Formatters.currency(
                                          b.monthlyRevenue,
                                        ),
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
                  ),
              };
            },
          ),
        ],
      ),
    );
  }
}
