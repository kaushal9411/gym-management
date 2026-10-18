import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/leads/lead_analytics_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/lead.dart';
import '../../../models/lead_analytics.dart';
import '../../../repositories/lead_repository.dart';
import '../../finance/presentation/widgets/analytics_parts.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import 'lead_list_screen.dart';
import 'lead_ui.dart';
import 'widgets/lead_card.dart';
import 'widgets/lead_charts.dart';
import 'widgets/lead_insights.dart';
import 'widgets/lead_widgets.dart';

/// Leads dashboard — `GET /leads/analytics?range=`. Needs `leads:view` (the
/// menu entry is gated on it).
///
/// Gradient hero with the three headline tiles (Today / This month / This
/// year — server `headline`, independent of the range) and quick actions;
/// range chips Today / 7D / 30D / Month / Year / **Custom** (date-range
/// picker, <= 366 days); an 8-tile KPI grid where every tile opens a bottom
/// sheet (period comparison, ring / sparkline, related leads, and a
/// pre-filtered list); a live **Pipeline** panel (all-time stage counts from
/// `GET /leads` -> segmented bar, tap a stage to open it, "Open board");
/// the web **Follow-ups** panel (Team / Mine, Log call / Reschedule); then the
/// report panels in [LeadInsights]: trend, last 12 months, funnel, sources,
/// staff leaderboard, interest by plan, branches (only with >1), lost
/// reasons and open-lead ageing — each opening a detail sheet. Pull-to-
/// refresh keeps numbers on screen.
///
/// Dropped vs web: the compare-with-previous toggle (deltas are always
/// shown where a baseline exists), branch scoping of the analytics (the API
/// supports it but web only reads it from the URL), CSV export.
class LeadsDashboardScreen extends StatelessWidget {
  const LeadsDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) {
        final repo = getIt<LeadRepository>();
        return LeadAnalyticsCubit(
          (range, from, to) =>
              repo.analytics(range: range, dateFrom: from, dateTo: to),
        )..load();
      },
      child: const _DashboardView(),
    );
  }
}

class _DashboardView extends StatefulWidget {
  const _DashboardView();

  @override
  State<_DashboardView> createState() => _DashboardViewState();
}

class _DashboardViewState extends State<_DashboardView> {
  LeadCounts? _counts;
  LeadSummary? _summary;
  LeadFollowUps? _followUps;
  bool _teamScope = true;

  @override
  void initState() {
    super.initState();
    _loadExtras();
  }

  /// Pipeline counts + follow-ups preview. Failures just leave the panels
  /// empty — the analytics block has its own error state.
  Future<void> _loadExtras() async {
    final repo = getIt<LeadRepository>();
    try {
      final r = await repo.list(limit: 1);
      if (mounted) {
        setState(() {
          _counts = r.counts;
          _summary = r.summary;
        });
      }
    } on Object {
      // panel stays in its loading/empty state
    }
    await _loadFollowUps();
  }

  Future<void> _loadFollowUps() async {
    try {
      final f = await getIt<LeadRepository>().followUps(
        scope: _teamScope ? 'all' : 'mine',
        limit: 3,
      );
      if (mounted) setState(() => _followUps = f);
    } on Object {
      // keep the previous preview
    }
  }

  Future<void> _refresh() async {
    await Future.wait([
      context.read<LeadAnalyticsCubit>().load(null, true),
      _loadExtras(),
    ]);
  }

  Future<void> _newLead() async {
    await context.push(AppRoutes.leadForm);
    if (mounted) await _refresh();
  }

  void _openList({
    LeadFilters filters = const LeadFilters(),
    bool board = false,
  }) {
    context
        .push(
          AppRoutes.leadList,
          extra: LeadListArgs(filters: filters, board: board),
        )
        .then((_) => _loadExtras());
  }

  Future<void> _pickCustom() async {
    final cubit = context.read<LeadAnalyticsCubit>();
    final now = DateTime.now();
    final s = cubit.state;
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 3),
      lastDate: now,
      initialDateRange: s.from != null && s.to != null
          ? DateTimeRange(
              start: DateTime.tryParse(s.from!) ?? now,
              end: DateTime.tryParse(s.to!) ?? now,
            )
          : DateTimeRange(
              start: now.subtract(const Duration(days: 29)),
              end: now,
            ),
    );
    if (picked == null || !mounted) return;
    if (picked.end.difference(picked.start).inDays + 1 > 366) {
      leadToast(
        context,
        'A custom range can span at most 366 days.',
        error: true,
      );
      return;
    }
    await cubit.load(
      LeadRange.custom,
      false,
      ymd(picked.start),
      ymd(picked.end),
    );
  }

  @override
  Widget build(BuildContext context) {
    final canCreate = leadsCan(context, 'leads:create');
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Leads'),
        actions: [
          IconButton(
            tooltip: 'All leads',
            icon: const Icon(Icons.list_alt_rounded),
            onPressed: _openList,
          ),
          if (canCreate)
            IconButton(
              tooltip: 'New lead',
              icon: const Icon(Icons.add_circle_outline_rounded),
              onPressed: _newLead,
            ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        edgeOffset: top,
        onRefresh: _refresh,
        child: BlocBuilder<LeadAnalyticsCubit, LeadAnalyticsState>(
          builder: (context, state) {
            final data = state is LeadAnalyticsLoaded ? state.data : null;
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.only(bottom: 40),
              children: [
                _Hero(
                  top: top,
                  data: data,
                  canCreate: canCreate,
                  onAll: _openList,
                  onFollowUps: () => context
                      .push(AppRoutes.leadFollowUps)
                      .then((_) => _loadExtras()),
                  onNew: _newLead,
                ),
                const SizedBox(height: 14),
                _RangeChips(state: state, onCustom: _pickCustom),
                const SizedBox(height: 14),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: switch (state) {
                    LeadAnalyticsLoading() => const _Skeleton(),
                    LeadAnalyticsError(:final message) => AnalyticsErrorBlock(
                        title: 'Leads analytics unavailable',
                        message: message,
                        onRetry: () =>
                            context.read<LeadAnalyticsCubit>().load(),
                      ),
                    LeadAnalyticsLoaded(:final data) => _Content(
                        data: data,
                        counts: _counts,
                        summary: _summary,
                        followUps: _followUps,
                        teamScope: _teamScope,
                        onScope: (team) {
                          setState(() => _teamScope = team);
                          _loadFollowUps();
                        },
                        onOpenList: _openList,
                        onReload: _loadExtras,
                      ),
                  },
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ── hero ─────────────────────────────────────────────────────────────────

class _Hero extends StatelessWidget {
  const _Hero({
    required this.top,
    required this.data,
    required this.canCreate,
    required this.onAll,
    required this.onFollowUps,
    required this.onNew,
  });

  final double top;
  final LeadAnalytics? data;
  final bool canCreate;
  final VoidCallback onAll;
  final VoidCallback onFollowUps;
  final VoidCallback onNew;

  @override
  Widget build(BuildContext context) {
    return MeshHeroBackground(
      radius: const BorderRadius.vertical(bottom: Radius.circular(34)),
      child: SizedBox(
        width: double.infinity,
        child: Padding(
          padding: EdgeInsets.fromLTRB(16, top + 2, 16, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              FadeUp(
                index: 0,
                child: Text(
                  'SALES & GROWTH',
                  style: AppText.eyebrow(
                    color: Colors.white.withValues(alpha: 0.75),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              FadeUp(
                index: 1,
                child: Text(
                  'Leads & Enquiries',
                  style: AppText.display(size: 27, color: Colors.white),
                ),
              ),
              const SizedBox(height: 2),
              FadeUp(
                index: 2,
                child: Text(
                  'Every enquiry from first contact to joined member',
                  style: AppText.body(
                    size: 12.5,
                    weight: FontWeight.w600,
                    color: Colors.white.withValues(alpha: 0.88),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              FadeUp(
                index: 3,
                child: Row(
                  children: [
                    Expanded(
                      child: _Headline(
                        'Today',
                        Icons.wb_sunny_rounded,
                        data?.today,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _Headline(
                        'This month',
                        Icons.calendar_view_month_rounded,
                        data?.thisMonth,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _Headline(
                        'This year',
                        Icons.date_range_rounded,
                        data?.thisYear,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              FadeUp(
                index: 4,
                child: Row(
                  children: [
                    Expanded(
                      child: LeadHeroAction(
                        label: 'All leads',
                        icon: Icons.view_agenda_rounded,
                        onTap: onAll,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: LeadHeroAction(
                        label: 'Follow-ups',
                        icon: Icons.event_available_rounded,
                        onTap: onFollowUps,
                      ),
                    ),
                    if (canCreate) ...[
                      const SizedBox(width: 8),
                      Expanded(
                        child: LeadHeroAction(
                          label: 'New lead',
                          icon: Icons.person_add_alt_1_rounded,
                          onTap: onNew,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Headline extends StatelessWidget {
  const _Headline(this.label, this.icon, this.p);

  final String label;
  final IconData icon;
  final LeadHeadlinePeriod? p;

  @override
  Widget build(BuildContext context) {
    final delta = deltaText(p?.newLeadsDelta);
    final up = (p?.newLeadsDelta ?? 0) >= 0;
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 10, 8, 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 12, color: Colors.white.withValues(alpha: 0.85)),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  label.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 9.5,
                    weight: FontWeight.w800,
                    color: Colors.white.withValues(alpha: 0.85),
                  ).copyWith(letterSpacing: 0.6),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          if (p == null)
            Text('–', style: AppText.display(size: 26, color: Colors.white))
          else
            CountUp(
              value: p!.newLeads,
              style: AppText.display(size: 26, color: Colors.white),
            ),
          Text(
            'enquiries',
            style: AppText.body(
              size: 10,
              color: Colors.white.withValues(alpha: 0.75),
            ),
          ),
          const SizedBox(height: 3),
          Text(
            p == null ? ' ' : '${p!.converted} converted',
            style: AppText.body(
              size: 11,
              weight: FontWeight.w800,
              color: const Color(0xFF6EE7B7),
            ),
          ),
          Text(
            p == null
                ? ' '
                : delta == null
                    ? 'no prior data'
                    : '$delta vs prev',
            style: AppText.body(
              size: 10,
              weight: FontWeight.w700,
              color: delta == null
                  ? Colors.white.withValues(alpha: 0.6)
                  : (up ? const Color(0xFF6EE7B7) : const Color(0xFFFDA4AF)),
            ),
          ),
        ],
      ),
    );
  }
}

// ── range chips ──────────────────────────────────────────────────────────

class _RangeChips extends StatelessWidget {
  const _RangeChips({required this.state, required this.onCustom});

  final LeadAnalyticsState state;
  final VoidCallback onCustom;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<LeadAnalyticsCubit>();
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        children: [
          for (final r in LeadRange.values)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _RangeChip(
                label: r == LeadRange.custom &&
                        state.range == LeadRange.custom &&
                        state.from != null &&
                        state.to != null
                    ? '${fmtDay(state.from)} – ${fmtDay(state.to)}'
                    : r.label,
                icon: r == LeadRange.custom ? Icons.date_range_rounded : null,
                selected: r == state.range,
                onTap: r == LeadRange.custom ? onCustom : () => cubit.load(r),
              ),
            ),
        ],
      ),
    );
  }
}

class _RangeChip extends StatelessWidget {
  const _RangeChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
  });

  final String label;
  final IconData? icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(99),
          gradient: selected ? LeadColors.cta : null,
          color: selected ? null : AppColors.surface,
          border: selected ? null : Border.all(color: AppColors.line),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: LeadColors.violet.withValues(alpha: 0.4),
                    blurRadius: 14,
                    offset: const Offset(0, 5),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 15,
                color: selected ? Colors.white : AppColors.inkSoft,
              ),
              const SizedBox(width: 5),
            ],
            Text(
              label,
              style: AppText.body(
                size: 12.5,
                weight: FontWeight.w800,
                color: selected ? Colors.white : AppColors.inkSoft,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return Looping(
      duration: const Duration(milliseconds: 1100),
      reverse: true,
      builder: (context, t) {
        Widget box(double h) => Opacity(
              opacity: 0.45 + 0.4 * t,
              child: Container(
                height: h,
                margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(
                  color: AppColors.surface2,
                  borderRadius: BorderRadius.circular(20),
                ),
              ),
            );
        return Column(
          children: [
            Row(
              children: [
                Expanded(child: box(96)),
                const SizedBox(width: 10),
                Expanded(child: box(96)),
              ],
            ),
            Row(
              children: [
                Expanded(child: box(96)),
                const SizedBox(width: 10),
                Expanded(child: box(96)),
              ],
            ),
            box(150),
            box(150),
          ],
        );
      },
    );
  }
}

// ── content ──────────────────────────────────────────────────────────────

class _Content extends StatelessWidget {
  const _Content({
    required this.data,
    required this.counts,
    required this.summary,
    required this.followUps,
    required this.teamScope,
    required this.onScope,
    required this.onOpenList,
    required this.onReload,
  });

  final LeadAnalytics data;
  final LeadCounts? counts;
  final LeadSummary? summary;
  final LeadFollowUps? followUps;
  final bool teamScope;
  final ValueChanged<bool> onScope;
  final void Function({LeadFilters filters, bool board}) onOpenList;
  final VoidCallback onReload;

  String _rate(double? v) =>
      v == null ? '–' : '${(v * 100).toStringAsFixed(1)}%';

  void _kpiSheet(
    BuildContext context, {
    required IconData icon,
    required String title,
    required Color color,
    required Widget body,
  }) {
    showLeadSheet<void>(
      context,
      (_) => LeadSheetScaffold(
        icon: icon,
        title: title,
        subtitle: 'Selected range vs the period before it',
        color: color,
        child: body,
      ),
    );
  }

  /// Pops the sheet, then opens the list with [filters].
  VoidCallback _toList(
    BuildContext context,
    LeadFilters filters, {
    bool board = false,
  }) =>
      () {
        Navigator.of(context).pop();
        onOpenList(filters: filters, board: board);
      };

  @override
  Widget build(BuildContext context) {
    final d = data;
    final c = counts;
    final tiles = <Widget>[
      LeadKpiTile(
        index: 0,
        label: 'New leads',
        color: LeadColors.indigo,
        icon: Icons.person_add_alt_1_rounded,
        intValue: d.newLeads.intValue,
        deltaPercent: d.newLeads.deltaPercent,
        onTap: () => _kpiSheet(
          context,
          icon: Icons.person_add_alt_1_rounded,
          title: 'New leads',
          color: LeadColors.indigo,
          body: _PeriodSheet(
            kpi: d.newLeads,
            color: LeadColors.indigo,
            unit: 'enquiries',
            note: 'Leads created in the selected range.',
            chart: d.daily.length >= 2
                ? DrawnSparkline(
                    values: [for (final p in d.daily) p.newLeads.toDouble()],
                    colors: const [LeadColors.indigo, LeadColors.fuchsia],
                  )
                : null,
            actionLabel: 'Open all leads',
            onAction: _toList(context, const LeadFilters()),
          ),
        ),
      ),
      LeadKpiTile(
        index: 1,
        label: 'Converted',
        color: LeadColors.green,
        icon: Icons.verified_rounded,
        intValue: d.converted.intValue,
        deltaPercent: d.converted.deltaPercent,
        onTap: () => _kpiSheet(
          context,
          icon: Icons.verified_rounded,
          title: 'Converted',
          color: LeadColors.green,
          body: _PeriodSheet(
            kpi: d.converted,
            color: LeadColors.green,
            unit: 'new members',
            note: 'Leads converted to members in the selected range.',
            ring: d.conversionRate.value,
            ringLabel: 'conversion',
            chart: d.daily.length >= 2
                ? DrawnSparkline(
                    values: [for (final p in d.daily) p.converted.toDouble()],
                    colors: const [LeadColors.teal, LeadColors.green],
                  )
                : null,
            actionLabel: 'View converted leads',
            onAction: _toList(
              context,
              const LeadFilters(status: LeadStatus.converted),
            ),
          ),
        ),
      ),
      LeadKpiTile(
        index: 2,
        label: 'Conversion rate',
        color: LeadColors.fuchsia,
        icon: Icons.percent_rounded,
        text: _rate(d.conversionRate.value),
        deltaPercent: d.conversionRate.deltaPercent,
        onTap: () => _kpiSheet(
          context,
          icon: Icons.percent_rounded,
          title: 'Conversion rate',
          color: LeadColors.fuchsia,
          body: _PeriodSheet(
            kpi: d.conversionRate,
            color: LeadColors.fuchsia,
            valueText: _rate(d.conversionRate.value),
            previousText: _rate(d.conversionRate.previous),
            note: '${d.converted.intValue} of ${d.newLeads.intValue} leads '
                'created in this range have converted.',
            ring: d.conversionRate.value,
            ringLabel: 'of leads',
          ),
        ),
      ),
      LeadKpiTile(
        index: 3,
        label: 'Open leads',
        color: LeadColors.violet,
        icon: Icons.bolt_rounded,
        intValue: d.open.intValue,
        onTap: () => _kpiSheet(
          context,
          icon: Icons.bolt_rounded,
          title: 'Open leads',
          color: LeadColors.violet,
          body: _OpenSheet(
            counts: c,
            total: d.open.intValue,
            onStage: (s) => _toList(context, LeadFilters(status: s))(),
          ),
        ),
      ),
      LeadKpiTile(
        index: 4,
        label: 'Follow-ups today',
        color: LeadColors.amber,
        icon: Icons.today_rounded,
        intValue: d.followUpsDueToday.intValue,
        onTap: () => _kpiSheet(
          context,
          icon: Icons.today_rounded,
          title: 'Follow-ups today',
          color: LeadColors.amber,
          body: _FollowUpSheet(
            bucket: 'today',
            color: LeadColors.amber,
            count: d.followUpsDueToday.intValue,
            onOpen: _toList(context, const LeadFilters(followUp: 'today')),
          ),
        ),
      ),
      LeadKpiTile(
        index: 5,
        label: 'Overdue',
        color: LeadColors.rose,
        icon: Icons.alarm_rounded,
        intValue: d.followUpsOverdue.intValue,
        onTap: () => _kpiSheet(
          context,
          icon: Icons.alarm_rounded,
          title: 'Overdue follow-ups',
          color: LeadColors.rose,
          body: _FollowUpSheet(
            bucket: 'overdue',
            color: LeadColors.rose,
            count: d.followUpsOverdue.intValue,
            onOpen: _toList(context, const LeadFilters(followUp: 'overdue')),
          ),
        ),
      ),
      LeadKpiTile(
        index: 6,
        label: 'Avg days to convert',
        color: LeadColors.teal,
        icon: Icons.timelapse_rounded,
        text: d.avgDaysToConvert.value == null
            ? '–'
            : d.avgDaysToConvert.value!.toStringAsFixed(1),
        onTap: () => _kpiSheet(
          context,
          icon: Icons.timelapse_rounded,
          title: 'Avg days to convert',
          color: LeadColors.teal,
          body: _PeriodSheet(
            kpi: d.avgDaysToConvert,
            color: LeadColors.teal,
            valueText: d.avgDaysToConvert.value == null
                ? '–'
                : d.avgDaysToConvert.value!.toStringAsFixed(1),
            previousText: d.avgDaysToConvert.previous == null
                ? '–'
                : d.avgDaysToConvert.previous!.toStringAsFixed(1),
            note: d.avgDaysToConvert.value == null
                ? 'Nothing converted in this range yet.'
                : 'Average days between a lead being created and converting '
                    '(lower is better).',
            invertDelta: true,
          ),
        ),
      ),
      LeadKpiTile(
        index: 7,
        label: 'Lost',
        color: LeadColors.slate,
        icon: Icons.cancel_rounded,
        intValue: d.lost.intValue,
        deltaPercent: d.lost.deltaPercent,
        invertDelta: true,
        onTap: () => _kpiSheet(
          context,
          icon: Icons.cancel_rounded,
          title: 'Lost leads',
          color: LeadColors.rose,
          body: _PeriodSheet(
            kpi: d.lost,
            color: LeadColors.rose,
            unit: 'lost',
            note: 'Leads marked lost in the selected range.',
            invertDelta: true,
            actionLabel: 'View lost leads',
            onAction: _toList(
              context,
              const LeadFilters(status: LeadStatus.lost),
            ),
            extra: d.lostReasons.isEmpty
                ? null
                : Column(
                    children: [
                      for (final r in d.lostReasons)
                        LeadBarRow(
                          label: LeadLostReason.labelOf(r.reason),
                          value: '${r.count}',
                          fraction: r.count / d.lostReasons.first.count,
                          color: LeadColors.rose,
                        ),
                    ],
                  ),
          ),
        ),
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: tiles.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            mainAxisExtent: 100,
          ),
          itemBuilder: (_, i) => tiles[i],
        ),
        const SizedBox(height: 14),
        _PipelinePanel(
          counts: c,
          summary: summary,
          onStage: (s) => onOpenList(filters: LeadFilters(status: s)),
          onBoard: () => onOpenList(board: true),
          onAll: onOpenList,
        ),
        const SizedBox(height: 14),
        _FollowUpsPanel(
          data: followUps,
          team: teamScope,
          onScope: onScope,
          onReload: onReload,
        ),
        const SizedBox(height: 14),
        LeadInsights(data: d),
      ],
    );
  }
}

// ── pipeline + follow-ups panels ─────────────────────────────────────────

class _PipelinePanel extends StatelessWidget {
  const _PipelinePanel({
    required this.counts,
    required this.summary,
    required this.onStage,
    required this.onBoard,
    required this.onAll,
  });

  final LeadCounts? counts;
  final LeadSummary? summary;
  final ValueChanged<LeadStatus> onStage;
  final VoidCallback onBoard;
  final VoidCallback onAll;

  @override
  Widget build(BuildContext context) {
    final c = counts;
    return FadeUp(
      index: 0,
      child: LeadPanel(
        icon: Icons.view_kanban_rounded,
        color: LeadColors.violet,
        title: 'Pipeline',
        subtitle: summary == null
            ? 'All-time, by stage'
            : '${summary!.open} open · ${summary!.converted} converted · '
                '${summary!.lost} lost',
        badge: c == null ? null : '${c.all} leads',
        child: c == null
            ? const LeadEmptyLine('Loading pipeline…')
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LeadSegmentBar(
                    parts: [
                      for (final s in LeadStatus.values)
                        (c.of(s), leadStatusColor(s)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final s in LeadStatus.values)
                        GestureDetector(
                          onTap: () => onStage(s),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 7,
                            ),
                            decoration: BoxDecoration(
                              color: leadStatusColor(s).withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(99),
                              border: Border.all(
                                color:
                                    leadStatusColor(s).withValues(alpha: 0.4),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  leadStatusIcon(s),
                                  size: 14,
                                  color: leadStatusColor(s),
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  '${s.label} · ${c.of(s)}',
                                  style: AppText.body(
                                    size: 12,
                                    weight: FontWeight.w800,
                                    color: leadStatusColor(s),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _OutlineAction(
                          label: 'Open board',
                          icon: Icons.view_kanban_rounded,
                          color: LeadColors.violet,
                          onTap: onBoard,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _OutlineAction(
                          label: 'All leads',
                          icon: Icons.view_agenda_rounded,
                          color: LeadColors.indigo,
                          onTap: onAll,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
      ),
    );
  }
}

class _OutlineAction extends StatelessWidget {
  const _OutlineAction({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 40,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w800,
                  color: color,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FollowUpsPanel extends StatelessWidget {
  const _FollowUpsPanel({
    required this.data,
    required this.team,
    required this.onScope,
    required this.onReload,
  });

  final LeadFollowUps? data;
  final bool team;
  final ValueChanged<bool> onScope;
  final VoidCallback onReload;

  @override
  Widget build(BuildContext context) {
    final d = data;
    return FadeUp(
      index: 1,
      child: LeadPanel(
        icon: Icons.event_available_rounded,
        color: LeadColors.amber,
        title: 'Follow-ups',
        subtitle: d == null
            ? 'Due today and overdue'
            : '${d.overdue} overdue · ${d.today} today · ${d.upcoming} upcoming',
        action: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _ScopePill(
              label: 'Team',
              selected: team,
              onTap: () => onScope(true),
            ),
            const SizedBox(width: 4),
            _ScopePill(
              label: 'Mine',
              selected: !team,
              onTap: () => onScope(false),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (d == null)
              const LeadEmptyLine('Loading follow-ups…')
            else if (d.items.isEmpty)
              const LeadEmptyLine(
                'Nothing due. No overdue or due-today follow-ups.',
              )
            else
              for (final l in d.items)
                LeadCard(
                  lead: l,
                  showFollowUpActions: true,
                  onReturn: onReload,
                ),
            const SizedBox(height: 2),
            _OutlineAction(
              label: 'See all follow-ups',
              icon: Icons.arrow_forward_rounded,
              color: LeadColors.amber,
              onTap: () =>
                  context.push(AppRoutes.leadFollowUps).then((_) => onReload()),
            ),
          ],
        ),
      ),
    );
  }
}

class _ScopePill extends StatelessWidget {
  const _ScopePill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(99),
          color: selected
              ? LeadColors.amber.withValues(alpha: 0.2)
              : Colors.transparent,
          border: Border.all(
            color: selected ? LeadColors.amber : AppColors.line,
          ),
        ),
        child: Text(
          label,
          style: AppText.body(
            size: 11,
            weight: FontWeight.w800,
            color: selected ? LeadColors.amber : AppColors.inkFaint,
          ),
        ),
      ),
    );
  }
}

// ── KPI sheets ───────────────────────────────────────────────────────────

class _PeriodSheet extends StatelessWidget {
  const _PeriodSheet({
    required this.kpi,
    required this.color,
    required this.note,
    this.unit = '',
    this.valueText,
    this.previousText,
    this.ring,
    this.ringLabel = '',
    this.chart,
    this.extra,
    this.actionLabel,
    this.onAction,
    this.invertDelta = false,
  });

  final LeadKpi kpi;
  final Color color;
  final String note;
  final String unit;
  final String? valueText;
  final String? previousText;
  final double? ring;
  final String ringLabel;
  final Widget? chart;
  final Widget? extra;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// Lower is better (lost leads, days to convert): colour the delta green
  /// when it goes down.
  final bool invertDelta;

  @override
  Widget build(BuildContext context) {
    final delta = kpi.deltaPercent;
    final good = delta == null ? true : (invertDelta ? delta <= 0 : delta >= 0);
    final dc = good ? LeadColors.green : LeadColors.rose;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            if (ring != null) ...[
              AnimatedRing(
                value: ring!,
                size: 92,
                stroke: 10,
                colors: [color, Color.lerp(color, LeadColors.fuchsia, 0.6)!],
                track: color.withValues(alpha: 0.15),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CountUp(
                      value: (ring! * 100).round(),
                      suffix: '%',
                      style: AppText.display(size: 18),
                    ),
                    if (ringLabel.isNotEmpty)
                      Text(
                        ringLabel,
                        style: AppText.body(
                          size: 9.5,
                          color: AppColors.inkFaint,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      if (valueText != null)
                        Text(
                          valueText!,
                          style: AppText.display(size: 34, color: color),
                        )
                      else
                        CountUp(
                          value: kpi.intValue,
                          style: AppText.display(size: 34, color: color),
                        ),
                      if (unit.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 7),
                          child: Text(
                            unit,
                            style: AppText.body(
                              size: 13,
                              color: AppColors.inkFaint,
                              weight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        'Previous: ${previousText ?? (kpi.previous == null ? '–' : kpi.previous!.round().toString())}',
                        style: AppText.body(
                          size: 12.5,
                          color: AppColors.inkSoft,
                          weight: FontWeight.w600,
                        ),
                      ),
                      if (delta != null)
                        LeadTagChip(
                          icon: delta >= 0
                              ? Icons.arrow_upward_rounded
                              : Icons.arrow_downward_rounded,
                          label: '${delta.abs().round()}%',
                          color: dc,
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          note,
          style: AppText.body(size: 12.5, color: AppColors.inkSoft),
        ),
        if (chart != null) ...[const SizedBox(height: 14), chart!],
        if (extra != null) ...[const SizedBox(height: 14), extra!],
        if (actionLabel != null && onAction != null) ...[
          const SizedBox(height: 16),
          _OutlineAction(
            label: actionLabel!,
            icon: Icons.arrow_forward_rounded,
            color: color,
            onTap: onAction!,
          ),
        ],
      ],
    );
  }
}

class _OpenSheet extends StatelessWidget {
  const _OpenSheet({
    required this.counts,
    required this.total,
    required this.onStage,
  });

  final LeadCounts? counts;
  final int total;
  final ValueChanged<LeadStatus> onStage;

  @override
  Widget build(BuildContext context) {
    final c = counts;
    final open = LeadStatus.values.where((s) => s.isOpen).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            CountUp(
              value: total,
              style: AppText.display(size: 34, color: LeadColors.violet),
            ),
            const SizedBox(width: 8),
            Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: Text(
                'in the pipeline (all-time)',
                style: AppText.body(
                  size: 13,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (c == null)
          const LeadEmptyLine('Loading stages…')
        else ...[
          LeadSegmentBar(
            parts: [for (final s in open) (c.of(s), leadStatusColor(s))],
          ),
          const SizedBox(height: 14),
          for (final s in open)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => onStage(s),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: leadStatusColor(s).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          leadStatusIcon(s),
                          size: 18,
                          color: leadStatusColor(s),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            s.label,
                            style: AppText.body(
                              size: 13.5,
                              weight: FontWeight.w700,
                            ),
                          ),
                        ),
                        Text(
                          '${c.of(s)}',
                          style: AppText.display(
                            size: 16,
                            color: leadStatusColor(s),
                          ),
                        ),
                        Icon(
                          Icons.chevron_right_rounded,
                          size: 18,
                          color: AppColors.inkFaint,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ],
    );
  }
}

/// Follow-ups bucket preview: the first leads from `GET /leads/follow-ups`
/// plus a button to open the pre-filtered list.
class _FollowUpSheet extends StatefulWidget {
  const _FollowUpSheet({
    required this.bucket,
    required this.color,
    required this.count,
    required this.onOpen,
  });

  final String bucket;
  final Color color;
  final int count;
  final VoidCallback onOpen;

  @override
  State<_FollowUpSheet> createState() => _FollowUpSheetState();
}

class _FollowUpSheetState extends State<_FollowUpSheet> {
  List<Lead>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await getIt<LeadRepository>().followUps(
        scope: 'all',
        bucket: widget.bucket,
        limit: 8,
      );
      if (mounted) setState(() => _items = r.items);
    } on Object {
      if (mounted) setState(() => _error = 'Could not load these leads.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            CountUp(
              value: widget.count,
              style: AppText.display(size: 34, color: widget.color),
            ),
            const SizedBox(width: 8),
            Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: Text(
                widget.bucket == 'overdue' ? 'missed' : 'due today',
                style: AppText.body(
                  size: 13,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_error != null)
          LeadEmptyLine(_error!)
        else if (items == null)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2.5)),
          )
        else if (items.isEmpty)
          const LeadEmptyLine('Nothing here right now.')
        else
          for (final l in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () {
                    Navigator.of(context).pop();
                    context.push(AppRoutes.leadDetail, extra: l.id);
                  },
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: widget.color.withValues(alpha: 0.09),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        LeadAvatar(
                          name: l.name,
                          size: 38,
                          color: leadStatusColor(l.status),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                l.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 13.5,
                                  weight: FontWeight.w800,
                                ),
                              ),
                              Text(
                                '${l.phone} · ${fmtWhen(l.nextFollowUpAt)}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 11,
                                  color: AppColors.inkFaint,
                                ),
                              ),
                            ],
                          ),
                        ),
                        LeadStatusPill(l.status),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        const SizedBox(height: 10),
        _OutlineAction(
          label: 'Open in list',
          icon: Icons.arrow_forward_rounded,
          color: widget.color,
          onTap: widget.onOpen,
        ),
      ],
    );
  }
}
