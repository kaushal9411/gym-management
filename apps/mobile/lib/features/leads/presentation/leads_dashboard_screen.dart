import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/leads/lead_analytics_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/lead.dart';
import '../../../models/lead_analytics.dart';
import '../../../repositories/lead_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../finance/presentation/widgets/analytics_parts.dart';
import 'lead_list_screen.dart';
import 'lead_ui.dart';
import 'widgets/lead_charts.dart';

/// Leads dashboard — `GET /leads/analytics?range=`. Needs `leads:view` (the
/// menu entry is gated on it). Range chips Today / 7D / 30D / Month / Year;
/// the three headline tiles (Today / This month / This year) are independent
/// of the range (server `headline`); KPI tiles for follow-ups due/overdue
/// open the pre-filtered list. Charts are the app's own `CustomPainter` /
/// bar widgets (no chart package): enquiries-vs-converted trend (`daily`,
/// scrolls for long ranges), last-12-months cohort bars (`monthly`), funnel,
/// source breakdown with conversion rate, staff leaderboard, lost reasons,
/// open-lead ageing. Pull-to-refresh keeps numbers on screen.
///
/// Dropped vs web: per-plan and per-branch cohort tables, custom date range,
/// branch filter, hover tooltips (point values are in the sub-labels).
class LeadsDashboardScreen extends StatelessWidget {
  const LeadsDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) {
        final repo = getIt<LeadRepository>();
        return LeadAnalyticsCubit((r) => repo.analytics(range: r))..load();
      },
      child: const _DashboardView(),
    );
  }
}

class _DashboardView extends StatelessWidget {
  const _DashboardView();

  Future<void> _newLead(BuildContext context) async {
    final cubit = context.read<LeadAnalyticsCubit>();
    await context.push(AppRoutes.leadForm);
    await cubit.load(null, true);
  }

  @override
  Widget build(BuildContext context) {
    final canCreate = leadsCan(context, 'leads:create');
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Leads & Enquiries', style: AppText.display(size: 18)),
        actions: [
          IconButton(
            tooltip: 'All leads',
            icon: const Icon(Icons.list_alt_rounded),
            onPressed: () => context.push(AppRoutes.leadList),
          ),
          if (canCreate)
            IconButton(
              tooltip: 'New lead',
              icon: const Icon(Icons.add_circle_outline_rounded),
              onPressed: () => _newLead(context),
            ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: () => context.read<LeadAnalyticsCubit>().load(null, true),
        child: BlocBuilder<LeadAnalyticsCubit, LeadAnalyticsState>(
          builder: (context, state) {
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(18, 4, 18, 40),
              children: [
                _RangeChips(selected: state.range),
                const SizedBox(height: 12),
                switch (state) {
                  LeadAnalyticsLoading() => const _Skeleton(),
                  LeadAnalyticsError(:final message) => AnalyticsErrorBlock(
                      title: 'Leads analytics unavailable',
                      message: message,
                      onRetry: () => context.read<LeadAnalyticsCubit>().load(),
                    ),
                  LeadAnalyticsLoaded(:final data) => _Content(data: data),
                },
              ],
            );
          },
        ),
      ),
    );
  }
}

class _RangeChips extends StatelessWidget {
  const _RangeChips({required this.selected});

  final LeadRange selected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 38,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (final r in LeadRange.values)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(r.label),
                selected: r == selected,
                showCheckmark: false,
                onSelected: (_) => context.read<LeadAnalyticsCubit>().load(r),
                backgroundColor: AppColors.surface2,
                selectedColor: AppColors.staffSoft,
                side: BorderSide(
                  color: r == selected ? AppColors.staffB : AppColors.line,
                ),
                labelStyle: AppText.body(
                  size: 12,
                  weight: FontWeight.w700,
                  color:
                      r == selected ? AppColors.staffPillFg : AppColors.inkSoft,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    Widget box(double h) => Container(
          height: h,
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
          ),
        );
    return Column(
      children: [
        Row(
          children: [
            for (var i = 0; i < 3; i++) ...[
              Expanded(child: box(92)),
              if (i < 2) const SizedBox(width: 8),
            ],
          ],
        ),
        box(84),
        box(84),
        box(170),
        box(150),
      ],
    );
  }
}

class _Content extends StatelessWidget {
  const _Content({required this.data});

  final LeadAnalytics data;

  void _openList(BuildContext context, {String? followUp}) => context.push(
        AppRoutes.leadList,
        extra: LeadListArgs(filters: LeadFilters(followUp: followUp)),
      );

  String _rate(double? v) =>
      v == null ? '–' : '${(v * 100).toStringAsFixed(1)}%';

  @override
  Widget build(BuildContext context) {
    final d = data;
    final gap = const SizedBox(height: 12);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: _Headline('Today', d.today)),
            const SizedBox(width: 8),
            Expanded(child: _Headline('This month', d.thisMonth)),
            const SizedBox(width: 8),
            Expanded(child: _Headline('This year', d.thisYear)),
          ],
        ),
        gap,
        LayoutBuilder(
          builder: (context, c) {
            final w = (c.maxWidth - 10) / 2;
            Widget tile(Widget child, [VoidCallback? onTap]) => SizedBox(
                  width: w,
                  child: onTap == null
                      ? child
                      : Stack(
                          children: [
                            child,
                            Positioned.fill(
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  borderRadius:
                                      BorderRadius.circular(AppRadii.card),
                                  onTap: onTap,
                                ),
                              ),
                            ),
                          ],
                        ),
                );
            return Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                tile(
                  AnalyticsKpi(
                    label: 'CONVERSION RATE',
                    value: _rate(d.conversionRate.value),
                    sub: 'Of leads created in range',
                    delta: d.conversionRate.deltaPercent,
                  ),
                ),
                tile(
                  AnalyticsKpi(
                    label: 'OPEN LEADS',
                    value: '${d.open.intValue}',
                    sub: 'Tap to browse',
                  ),
                  () => _openList(context),
                ),
                tile(
                  AnalyticsKpi(
                    label: 'AVG DAYS TO CONVERT',
                    value: d.avgDaysToConvert.value == null
                        ? '–'
                        : d.avgDaysToConvert.value!.toStringAsFixed(1),
                    sub: d.avgDaysToConvert.value == null
                        ? 'Nothing converted yet'
                        : 'Created to converted',
                  ),
                ),
                tile(
                  AnalyticsKpi(
                    label: 'FOLLOW-UPS DUE',
                    value: '${d.followUpsDueToday.intValue}',
                    sub: 'Due today · tap to filter',
                    valueColor: d.followUpsDueToday.intValue > 0
                        ? AppColors.warning
                        : null,
                  ),
                  () => _openList(context, followUp: 'today'),
                ),
                tile(
                  AnalyticsKpi(
                    label: 'OVERDUE',
                    value: '${d.followUpsOverdue.intValue}',
                    sub: 'Missed · tap to filter',
                    valueColor: d.followUpsOverdue.intValue > 0
                        ? AppColors.danger
                        : null,
                  ),
                  () => _openList(context, followUp: 'overdue'),
                ),
                tile(
                  AnalyticsKpi(
                    label: 'NEW / CONVERTED',
                    value: '${d.newLeads.intValue} / ${d.converted.intValue}',
                    sub: 'In range',
                    delta: d.newLeads.deltaPercent,
                  ),
                ),
              ],
            );
          },
        ),
        gap,
        AppButton(
          label: 'Follow-ups to do',
          icon: Icons.event_available_rounded,
          variant: AppButtonVariant.ghost,
          onPressed: () => context.push(AppRoutes.leadFollowUps),
        ),
        gap,
        AnalyticsBlock(
          title: 'ENQUIRIES VS CONVERTED',
          child: LeadTrendChart(daily: d.daily),
        ),
        gap,
        AnalyticsBlock(
          title: 'LAST 12 MONTHS',
          trailing: 'cohort conversion %',
          child: LeadMonthlyChart(monthly: d.monthly),
        ),
        gap,
        AnalyticsBlock(
          title: 'PIPELINE FUNNEL',
          trailing: '${d.funnelTotal} leads · ${d.funnelLost} lost',
          child: _Funnel(d),
        ),
        gap,
        AnalyticsBlock(
          title: 'BY SOURCE',
          child: _CohortBars(
            rows: d.bySource.where((r) => r.leads > 0).toList(),
            label: (r) => LeadSource.labelOf(r.key ?? ''),
            empty: 'No enquiries in this range.',
          ),
        ),
        gap,
        AnalyticsBlock(
          title: 'STAFF LEADERBOARD',
          child: _CohortBars(
            rows: d.byStaff.where((r) => r.leads > 0).toList(),
            label: (r) => r.name,
            empty: 'No assigned enquiries in this range.',
          ),
        ),
        gap,
        AnalyticsBlock(
          title: 'WHY LEADS ARE LOST',
          child: d.lostReasons.isEmpty
              ? analyticsEmpty('No lost leads in this range.')
              : Column(
                  children: [
                    for (final r in d.lostReasons)
                      AnalyticsBar(
                        label: LeadLostReason.labelOf(r.reason),
                        value: '${r.count}',
                        fraction: r.count / d.lostReasons.first.count,
                        color: AppColors.danger,
                      ),
                  ],
                ),
        ),
        gap,
        AnalyticsBlock(
          title: 'OPEN LEAD AGEING',
          child: _Ageing(d.ageing),
        ),
      ],
    );
  }
}

class _Headline extends StatelessWidget {
  const _Headline(this.label, this.p);

  final String label;
  final LeadHeadlinePeriod p;

  @override
  Widget build(BuildContext context) {
    final delta = deltaText(p.newLeadsDelta);
    final up = (p.newLeadsDelta ?? 0) >= 0;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: AppText.eyebrow()),
          const SizedBox(height: 4),
          Text('${p.newLeads}', style: AppText.display(size: 26)),
          Text(
            'enquiries',
            style: AppText.body(size: 10.5, color: AppColors.inkFaint),
          ),
          const SizedBox(height: 4),
          Text(
            '${p.converted} converted',
            style: AppText.body(
              size: 11.5,
              weight: FontWeight.w700,
              color: AppColors.success,
            ),
          ),
          Text(
            delta == null ? 'no prior data' : '$delta vs prev',
            style: AppText.body(
              size: 10.5,
              weight: FontWeight.w700,
              color: delta == null
                  ? AppColors.inkFaint
                  : (up ? AppColors.success : AppColors.danger),
            ),
          ),
        ],
      ),
    );
  }
}

class _Funnel extends StatelessWidget {
  const _Funnel(this.d);

  final LeadAnalytics d;

  @override
  Widget build(BuildContext context) {
    if (d.funnel.isEmpty || d.funnelTotal == 0) {
      return analyticsEmpty('No leads created in this range.');
    }
    final top = d.funnel.first.count == 0 ? 1 : d.funnel.first.count;
    return Column(
      children: [
        for (final s in d.funnel)
          AnalyticsBar(
            label: LeadStatus.parse(s.stage).label,
            value: '${s.count}',
            fraction: s.count / top,
            sub: s.dropOff > 0 ? '-${s.dropOff} dropped' : null,
            color: leadStatusColor(LeadStatus.parse(s.stage)),
          ),
      ],
    );
  }
}

class _CohortBars extends StatelessWidget {
  const _CohortBars({
    required this.rows,
    required this.label,
    required this.empty,
  });

  final List<LeadCohortRow> rows;
  final String Function(LeadCohortRow) label;
  final String empty;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return analyticsEmpty(empty);
    final sorted = [...rows]..sort((a, b) => b.leads.compareTo(a.leads));
    final top = sorted.first.leads;
    return Column(
      children: [
        for (final r in sorted)
          AnalyticsBar(
            label: label(r),
            value: '${r.leads}',
            fraction: top == 0 ? 0 : r.leads / top,
            sub: '${r.converted} converted · ${pctText(r.conversionRate)}',
          ),
      ],
    );
  }
}

class _Ageing extends StatelessWidget {
  const _Ageing(this.buckets);

  final List<LeadAgeingBucket> buckets;

  @override
  Widget build(BuildContext context) {
    final total = buckets.fold<int>(0, (a, b) => a + b.count);
    if (buckets.isEmpty || total == 0) {
      return analyticsEmpty('No open leads.');
    }
    final top = buckets.fold<int>(1, (a, b) => b.count > a ? b.count : a);
    return Column(
      children: [
        for (var i = 0; i < buckets.length; i++)
          AnalyticsBar(
            label: '${buckets[i].bucket} days',
            value: '${buckets[i].count}',
            fraction: buckets[i].count / top,
            color: Color.lerp(
              AppColors.success,
              AppColors.danger,
              buckets.length > 1 ? i / (buckets.length - 1) : 0,
            ),
          ),
      ],
    );
  }
}
