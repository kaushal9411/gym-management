import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/lead.dart';
import '../../../../models/lead_analytics.dart';
import '../../../manager/presentation/widgets/member_detail_anim.dart';
import '../lead_ui.dart';
import 'lead_charts.dart';
import 'lead_widgets.dart';

String _pct(double ratio) => '${(ratio * 100).toStringAsFixed(1)}%';

/// One bar row of an insight panel / sheet.
class _Row {
  const _Row({
    required this.label,
    required this.count,
    required this.color,
    this.sub,
    this.rank,
    this.name,
  });

  final String label;
  final int count;
  final Color color;
  final String? sub;
  final int? rank;

  /// Name for the avatar of a leaderboard row.
  final String? name;
}

/// Report panels for the Leads dashboard, one per web chart card. Each
/// shows a compact preview and opens a bottom sheet with the full detail
/// (same pattern as the Members insight panels).
class LeadInsights extends StatelessWidget {
  const LeadInsights({super.key, required this.data});

  final LeadAnalytics data;

  void _sheet(
    BuildContext context, {
    required IconData icon,
    required String title,
    required Color color,
    required Widget body,
    String? subtitle,
  }) {
    showLeadSheet<void>(
      context,
      (_) => LeadSheetScaffold(
        icon: icon,
        title: title,
        subtitle: subtitle,
        color: color,
        child: body,
      ),
    );
  }

  Widget _rowsBody(List<_Row> rows, {int? limit, String empty = 'No data.'}) {
    if (rows.isEmpty) return LeadEmptyLine(empty);
    final shown = limit == null ? rows : rows.take(limit).toList();
    final top = rows.map((r) => r.count).fold<int>(1, math.max);
    return Column(
      children: [
        for (final r in shown)
          LeadBarRow(
            label: r.label,
            value: '${r.count}',
            fraction: r.count / top,
            color: r.color,
            sub: r.sub,
            leading: r.rank == null
                ? null
                : LeadAvatar(name: r.name ?? r.label, size: 30, color: r.color),
          ),
      ],
    );
  }

  List<_Row> _cohortRows(
    List<LeadCohortRow> rows,
    String Function(LeadCohortRow) label,
    Color Function(LeadCohortRow) color, {
    bool ranked = false,
  }) {
    final sorted = rows.where((r) => r.leads > 0).toList()
      ..sort((a, b) => b.leads.compareTo(a.leads));
    return [
      for (var i = 0; i < sorted.length; i++)
        _Row(
          label: label(sorted[i]),
          count: sorted[i].leads,
          color: color(sorted[i]),
          sub: '${sorted[i].converted} converted · '
              '${_pct(sorted[i].conversionRate)}',
          rank: ranked ? i + 1 : null,
          name: sorted[i].name,
        ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    final sourceRows = _cohortRows(
      d.bySource,
      (r) => LeadSource.labelOf(r.key ?? ''),
      (r) => leadSourceColor(LeadSource.parse(r.key)),
    );
    final staffRows = _cohortRows(
      [...d.byStaff]..sort((a, b) => b.converted.compareTo(a.converted)),
      (r) => r.name,
      (_) => LeadColors.indigo,
      ranked: true,
    );
    final planRows = _cohortRows(
      d.byPlan,
      (r) => r.name,
      (_) => LeadColors.violet,
    );
    final branchRows = _cohortRows(
      d.topBranches,
      (r) => r.name,
      (_) => LeadColors.amber,
    );
    final lostRows = [
      for (final r in d.lostReasons)
        _Row(
          label: LeadLostReason.labelOf(r.reason),
          count: r.count,
          color: LeadColors.rose,
        ),
    ];
    final ageTotal = d.ageing.fold<int>(0, (a, b) => a + b.count);
    final ageRows = [
      for (var i = 0; i < d.ageing.length; i++)
        _Row(
          label: '${d.ageing[i].bucket} days',
          count: d.ageing[i].count,
          color: Color.lerp(
            LeadColors.green,
            LeadColors.rose,
            d.ageing.length > 1 ? i / (d.ageing.length - 1) : 0,
          )!,
        ),
    ];
    final panels = <Widget>[
      LeadPanel(
        icon: Icons.show_chart_rounded,
        color: LeadColors.indigo,
        title: 'Enquiries vs converted',
        subtitle: 'Daily, selected range',
        badge: '${d.newLeads.intValue} / ${d.converted.intValue}',
        onTap: () => _sheet(
          context,
          icon: Icons.show_chart_rounded,
          title: 'Enquiries vs converted',
          subtitle: 'Per day in the selected range',
          color: LeadColors.indigo,
          body: _TrendSheet(d),
        ),
        child: LeadTrendChart(daily: d.daily),
      ),
      LeadPanel(
        icon: Icons.bar_chart_rounded,
        color: LeadColors.teal,
        title: 'Last 12 months',
        subtitle: 'Cohort conversion %',
        onTap: () => _sheet(
          context,
          icon: Icons.bar_chart_rounded,
          title: 'Last 12 months',
          subtitle: 'Leads created each month and how many converted',
          color: LeadColors.teal,
          body: _MonthlySheet(d.monthly),
        ),
        child: LeadMonthlyChart(monthly: d.monthly),
      ),
      LeadPanel(
        icon: Icons.filter_alt_rounded,
        color: LeadColors.violet,
        title: 'Pipeline funnel',
        subtitle: 'Leads created in range, by furthest stage',
        badge: '${d.funnelTotal} leads · ${d.funnelLost} lost',
        onTap: () => _sheet(
          context,
          icon: Icons.filter_alt_rounded,
          title: 'Pipeline funnel',
          subtitle: 'Where leads stall and drop off',
          color: LeadColors.violet,
          body: _FunnelSheet(d),
        ),
        child: _funnelPreview(d),
      ),
      LeadPanel(
        icon: Icons.campaign_rounded,
        color: LeadColors.fuchsia,
        title: 'Lead sources',
        subtitle: 'Leads and conversion by channel',
        badge: sourceRows.isEmpty ? null : '${sourceRows.length} channels',
        onTap: () => _sheet(
          context,
          icon: Icons.campaign_rounded,
          title: 'Lead sources',
          subtitle: 'Leads created in range, by source',
          color: LeadColors.fuchsia,
          body: _rowsBody(sourceRows, empty: 'No enquiries in this range.'),
        ),
        child: _rowsBody(
          sourceRows,
          limit: 4,
          empty: 'No enquiries in this range.',
        ),
      ),
      LeadPanel(
        icon: Icons.emoji_events_rounded,
        color: LeadColors.indigo,
        title: 'Staff leaderboard',
        subtitle: 'Assigned, converted and rate',
        onTap: () => _sheet(
          context,
          icon: Icons.emoji_events_rounded,
          title: 'Staff leaderboard',
          subtitle: 'Ranked by conversions',
          color: LeadColors.indigo,
          body: _rowsBody(
            staffRows,
            empty: 'No assigned enquiries in this range.',
          ),
        ),
        child: _rowsBody(
          staffRows,
          limit: 4,
          empty: 'No assigned enquiries in this range.',
        ),
      ),
      LeadPanel(
        icon: Icons.card_membership_rounded,
        color: LeadColors.violet,
        title: 'Interest by plan',
        subtitle: 'Leads created in range, by interested plan',
        onTap: () => _sheet(
          context,
          icon: Icons.card_membership_rounded,
          title: 'Interest by plan',
          color: LeadColors.violet,
          body: _rowsBody(planRows, empty: 'No plan interest recorded.'),
        ),
        child: _rowsBody(
          planRows,
          limit: 4,
          empty: 'No plan interest recorded.',
        ),
      ),
      if (branchRows.length > 1)
        LeadPanel(
          icon: Icons.storefront_rounded,
          color: LeadColors.amber,
          title: 'Branches',
          subtitle: 'Leads created in range, per branch',
          onTap: () => _sheet(
            context,
            icon: Icons.storefront_rounded,
            title: 'Branches',
            color: LeadColors.amber,
            body: _rowsBody(branchRows),
          ),
          child: _rowsBody(branchRows, limit: 4),
        ),
      LeadPanel(
        icon: Icons.heart_broken_rounded,
        color: LeadColors.rose,
        title: 'Why leads are lost',
        subtitle: 'Lost in range, by reason',
        badge: lostRows.isEmpty ? null : '${d.lost.intValue} lost',
        onTap: () => _sheet(
          context,
          icon: Icons.heart_broken_rounded,
          title: 'Why leads are lost',
          color: LeadColors.rose,
          body: _rowsBody(lostRows, empty: 'No lost leads in this range.'),
        ),
        child: _rowsBody(
          lostRows,
          limit: 4,
          empty: 'No lost leads in this range.',
        ),
      ),
      LeadPanel(
        icon: Icons.hourglass_bottom_rounded,
        color: LeadColors.green,
        title: 'Open lead ageing',
        subtitle: 'Open leads by days since created (all-time)',
        badge: ageTotal == 0 ? null : '$ageTotal open',
        onTap: () => _sheet(
          context,
          icon: Icons.hourglass_bottom_rounded,
          title: 'Open lead ageing',
          subtitle: 'The older the lead, the colder it gets',
          color: LeadColors.green,
          body: _rowsBody(
            ageTotal == 0 ? const [] : ageRows,
            empty: 'No open leads.',
          ),
        ),
        child: _rowsBody(
          ageTotal == 0 ? const [] : ageRows,
          empty: 'No open leads.',
        ),
      ),
    ];
    return Column(
      children: [
        for (var i = 0; i < panels.length; i++) ...[
          if (i > 0) const SizedBox(height: 12),
          FadeUp(index: i % 4, child: panels[i]),
        ],
      ],
    );
  }

  Widget _funnelPreview(LeadAnalytics d) {
    if (d.funnel.isEmpty || d.funnelTotal == 0) {
      return const LeadEmptyLine('No leads created in this range.');
    }
    final top = d.funnel.first.count == 0 ? 1 : d.funnel.first.count;
    return Column(
      children: [
        for (final s in d.funnel)
          LeadBarRow(
            label: LeadStatus.parse(s.stage).label,
            value: '${s.count}',
            fraction: s.count / top,
            color: leadStatusColor(LeadStatus.parse(s.stage)),
            sub: s.dropOff > 0 ? '-${s.dropOff} dropped' : null,
            leading: Icon(
              leadStatusIcon(LeadStatus.parse(s.stage)),
              size: 18,
              color: leadStatusColor(LeadStatus.parse(s.stage)),
            ),
          ),
      ],
    );
  }
}

class _TrendSheet extends StatelessWidget {
  const _TrendSheet(this.d);

  final LeadAnalytics d;

  @override
  Widget build(BuildContext context) {
    LeadDailyPoint? peak;
    for (final p in d.daily) {
      if (peak == null || p.newLeads > peak.newLeads) peak = p;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _Stat('Enquiries', d.newLeads.intValue, leadEnquiryColor),
            const SizedBox(width: 8),
            _Stat('Converted', d.converted.intValue, leadConvertedColor),
            const SizedBox(width: 8),
            _Stat('Lost', d.lost.intValue, LeadColors.rose),
          ],
        ),
        const SizedBox(height: 14),
        LeadTrendChart(daily: d.daily, height: 190),
        if (peak != null && peak.newLeads > 0) ...[
          const SizedBox(height: 12),
          Text(
            'Busiest day: ${peak.date} · ${peak.newLeads} enquiries',
            style: AppText.body(
              size: 12.5,
              weight: FontWeight.w700,
              color: LeadColors.indigo,
            ),
          ),
        ],
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value, this.color);

  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CountUp(
              value: value,
              style: AppText.display(size: 22, color: color),
            ),
            Text(
              label,
              style: AppText.body(
                size: 11,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MonthlySheet extends StatelessWidget {
  const _MonthlySheet(this.monthly);

  final List<LeadMonthlyPoint> monthly;

  @override
  Widget build(BuildContext context) {
    final rows = monthly.reversed.toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LeadMonthlyChart(monthly: monthly),
        const SizedBox(height: 14),
        for (final m in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                SizedBox(
                  width: 70,
                  child: Text(
                    m.month,
                    style: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w700,
                      color: AppColors.inkSoft,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    '${m.newLeads} enquiries · ${m.converted} converted',
                    style: AppText.body(size: 12.5),
                  ),
                ),
                Text(
                  m.newLeads == 0 ? '–' : _pct(m.conversionRate),
                  style: AppText.body(
                    size: 12.5,
                    weight: FontWeight.w800,
                    color: LeadColors.teal,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _FunnelSheet extends StatelessWidget {
  const _FunnelSheet(this.d);

  final LeadAnalytics d;

  @override
  Widget build(BuildContext context) {
    if (d.funnel.isEmpty || d.funnelTotal == 0) {
      return const LeadEmptyLine('No leads created in this range.');
    }
    return Column(
      children: [
        for (final s in d.funnel)
          LeadBarRow(
            label: LeadStatus.parse(s.stage).label,
            value: '${s.count} · ${(s.pctOfTop * 100).round()}%',
            fraction: s.pctOfTop <= 0
                ? s.count / math.max(1, d.funnel.first.count)
                : s.pctOfTop,
            color: leadStatusColor(LeadStatus.parse(s.stage)),
            sub: s.dropOff > 0
                ? 'Dropped ${s.dropOff} (${(s.dropOffRate * 100).round()}%) '
                    'before this stage'
                : null,
            leading: Icon(
              leadStatusIcon(LeadStatus.parse(s.stage)),
              size: 18,
              color: leadStatusColor(LeadStatus.parse(s.stage)),
            ),
          ),
        LeadBarRow(
          label: 'Lost',
          value: '${d.funnelLost}',
          fraction: d.funnelTotal == 0 ? 0 : d.funnelLost / d.funnelTotal,
          color: LeadColors.rose,
          leading: const Icon(
            Icons.cancel_rounded,
            size: 18,
            color: LeadColors.rose,
          ),
        ),
      ],
    );
  }
}
