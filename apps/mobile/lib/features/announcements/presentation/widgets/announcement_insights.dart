import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/announcement.dart';
import '../../../../models/announcement_stats.dart';
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
import '../announcement_ui.dart';

/// Web's five announcement KPI tiles from `stats.kpis`: Published (with its
/// delta and daily sparkline), Scheduled, Drafts, Expired, Expiring soon.
class AnnouncementKpis extends StatelessWidget {
  const AnnouncementKpis({
    super.key,
    required this.stats,
    required this.compare,
    required this.previousLabel,
  });

  final AnnouncementStats stats;
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
    return CommKpiGrid(
      wideColumns: 5,
      tiles: [
        LedgerKpiTile(
          key: const ValueKey('ann-kpi-published'),
          label: 'Published',
          icon: Icons.check_circle_outline_rounded,
          color: TeamColors.green,
          value: AnimatedNumber(value: s.published.value, format: count),
          caption: compare
              ? IncomeDeltaText(
                  pct: pctChange(s.published.value, s.published.previous),
                  suffix: 'vs ${previousLabel.toLowerCase()}',
                )
              : Text('this period', style: hint()),
          spark: [for (final d in s.daily) d.published.toDouble()],
        ),
        LedgerKpiTile(
          key: const ValueKey('ann-kpi-scheduled'),
          label: 'Scheduled',
          icon: Icons.event_rounded,
          color: TeamColors.amber,
          value: AnimatedNumber(value: s.scheduled.toDouble(), format: count),
          caption: Text('queued to go out', style: hint()),
        ),
        LedgerKpiTile(
          key: const ValueKey('ann-kpi-drafts'),
          label: 'Drafts',
          icon: Icons.edit_note_rounded,
          color: TeamColors.violet,
          value: AnimatedNumber(value: s.drafts.toDouble(), format: count),
          caption: Text('not yet sent', style: hint()),
        ),
        LedgerKpiTile(
          key: const ValueKey('ann-kpi-expired'),
          label: 'Expired',
          icon: Icons.hourglass_bottom_rounded,
          color: TeamColors.rose,
          value: AnimatedNumber(value: s.expired.toDouble(), format: count),
          caption: Text('past expiry', style: hint()),
        ),
        LedgerKpiTile(
          key: const ValueKey('ann-kpi-expiring'),
          label: 'Expiring soon',
          icon: Icons.warning_amber_rounded,
          color: kAnnouncementOrange,
          value:
              AnimatedNumber(value: s.expiringSoon.toDouble(), format: count),
          caption: Text('needs a look', style: hint()),
        ),
      ],
    );
  }
}

/// Orange (web's attendance accent) for "Expiring soon".
const kAnnouncementOrange = Color(0xFFF97316);

/// Charts and lists from `GET /tenant-announcements/stats`: publishing trend,
/// by status, audience, by branch, upcoming, expiring soon and recent reach.
class AnnouncementInsights extends StatelessWidget {
  const AnnouncementInsights({
    super.key,
    required this.stats,
    required this.loading,
    required this.compare,
    required this.previousLabel,
  });

  final AnnouncementStats? stats;
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
    final now = DateTime.now();
    final branches = s?.byBranch ?? const <AnnouncementBranchStat>[];
    return AdaptiveColumns(
      fullWidth: [_reach(s)],
      children: [
        _trend(s),
        _status(s),
        _audience(s),
        if (branches.isNotEmpty || loading) _branches(s),
        _timeline(
          s,
          now,
          title: 'Upcoming',
          subtitle: 'Next scheduled to go out',
          icon: Icons.timer_outlined,
          color: TeamColors.amber,
          emptyText: 'Nothing scheduled',
          rows: [
            for (final u in s?.upcoming ?? const <AnnouncementUpcoming>[])
              if (u.publishAt != null)
                _TimelineRow(
                  u.id,
                  u.title,
                  audienceFromApi(u.audience),
                  DateTime.parse(u.publishAt!),
                  upcoming: true,
                ),
          ],
        ),
        _timeline(
          s,
          now,
          title: 'Expiring soon',
          subtitle: 'Live announcements about to expire',
          icon: Icons.hourglass_bottom_rounded,
          color: kAnnouncementOrange,
          emptyText: 'Nothing is about to expire',
          rows: [
            for (final u in s?.expiring ?? const <AnnouncementExpiring>[])
              if (u.expiresAt != null)
                _TimelineRow(
                  u.id,
                  u.title,
                  audienceFromApi(u.audience),
                  DateTime.parse(u.expiresAt!),
                  upcoming: false,
                ),
          ],
        ),
      ],
    );
  }

  Widget _trend(AnnouncementStats? s) {
    final daily = s?.daily ?? const <AnnouncementDay>[];
    final rows = [
      for (final d in daily)
        AnalyticsRow(
          label: analyticsShortDate(d.date),
          tip: d.date,
          a: d.published.toDouble(),
          pa: d.previousPublished.toDouble(),
        ),
    ];
    return _card(
      title: 'Publishing trend',
      subtitle: compare
          ? 'Published per day vs ${previousLabel.toLowerCase()}'
          : 'Published per day',
      icon: Icons.show_chart_rounded,
      color: TeamColors.fuchsia,
      empty: daily.isEmpty,
      emptyText: 'Nothing published in this period',
      child: AnalyticsTrendChart(
        rows: rows,
        format: AnalyticsFormat.number,
        color: TeamColors.fuchsia,
        labelA: 'Published',
        compare: compare,
        previousLabel: previousLabel,
      ),
    );
  }

  Widget _status(AnnouncementStats? s) {
    final data = [
      for (final st in kAnnouncementStatuses)
        (
          st,
          (s?.byStatus ?? const <AnnouncementStatusStat>[])
              .where((b) => b.status == st)
              .fold<int>(0, (a, b) => a + b.count),
        ),
    ];
    final total = data.fold<int>(0, (a, d) => a + d.$2);
    return _card(
      title: 'By status',
      subtitle: 'All announcements right now',
      icon: Icons.donut_large_rounded,
      color: TeamColors.indigo,
      empty: total == 0,
      emptyText: 'No announcements yet',
      child: Row(
        children: [
          DashRing(
            size: 118,
            thickness: 16,
            segments: [for (final d in data) total == 0 ? 0 : d.$2 / total],
            colors: [for (final d in data) announcementStatusColor(d.$1)],
            trackColor: AppColors.surface3,
            semanticLabel: '$total announcements by status',
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
                            color: announcementStatusColor(d.$1),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 7),
                        Expanded(
                          child: Text(
                            announcementStatusLabel(d.$1),
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
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
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

  Widget _audience(AnnouncementStats? s) {
    final rows = s?.byAudience ?? const <AnnouncementAudienceStat>[];
    var max = 1;
    for (final r in rows) {
      if (r.count > max) max = r.count;
      if (compare && r.previousCount > max) max = r.previousCount;
    }
    return _card(
      title: 'Audience',
      subtitle: compare
          ? 'Published by audience vs ${previousLabel.toLowerCase()}'
          : 'Published by audience',
      icon: Icons.groups_rounded,
      color: TeamColors.teal,
      empty: rows.isEmpty,
      emptyText: 'No published announcements in this period',
      child: Column(
        children: [
          for (final r in rows)
            _bar(
              audienceShort(audienceFromApi(r.audience)),
              r.count,
              max,
              audienceColor(audienceFromApi(r.audience)),
              previous: compare ? r.previousCount : null,
            ),
        ],
      ),
    );
  }

  Widget _branches(AnnouncementStats? s) {
    final rows = s?.byBranch ?? const <AnnouncementBranchStat>[];
    final max = rows.fold<int>(1, (m, r) => r.count > m ? r.count : m);
    return _card(
      title: 'By branch',
      subtitle: 'Branch-targeted announcements',
      icon: Icons.storefront_outlined,
      color: TeamColors.amber,
      empty: rows.isEmpty,
      emptyText: 'No branch-targeted announcements',
      child: Column(
        children: [
          for (final r in rows) _bar(r.name, r.count, max, TeamColors.amber),
        ],
      ),
    );
  }

  Widget _timeline(
    AnnouncementStats? s,
    DateTime now, {
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required String emptyText,
    required List<_TimelineRow> rows,
  }) {
    return _card(
      title: title,
      subtitle: subtitle,
      icon: icon,
      color: color,
      empty: rows.isEmpty,
      emptyText: emptyText,
      child: Column(
        children: [
          for (final r in rows)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.line),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: Icon(icon, size: 18, color: color),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          r.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              AppText.body(size: 13, weight: FontWeight.w800),
                        ),
                        Text(
                          '${audienceShort(r.audience)} · '
                          '${r.upcoming ? annDateTime(r.when) : annDay(r.when)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 11,
                            color: AppColors.inkFaint,
                            weight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  TeamTag(
                    label: r.upcoming
                        ? annRelative(r.when, now)
                        : annExpiryRelative(r.when, now)
                            .replaceFirst(RegExp(r'^in '), ''),
                    color: color,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _reach(AnnouncementStats? s) {
    final rows = s?.recent ?? const <AnnouncementRecent>[];
    return _card(
      title: 'Recent reach',
      subtitle: 'Delivered and read, latest published',
      icon: Icons.mark_email_read_outlined,
      color: TeamColors.fuchsia,
      empty: rows.isEmpty,
      emptyText: 'Nothing published yet',
      child: Column(
        children: [
          for (final r in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: _ReachRow(row: r),
            ),
        ],
      ),
    );
  }
}

class _TimelineRow {
  const _TimelineRow(
    this.id,
    this.title,
    this.audience,
    this.when, {
    required this.upcoming,
  });

  final String id;
  final String title;
  final AnnouncementAudience audience;
  final DateTime when;
  final bool upcoming;
}

class _ReachRow extends StatelessWidget {
  const _ReachRow({required this.row});

  final AnnouncementRecent row;

  @override
  Widget build(BuildContext context) {
    final r = row;
    // delivered / read are null when announcements cannot be linked to member
    // notifications: show a dash, never a made-up bar.
    final known = r.hasReach;
    final pct = known && r.delivered! > 0
        ? (r.read! / r.delivered! * 100).round().clamp(0, 100)
        : 0;
    final published = r.publishedAt == null
        ? ''
        : ' · ${annDateTime(DateTime.parse(r.publishedAt!))}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                r.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(size: 13, weight: FontWeight.w800),
              ),
            ),
            Text(
              known ? '${r.read} / ${r.delivered} read' : '—',
              style: AppText.tabular(
                size: 11.5,
                color: AppColors.inkFaint,
                weight: FontWeight.w700,
              ),
            ),
          ],
        ),
        if (known) ...[
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: pct / 100,
              minHeight: 7,
              backgroundColor: AppColors.surface3,
              color: TeamColors.fuchsia,
            ),
          ),
        ],
        const SizedBox(height: 3),
        Text(
          '${audienceShort(audienceFromApi(r.audience))}$published'
          '${known ? ' · $pct%' : ''}',
          style: AppText.body(
            size: 11,
            color: AppColors.inkFaint,
            weight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
