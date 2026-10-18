import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/notification_stats.dart';
import '../../../../shared/widgets/adaptive_columns.dart';
import '../../../../shared/widgets/comm_kit.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../income/presentation/income_insights.dart' show LedgerKpiTile;
import '../../../income/presentation/income_ui.dart'
    show IncomeDeltaText, pctChange;
import '../../../manager/presentation/widgets/member_detail_anim.dart'
    show AnimatedRing;
import '../../../owner/presentation/widgets/dash_ui.dart' show DashRing;
import '../../../reports/presentation/analytics/analytics_chart.dart';
import '../../../reports/presentation/analytics/analytics_logic.dart';
import '../../../reports/presentation/analytics/analytics_view_parts.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../notification_ui.dart';

/// Web's four notification KPI tiles from `stats.kpis`: Received, Unread,
/// "Read by your team" and Read rate. "Read" is tenant-wide (one `readAt`
/// shared by every staff user), never per user.
class NotificationKpis extends StatelessWidget {
  const NotificationKpis({
    super.key,
    required this.stats,
    required this.compare,
    required this.previousLabel,
  });

  final NotificationStats stats;
  final bool compare;
  final String previousLabel;

  @override
  Widget build(BuildContext context) {
    final vs = 'vs ${previousLabel.toLowerCase()}';
    Widget? delta(double v, double prev, {String? hint}) => compare
        ? IncomeDeltaText(pct: pctChange(v, prev), suffix: vs)
        : (hint == null ? null : Text(hint, style: _hint()));
    final k = stats;
    String count(double n) => formatAnalytics(AnalyticsFormat.number, n);
    return CommKpiGrid(
      tiles: [
        LedgerKpiTile(
          key: const ValueKey('notif-kpi-received'),
          label: 'Received',
          icon: Icons.inbox_rounded,
          color: TeamColors.violet,
          value: AnimatedNumber(value: k.total.value, format: count),
          caption:
              delta(k.total.value, k.total.previous, hint: 'in this period'),
          spark: [for (final d in k.daily) d.total.toDouble()],
        ),
        LedgerKpiTile(
          key: const ValueKey('notif-kpi-unread'),
          label: 'Unread',
          icon: Icons.notifications_active_rounded,
          color: TeamColors.rose,
          value: AnimatedNumber(value: k.unread.toDouble(), format: count),
          caption: Text('waiting for your team', style: _hint()),
        ),
        LedgerKpiTile(
          key: const ValueKey('notif-kpi-read'),
          label: 'Read by your team',
          icon: Icons.done_all_rounded,
          color: TeamColors.green,
          value: AnimatedNumber(value: k.read.value, format: count),
          caption: delta(k.read.value, k.read.previous),
        ),
        LedgerKpiTile(
          key: const ValueKey('notif-kpi-rate'),
          label: 'Read rate',
          icon: Icons.speed_rounded,
          color: kNotifOrange,
          value: AnimatedNumber(
            value: k.readRate.value * 100,
            format: (v) => '${v.toStringAsFixed(0)}%',
          ),
          caption: delta(
            k.readRate.value * 100,
            k.readRate.previous * 100,
            hint: 'of received',
          ),
        ),
      ],
    );
  }

  static TextStyle _hint() => AppText.body(
        size: 11,
        color: AppColors.inkFaint,
        weight: FontWeight.w700,
      );
}

/// Charts from `GET /notifications/stats`: volume trend (this vs previous, or
/// received vs read), read-rate gauge, category donut with deltas, hourly
/// heatmap. Each card shows its own loading / error / empty state.
class NotificationInsights extends StatefulWidget {
  const NotificationInsights({
    super.key,
    required this.stats,
    required this.loading,
    required this.error,
    required this.compare,
    required this.previousLabel,
    required this.onRetry,
  });

  final NotificationStats? stats;
  final bool loading;
  final bool error;
  final bool compare;
  final String previousLabel;
  final VoidCallback onRetry;

  @override
  State<NotificationInsights> createState() => _NotificationInsightsState();
}

enum _TrendView { volume, read }

class _NotificationInsightsState extends State<NotificationInsights> {
  _TrendView _view = _TrendView.volume;

  NotificationStats? get _s => widget.stats;

  @override
  Widget build(BuildContext context) {
    return AdaptiveColumns(
      children: [
        _trend(),
        _gauge(),
        _categories(),
        _hourly(),
      ],
    );
  }

  AnalyticsCard _card({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required bool empty,
    required String emptyText,
    required Widget child,
    Widget? trailing,
  }) =>
      AnalyticsCard(
        title: title,
        subtitle: subtitle,
        color: color,
        icon: icon,
        trailing: trailing,
        loading: widget.loading && _s == null,
        error: widget.error && _s == null,
        empty: _s != null && empty,
        emptyText: emptyText,
        onRetry: widget.onRetry,
        child: child,
      );

  Widget _trend() {
    final daily = _s?.daily ?? const <NotificationDay>[];
    final prev = widget.previousLabel;
    final rows = [
      for (final d in daily)
        AnalyticsRow(
          label: analyticsShortDate(d.date),
          tip: d.date,
          a: d.total.toDouble(),
          b: d.read.toDouble(),
          pa: d.previousTotal.toDouble(),
        ),
    ];
    return _card(
      title: 'Notification volume',
      subtitle: _view == _TrendView.volume
          ? 'Received per day vs ${prev.toLowerCase()}'
          : 'Received per day and how many your team has read',
      icon: Icons.show_chart_rounded,
      color: TeamColors.violet,
      empty: daily.isEmpty,
      emptyText: 'No notifications in this period',
      trailing: CommSegmented<_TrendView>(
        color: TeamColors.violet,
        value: _view,
        onChanged: (v) => setState(() => _view = v),
        options: const [
          (_TrendView.volume, 'Volume'),
          (_TrendView.read, 'Read'),
        ],
      ),
      child: AnalyticsTrendChart(
        rows: rows,
        format: AnalyticsFormat.number,
        color: TeamColors.violet,
        labelA: _view == _TrendView.volume ? 'This period' : 'Received',
        colorB: _view == _TrendView.read ? TeamColors.green : null,
        labelB: _view == _TrendView.read ? 'Read by your team' : null,
        compare: widget.compare && _view == _TrendView.volume,
        previousLabel: prev,
      ),
    );
  }

  Widget _gauge() {
    final k = _s;
    final rate = (k?.readRate.value ?? 0) * 100;
    final prevRate = (k?.readRate.previous ?? 0) * 100;
    Widget box(String label, double v, Color c) => Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.surface3,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              children: [
                Text(
                  formatAnalytics(AnalyticsFormat.number, v),
                  style: AppText.display(size: 18, color: c),
                ),
                Text(
                  label,
                  style: AppText.body(
                    size: 11,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        );
    return _card(
      title: 'Read rate',
      subtitle: 'Share of received notifications your team has read',
      icon: Icons.speed_rounded,
      color: TeamColors.green,
      empty: k == null || k.total.value == 0,
      emptyText: 'Nothing received yet',
      child: k == null
          ? const SizedBox.shrink()
          : Column(
              children: [
                const SizedBox(height: 4),
                AnimatedRing(
                  value: (rate / 100).clamp(0.0, 1.0),
                  size: 150,
                  stroke: 14,
                  colors: const [TeamColors.green, TeamColors.teal],
                  track: AppColors.surface3,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${rate.round()}%',
                        style: AppText.display(size: 28),
                      ),
                      Text(
                        'read',
                        style: AppText.body(
                          size: 11,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                if (widget.compare) ...[
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      AnalyticsDeltaChip(value: rate, previous: prevRate),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          'vs ${widget.previousLabel.toLowerCase()} '
                          '(${prevRate.toStringAsFixed(0)}%)',
                          style: AppText.body(
                            size: 12,
                            color: AppColors.inkFaint,
                            weight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    box('Read', k.read.value, TeamColors.green),
                    const SizedBox(width: 8),
                    box('Unread', k.unread.toDouble(), TeamColors.rose),
                  ],
                ),
              ],
            ),
    );
  }

  Widget _categories() {
    final cats = [...(_s?.categories ?? const <NotificationCategoryStat>[])]
        .where((c) => c.count > 0 || c.previousCount > 0)
        .toList()
      ..sort((a, b) => b.count.compareTo(a.count));
    final shown = cats.where((c) => c.count > 0).toList();
    final total = shown.fold<int>(0, (s, c) => s + c.count);
    return _card(
      title: 'By category',
      subtitle: widget.compare
          ? 'Share of notifications, change vs '
              '${widget.previousLabel.toLowerCase()}'
          : 'Share of notifications received',
      icon: Icons.donut_large_rounded,
      color: TeamColors.indigo,
      empty: shown.isEmpty,
      emptyText: 'No notifications in this period',
      child: Column(
        children: [
          Row(
            children: [
              DashRing(
                size: 120,
                thickness: 16,
                segments: [
                  for (final c in shown) total == 0 ? 0 : c.count / total,
                ],
                colors: [for (final c in shown) notifCategoryColor(c.category)],
                trackColor: AppColors.surface3,
                semanticLabel: '$total notifications by category',
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('$total', style: AppText.display(size: 22)),
                    Text(
                      'received',
                      style: AppText.body(
                        size: 10.5,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  children: [
                    for (final c in cats.take(7))
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Container(
                              width: 9,
                              height: 9,
                              decoration: BoxDecoration(
                                color: notifCategoryColor(c.category),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 7),
                            Expanded(
                              child: Text(
                                notifCategoryLabel(c.category),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 12.5,
                                  weight: FontWeight.w700,
                                ),
                              ),
                            ),
                            Text(
                              '${c.count}',
                              style: AppText.tabular(
                                size: 12.5,
                                weight: FontWeight.w800,
                              ),
                            ),
                            if (widget.compare) ...[
                              const SizedBox(width: 6),
                              AnalyticsDeltaChip(
                                value: c.count.toDouble(),
                                previous: c.previousCount.toDouble(),
                              ),
                            ],
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _hourly() {
    final byHour = List<int>.generate(24, (h) {
      for (final x in _s?.hourly ?? const <NotificationHour>[]) {
        if (x.hour == h) return x.count;
      }
      return 0;
    });
    var busiest = 0;
    for (var h = 1; h < 24; h++) {
      if (byHour[h] > byHour[busiest]) busiest = h;
    }
    final any = byHour.any((v) => v > 0);
    final peak = byHour[busiest] == 0 ? 1 : byHour[busiest];
    String hourLabel(int h) =>
        '${h % 12 == 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}';
    Widget cell(int h) => Expanded(
          child: Tooltip(
            message: '${h.toString().padLeft(2, '0')}:00 · ${byHour[h]}',
            child: Column(
              children: [
                Container(
                  height: 38,
                  margin: const EdgeInsets.all(1.5),
                  decoration: BoxDecoration(
                    color: TeamColors.violet.withValues(
                      alpha: byHour[h] == 0
                          ? 0.07
                          : 0.18 + 0.82 * byHour[h] / peak,
                    ),
                    borderRadius: BorderRadius.circular(6),
                  ),
                ),
                Text(
                  h % 3 == 0 ? hourLabel(h) : '',
                  style: AppText.body(
                    size: 9,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        );
    return _card(
      title: 'Activity by hour',
      subtitle: 'When notifications arrive, by hour of day',
      icon: Icons.schedule_rounded,
      color: TeamColors.amber,
      empty: !any,
      emptyText: 'No notifications in this period',
      trailing: any
          ? TeamTag(
              label: 'Busiest ${hourLabel(busiest)} · ${byHour[busiest]}',
              color: TeamColors.amber,
            )
          : null,
      child: Column(
        children: [
          Row(children: [for (var h = 0; h < 12; h++) cell(h)]),
          const SizedBox(height: 6),
          Row(children: [for (var h = 12; h < 24; h++) cell(h)]),
        ],
      ),
    );
  }
}
