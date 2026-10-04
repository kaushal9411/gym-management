import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/common/period_stats_cubit.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/notification_stats.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../finance/presentation/widgets/analytics_parts.dart';

typedef NotificationStatsCubit = PeriodStatsCubit<NotificationStats>;

/// Notification-category label shared by the insights bars and the feed's
/// category filter chips.
String notificationCategoryLabel(String api) => switch (api) {
      'MEMBERSHIP' => 'Memberships',
      'MEMBER' => 'Members',
      'PAYMENT' => 'Payments',
      'ATTENDANCE' => 'Attendance',
      'SUBSCRIPTION' => 'Subscription',
      'ANNOUNCEMENT' => 'Announcements',
      'SYSTEM' => 'System',
      'STAFF' => 'Staff',
      'WORKOUT' => 'Workouts',
      'DIET' => 'Diet',
      'GENERAL' => 'General',
      _ => prettyEnum(api),
    };

/// Compact phone version of the web Notifications insights. Driven by
/// [NotificationStatsCubit]; every number is real
/// `GET /notifications/stats` data, built from the shared blocks in
/// `analytics_parts.dart` and the motion helpers in `shared/widgets/motion.dart`
/// (staggered entrance, count-up KPIs, chart wipe, growing bars — all skipped
/// under `MediaQuery.disableAnimations`).
///
/// Hidden completely without `notifications:view` or on HTTP 403.
///
/// The staff feed's read state is tenant-wide (one `readAt` shared by every
/// staff user), so Unread / Read rate are worded as feed-level figures.
///
/// Dropped vs web, and why:
///  * Category **donut** -> ranked share bars with a delta vs the previous
///    period (a many-slice donut + legend is unreadable at phone width).
///  * 24-column **hourly bar chart** -> a single "busiest hour" line (hours
///    are UTC, as the API buckets them, and labelled so).
///  * Read-per-day series on the volume chart -> only total vs previous is
///    drawn (the shared painter draws two lines); the read series stays in
///    the model.
///  * Chart hover tooltips -> no hover on touch; the peak day is printed.
class NotificationInsightsHeader extends StatelessWidget {
  const NotificationInsightsHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<NotificationStatsCubit,
        PeriodStatsState<NotificationStats>>(
      builder: (context, state) {
        if (state is PeriodStatsForbidden<NotificationStats>) {
          return const SizedBox.shrink();
        }
        final cubit = context.read<NotificationStatsCubit>();
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
                PeriodStatsLoading() => const AnalyticsLoading(),
                PeriodStatsError(:final message) => AnalyticsErrorBlock(
                    title: 'Insights unavailable',
                    message: message,
                    onRetry: cubit.load,
                  ),
                PeriodStatsLoaded(:final data) => _Loaded(
                    key: ValueKey('${data.range.from}_${data.range.to}'),
                    data: data,
                  ),
                PeriodStatsForbidden() => const SizedBox.shrink(),
              },
              const SizedBox(height: 4),
            ],
          ),
        );
      },
    );
  }
}

String _int(double v) => v.round().toString();
String _pct(double v) => pctText(v);

class _Loaded extends StatelessWidget {
  const _Loaded({super.key, required this.data});

  final NotificationStats data;

  @override
  Widget build(BuildContext context) {
    var i = 0;
    Widget step(Widget w) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: StaggeredReveal(index: i++, child: w),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        step(
          Row(
            children: [
              Expanded(
                child: AnalyticsKpi(
                  label: 'Total',
                  value: _int(data.total.value),
                  numeric: data.total.value,
                  formatNumeric: _int,
                  delta: data.total.deltaPercent,
                  sub: 'vs ${data.total.previous.round()} before',
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: AnalyticsKpi(
                  label: 'Unread',
                  value: '${data.unread}',
                  numeric: data.unread.toDouble(),
                  formatNumeric: _int,
                  sub: 'whole feed · shared by staff',
                ),
              ),
            ],
          ),
        ),
        step(
          AnalyticsKpi(
            label: 'Read rate',
            value: _pct(data.readRate.value),
            numeric: data.readRate.value,
            formatNumeric: _pct,
            delta: data.readRate.deltaPercent,
            sub: '${data.read.value.round()} of ${data.total.value.round()} '
                'read · vs ${_pct(data.readRate.previous)} before',
          ),
        ),
        step(_VolumeTrend(data: data)),
        step(_CategoryBlock(data: data)),
        step(_BusiestHour(data: data)),
      ],
    );
  }
}

class _VolumeTrend extends StatelessWidget {
  const _VolumeTrend({required this.data});

  final NotificationStats data;

  @override
  Widget build(BuildContext context) {
    final days = data.daily;
    final hasData = days.any((d) => d.total > 0 || d.previousTotal > 0);
    NotificationDay? peak;
    for (final d in days) {
      if (d.total > 0 && (peak == null || d.total > peak.total)) peak = d;
    }
    return AnalyticsBlock(
      title: 'Volume over time',
      trailing: '${shortDate(data.range.from)} – ${shortDate(data.range.to)}',
      child: !hasData
          ? analyticsEmpty('No notifications in this period or the one before.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                WipeReveal(
                  child: SizedBox(
                    height: 110,
                    width: double.infinity,
                    child: CustomPaint(
                      painter: AnalyticsTrendPainter(
                        current: days.map((d) => d.total.toDouble()).toList(),
                        previous: days
                            .map((d) => d.previousTotal.toDouble())
                            .toList(),
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
                    'Peak day ${shortDate(peak.date)} · ${peak.total}',
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

class _CategoryBlock extends StatelessWidget {
  const _CategoryBlock({required this.data});

  final NotificationStats data;

  @override
  Widget build(BuildContext context) {
    final total = data.categories.fold<int>(0, (s, c) => s + c.count);
    final sorted = [...data.categories]
      ..sort((a, b) => b.count.compareTo(a.count));
    return AnalyticsBlock(
      title: 'By category',
      child: total <= 0
          ? analyticsEmpty('No notifications in this period.')
          : Column(
              children: [
                for (final c in sorted.where((c) => c.count > 0))
                  AnalyticsBar(
                    animate: true,
                    label: notificationCategoryLabel(c.category),
                    value: '${c.count}',
                    fraction: c.count / total,
                    sub: '${pctText(c.count / total)} · ${c.unread} unread'
                        '${deltaText(c.deltaPercent) == null ? '' : ' · ${deltaText(c.deltaPercent)} vs before'}',
                  ),
              ],
            ),
    );
  }
}

class _BusiestHour extends StatelessWidget {
  const _BusiestHour({required this.data});

  final NotificationStats data;

  String _hour(int h) => '${h.toString().padLeft(2, '0')}:00';

  @override
  Widget build(BuildContext context) {
    final h = data.busiestHour;
    return AnalyticsBlock(
      title: 'Busiest hour',
      child: h == null
          ? analyticsEmpty('No notifications in this period.')
          : Text(
              '${_hour(h.hour)}–${_hour((h.hour + 1) % 24)} UTC · '
              '${h.count} ${h.count == 1 ? 'notification' : 'notifications'}',
              style: AppText.body(size: 13, weight: FontWeight.w700),
            ),
    );
  }
}
