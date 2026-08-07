import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../bloc/session/session_cubit.dart';
import '../../../../bloc/session/session_state.dart';
import '../../../../theme/app_theme.dart';
import '../../../../widgets/app_card.dart';
import '../../../../widgets/app_top_bar.dart';
import '../../../../widgets/sparkline_chart.dart';
import '../../data/dashboard_models.dart';
import '../../data/dashboard_repository.dart';
import '../bloc/dashboard_cubit.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) =>
          DashboardCubit(context.read<DashboardRepository>())..load(),
      child: const _DashboardView(),
    );
  }
}

class _DashboardView extends StatelessWidget {
  const _DashboardView();

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    final session = context.watch<SessionCubit>().state;
    final user = session is SessionAuthenticated ? session.user : null;

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => context.read<DashboardCubit>().load(),
          child: BlocBuilder<DashboardCubit, DashboardState>(
            builder: (context, state) {
              return switch (state) {
                DashboardLoading() =>
                  const Center(child: CircularProgressIndicator()),
                DashboardError(message: final message) => ListView(
                    children: [
                      const SizedBox(height: 80),
                      Icon(Icons.wifi_off, color: colors.inkFaint, size: 40),
                      const SizedBox(height: 12),
                      Center(
                        child: Text(
                          message,
                          style: TextStyle(color: colors.inkFaint),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Center(
                        child: OutlinedButton(
                          onPressed: () =>
                              context.read<DashboardCubit>().load(),
                          child: const Text('Retry'),
                        ),
                      ),
                    ],
                  ),
                DashboardLoaded(
                  kpis: final kpis,
                  announcements: final anns,
                  recentActivities: final activities,
                  revenueTrend: final trend,
                ) =>
                  ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      AppTopBar(
                        caption: 'All branches',
                        title: 'Overview',
                        trailing: CircleAvatar(
                          radius: 17,
                          backgroundColor: colors.accentSoft,
                          child: Text(
                            user?.initials ?? '?',
                            style: TextStyle(
                              color: colors.accent,
                              fontWeight: FontWeight.w800,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      GridView.count(
                        // Phone stays 2-up, exactly as designed; a tablet's
                        // extra width goes to more columns instead of
                        // stretched tiles or empty side gutters.
                        crossAxisCount: MediaQuery.sizeOf(context).width >= 900
                            ? 4
                            : MediaQuery.sizeOf(context).width >= 600
                                ? 3
                                : 2,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        mainAxisSpacing: 10,
                        crossAxisSpacing: 10,
                        childAspectRatio: 1.5,
                        children: [
                          _KpiTile(
                            label: 'Active members',
                            value: '${kpis.activeMembers}',
                          ),
                          _KpiTile(
                            label: 'Check-ins today',
                            value: '${kpis.todaysAttendance}',
                          ),
                          _KpiTile(
                            label: 'Revenue (MTD)',
                            value: _formatCurrency(kpis.monthlyRevenue),
                          ),
                          _KpiTile(
                            label: 'Expiring in 7d',
                            value: '${kpis.expiringMemberships}',
                            delta:
                                kpis.expiringMemberships > 0 ? 'Review' : null,
                            deltaColor: colors.warning,
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      if (anns.isNotEmpty) ...[
                        Text(
                          'Announcements',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: .6,
                            color: colors.inkFaint,
                          ),
                        ),
                        const SizedBox(height: 8),
                        ...anns.map(
                          (a) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: AppCard(
                              child: Text(
                                a.title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 6),
                      ],
                      AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Revenue trend · 7 days',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: .6,
                                color: colors.inkFaint,
                              ),
                            ),
                            const SizedBox(height: 8),
                            trend.isEmpty
                                ? SizedBox(
                                    height: 70,
                                    child: Center(
                                      child: Text(
                                        'No revenue yet this week',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: colors.inkFaint,
                                        ),
                                      ),
                                    ),
                                  )
                                : SparklineChart(
                                    values: trend.map((p) => p.income).toList(),
                                    lineColor: colors.accent,
                                    gridColor: colors.border,
                                  ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Recent activity',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: .6,
                                color: colors.inkFaint,
                              ),
                            ),
                            const SizedBox(height: 6),
                            if (activities.isEmpty)
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 10,
                                ),
                                child: Text(
                                  'Nothing yet today',
                                  style: TextStyle(color: colors.inkFaint),
                                ),
                              )
                            else
                              ...activities.map(
                                (a) => _ActivityRow(activity: a),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
              };
            },
          ),
        ),
      ),
    );
  }

  String _formatCurrency(String raw) {
    final value = double.tryParse(raw) ?? 0;
    if (value >= 100000) return '₹${(value / 100000).toStringAsFixed(1)}L';
    if (value >= 1000) return '₹${(value / 1000).toStringAsFixed(1)}K';
    return '₹${value.toStringAsFixed(0)}';
  }
}

class _KpiTile extends StatelessWidget {
  final String label;
  final String value;
  final String? delta;
  final Color? deltaColor;

  const _KpiTile({
    required this.label,
    required this.value,
    this.delta,
    this.deltaColor,
  });

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
      decoration: BoxDecoration(
        border: Border.all(color: colors.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: .6,
              color: colors.inkFaint,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontFamily: 'Bebas Neue',
              fontSize: 26,
              height: 1.0,
            ),
          ),
          if (delta != null) ...[
            const SizedBox(height: 4),
            Text(
              delta!,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: deltaColor ?? colors.success,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ActivityRow extends StatelessWidget {
  final RecentActivity activity;
  const _ActivityRow({required this.activity});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    final (bg, fg, icon) = switch (activity.type) {
      'PAYMENT' => (colors.accentSoft, colors.accent, Icons.currency_rupee),
      'CHECK_IN' => (colors.successSoft, colors.success, Icons.login),
      'NEW_MEMBER' => (colors.warningSoft, colors.warning, Icons.person_add),
      _ => (colors.surface2, colors.inkFaint, Icons.circle),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          CircleAvatar(
            radius: 14,
            backgroundColor: bg,
            child: Icon(icon, size: 14, color: fg),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${activity.label} — ${activity.detail}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  DateFormat('d MMM, h:mm a').format(activity.occurredAt),
                  style: TextStyle(fontSize: 11, color: colors.inkFaint),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
