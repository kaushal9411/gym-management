import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/reports/report_summary_cubit.dart';
import '../../../../bloc/session/session_cubit.dart';
import '../../../../bloc/session/session_state.dart';
import '../../../../core/di/service_locator.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../models/payments_analytics.dart' show AnalyticsRange;
import '../../../../models/report_summary.dart';
import '../../../../repositories/reports_repository.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../finance/presentation/widgets/analytics_parts.dart';

/// One reusable summary strip for every report screen that maps to one of
/// the 11 backend report types (`GET /reports/:type/summary`, perm
/// `reports:view`). Drop it above the list and pass the screen's own
/// filters; it reloads itself whenever [filters] changes and never touches
/// the list, its filters or its pagination.
///
/// Collapsed (default) it is a single horizontally-scrolling row of KPI
/// chips so the list keeps almost all of the viewport; "Details" expands the
/// first breakdown as share bars and, for date-ranged types, the daily
/// series as a this-vs-previous mini trend (shared `AnalyticsTrendPainter`).
///
/// Hidden completely without `reports:view` or on HTTP 403. Loading is a
/// slim bar, errors a one-line retry, an all-empty summary renders nothing.
///
/// Dropped vs web, and why:
///  * Donut breakdowns (`kind: 'donut'`) -> the same ranked share bars as
///    `kind: 'bar'`: donuts + legends don't fit a phone strip.
///  * Second and later breakdowns (e.g. "Expiring by plan", "Collected by
///    method") -> only the first is shown to keep the strip compact; the
///    full data is in the model and the Reports Center insights cover
///    methods/plans.
///  * Chart hover tooltips -> the series shows its range and peak day.
///  * Export buttons -> mobile has no file-saving package (see the guide's
///    "Download PDF" drop).
class ReportSummaryHeader extends StatefulWidget {
  const ReportSummaryHeader({
    super.key,
    required this.type,
    this.filters = const ReportSummaryFilters(),
    this.invertDeltas = false,
  });

  /// Report path segment, e.g. `revenue`, `expiring-memberships`.
  final String type;
  final ReportSummaryFilters filters;

  /// Spending-style reports (expenses): a rise is bad, so deltas flip colour.
  final bool invertDeltas;

  @override
  State<ReportSummaryHeader> createState() => _ReportSummaryHeaderState();
}

class _ReportSummaryHeaderState extends State<ReportSummaryHeader> {
  late final ReportSummaryCubit _cubit;
  bool _expanded = false;

  bool get _canView {
    final session = context.read<SessionCubit>().state;
    return session is SessionAuthenticatedStaff &&
        session.user.hasPermission('reports:view');
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
  }

  @override
  void didUpdateWidget(ReportSummaryHeader old) {
    super.didUpdateWidget(old);
    if (old.filters != widget.filters && _canView) {
      unawaited(_cubit.load(widget.filters));
    }
  }

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ReportSummaryCubit, ReportSummaryState>(
      bloc: _cubit,
      builder: (context, state) {
        final Widget body = switch (state) {
          ReportSummaryForbidden() => const SizedBox.shrink(),
          ReportSummaryLoading() => const Padding(
              padding: EdgeInsets.fromLTRB(18, 0, 18, 8),
              child: ClipRRect(
                borderRadius: BorderRadius.all(Radius.circular(AppRadii.pill)),
                child: LinearProgressIndicator(
                  minHeight: 3,
                  color: AppColors.staffB,
                  backgroundColor: AppColors.surface3,
                ),
              ),
            ),
          ReportSummaryError(:final message) => Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Summary unavailable: $message',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 11, color: AppColors.inkFaint),
                    ),
                  ),
                  TextButton(
                    onPressed: () => _cubit.load(widget.filters),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ReportSummaryLoaded(:final data) => data.isEmpty
              ? const SizedBox.shrink()
              : _Strip(
                  type: widget.type,
                  data: data,
                  expanded: _expanded,
                  invertDeltas: widget.invertDeltas,
                  onToggle: () => setState(() => _expanded = !_expanded),
                ),
        };
        return AnimatedSize(
          duration: reduceMotion(context)
              ? Duration.zero
              : const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          alignment: Alignment.topCenter,
          child: body,
        );
      },
    );
  }
}

/// Which breakdowns/series carry money (the API sends bare numbers; the
/// unit is implied by report type + breakdown key — see
/// `report-summary.util.ts`). Everything else is a count.
const _moneyBreakdowns = {
  'revenue/by-method',
  'expenses/by-category',
  'payments/by-method',
  'branch-performance/revenue-per-branch',
};
const _moneySeries = {'revenue', 'expenses', 'payments'};

String _formatKpi(SummaryKpi k, double v) => switch (k.format) {
      SummaryFormat.money => Formatters.currencyCompact(v),
      SummaryFormat.percent => '${(v * k.percentScale).toStringAsFixed(0)}%',
      SummaryFormat.text => k.text,
      SummaryFormat.number =>
        v == v.roundToDouble() ? v.round().toString() : v.toStringAsFixed(1),
    };

class _Strip extends StatelessWidget {
  const _Strip({
    required this.data,
    required this.expanded,
    required this.invertDeltas,
    required this.onToggle,
    required this.type,
  });

  final String type;
  final ReportSummary data;
  final bool expanded;
  final bool invertDeltas;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final breakdown = data.breakdowns.isEmpty ? null : data.breakdowns.first;
    final series = data.series;
    final hasDetails = (breakdown != null && breakdown.items.isNotEmpty) ||
        (series != null && series.points.isNotEmpty);
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
      child: StaggeredReveal(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: 62,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: data.kpis.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) =>
                    _KpiChip(kpi: data.kpis[i], invert: invertDeltas),
              ),
            ),
            if (hasDetails)
              Align(
                alignment: Alignment.centerLeft,
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                    onTap: onToggle,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 6,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            expanded ? 'Hide details' : 'Details',
                            style: AppText.body(
                              size: 11.5,
                              weight: FontWeight.w800,
                              color: AppColors.staffPillFg,
                            ),
                          ),
                          Icon(
                            expanded
                                ? Icons.expand_less_rounded
                                : Icons.expand_more_rounded,
                            size: 16,
                            color: AppColors.staffPillFg,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            if (expanded && hasDetails) ...[
              if (breakdown != null && breakdown.items.isNotEmpty)
                _BreakdownBlock(
                  breakdown: breakdown,
                  money: _moneyBreakdowns.contains('$type/${breakdown.key}'),
                ),
              if (series != null && series.points.isNotEmpty) ...[
                const SizedBox(height: 8),
                _SeriesBlock(
                  series: series,
                  range: data.range,
                  money: _moneySeries.contains(type),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _KpiChip extends StatelessWidget {
  const _KpiChip({required this.kpi, required this.invert});

  final SummaryKpi kpi;
  final bool invert;

  @override
  Widget build(BuildContext context) {
    final d = kpi.deltaPercent;
    final good = d == null ? true : (invert ? d <= 0 : d >= 0);
    final numeric = kpi.format != SummaryFormat.text;
    final style = AppText.display(size: 17);
    return Container(
      constraints: const BoxConstraints(minWidth: 104),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(kpi.label, style: AppText.eyebrow()),
          const SizedBox(height: 3),
          Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              numeric
                  ? AnimatedNumber(
                      value: kpi.value,
                      format: (v) => _formatKpi(kpi, v),
                      style: style,
                    )
                  : Text(kpi.text, style: style),
              if (d != null) ...[
                const SizedBox(width: 6),
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(
                    deltaText(d)!,
                    style: AppText.body(
                      size: 10.5,
                      weight: FontWeight.w800,
                      color: good ? AppColors.success : AppColors.danger,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _BreakdownBlock extends StatelessWidget {
  const _BreakdownBlock({required this.breakdown, required this.money});

  final SummaryBreakdown breakdown;
  final bool money;

  @override
  Widget build(BuildContext context) {
    final items = breakdown.items;
    final total = items.fold<double>(0, (s, e) => s + e.value);
    var maxV = 0.0;
    for (final i in items) {
      if (i.value > maxV) maxV = i.value;
    }
    // Donut-kind breakdowns are shares of a whole; bar-kind ones are scaled
    // to the largest item. Both render as the same share bars.
    final isShare = breakdown.kind == 'donut';
    String fmt(double v) =>
        v == v.roundToDouble() ? v.round().toString() : v.toStringAsFixed(1);
    return AnalyticsBlock(
      title: breakdown.title,
      child: maxV <= 0
          ? analyticsEmpty('Nothing to show for these filters.')
          : Column(
              children: [
                for (final i in items)
                  AnalyticsBar(
                    animate: true,
                    label: _label(i.label),
                    value: money ? Formatters.currency(i.value) : fmt(i.value),
                    fraction: i.value / maxV,
                    sub: isShare && total > 0 ? pctText(i.value / total) : null,
                  ),
              ],
            ),
    );
  }

  /// Labels are server text (plan/trainer/branch names, or ENUM_CASE
  /// statuses/methods). Only prettify ones that are clearly SCREAMING_CASE.
  String _label(String raw) =>
      raw == raw.toUpperCase() && raw.contains(RegExp('[A-Z]'))
          ? prettyEnum(raw)
          : raw;
}

class _SeriesBlock extends StatelessWidget {
  const _SeriesBlock({
    required this.series,
    required this.range,
    required this.money,
  });

  final SummarySeries series;
  final AnalyticsRange? range;
  final bool money;

  @override
  Widget build(BuildContext context) {
    final pts = series.points;
    final hasData = pts.any((p) => p.value > 0 || p.previous > 0);
    SummaryPoint? peak;
    for (final p in pts) {
      if (p.value > 0 && (peak == null || p.value > peak.value)) peak = p;
    }
    return AnalyticsBlock(
      title: series.title,
      trailing: range == null
          ? null
          : '${shortDate(range!.from)} – ${shortDate(range!.to)}',
      child: !hasData
          ? analyticsEmpty('No activity in this period or the one before.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                WipeReveal(
                  child: SizedBox(
                    height: 70,
                    width: double.infinity,
                    child: CustomPaint(
                      painter: AnalyticsTrendPainter(
                        current: pts.map((p) => p.value).toList(),
                        previous: pts.map((p) => p.previous).toList(),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const AnalyticsDot(color: AppColors.staffB),
                    Text(
                      '  This period',
                      style: AppText.body(size: 11, color: AppColors.inkSoft),
                    ),
                    const SizedBox(width: 14),
                    const AnalyticsDot(color: AppColors.inkFaint),
                    Text(
                      '  Previous',
                      style: AppText.body(size: 11, color: AppColors.inkSoft),
                    ),
                  ],
                ),
                if (peak != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Peak ${shortDate(peak.date)} · '
                    '${money ? Formatters.currency(peak.value) : peak.value.round()}',
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
