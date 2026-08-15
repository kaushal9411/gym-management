import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/dashboard/dashboard_cubit.dart';
import '../../../bloc/dashboard/dashboard_state.dart';
import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../reports/presentation/widgets/report_filter_bar.dart';
import 'widgets/kpi_card.dart';
import 'widgets/recent_activity_tile.dart';
import 'widgets/trend_chart.dart';

/// Design frame "4. Dashboard" (Tenant/Owner) — KPI cards, three 30-day
/// trend charts (Attendance/Revenue/Member Growth, mirroring web's
/// `ChartsGrid`), recent activity feed. Every number comes from real
/// endpoints (`/reports/dashboard/kpis`, `/recent-activities`,
/// `/analytics/attendance-trends`, `/analytics/revenue-trends`,
/// `/analytics/new-member-growth`), each branch-scoped via the same
/// `ReportFilterBar` the Reports screens already use (Prompt 62 — matches
/// web's header `BranchSelector`, except mobile keeps the "All branches"
/// tenant-wide total as an explicit, honestly-labeled option rather than
/// forcing a single branch).
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
    final name = session is SessionAuthenticatedStaff ? session.user.name : '';
    final avatarUrl =
        session is SessionAuthenticatedStaff ? session.user.avatarUrl : null;

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
              GestureDetector(
                onTap: () => context.push(AppRoutes.myProfile),
                child: UserAvatar(avatarUrl: avatarUrl, name: name),
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
                DashboardLoaded(
                  :final kpis,
                  :final activities,
                  :final revenueTrend,
                  :final attendanceTrend,
                  :final memberGrowthTrend,
                  :final platformAnnouncements,
                  :final subscription,
                  :final branches,
                  :final selectedBranchId,
                ) =>
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (branches.length > 1) ...[
                        ReportFilterBar(
                          branches: branches,
                          selectedBranchId: selectedBranchId,
                          onBranchChanged: (branchId) => context
                              .read<DashboardCubit>()
                              .selectBranch(branchId),
                        ),
                        const SizedBox(height: 14),
                      ],
                      Row(
                        children: [
                          Expanded(
                            child: KpiCard(
                              label: "Today's Attendance",
                              value: '${kpis.todaysAttendance}',
                              icon: Icons.how_to_reg_rounded,
                              iconColor: AppColors.staffA,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: KpiCard(
                              label: 'Active Members',
                              value: '${kpis.activeMembers}',
                              icon: Icons.groups_rounded,
                              iconColor: AppColors.staffB,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: KpiCard(
                              label: 'Expiring Memberships',
                              value: '${kpis.expiringMemberships}',
                              valueColor: kpis.expiringMemberships > 0
                                  ? AppColors.warning
                                  : null,
                              icon: Icons.event_busy_rounded,
                              iconColor: AppColors.warning,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: KpiCard(
                              label: 'New Members (this month)',
                              value: '${kpis.newMembersThisMonth}',
                              icon: Icons.person_add_alt_1_rounded,
                              iconColor: AppColors.memberA,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: KpiCard(
                              label: 'Monthly Revenue',
                              value: Formatters.currencyCompact(
                                kpis.monthlyRevenue,
                              ),
                              valueColor: AppColors.memberB,
                              icon: Icons.account_balance_wallet_rounded,
                              iconColor: AppColors.success,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: KpiCard(
                              label: 'Outstanding Payments',
                              value: Formatters.currencyCompact(
                                kpis.outstandingPayments,
                              ),
                              valueColor: kpis.outstandingPayments > 0
                                  ? AppColors.warning
                                  : null,
                              icon: Icons.schedule_rounded,
                              iconColor: AppColors.danger,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _TrendChartCard(
                        title: 'Attendance Trends',
                        description: 'Check-ins over the last 30 days',
                        values: attendanceTrend
                            .map((p) => p.value.toDouble())
                            .toList(),
                        dateLabels: attendanceTrend
                            .map((p) => p.date.substring(5))
                            .toList(),
                        color: AppColors.staffB,
                      ),
                      const SizedBox(height: 16),
                      _TrendChartCard(
                        title: 'Revenue Trends',
                        description: 'Collected revenue over the last 30 days',
                        values: revenueTrend.map((p) => p.income).toList(),
                        dateLabels: revenueTrend
                            .map((p) => p.date.substring(5))
                            .toList(),
                        color: AppColors.success,
                      ),
                      const SizedBox(height: 16),
                      _TrendChartCard(
                        title: 'Member Growth',
                        description: 'New members over the last 30 days',
                        values: memberGrowthTrend
                            .map((p) => p.value.toDouble())
                            .toList(),
                        dateLabels: memberGrowthTrend
                            .map((p) => p.date.substring(5))
                            .toList(),
                        color: AppColors.memberB,
                        type: TrendChartType.bar,
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
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Announcements', style: AppText.eyebrow()),
                            const SizedBox(height: 10),
                            if (platformAnnouncements.isEmpty)
                              const _EmptyState(
                                icon: Icons.campaign_rounded,
                                title: 'No announcements',
                                description:
                                    'Platform announcements will appear here.',
                              )
                            else
                              ...platformAnnouncements.map(
                                (a) => Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Container(
                                        width: 28,
                                        height: 28,
                                        decoration: BoxDecoration(
                                          color: AppColors.staffB
                                              .withValues(alpha: 0.16),
                                          shape: BoxShape.circle,
                                        ),
                                        alignment: Alignment.center,
                                        child: const Icon(
                                          Icons.campaign_rounded,
                                          size: 14,
                                          color: AppColors.staffB,
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              a.title,
                                              style: AppText.body(
                                                size: 13,
                                                weight: FontWeight.w700,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              a.body,
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                              style: AppText.body(
                                                size: 11,
                                                color: AppColors.inkFaint,
                                              ),
                                            ),
                                            if (a.publishedAt != null) ...[
                                              const SizedBox(height: 3),
                                              Text(
                                                Formatters.relativeTime(
                                                  a.publishedAt!,
                                                ),
                                                style: AppText.body(
                                                  size: 10,
                                                  color: AppColors.inkFaint,
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      AppCard(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Upcoming Birthdays',
                              style: AppText.eyebrow(),
                            ),
                            const SizedBox(height: 10),
                            // Web's own dashboard leaves this as a permanent
                            // placeholder too (`upcoming-birthdays.tsx`:
                            // "Needs the Members module's date-of-birth
                            // data") — no endpoint returns member birthdays
                            // anywhere in this API, so this mirrors web's
                            // honest not-yet-available state rather than
                            // inventing one.
                            const _EmptyState(
                              icon: Icons.cake_rounded,
                              title: 'Available once Members go live',
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      AppCard(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Quick Statistics',
                              style: AppText.eyebrow(),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: _QuickStat(
                                    label: 'Active Branches',
                                    value: '${branches.length}',
                                    icon: Icons.store_rounded,
                                    color: AppColors.staffB,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: _QuickStat(
                                    label: 'Current Plan',
                                    value: subscription?.plan.name ?? '—',
                                    icon: Icons.credit_card_rounded,
                                    color: AppColors.staffA,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(
                                  child: _QuickStat(
                                    label: 'Subscription Status',
                                    value: subscription?.status ?? '—',
                                    icon: Icons.verified_user_rounded,
                                    color: AppColors.success,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: _QuickStat(
                                    label: 'Currency',
                                    value: subscription?.plan.currency ?? '—',
                                    icon: Icons.paid_rounded,
                                    color: AppColors.memberB,
                                  ),
                                ),
                              ],
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

class _TrendChartCard extends StatelessWidget {
  const _TrendChartCard({
    required this.title,
    required this.description,
    required this.values,
    required this.dateLabels,
    required this.color,
    this.type = TrendChartType.area,
  });

  final String title;
  final String description;
  final List<double> values;
  final List<String> dateLabels;
  final Color color;
  final TrendChartType type;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppText.eyebrow()),
          const SizedBox(height: 2),
          Text(
            description,
            style: AppText.body(size: 11, color: AppColors.inkFaint),
          ),
          const SizedBox(height: 12),
          TrendChart(
            values: values,
            dateLabels: dateLabels,
            color: color,
            type: type,
          ),
        ],
      ),
    );
  }
}

/// Mirrors web's `EmptyState` — an icon + title (+ optional description)
/// used by the Announcements/Upcoming-Birthdays cards' "nothing here yet"
/// state.
class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    this.description,
  });

  final IconData icon;
  final String title;
  final String? description;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Column(
          children: [
            Icon(icon, size: 26, color: AppColors.inkFaint),
            const SizedBox(height: 8),
            Text(
              title,
              textAlign: TextAlign.center,
              style: AppText.body(
                size: 12,
                weight: FontWeight.w700,
                color: AppColors.inkSoft,
              ),
            ),
            if (description != null) ...[
              const SizedBox(height: 3),
              Text(
                description!,
                textAlign: TextAlign.center,
                style: AppText.body(size: 11, color: AppColors.inkFaint),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// One "Quick Statistics" tile — mirrors web's icon-badge + label/value
/// layout exactly.
class _QuickStat extends StatelessWidget {
  const _QuickStat({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(9),
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 15, color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: AppText.body(size: 10, color: AppColors.inkFaint),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 14, weight: FontWeight.w800),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
