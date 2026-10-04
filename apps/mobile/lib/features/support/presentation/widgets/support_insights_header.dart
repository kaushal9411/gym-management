import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/common/period_stats_cubit.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/support_ticket_stats.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../finance/presentation/widgets/analytics_parts.dart';

typedef SupportStatsCubit = PeriodStatsCubit<SupportTicketStats>;

String supportStatusLabel(String api) => prettyEnum(api);

String supportPriorityLabel(String api) => prettyEnum(api);

/// A ticket unresolved this long gets the warning colour.
const supportStaleDays = 7;

/// Compact phone version of the web Support insights. Driven by
/// [SupportStatsCubit]; every number is real `GET /support/tickets/stats`
/// data, built from the shared blocks in `analytics_parts.dart` and the
/// motion helpers in `shared/widgets/motion.dart` (staggered entrance,
/// count-up KPIs, chart wipe, growing bars — all skipped under
/// `MediaQuery.disableAnimations`).
///
/// Hidden completely without `support:view` or on HTTP 403.
///
/// Only Created, the trend and the priority bars follow the period chips;
/// Unresolved / Open / Resolved / Oldest open and the status split are
/// current-state figures (the API has no resolvedAt, so "resolved in period"
/// does not exist). The oldest-open card shows "None" when the API sends
/// null and turns warning-coloured at [supportStaleDays]+ days.
///
/// Dropped vs web, and why:
///  * Status / priority **donuts** -> share bars (priority bars carry a
///    thinner previous-period bar): donuts + legends don't fit 360px.
///  * Created-per-day **column chart** -> the shared two-line trend.
///  * Chart hover tooltips -> no hover on touch; the peak day is printed.
///  * Closed KPI card -> closed is already in the status chips and share
///    bars; four more cards would only push the list down the phone screen.
///  * No category / SLA / resolution-time widgets: the API has none.
class SupportInsightsHeader extends StatelessWidget {
  const SupportInsightsHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<SupportStatsCubit, PeriodStatsState<SupportTicketStats>>(
      builder: (context, state) {
        if (state is PeriodStatsForbidden<SupportTicketStats>) {
          return const SizedBox.shrink();
        }
        final cubit = context.read<SupportStatsCubit>();
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

class _Loaded extends StatelessWidget {
  const _Loaded({super.key, required this.data});

  final SupportTicketStats data;

  @override
  Widget build(BuildContext context) {
    AnalyticsKpi kpi(
      String label,
      num value,
      String sub, {
      double? delta,
    }) =>
        AnalyticsKpi(
          label: label,
          value: '${value.round()}',
          numeric: value.toDouble(),
          formatNumeric: _int,
          delta: delta,
          invertDelta: true,
          sub: sub,
        );

    final oldest = data.oldestOpenDays;
    final stale = oldest != null && oldest >= supportStaleDays;
    final oldestCard = AnalyticsKpi(
      label: 'Oldest open',
      value: oldest == null ? 'None' : '${oldest}d',
      numeric: oldest?.toDouble(),
      formatNumeric: (v) => '${v.round()}d',
      valueColor: stale ? AppColors.warning : null,
      sub: oldest == null ? 'nothing unresolved' : 'waiting since',
    );

    final cards = [
      kpi(
        'Created',
        data.created.value,
        'vs ${data.created.previous.round()} before',
        delta: data.created.deltaPercent,
      ),
      kpi('Unresolved', data.unresolved, 'open + in progress'),
      kpi('Open', data.open, 'awaiting first reply'),
      kpi('Resolved', data.resolved, 'fixed, not closed'),
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
        step(oldestCard),
        step(_CreatedTrend(data: data)),
        step(_StatusBlock(items: data.byStatus)),
        step(_PriorityBlock(items: data.byPriority)),
      ],
    );
  }
}

class _CreatedTrend extends StatelessWidget {
  const _CreatedTrend({required this.data});

  final SupportTicketStats data;

  @override
  Widget build(BuildContext context) {
    final days = data.daily;
    final hasData = days.any((d) => d.created > 0 || d.previousCreated > 0);
    TicketDay? peak;
    for (final d in days) {
      if (d.created > 0 && (peak == null || d.created > peak.created)) {
        peak = d;
      }
    }
    return AnalyticsBlock(
      title: 'Created over time',
      trailing: '${shortDate(data.range.from)} – ${shortDate(data.range.to)}',
      child: !hasData
          ? analyticsEmpty('No tickets in this period or the one before.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                WipeReveal(
                  child: SizedBox(
                    height: 110,
                    width: double.infinity,
                    child: CustomPaint(
                      painter: AnalyticsTrendPainter(
                        current: days.map((d) => d.created.toDouble()).toList(),
                        previous: days
                            .map((d) => d.previousCreated.toDouble())
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
                    'Peak day ${shortDate(peak.date)} · ${peak.created}',
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

class _StatusBlock extends StatelessWidget {
  const _StatusBlock({required this.items});

  final List<TicketStatusStat> items;

  @override
  Widget build(BuildContext context) {
    final total = items.fold<int>(0, (s, e) => s + e.count);
    return AnalyticsBlock(
      title: 'By status',
      child: total <= 0
          ? analyticsEmpty('No tickets yet.')
          : Column(
              children: [
                for (final e in items)
                  AnalyticsBar(
                    animate: true,
                    label: supportStatusLabel(e.status),
                    value: '${e.count}',
                    fraction: e.count / total,
                    sub: pctText(e.count / total),
                  ),
              ],
            ),
    );
  }
}

class _PriorityBlock extends StatelessWidget {
  const _PriorityBlock({required this.items});

  final List<TicketPriorityStat> items;

  @override
  Widget build(BuildContext context) {
    var maxV = 0;
    for (final e in items) {
      if (e.count > maxV) maxV = e.count;
      if (e.previousCount > maxV) maxV = e.previousCount;
    }
    return AnalyticsBlock(
      title: 'Created by priority',
      child: maxV <= 0
          ? analyticsEmpty('No tickets in this period or the one before.')
          : Column(
              children: [
                for (final e in items)
                  AnalyticsBar(
                    animate: true,
                    label: supportPriorityLabel(e.priority),
                    value: '${e.count}',
                    fraction: e.count / maxV,
                    previousFraction: e.previousCount / maxV,
                    sub: 'Previous ${e.previousCount}'
                        '${deltaText(e.deltaPercent) == null ? '' : ' · ${deltaText(e.deltaPercent)}'}',
                  ),
              ],
            ),
    );
  }
}
