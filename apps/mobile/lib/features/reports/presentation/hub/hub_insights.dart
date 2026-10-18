import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/routing/app_routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/reports_overview.dart';
import '../kit/kit.dart';

enum _TrendMetric { revenue, expenses, checkIns, newMembers }

extension on _TrendMetric {
  String get label => switch (this) {
        _TrendMetric.revenue => 'Revenue',
        _TrendMetric.expenses => 'Expenses',
        _TrendMetric.checkIns => 'Check-ins',
        _TrendMetric.newMembers => 'New members',
      };

  IconData get icon => switch (this) {
        _TrendMetric.revenue => Icons.payments_rounded,
        _TrendMetric.expenses => Icons.receipt_long_rounded,
        _TrendMetric.checkIns => Icons.how_to_reg_rounded,
        _TrendMetric.newMembers => Icons.person_add_alt_1_rounded,
      };

  Color get color => switch (this) {
        _TrendMetric.revenue => RptColors.green,
        _TrendMetric.expenses => RptColors.rose,
        _TrendMetric.checkIns => RptColors.teal,
        _TrendMetric.newMembers => RptColors.indigo,
      };

  RptFormat get format => switch (this) {
        _TrendMetric.revenue || _TrendMetric.expenses => RptFormat.money,
        _ => RptFormat.number,
      };

  double cur(OverviewDay d) => switch (this) {
        _TrendMetric.revenue => d.revenue,
        _TrendMetric.expenses => d.expenses,
        _TrendMetric.checkIns => d.checkIns.toDouble(),
        _TrendMetric.newMembers => d.newMembers.toDouble(),
      };

  double prev(OverviewDay d) => switch (this) {
        _TrendMetric.revenue => d.prevRevenue,
        _TrendMetric.expenses => d.prevExpenses,
        _TrendMetric.checkIns => d.prevCheckIns.toDouble(),
        _TrendMetric.newMembers => d.prevNewMembers.toDouble(),
      };
}

/// Colour of a member status slice (web's `statusColor`).
Color hubStatusColor(String status, int i) {
  switch (status.toLowerCase()) {
    case 'active':
      return RptColors.green;
    case 'expired':
    case 'cancelled':
    case 'canceled':
      return RptColors.rose;
    case 'inactive':
    case 'frozen':
    case 'paused':
      return RptColors.slate;
  }
  return rptSeriesColor(i);
}

/// Mon-first weekday points from the API's 0 = Sunday rows.
List<RptPoint> hubWeekdayPoints(
  List<OverviewWeekday> src, {
  required bool compare,
}) {
  final cur = List<double>.filled(7, 0);
  final prev = List<double>.filled(7, 0);
  for (final w in src) {
    final i = rptWeekdayIndex(w.weekday);
    cur[i] = w.count.toDouble();
    prev[i] = w.previousCount.toDouble();
  }
  return [
    for (var i = 0; i < 7; i++)
      RptPoint(
        label: kRptWeekdays[i],
        value: cur[i],
        previous: compare ? prev[i] : null,
      ),
  ];
}

/// The four ratios web's "Health ratios" card derives from real overview
/// fields (no invented metrics). Each is 0..100 or null when its base is 0.
class HubRatios {
  const HubRatios({
    this.netMargin,
    this.expenseRatio,
    this.activeShare,
    this.renewalsDue,
  });

  final double? netMargin;
  final double? expenseRatio;
  final double? activeShare;
  final double? renewalsDue;

  bool get isEmpty =>
      netMargin == null &&
      expenseRatio == null &&
      activeShare == null &&
      renewalsDue == null;

  factory HubRatios.of(ReportsOverview o) {
    double clamp(double v) => v.clamp(0.0, 100.0);
    final k = o.kpis;
    final revenue = k.revenue.value;
    final total = o.memberStatus.fold<int>(0, (s, e) => s + e.count);
    final active = o.memberStatus
        .where((s) => s.status.toLowerCase() == 'active')
        .fold<int>(0, (s, e) => s + e.count);
    return HubRatios(
      netMargin: revenue > 0 ? clamp(k.netProfit.value / revenue * 100) : null,
      expenseRatio:
          revenue > 0 ? clamp(k.expenses.value / revenue * 100) : null,
      activeShare: total > 0 ? clamp(active / total * 100) : null,
      renewalsDue: k.activeMembers > 0
          ? clamp(k.expiringIn30d / k.activeMembers * 100)
          : null,
    );
  }
}

/// KPI tiles of the hub (web's `HubKpis`): 9 tiles with sparklines and a
/// delta vs the previous period.
List<RptKpi> hubKpis(ReportsOverview o, {required bool compare}) {
  final k = o.kpis;
  double? p(double v) => compare ? v : null;
  return [
    RptKpi(
      label: 'Revenue',
      value: k.revenue.value,
      previous: p(k.revenue.previous),
      format: RptFormat.money,
      compact: true,
      icon: Icons.payments_rounded,
      color: RptColors.green,
      sparkline: [for (final d in o.daily) d.revenue],
    ),
    RptKpi(
      label: 'Expenses',
      value: k.expenses.value,
      previous: p(k.expenses.previous),
      format: RptFormat.money,
      compact: true,
      invert: true,
      icon: Icons.receipt_long_rounded,
      color: RptColors.sky,
      sparkline: [for (final d in o.daily) d.expenses],
    ),
    RptKpi(
      label: 'Net profit',
      value: k.netProfit.value,
      previous: p(k.netProfit.previous),
      format: RptFormat.money,
      compact: true,
      icon: Icons.trending_up_rounded,
      color: RptColors.green,
      sparkline: [for (final d in o.daily) d.revenue - d.expenses],
    ),
    RptKpi(
      label: 'New members',
      value: k.newMembers.value,
      previous: p(k.newMembers.previous),
      icon: Icons.person_add_alt_1_rounded,
      color: RptColors.indigo,
      sparkline: [for (final d in o.daily) d.newMembers.toDouble()],
    ),
    RptKpi(
      label: 'Active members',
      value: k.activeMembers.toDouble(),
      hint: 'right now',
      icon: Icons.groups_rounded,
      color: RptColors.indigo,
    ),
    RptKpi(
      label: 'Check-ins',
      value: k.checkIns.value,
      previous: p(k.checkIns.previous),
      icon: Icons.how_to_reg_rounded,
      color: RptColors.teal,
      sparkline: [for (final d in o.daily) d.checkIns.toDouble()],
    ),
    RptKpi(
      label: 'Avg daily check-ins',
      value: k.avgDailyCheckIns.value,
      previous: p(k.avgDailyCheckIns.previous),
      icon: Icons.calendar_view_day_rounded,
      color: RptColors.teal,
    ),
    RptKpi(
      label: 'Expiring in 30d',
      value: k.expiringIn30d.toDouble(),
      hint: 'memberships',
      icon: Icons.event_busy_rounded,
      color: RptColors.fuchsia,
    ),
    RptKpi(
      label: 'Churned',
      value: k.churned.value,
      previous: p(k.churned.previous),
      invert: true,
      icon: Icons.person_remove_rounded,
      color: RptColors.fuchsia,
    ),
  ];
}

/// The eleven insight panels of web's hub, as a [RptPanelGrid]: Trend,
/// Revenue vs expenses vs net, Member status, Attendance by weekday, Peak
/// hours, Plan distribution, Payment methods, Branch comparison, Top
/// trainers, Expiring memberships and Health ratios.
class HubInsights extends StatelessWidget {
  const HubInsights({
    super.key,
    required this.data,
    required this.compare,
    required this.previousLabel,
    this.canOpenExpiring = true,
  });

  final ReportsOverview data;
  final bool compare;
  final String previousLabel;

  /// "View report" link on the expiring card (needs `reports:view`).
  final bool canOpenExpiring;

  @override
  Widget build(BuildContext context) {
    return RptPanelGrid(
      panels: [
        RptPanel(
          full: true,
          _TrendPanel(
            data: data,
            compare: compare,
            previousLabel: previousLabel,
          ),
        ),
        RptPanel(full: true, _ProfitPanel(data: data)),
        RptPanel(_StatusPanel(data: data)),
        RptPanel(
          _WeekdayPanel(
            data: data,
            compare: compare,
            previousLabel: previousLabel,
          ),
        ),
        RptPanel(_HourlyPanel(data: data)),
        RptPanel(_PlansPanel(data: data)),
        RptPanel(_MethodsPanel(data: data)),
        RptPanel(
          full: true,
          _BranchesPanel(
            data: data,
            compare: compare,
            previousLabel: previousLabel,
          ),
        ),
        RptPanel(_TrainersPanel(data: data)),
        RptPanel(_ExpiringPanel(data: data, canOpen: canOpenExpiring)),
        RptPanel(full: true, _GaugesPanel(data: data)),
      ],
    );
  }
}

class _TrendPanel extends StatefulWidget {
  const _TrendPanel({
    required this.data,
    required this.compare,
    required this.previousLabel,
  });

  final ReportsOverview data;
  final bool compare;
  final String previousLabel;

  @override
  State<_TrendPanel> createState() => _TrendPanelState();
}

class _TrendPanelState extends State<_TrendPanel> {
  _TrendMetric _metric = _TrendMetric.revenue;

  @override
  Widget build(BuildContext context) {
    final m = _metric;
    final daily = widget.data.daily;
    return RptChartCard(
      title: 'Trend',
      subtitle: widget.compare
          ? 'This period vs ${widget.previousLabel.toLowerCase()}'
          : 'Daily values for this period',
      icon: Icons.show_chart_rounded,
      color: m.color,
      empty: daily.isEmpty,
      minHeight: 240,
      actions: null,
      legend: RptSegmented<_TrendMetric>(
        color: m.color,
        value: m,
        onChanged: (v) => setState(() => _metric = v),
        options: [
          for (final x in _TrendMetric.values)
            RptSegment(x, x.label, icon: x.icon),
        ],
      ),
      child: RptTrendChart(
        key: ValueKey(m),
        points: [
          for (final d in daily)
            RptPoint(
              label: rptShortDate(d.date),
              tip: d.date,
              value: m.cur(d),
              previous: widget.compare ? m.prev(d) : null,
            ),
        ],
        format: m.format,
        color: m.color,
        currentLabel: m.label,
        previousLabel: widget.previousLabel,
        showPrevious: widget.compare,
        height: 220,
      ),
    );
  }
}

class _ProfitPanel extends StatelessWidget {
  const _ProfitPanel({required this.data});

  final ReportsOverview data;

  @override
  Widget build(BuildContext context) {
    final daily = data.daily;
    return RptChartCard(
      title: 'Revenue vs expenses vs net',
      subtitle: 'Daily · tap a legend item to hide it',
      icon: Icons.stacked_bar_chart_rounded,
      color: RptColors.green,
      empty: daily.isEmpty,
      minHeight: 240,
      child: RptMultiSeriesChart(
        rows: [
          for (final d in daily)
            RptMultiRow(
              label: rptShortDate(d.date),
              tip: d.date,
              values: {
                'revenue': d.revenue,
                'expenses': d.expenses,
                'net': d.revenue - d.expenses,
              },
            ),
        ],
        series: const [
          RptSeriesDef(
            key: 'revenue',
            label: 'Revenue',
            color: RptColors.green,
          ),
          RptSeriesDef(
            key: 'expenses',
            label: 'Expenses',
            color: RptColors.rose,
          ),
          RptSeriesDef(
            key: 'net',
            label: 'Net',
            type: RptSeriesType.line,
            color: RptColors.indigo,
          ),
        ],
      ),
    );
  }
}

class _StatusPanel extends StatelessWidget {
  const _StatusPanel({required this.data});

  final ReportsOverview data;

  @override
  Widget build(BuildContext context) {
    final items = [
      for (var i = 0; i < data.memberStatus.length; i++)
        RptDonutDatum(
          label: rptTitleCase(data.memberStatus[i].status),
          value: data.memberStatus[i].count.toDouble(),
          color: hubStatusColor(data.memberStatus[i].status, i),
        ),
    ];
    final total = items.fold<double>(0, (s, d) => s + d.value);
    return RptChartCard(
      title: 'Member status',
      subtitle: 'Members by current status',
      icon: Icons.donut_large_rounded,
      color: RptColors.indigo,
      empty: total == 0,
      minHeight: 220,
      child: RptDonut(
        data: items,
        centerLabel: 'Members',
        centerValue: rptGrouped(total),
      ),
    );
  }
}

class _WeekdayPanel extends StatelessWidget {
  const _WeekdayPanel({
    required this.data,
    required this.compare,
    required this.previousLabel,
  });

  final ReportsOverview data;
  final bool compare;
  final String previousLabel;

  @override
  Widget build(BuildContext context) {
    final pts = hubWeekdayPoints(data.weekdayAttendance, compare: compare);
    var best = pts.first;
    for (final p in pts) {
      if (p.value > best.value) best = p;
    }
    final empty = data.weekdayAttendance.isEmpty ||
        pts.every((p) => p.value == 0 && (p.previous ?? 0) == 0);
    return RptChartCard(
      title: 'Attendance by weekday',
      subtitle: 'Check-ins per day of week',
      icon: Icons.calendar_view_week_rounded,
      color: RptColors.teal,
      empty: empty,
      minHeight: 220,
      actions: best.value > 0
          ? RptStatPill(
              icon: Icons.calendar_today_rounded,
              label: 'Busiest',
              value: best.label,
              color: RptColors.teal,
            )
          : null,
      child: RptGroupedBarChart(
        data: pts,
        color: RptColors.teal,
        previousLabel: previousLabel,
      ),
    );
  }
}

class _HourlyPanel extends StatelessWidget {
  const _HourlyPanel({required this.data});

  final ReportsOverview data;

  @override
  Widget build(BuildContext context) {
    final counts = List<double>.filled(24, 0);
    for (final h in data.hourlyAttendance) {
      if (h.hour >= 0 && h.hour < 24) counts[h.hour] = h.count.toDouble();
    }
    var peak = -1;
    var max = 0.0;
    for (var h = 0; h < 24; h++) {
      if (counts[h] > max) {
        max = counts[h];
        peak = h;
      }
    }
    return RptChartCard(
      title: 'Peak hours',
      subtitle: 'Check-ins by hour of day',
      icon: Icons.schedule_rounded,
      color: RptColors.teal,
      empty: peak < 0,
      minHeight: 160,
      actions: peak >= 0
          ? RptStatPill(
              icon: Icons.access_time_filled_rounded,
              label: 'Busiest',
              value: rptHourLabel(peak),
              color: RptColors.teal,
            )
          : null,
      child: RptHeatmap(
        matrix: rptHourMatrix(counts),
        cellHeight: 54,
        labelEvery: 3,
      ),
    );
  }
}

class _PlansPanel extends StatefulWidget {
  const _PlansPanel({required this.data});

  final ReportsOverview data;

  @override
  State<_PlansPanel> createState() => _PlansPanelState();
}

class _PlansPanelState extends State<_PlansPanel> {
  bool _byRevenue = false;

  @override
  Widget build(BuildContext context) {
    final src = widget.data.planDistribution;
    return RptChartCard(
      title: 'Plan distribution',
      subtitle: _byRevenue
          ? 'Revenue per plan this period'
          : 'Active members per plan',
      icon: Icons.card_membership_rounded,
      color: RptColors.indigo,
      empty: src.isEmpty,
      actions: RptSegmented<bool>(
        value: _byRevenue,
        onChanged: (v) => setState(() => _byRevenue = v),
        options: const [
          RptSegment(false, 'Members'),
          RptSegment(true, 'Revenue'),
        ],
      ),
      child: RptHBarChart(
        key: ValueKey(_byRevenue),
        rankBadges: true,
        format: _byRevenue ? RptFormat.money : RptFormat.number,
        color: _byRevenue ? RptColors.green : RptColors.indigo,
        data: [
          for (final p in src)
            RptHBarDatum(
              label: p.planName,
              value: _byRevenue ? p.revenue : p.activeCount.toDouble(),
            ),
        ],
      ),
    );
  }
}

class _MethodsPanel extends StatelessWidget {
  const _MethodsPanel({required this.data});

  final ReportsOverview data;

  @override
  Widget build(BuildContext context) {
    final items = [
      for (final m in data.paymentMethods)
        RptDonutDatum(label: rptTitleCase(m.method), value: m.amount),
    ];
    final total = items.fold<double>(0, (s, d) => s + d.value);
    return RptChartCard(
      title: 'Payment methods',
      subtitle: 'Collected amount by method',
      icon: Icons.account_balance_wallet_rounded,
      color: RptColors.green,
      empty: total == 0,
      minHeight: 220,
      child: RptDonut(
        data: items,
        format: RptFormat.money,
        centerLabel: 'Collected',
      ),
    );
  }
}

class _BranchesPanel extends StatelessWidget {
  const _BranchesPanel({
    required this.data,
    required this.compare,
    required this.previousLabel,
  });

  final ReportsOverview data;
  final bool compare;
  final String previousLabel;

  @override
  Widget build(BuildContext context) {
    final src = data.branches;
    return RptChartCard(
      title: 'Branch comparison',
      subtitle: 'Revenue, members and attendance per branch',
      icon: Icons.compare_arrows_rounded,
      color: RptColors.sky,
      empty: src.isEmpty,
      emptyText: 'No branch data',
      minHeight: 240,
      child: LayoutBuilder(
        builder: (context, box) {
          final chart = RptGroupedBarChart(
            data: [
              for (final b in src)
                RptPoint(
                  label: b.name,
                  value: b.revenue,
                  previous: compare ? b.previousRevenue : null,
                ),
            ],
            format: RptFormat.money,
            color: RptColors.sky,
            currentLabel: 'Revenue',
            previousLabel: previousLabel,
          );
          final table = Column(
            children: [
              for (final b in src) _BranchRow(branch: b),
            ],
          );
          if (box.maxWidth >= 700) {
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: chart),
                const SizedBox(width: 20),
                Expanded(child: table),
              ],
            );
          }
          return Column(children: [chart, const SizedBox(height: 12), table]);
        },
      ),
    );
  }
}

class _BranchRow extends StatelessWidget {
  const _BranchRow({required this.branch});

  final OverviewBranch branch;

  @override
  Widget build(BuildContext context) {
    Widget stat(String label, String value) => Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: AppText.body(
                  size: 10.5,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w700,
                ),
              ),
              Text(
                value,
                style: AppText.tabular(size: 12.5, weight: FontWeight.w800),
              ),
            ],
          ),
        );
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            branch.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.body(size: 13.5, weight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              stat(
                'Revenue',
                rptFormatValue(RptFormat.money, branch.revenue, compact: true),
              ),
              stat('New', rptGrouped(branch.newMembers.toDouble())),
              stat('Check-ins', rptGrouped(branch.checkIns.toDouble())),
              stat('Active', rptGrouped(branch.activeMembers.toDouble())),
            ],
          ),
        ],
      ),
    );
  }
}

class _TrainersPanel extends StatelessWidget {
  const _TrainersPanel({required this.data});

  final ReportsOverview data;

  @override
  Widget build(BuildContext context) {
    return RptChartCard(
      title: 'Top trainers',
      subtitle: 'By assigned members',
      icon: Icons.emoji_events_rounded,
      color: RptColors.amber,
      empty: data.topTrainers.isEmpty,
      child: RptHBarChart(
        rankBadges: true,
        limit: 6,
        color: RptColors.amber,
        data: [
          for (final t in data.topTrainers)
            RptHBarDatum(label: t.name, value: t.assignedMembers.toDouble()),
        ],
      ),
    );
  }
}

class _ExpiringPanel extends StatelessWidget {
  const _ExpiringPanel({required this.data, required this.canOpen});

  final ReportsOverview data;
  final bool canOpen;

  @override
  Widget build(BuildContext context) {
    final total = data.expiringBuckets.fold<int>(0, (s, b) => s + b.count);
    return RptChartCard(
      title: 'Expiring memberships',
      subtitle: 'Upcoming renewals by time window',
      icon: Icons.hourglass_bottom_rounded,
      color: RptColors.fuchsia,
      empty: total == 0,
      emptyText: 'No memberships expiring soon',
      actions: canOpen
          ? TextButton(
              onPressed: () =>
                  context.push(AppRoutes.expiringMembershipsReport),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                minimumSize: const Size(0, 30),
              ),
              child: const Text('View report ›'),
            )
          : null,
      child: RptHBarChart(
        sort: false,
        color: RptColors.fuchsia,
        data: [
          for (final b in data.expiringBuckets)
            RptHBarDatum(label: b.label, value: b.count.toDouble()),
        ],
      ),
    );
  }
}

class _GaugesPanel extends StatelessWidget {
  const _GaugesPanel({required this.data});

  final ReportsOverview data;

  @override
  Widget build(BuildContext context) {
    final r = HubRatios.of(data);
    Widget gauge(String label, String caption, double v, Color c) => Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              RptRadialGauge(value: v, size: 78, thickness: 9, color: c),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: AppText.body(size: 13.5, weight: FontWeight.w800),
                    ),
                    Text(
                      caption,
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
    final gauges = <Widget>[
      if (r.netMargin != null)
        gauge(
          'Net margin',
          'Net profit / revenue',
          r.netMargin!,
          RptColors.teal,
        ),
      if (r.expenseRatio != null)
        gauge(
          'Expense ratio',
          'Expenses / revenue',
          r.expenseRatio!,
          RptColors.fuchsia,
        ),
      if (r.activeShare != null)
        gauge(
          'Active share',
          'Active / all members',
          r.activeShare!,
          RptColors.indigo,
        ),
      if (r.renewalsDue != null)
        gauge(
          'Renewals due',
          'Expiring in 30d / active',
          r.renewalsDue!,
          RptColors.amber,
        ),
    ];
    return RptChartCard(
      title: 'Health ratios',
      subtitle: "Derived from this period's totals",
      icon: Icons.speed_rounded,
      color: RptColors.teal,
      empty: gauges.isEmpty,
      minHeight: 120,
      child: LayoutBuilder(
        builder: (context, box) {
          final cols = box.maxWidth >= 900
              ? 4
              : box.maxWidth >= 520
                  ? 2
                  : 1;
          const gap = 10.0;
          final w = (box.maxWidth - gap * (cols - 1)) / cols;
          return Wrap(
            spacing: gap,
            runSpacing: gap,
            children: [for (final g in gauges) SizedBox(width: w, child: g)],
          );
        },
      ),
    );
  }
}
