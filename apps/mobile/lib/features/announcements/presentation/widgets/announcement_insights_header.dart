import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/common/period_stats_cubit.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/announcement.dart';
import '../../../../models/announcement_stats.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../finance/presentation/widgets/analytics_parts.dart';

typedef AnnouncementStatsCubit = PeriodStatsCubit<AnnouncementStats>;

String announcementAudienceLabel(String api) =>
    AnnouncementAudienceX.fromApi(api).label;

String announcementStatusLabel(String api) => prettyEnum(api);

/// Compact phone version of the web Announcements insights. Driven by
/// [AnnouncementStatsCubit]; every number is real
/// `GET /tenant-announcements/stats` data, built from the shared blocks in
/// `analytics_parts.dart` and the motion helpers in `shared/widgets/motion.dart`
/// (staggered entrance, count-up KPIs, chart wipe, growing bars — all skipped
/// under `MediaQuery.disableAnimations`).
///
/// Hidden completely without `announcements:view` or on HTTP 403.
///
/// Only the Published KPI, trend and audience bars follow the period chips;
/// Scheduled / Drafts / Expired / Expiring soon (next 7 days) / the status
/// split and the upcoming/expiring lists are current-state figures.
///
/// Dropped vs web, and why:
///  * Status and audience **donuts** -> share bars (audience bars carry a
///    thinner previous-period bar): donuts + legends don't fit 360px.
///  * Published-per-day **column chart** -> the shared two-line trend.
///  * Chart hover tooltips -> no hover on touch; the peak day is printed.
///  * Per-announcement delivered/read **bars** render only when the API
///    sends non-null numbers. Today it always sends null (member
///    notifications carry no link back to the announcement), so each recent
///    row shows publish time instead plus one honest note — nothing is
///    estimated.
///  * Upcoming / expiring / recent rows are not tappable — there is no
///    announcement detail screen on mobile.
class AnnouncementInsightsHeader extends StatelessWidget {
  const AnnouncementInsightsHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AnnouncementStatsCubit,
        PeriodStatsState<AnnouncementStats>>(
      builder: (context, state) {
        if (state is PeriodStatsForbidden<AnnouncementStats>) {
          return const SizedBox.shrink();
        }
        final cubit = context.read<AnnouncementStatsCubit>();
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

  final AnnouncementStats data;

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
          sub: sub,
        );

    final cards = [
      kpi(
        'Published',
        data.published.value,
        'vs ${data.published.previous.round()} before',
        delta: data.published.deltaPercent,
      ),
      kpi('Scheduled', data.scheduled, 'waiting to go out'),
      kpi('Drafts', data.drafts, 'not published'),
      kpi('Expired', data.expired, 'past expiry'),
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
        step(kpi('Expiring soon', data.expiringSoon, 'within the next 7 days')),
        step(_PublishTrend(data: data)),
        step(_StatusBlock(items: data.byStatus)),
        step(_AudienceBlock(items: data.byAudience)),
        if (data.byBranch.isNotEmpty) step(_BranchBlock(items: data.byBranch)),
        step(_UpcomingBlock(items: data.upcoming)),
        step(_ExpiringBlock(items: data.expiring)),
        step(_RecentBlock(items: data.recent)),
      ],
    );
  }
}

class _PublishTrend extends StatelessWidget {
  const _PublishTrend({required this.data});

  final AnnouncementStats data;

  @override
  Widget build(BuildContext context) {
    final days = data.daily;
    final hasData = days.any((d) => d.published > 0 || d.previousPublished > 0);
    AnnouncementDay? peak;
    for (final d in days) {
      if (d.published > 0 && (peak == null || d.published > peak.published)) {
        peak = d;
      }
    }
    return AnalyticsBlock(
      title: 'Published over time',
      trailing: '${shortDate(data.range.from)} – ${shortDate(data.range.to)}',
      child: !hasData
          ? analyticsEmpty(
              'Nothing published in this period or the one before.',
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                WipeReveal(
                  child: SizedBox(
                    height: 110,
                    width: double.infinity,
                    child: CustomPaint(
                      painter: AnalyticsTrendPainter(
                        current:
                            days.map((d) => d.published.toDouble()).toList(),
                        previous: days
                            .map((d) => d.previousPublished.toDouble())
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
                    'Peak day ${shortDate(peak.date)} · ${peak.published}',
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

  final List<AnnouncementStatusStat> items;

  @override
  Widget build(BuildContext context) {
    final total = items.fold<int>(0, (s, e) => s + e.count);
    return AnalyticsBlock(
      title: 'By status',
      child: total <= 0
          ? analyticsEmpty('No announcements yet.')
          : Column(
              children: [
                for (final e in items)
                  AnalyticsBar(
                    animate: true,
                    label: announcementStatusLabel(e.status),
                    value: '${e.count}',
                    fraction: e.count / total,
                    sub: pctText(e.count / total),
                  ),
              ],
            ),
    );
  }
}

class _AudienceBlock extends StatelessWidget {
  const _AudienceBlock({required this.items});

  final List<AnnouncementAudienceStat> items;

  @override
  Widget build(BuildContext context) {
    var maxV = 0;
    for (final e in items) {
      if (e.count > maxV) maxV = e.count;
      if (e.previousCount > maxV) maxV = e.previousCount;
    }
    return AnalyticsBlock(
      title: 'Published by audience',
      child: maxV <= 0
          ? analyticsEmpty(
              'Nothing published in this period or the one before.',
            )
          : Column(
              children: [
                for (final e in items)
                  AnalyticsBar(
                    animate: true,
                    label: announcementAudienceLabel(e.audience),
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

class _BranchBlock extends StatelessWidget {
  const _BranchBlock({required this.items});

  final List<AnnouncementBranchStat> items;

  @override
  Widget build(BuildContext context) {
    var maxV = 0;
    for (final e in items) {
      if (e.count > maxV) maxV = e.count;
    }
    return AnalyticsBlock(
      title: 'Published by branch',
      child: maxV <= 0
          ? analyticsEmpty('No branch-targeted announcements in this period.')
          : Column(
              children: [
                for (final e in items)
                  AnalyticsBar(
                    animate: true,
                    label: e.name,
                    value: '${e.count}',
                    fraction: e.count / maxV,
                  ),
              ],
            ),
    );
  }
}

class _TitleRow extends StatelessWidget {
  const _TitleRow({
    required this.title,
    required this.audience,
    required this.when,
  });

  final String title;
  final String audience;
  final String when;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 12.5, weight: FontWeight.w700),
                ),
                Text(
                  announcementAudienceLabel(audience),
                  style: AppText.body(
                    size: 10.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            when,
            style: AppText.tabular(size: 11.5, weight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _UpcomingBlock extends StatelessWidget {
  const _UpcomingBlock({required this.items});

  final List<AnnouncementUpcoming> items;

  @override
  Widget build(BuildContext context) => AnalyticsBlock(
        title: 'Upcoming (scheduled)',
        child: items.isEmpty
            ? analyticsEmpty('Nothing scheduled.')
            : Column(
                children: [
                  for (final e in items)
                    _TitleRow(
                      title: e.title,
                      audience: e.audience,
                      when: shortDateTime(e.publishAt),
                    ),
                ],
              ),
      );
}

class _ExpiringBlock extends StatelessWidget {
  const _ExpiringBlock({required this.items});

  final List<AnnouncementExpiring> items;

  @override
  Widget build(BuildContext context) => AnalyticsBlock(
        title: 'Expiring soon',
        child: items.isEmpty
            ? analyticsEmpty('Nothing is about to expire.')
            : Column(
                children: [
                  for (final e in items)
                    _TitleRow(
                      title: e.title,
                      audience: e.audience,
                      when: shortDateTime(e.expiresAt),
                    ),
                ],
              ),
      );
}

class _RecentBlock extends StatelessWidget {
  const _RecentBlock({required this.items});

  final List<AnnouncementRecent> items;

  @override
  Widget build(BuildContext context) {
    final anyReach = items.any((e) => e.hasReach);
    return AnalyticsBlock(
      title: 'Recent reach',
      child: items.isEmpty
          ? analyticsEmpty('No announcements published yet.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final e in items)
                  if (e.hasReach)
                    _ReachRow(item: e)
                  else
                    _TitleRow(
                      title: e.title,
                      audience: e.audience,
                      when: shortDateTime(e.publishedAt),
                    ),
                if (!anyReach) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Delivered / read counts are not tracked per announcement.',
                    style: AppText.body(
                      size: 10.5,
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

class _ReachRow extends StatelessWidget {
  const _ReachRow({required this.item});

  final AnnouncementRecent item;

  @override
  Widget build(BuildContext context) {
    final delivered = item.delivered ?? 0;
    final read = item.read ?? 0;
    return AnalyticsBar(
      animate: true,
      label: item.title,
      value: '$read / $delivered read',
      fraction: delivered > 0 ? read / delivered : 0,
      sub: '${announcementAudienceLabel(item.audience)} · '
          '${shortDateTime(item.publishedAt)}',
    );
  }
}
