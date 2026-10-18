import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/reports/report_summary_cubit.dart';
import '../../../../bloc/session/session_cubit.dart';
import '../../../../bloc/session/session_state.dart';
import '../../../../core/di/service_locator.dart';
import '../../../../models/report_summary.dart';
import '../../../../repositories/reports_repository.dart';
import 'rpt_bars.dart';
import 'rpt_chart_card.dart';
import 'rpt_chart_math.dart';
import 'rpt_donut.dart';
import 'rpt_format.dart';
import 'rpt_kpi.dart';
import 'rpt_layout.dart';
import 'rpt_line_charts.dart';
import 'rpt_theme.dart';

/// Which breakdowns / series carry money (the API sends bare numbers; the
/// unit is implied by report type + breakdown key — see
/// `report-summary.util.ts`). Everything else is a count.
const kRptMoneyBreakdowns = {
  'revenue/by-method',
  'expenses/by-category',
  'payments/by-method',
  'branch-performance/revenue-per-branch',
};
const kRptMoneySeries = {'revenue', 'expenses', 'payments'};

final _invertKpi = RegExp(
  'expense|churn|outstanding|overdue|refund|expiring|inactive|failed',
  caseSensitive: false,
);

/// KPI strip + series chart + breakdown charts for one loaded
/// [ReportSummary] (web's `ReportSummarySection`) — the same generic block
/// for all 11 tabular reports.
///
///  * KPIs -> [RptKpiGrid] (money/percent/count/text; delta vs previous when
///    [compare]; expense/churn-style KPIs colour-inverted automatically, or
///    all of them with [invertDeltas]).
///  * `series` -> [RptTrendChart] (Daily / Cumulative, dashed previous).
///  * `breakdowns` -> [RptDonut] (`kind: donut`) or [RptHBarChart]
///    (`kind: bar`, previous ticks while comparing).
class RptSummarySection extends StatelessWidget {
  const RptSummarySection({
    super.key,
    required this.type,
    required this.summary,
    this.accent = RptAccent.members,
    this.compare = true,
    this.invertDeltas = false,
    this.labelFor,
    this.colorFor,
    this.tint,
  });

  /// Overrides [accent]'s colour (Expenses lean rose, not Finance green).
  final Color? tint;

  /// Report path segment (`revenue`, `payments`, ...), used to tell money
  /// breakdowns from counts.
  final String type;
  final ReportSummary summary;
  final RptAccent accent;
  final bool compare;
  final bool invertDeltas;

  /// Optional display label for a breakdown item: `(breakdownKey, apiLabel)`
  /// -> text. The API sends raw enums (`ONLINE_GATEWAY`, `OFFICE_SUPPLIES`);
  /// money reports use this to show "Online Gateway". Default: as sent.
  final String Function(String breakdownKey, String label)? labelFor;

  /// Optional semantic colour per breakdown item (`breakdownKey`, `apiLabel`)
  /// — e.g. member status `ACTIVE` green; null keeps the categorical colour.
  final Color? Function(String breakdownKey, String label)? colorFor;

  @override
  Widget build(BuildContext context) {
    final color = tint ?? accent.color;
    final hasPrev = compare && summary.previousRange != null;
    final kpis = [
      for (final k in summary.kpis) _kpi(k, color, hasPrev),
    ];
    final series = summary.series;
    final seriesMoney = kRptMoneySeries.contains(type);
    final panels = <RptPanel>[
      if (series != null && series.points.isNotEmpty)
        RptPanel(
          full: true,
          RptChartCard(
            title: series.title,
            subtitle: hasPrev ? 'This period vs previous period' : null,
            icon: Icons.show_chart_rounded,
            color: color,
            child: RptTrendChart(
              points: [
                for (final p in series.points)
                  RptPoint(
                    label: rptShortDate(p.date),
                    tip: p.date,
                    value: p.value,
                    previous: hasPrev ? p.previous : null,
                  ),
              ],
              format: seriesMoney ? RptFormat.money : RptFormat.number,
              color: color,
              showPrevious: hasPrev,
              modes: const [RptTrendMode.daily, RptTrendMode.cumulative],
            ),
          ),
        ),
      for (final b in summary.breakdowns)
        if (b.items.isNotEmpty)
          RptPanel(
            RptChartCard(
              title: b.title,
              subtitle: b.kind == 'bar' &&
                      hasPrev &&
                      b.items.any((i) => i.previous != null)
                  ? 'Ticks mark the previous period'
                  : null,
              icon: b.kind == 'donut'
                  ? Icons.donut_large_rounded
                  : Icons.align_horizontal_left_rounded,
              color: color,
              child: _breakdown(b, color, hasPrev),
            ),
          ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (kpis.isNotEmpty) RptKpiGrid(kpis: kpis),
        if (kpis.isNotEmpty && panels.isNotEmpty) const SizedBox(height: 12),
        if (panels.isNotEmpty) RptPanelGrid(panels: panels),
      ],
    );
  }

  RptKpi _kpi(SummaryKpi k, Color color, bool hasPrev) {
    final invert = invertDeltas || _invertKpi.hasMatch('${k.key} ${k.label}');
    switch (k.format) {
      case SummaryFormat.text:
        return RptKpi(label: k.label, value: 0, text: k.text, color: color);
      case SummaryFormat.percent:
        final scale = k.percentScale;
        return RptKpi(
          label: k.label,
          value: k.value * scale,
          previous: hasPrev && k.previous != null ? k.previous! * scale : null,
          format: RptFormat.percent,
          invert: invert,
          icon: Icons.percent_rounded,
          color: color,
        );
      case SummaryFormat.money:
        return RptKpi(
          label: k.label,
          value: k.value,
          previous: hasPrev ? k.previous : null,
          format: RptFormat.money,
          compact: true,
          invert: invert,
          icon: Icons.account_balance_wallet_rounded,
          color: color,
        );
      case SummaryFormat.number:
        return RptKpi(
          label: k.label,
          value: k.value,
          previous: hasPrev ? k.previous : null,
          invert: invert,
          icon: Icons.tag_rounded,
          color: color,
        );
    }
  }

  Widget _breakdown(SummaryBreakdown b, Color color, bool hasPrev) {
    final format = kRptMoneyBreakdowns.contains('$type/${b.key}')
        ? RptFormat.money
        : RptFormat.number;
    String name(String l) => labelFor?.call(b.key, l) ?? l;
    if (b.kind == 'donut') {
      return RptDonut(
        data: [
          for (final i in b.items)
            RptDonutDatum(
              label: name(i.label),
              value: i.value,
              color: colorFor?.call(b.key, i.label),
            ),
        ],
        format: format,
      );
    }
    return RptHBarChart(
      data: [
        for (final i in b.items)
          RptHBarDatum(
            label: name(i.label),
            value: i.value,
            previous: hasPrev ? i.previous : null,
            color: colorFor?.call(b.key, i.label),
          ),
      ],
      format: format,
      color: color,
      limit: 10,
      rankBadges: true,
    );
  }
}

/// Loads `GET /reports/:type/summary` for [filters] and renders it as a
/// [RptSummarySection] — the drop-in replacement for the old
/// `ReportSummaryHeader`. Reloads whenever [filters] changes, never touches
/// the report list or its paging.
///
/// Hidden without `reports:view` (checked up front, no request) and on HTTP
/// 403 (plan-gated module). Shows skeleton tiles while loading and a quiet
/// retry card on errors ("Insights unavailable" — the list is unaffected).
class RptSummaryPanel extends StatefulWidget {
  const RptSummaryPanel({
    super.key,
    required this.type,
    this.filters = const ReportSummaryFilters(),
    this.accent = RptAccent.members,
    this.compare = true,
    this.invertDeltas = false,
    this.labelFor,
    this.colorFor,
    this.onLoaded,
    this.tint,
  });

  /// See [RptSummarySection.tint].
  final Color? tint;

  final String type;
  final ReportSummaryFilters filters;
  final RptAccent accent;

  /// Show previous-period deltas / series (date-ranged reports only; the
  /// API sends no previous range for point-in-time ones anyway).
  final bool compare;
  final bool invertDeltas;

  /// See [RptSummarySection.labelFor].
  final String Function(String breakdownKey, String label)? labelFor;

  /// See [RptSummarySection.colorFor].
  final Color? Function(String breakdownKey, String label)? colorFor;

  /// Called with each freshly loaded summary (asynchronously, never during
  /// build; not called while loading / hidden / failed) so the screen can
  /// feed its hero chips — web builds its hero stats from the first KPIs of
  /// the same summary.
  final ValueChanged<ReportSummary>? onLoaded;

  @override
  State<RptSummaryPanel> createState() => _RptSummaryPanelState();
}

class _RptSummaryPanelState extends State<RptSummaryPanel> {
  late final ReportSummaryCubit _cubit;
  StreamSubscription<ReportSummaryState>? _sub;

  bool get _canView {
    final s = context.read<SessionCubit>().state;
    return s is SessionAuthenticatedStaff &&
        s.user.hasPermission('reports:view');
  }

  @override
  void initState() {
    super.initState();
    _cubit = ReportSummaryCubit(getIt<ReportsRepository>(), widget.type);
    if (_canView) {
      unawaited(_cubit.load(widget.filters));
    } else {
      _cubit.hide();
    }
    _sub = _cubit.stream.listen((s) {
      if (s is ReportSummaryLoaded) widget.onLoaded?.call(s.data);
    });
  }

  @override
  void didUpdateWidget(RptSummaryPanel old) {
    super.didUpdateWidget(old);
    if (old.filters != widget.filters && _canView) {
      unawaited(_cubit.load(widget.filters));
    }
  }

  @override
  void dispose() {
    unawaited(_sub?.cancel());
    _cubit.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ReportSummaryCubit, ReportSummaryState>(
      bloc: _cubit,
      builder: (context, state) => switch (state) {
        ReportSummaryForbidden() => const SizedBox.shrink(),
        ReportSummaryLoading() => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              RptKpiGrid(
                loading: true,
                kpis: [
                  for (var i = 0; i < 4; i++)
                    RptKpi(
                      label: '…',
                      value: 0,
                      color: widget.tint ?? widget.accent.color,
                    ),
                ],
              ),
              const SizedBox(height: 12),
              const RptChartCard(
                loading: true,
                minHeight: 200,
                child: SizedBox(),
              ),
            ],
          ),
        ReportSummaryError() => RptChartCard(
            title: 'Insights',
            icon: Icons.insights_rounded,
            color: widget.tint ?? widget.accent.color,
            error: true,
            errorText:
                'Insights unavailable right now. The report below is unaffected.',
            onRetry: () => _cubit.load(widget.filters),
            minHeight: 60,
            child: const SizedBox(),
          ),
        ReportSummaryLoaded(:final data) => data.isEmpty
            ? const SizedBox.shrink()
            : RptSummarySection(
                type: widget.type,
                summary: data,
                accent: widget.accent,
                compare: widget.compare,
                invertDeltas: widget.invertDeltas,
                labelFor: widget.labelFor,
                colorFor: widget.colorFor,
                tint: widget.tint,
              ),
      },
    );
  }
}
