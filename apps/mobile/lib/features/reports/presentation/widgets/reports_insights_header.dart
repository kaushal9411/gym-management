import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/reports/reports_overview_cubit.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../models/reports_overview.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../finance/presentation/widgets/analytics_parts.dart';

/// Reports Center "Insights" — compact phone version of the web Reports
/// overview. Driven by [ReportsOverviewCubit]; every number is real
/// `GET /reports/overview` data. Built from the shared analytics blocks in
/// `finance/presentation/widgets/analytics_parts.dart` and the package-free
/// motion helpers in `shared/widgets/motion.dart` (staggered entrance,
/// count-up numbers, chart wipe, growing bars — all skipped when the OS
/// reduce-motion setting is on).
///
/// Hidden completely (renders nothing) when the caller lacks `reports:view`
/// or the API answers 403. Loading / error / empty are handled per block.
///
/// Dropped vs web, and why:
///  * Payment-method and member-status **donuts** -> ranked share bars: a
///    3-8 slice donut + legend is unreadable at phone width.
///  * Branch **grouped bar chart** -> one row per branch (this-period bar
///    plus a thinner previous-period bar on the same scale).
///  * Weekday **grouped column chart** -> seven rows, this period bar +
///    thin previous bar (same reason).
///  * Hourly attendance chart -> only the peak hour is shown as a line
///    under the weekday block (24 columns don't fit; the hour is UTC, as
///    the API buckets it, so it is labelled "UTC").
///  * Daily expenses / check-ins / new-member series and chart hover
///    tooltips -> only the revenue-vs-previous trend is drawn (no hover on
///    touch; the peak day is printed instead). The series stay in the model.
///  * Branch filter -> tenant-wide here (the endpoint supports `branchId`;
///    the server still auto-scopes branch-limited users).
///  * Top trainers are not tappable — no trainer detail screen on mobile.
///  * Average daily check-ins KPI is folded into the Check-ins subtitle
///    rather than a ninth card.
class ReportsInsightsHeader extends StatelessWidget {
  const ReportsInsightsHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ReportsOverviewCubit, ReportsOverviewState>(
      builder: (context, state) {
        if (state is ReportsOverviewForbidden) return const SizedBox.shrink();
        final cubit = context.read<ReportsOverviewCubit>();
        return Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Insights', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              AnalyticsPeriodChips(
                selected: state.period,
                onSelected: cubit.load,
              ),
              const SizedBox(height: 12),
              switch (state) {
                ReportsOverviewLoading() => const AnalyticsLoading(),
                ReportsOverviewError(:final message) => AnalyticsErrorBlock(
                    title: 'Insights unavailable',
                    message: message,
                    onRetry: cubit.load,
                  ),
                ReportsOverviewLoaded(:final data) =>
                  // Keyed by range so a period switch replays the entrance.
                  _Loaded(
                    key: ValueKey('${data.range.from}_${data.range.to}'),
                    data: data,
                  ),
                ReportsOverviewForbidden() => const SizedBox.shrink(),
              },
            ],
          ),
        );
      },
    );
  }
}

String _money(double v) => Formatters.currencyCompact(v);
String _int(double v) => v.round().toString();

class _Loaded extends StatelessWidget {
  const _Loaded({super.key, required this.data});

  final ReportsOverview data;

  @override
  Widget build(BuildContext context) {
    final k = data.kpis;
    AnalyticsKpi kpi({
      required String label,
      required double value,
      required String Function(double) fmt,
      required String sub,
      double? delta,
      bool invert = false,
    }) =>
        AnalyticsKpi(
          label: label,
          value: fmt(value),
          numeric: value,
          formatNumeric: fmt,
          delta: delta,
          invertDelta: invert,
          sub: sub,
        );

    final cards = [
      kpi(
        label: 'Revenue',
        value: k.revenue.value,
        fmt: _money,
        delta: k.revenue.deltaPercent,
        sub: 'vs ${_money(k.revenue.previous)} before',
      ),
      kpi(
        label: 'Expenses',
        value: k.expenses.value,
        fmt: _money,
        delta: k.expenses.deltaPercent,
        invert: true,
        sub: 'vs ${_money(k.expenses.previous)} before',
      ),
      kpi(
        label: 'Net profit',
        value: k.netProfit.value,
        fmt: _money,
        // A negative baseline makes a % change meaningless; only compare
        // against a positive previous profit.
        delta: k.netProfit.deltaPercent,
        sub: 'vs ${_money(k.netProfit.previous)} before',
      ),
      kpi(
        label: 'New members',
        value: k.newMembers.value,
        fmt: _int,
        delta: k.newMembers.deltaPercent,
        sub: 'vs ${k.newMembers.previous.round()} before',
      ),
      kpi(
        label: 'Check-ins',
        value: k.checkIns.value,
        fmt: _int,
        delta: k.checkIns.deltaPercent,
        sub: '${k.avgDailyCheckIns.value.toStringAsFixed(1)} / day · '
            'vs ${k.checkIns.previous.round()}',
      ),
      kpi(
        label: 'Churned',
        value: k.churned.value,
        fmt: _int,
        delta: k.churned.deltaPercent,
        invert: true,
        sub: 'vs ${k.churned.previous.round()} before',
      ),
      kpi(
        label: 'Active members',
        value: k.activeMembers.toDouble(),
        fmt: _int,
        sub: 'right now',
      ),
      kpi(
        label: 'Expiring',
        value: k.expiringIn30d.toDouble(),
        fmt: _int,
        sub: 'next 30 days',
      ),
    ];

    var i = 0;
    Widget step(Widget w) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: StaggeredReveal(index: i++, child: w),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var r = 0; r < cards.length; r += 2)
          step(
            Row(
              children: [
                Expanded(child: cards[r]),
                const SizedBox(width: 10),
                Expanded(child: cards[r + 1]),
              ],
            ),
          ),
        step(_RevenueTrend(data: data)),
        step(_WeekdayBlock(data: data)),
        step(_StatusBlock(items: data.memberStatus)),
        step(_PlanBlock(items: data.planDistribution)),
        step(_MethodBlock(items: data.paymentMethods)),
        step(_BranchBlock(items: data.branches)),
        step(_TrainerBlock(items: data.topTrainers)),
        step(_ExpiringBlock(items: data.expiringBuckets)),
      ],
    );
  }
}

class _RevenueTrend extends StatelessWidget {
  const _RevenueTrend({required this.data});

  final ReportsOverview data;

  @override
  Widget build(BuildContext context) {
    final days = data.daily;
    final hasData = days.any((d) => d.revenue > 0 || d.prevRevenue > 0);
    OverviewDay? peak;
    for (final d in days) {
      if (d.revenue > 0 && (peak == null || d.revenue > peak.revenue)) {
        peak = d;
      }
    }
    return AnalyticsBlock(
      title: 'Revenue over time',
      trailing: '${shortDate(data.range.from)} – ${shortDate(data.range.to)}',
      child: !hasData
          ? analyticsEmpty('No revenue in this period or the one before.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                WipeReveal(
                  child: SizedBox(
                    height: 110,
                    width: double.infinity,
                    child: CustomPaint(
                      painter: AnalyticsTrendPainter(
                        current: days.map((d) => d.revenue).toList(),
                        previous: days.map((d) => d.prevRevenue).toList(),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const AnalyticsDot(color: AppColors.staffB),
                    Text(
                      '  This period',
                      style: AppText.body(size: 11, color: AppColors.inkSoft),
                    ),
                    const SizedBox(width: 14),
                    const AnalyticsDot(color: AppColors.inkFaint),
                    Flexible(
                      child: Text(
                        '  Previous (${shortDate(data.previousRange.from)} – '
                        '${shortDate(data.previousRange.to)})',
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(size: 11, color: AppColors.inkSoft),
                      ),
                    ),
                  ],
                ),
                if (peak != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Peak day ${shortDate(peak.date)} · '
                    '${Formatters.currency(peak.revenue)}',
                    style: AppText.body(
                      size: 11,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}

class _WeekdayBlock extends StatelessWidget {
  const _WeekdayBlock({required this.data});

  final ReportsOverview data;

  static const _names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  @override
  Widget build(BuildContext context) {
    final rows = data.weekdayAttendance;
    var maxV = 0;
    for (final r in rows) {
      if (r.count > maxV) maxV = r.count;
      if (r.previousCount > maxV) maxV = r.previousCount;
    }
    OverviewHour? peakHour;
    for (final h in data.hourlyAttendance) {
      if (h.count > 0 && (peakHour == null || h.count > peakHour.count)) {
        peakHour = h;
      }
    }
    return AnalyticsBlock(
      title: 'Attendance by weekday',
      trailing: 'bar = this period · thin = previous',
      child: maxV == 0
          ? analyticsEmpty('No check-ins in this period or the one before.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final r in rows)
                  AnalyticsBar(
                    animate: true,
                    label: _names[r.weekday.clamp(0, 6)],
                    value: '${r.count}',
                    fraction: r.count / maxV,
                    previousFraction: r.previousCount / maxV,
                  ),
                if (peakHour != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Busiest hour ${peakHour.hour.toString().padLeft(2, '0')}:00 '
                    'UTC · ${peakHour.count} check-ins',
                    style: AppText.body(
                      size: 11,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}

const _statusColors = {
  'ACTIVE': AppColors.success,
  'INACTIVE': AppColors.danger,
  'FROZEN': AppColors.warning,
};

class _StatusBlock extends StatelessWidget {
  const _StatusBlock({required this.items});

  final List<OverviewStatus> items;

  @override
  Widget build(BuildContext context) {
    final total = items.fold<int>(0, (s, e) => s + e.count);
    return AnalyticsBlock(
      title: 'Member status',
      trailing: '$total members',
      child: total == 0
          ? analyticsEmpty('No members yet.')
          : Column(
              children: [
                for (final s in items)
                  AnalyticsBar(
                    animate: true,
                    label: prettyEnum(s.status),
                    value: '${s.count}',
                    fraction: s.count / total,
                    color: _statusColors[s.status],
                    sub: pctText(s.count / total),
                  ),
              ],
            ),
    );
  }
}

class _PlanBlock extends StatelessWidget {
  const _PlanBlock({required this.items});

  final List<OverviewPlan> items;

  @override
  Widget build(BuildContext context) {
    var maxV = 0;
    for (final p in items) {
      if (p.activeCount > maxV) maxV = p.activeCount;
    }
    return AnalyticsBlock(
      title: 'Plan distribution',
      trailing: 'active memberships',
      child: maxV == 0
          ? analyticsEmpty('No active memberships.')
          : Column(
              children: [
                for (final p in items)
                  AnalyticsBar(
                    animate: true,
                    label: p.planName,
                    value: '${p.activeCount}',
                    fraction: p.activeCount / maxV,
                    sub: 'Revenue ${Formatters.currency(p.revenue)}',
                  ),
              ],
            ),
    );
  }
}

class _MethodBlock extends StatelessWidget {
  const _MethodBlock({required this.items});

  final List<OverviewMethod> items;

  @override
  Widget build(BuildContext context) {
    final total = items.fold<double>(0, (s, e) => s + e.amount);
    final sorted = [...items]..sort((a, b) => b.amount.compareTo(a.amount));
    return AnalyticsBlock(
      title: 'Payment methods',
      child: total <= 0
          ? analyticsEmpty('No payments in this period.')
          : Column(
              children: [
                for (final m in sorted)
                  AnalyticsBar(
                    animate: true,
                    label: prettyEnum(m.method),
                    value: Formatters.currency(m.amount),
                    fraction: m.amount / total,
                    sub: '${pctText(m.amount / total)} · ${m.count} '
                        '${m.count == 1 ? 'payment' : 'payments'}',
                  ),
              ],
            ),
    );
  }
}

class _BranchBlock extends StatelessWidget {
  const _BranchBlock({required this.items});

  final List<OverviewBranch> items;

  @override
  Widget build(BuildContext context) {
    var maxV = 0.0;
    for (final b in items) {
      if (b.revenue > maxV) maxV = b.revenue;
      if (b.previousRevenue > maxV) maxV = b.previousRevenue;
    }
    return AnalyticsBlock(
      title: 'Branch comparison',
      trailing: 'revenue · thin = previous',
      child: items.isEmpty || maxV <= 0
          ? analyticsEmpty('No branch revenue in this period.')
          : Column(
              children: [
                for (final b in items)
                  AnalyticsBar(
                    animate: true,
                    label: b.name,
                    value: Formatters.currency(b.revenue),
                    fraction: b.revenue / maxV,
                    previousFraction: b.previousRevenue / maxV,
                    sub: '${b.newMembers} new · ${b.checkIns} check-ins · '
                        '${b.activeMembers} active',
                  ),
              ],
            ),
    );
  }
}

class _TrainerBlock extends StatelessWidget {
  const _TrainerBlock({required this.items});

  final List<OverviewTrainer> items;

  @override
  Widget build(BuildContext context) {
    var maxV = 0;
    for (final t in items) {
      if (t.assignedMembers > maxV) maxV = t.assignedMembers;
    }
    return AnalyticsBlock(
      title: 'Top trainers',
      trailing: 'assigned members',
      child: maxV == 0
          ? analyticsEmpty('No trainers with assigned members.')
          : Column(
              children: [
                for (final t in items)
                  AnalyticsBar(
                    animate: true,
                    label: t.name,
                    value: '${t.assignedMembers}',
                    fraction: t.assignedMembers / maxV,
                  ),
              ],
            ),
    );
  }
}

class _ExpiringBlock extends StatelessWidget {
  const _ExpiringBlock({required this.items});

  final List<OverviewBucket> items;

  @override
  Widget build(BuildContext context) {
    var maxV = 0;
    for (final b in items) {
      if (b.count > maxV) maxV = b.count;
    }
    return AnalyticsBlock(
      title: 'Expiring memberships',
      trailing: 'next 30 days',
      child: maxV == 0
          ? analyticsEmpty('Nothing expiring in the next 30 days.')
          : Column(
              children: [
                for (final b in items)
                  AnalyticsBar(
                    animate: true,
                    label: b.label,
                    value: '${b.count}',
                    fraction: b.count / maxV,
                    color: AppColors.warning,
                  ),
              ],
            ),
    );
  }
}
