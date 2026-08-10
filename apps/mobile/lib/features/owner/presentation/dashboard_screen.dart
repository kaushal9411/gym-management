import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/dashboard/dashboard_cubit.dart';
import '../../../bloc/dashboard/dashboard_state.dart';
import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'widgets/kpi_card.dart';
import 'widgets/recent_activity_tile.dart';
import 'widgets/revenue_sparkline.dart';

/// Design frame "4. Dashboard" (Tenant/Owner) — KPI cards, revenue
/// sparkline, recent activity feed. All three come from real endpoints
/// (`/reports/dashboard/kpis`, `/recent-activities`, `/analytics/revenue-trends`).
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<DashboardCubit>(
      create: (_) => getIt<DashboardCubit>()..load(),
      child: const _DashboardView(),
    );
  }
}

class _DashboardView extends StatelessWidget {
  const _DashboardView();

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
      onRefresh: () => context.read<DashboardCubit>().load(),
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
                    Text('Overview', style: AppText.display(size: 22)),
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
                DashboardLoaded(:final kpis, :final activities, :final trend) =>
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: KpiCard(
                              label: 'Active members',
                              value: '${kpis.activeMembers}',
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: KpiCard(
                              label: 'Revenue (MTD)',
                              value: Formatters.currency(kpis.monthlyRevenue),
                              valueColor: AppColors.memberB,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: KpiCard(
                              label: "Today's check-ins",
                              value: '${kpis.todaysAttendance}',
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
                      GlassCard(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Revenue trend · 7 days',
                              style: AppText.eyebrow(),
                            ),
                            const SizedBox(height: 10),
                            trend.isEmpty
                                ? const SizedBox(height: 90)
                                : RevenueSparkline(points: trend),
                          ],
                        ),
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
