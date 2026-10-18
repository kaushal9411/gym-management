import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/support_ticket.dart';
import '../../../../models/support_ticket_stats.dart';
import '../../../../shared/widgets/adaptive_columns.dart';
import '../../../../shared/widgets/comm_kit.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../income/presentation/income_insights.dart' show LedgerKpiTile;
import '../../../income/presentation/income_ui.dart'
    show IncomeDeltaText, pctChange;
import '../../../owner/presentation/widgets/dash_ui.dart' show DashRing;
import '../../../reports/presentation/analytics/analytics_chart.dart';
import '../../../reports/presentation/analytics/analytics_logic.dart';
import '../../../reports/presentation/analytics/analytics_view_parts.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../support_ui.dart';

/// A ticket unresolved this long gets the warning colour (web: 7+ days).
const supportStaleDays = 7;

/// Web's five support KPI tiles from `stats.kpis`: Created (delta + daily
/// sparkline), Unresolved, Open, Resolved and Oldest open.
class SupportKpis extends StatelessWidget {
  const SupportKpis({
    super.key,
    required this.stats,
    required this.compare,
    required this.previousLabel,
  });

  final SupportTicketStats stats;
  final bool compare;
  final String previousLabel;

  @override
  Widget build(BuildContext context) {
    TextStyle hint() => AppText.body(
          size: 11,
          color: AppColors.inkFaint,
          weight: FontWeight.w700,
        );
    String count(double n) => formatAnalytics(AnalyticsFormat.number, n);
    final s = stats;
    final oldest = s.oldestOpenDays;
    final stale = oldest != null && oldest >= supportStaleDays;
    return CommKpiGrid(
      wideColumns: 5,
      tiles: [
        LedgerKpiTile(
          key: const ValueKey('sup-kpi-created'),
          label: 'Created',
          icon: Icons.inbox_rounded,
          color: kSupportColor,
          value: AnimatedNumber(value: s.created.value, format: count),
          caption: compare
              ? IncomeDeltaText(
                  pct: pctChange(s.created.value, s.created.previous),
                  suffix: 'vs ${previousLabel.toLowerCase()}',
                )
              : Text('this period', style: hint()),
          spark: [for (final d in s.daily) d.created.toDouble()],
        ),
        LedgerKpiTile(
          key: const ValueKey('sup-kpi-unresolved'),
          label: 'Unresolved',
          icon: Icons.error_outline_rounded,
          color: TeamColors.violet,
          value: AnimatedNumber(value: s.unresolved.toDouble(), format: count),
          caption: Text('open + in progress', style: hint()),
        ),
        LedgerKpiTile(
          key: const ValueKey('sup-kpi-open'),
          label: 'Open',
          icon: Icons.radio_button_checked_rounded,
          color: ticketStatusColor('OPEN'),
          value: AnimatedNumber(value: s.open.toDouble(), format: count),
          caption: Text('waiting for us', style: hint()),
        ),
        LedgerKpiTile(
          key: const ValueKey('sup-kpi-resolved'),
          label: 'Resolved',
          icon: Icons.check_circle_outline_rounded,
          color: TeamColors.green,
          value: AnimatedNumber(value: s.resolved.toDouble(), format: count),
          caption: Text('awaiting close', style: hint()),
        ),
        LedgerKpiTile(
          key: const ValueKey('sup-kpi-oldest'),
          label: 'Oldest open',
          icon: Icons.hourglass_bottom_rounded,
          color: stale ? ticketStatusColor('OPEN') : TeamColors.indigo,
          value: AnimatedNumber(
            value: (oldest ?? 0).toDouble(),
            format: count,
          ),
          caption: Text(
            oldest == null
                ? 'No open tickets'
                : oldest == 1
                    ? 'day waiting'
                    : 'days waiting',
            style: hint(),
          ),
        ),
      ],
    );
  }
}

/// Charts from `GET /support/tickets/stats`: tickets created per day (vs the
/// previous period when comparing), the status split (current state) and
/// tickets created by priority.
class SupportInsights extends StatelessWidget {
  const SupportInsights({
    super.key,
    required this.stats,
    required this.loading,
    required this.compare,
    required this.previousLabel,
  });

  final SupportTicketStats? stats;
  final bool loading;
  final bool compare;
  final String previousLabel;

  AnalyticsCard _card({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required bool empty,
    required String emptyText,
    required Widget child,
  }) =>
      AnalyticsCard(
        title: title,
        subtitle: subtitle,
        color: color,
        icon: icon,
        loading: loading && stats == null,
        empty: stats != null && empty,
        emptyText: emptyText,
        child: child,
      );

  @override
  Widget build(BuildContext context) {
    final s = stats;
    return AdaptiveColumns(
      fullWidth: [_priority(s)],
      children: [_trend(s), _status(s)],
    );
  }

  Widget _trend(SupportTicketStats? s) {
    final daily = s?.daily ?? const <TicketDay>[];
    final rows = [
      for (final d in daily)
        AnalyticsRow(
          label: analyticsShortDate(d.date),
          tip: d.date,
          a: d.created.toDouble(),
          pa: d.previousCreated.toDouble(),
        ),
    ];
    return _card(
      title: 'Tickets created',
      subtitle:
          compare ? 'Per day vs ${previousLabel.toLowerCase()}' : 'Per day',
      icon: Icons.show_chart_rounded,
      color: kSupportColor,
      empty: daily.isEmpty,
      emptyText: 'No tickets raised in this period',
      child: AnalyticsTrendChart(
        rows: rows,
        format: AnalyticsFormat.number,
        color: kSupportColor,
        labelA: 'Created',
        compare: compare,
        previousLabel: previousLabel,
      ),
    );
  }

  Widget _status(SupportTicketStats? s) {
    final data = [
      for (final st in kTicketStatuses)
        (
          st,
          (s?.byStatus ?? const <TicketStatusStat>[])
              .where((b) => b.status == st)
              .fold<int>(0, (a, b) => a + b.count),
        ),
    ];
    final total = data.fold<int>(0, (a, d) => a + d.$2);
    return _card(
      title: 'By status',
      subtitle: 'All tickets right now',
      icon: Icons.donut_large_rounded,
      color: TeamColors.indigo,
      empty: total == 0,
      emptyText: 'No tickets yet',
      child: Row(
        children: [
          DashRing(
            size: 118,
            thickness: 16,
            segments: [for (final d in data) total == 0 ? 0 : d.$2 / total],
            colors: [for (final d in data) ticketStatusColor(d.$1)],
            trackColor: AppColors.surface3,
            semanticLabel: '$total tickets by status',
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('$total', style: AppText.display(size: 22)),
                Text(
                  'Total',
                  style: AppText.body(
                    size: 10.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              children: [
                for (final d in data)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Container(
                          width: 9,
                          height: 9,
                          decoration: BoxDecoration(
                            color: ticketStatusColor(d.$1),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 7),
                        Expanded(
                          child: Text(
                            ticketStatusLabel(d.$1),
                            style: AppText.body(
                              size: 12.5,
                              weight: FontWeight.w700,
                            ),
                          ),
                        ),
                        Text(
                          '${d.$2}',
                          style: AppText.tabular(
                            size: 12.5,
                            weight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _bar(String label, int value, int max, Color color, {int? previous}) {
    Widget track(double v, double h, Color c) => ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(
            value: v.clamp(0.0, 1.0),
            minHeight: h,
            backgroundColor: AppColors.surface3,
            color: c,
          ),
        );
    final m = max == 0 ? 1 : max;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: AppText.body(size: 12.5, weight: FontWeight.w700),
                ),
              ),
              Text(
                '$value',
                style: AppText.tabular(size: 12.5, weight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 4),
          track(value / m, 7, color),
          if (previous != null) ...[
            const SizedBox(height: 3),
            track(previous / m, 3, AppColors.inkFaint),
          ],
        ],
      ),
    );
  }

  Widget _priority(SupportTicketStats? s) {
    final rows = s?.byPriority ?? const <TicketPriorityStat>[];
    int countOf(String api) => rows
        .where((r) => r.priority == api)
        .fold<int>(0, (a, r) => a + r.count);
    int prevOf(String api) => rows
        .where((r) => r.priority == api)
        .fold<int>(0, (a, r) => a + r.previousCount);
    var max = 1;
    var any = false;
    for (final p in kTicketPriorities) {
      final c = countOf(p.apiValue);
      final pv = prevOf(p.apiValue);
      if (c > 0 || (compare && pv > 0)) any = true;
      if (c > max) max = c;
      if (compare && pv > max) max = pv;
    }
    return _card(
      title: 'By priority',
      subtitle: compare
          ? 'Tickets created by priority vs ${previousLabel.toLowerCase()}'
          : 'Tickets created by priority',
      icon: Icons.flag_rounded,
      color: TeamColors.amber,
      empty: !any,
      emptyText: 'No tickets raised in this period',
      child: Column(
        children: [
          for (final p in kTicketPriorities)
            _bar(
              p.label,
              countOf(p.apiValue),
              max,
              ticketPriorityColor(p),
              previous: compare ? prevOf(p.apiValue) : null,
            ),
        ],
      ),
    );
  }
}
