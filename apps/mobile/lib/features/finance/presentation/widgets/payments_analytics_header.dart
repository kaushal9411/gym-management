import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/finance/payments_analytics_cubit.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../models/payments_analytics.dart';
import '../../../../shared/widgets/app_pill.dart';
import '../payments_screen.dart' show paymentStatusTones;
import 'analytics_parts.dart';

/// Compact phone version of the web Payments analytics (hero + KPI cards +
/// charts). Driven by [PaymentsAnalyticsCubit]; every number is real
/// `GET /payments/analytics` data.
///
/// Dropped vs web, and why:
///  * Method **donut** → ranked share bars: a 5-7 slice donut with legend is
///    unreadable at phone width, bars carry the same data.
///  * Branch comparison **grouped bar chart** → one row per branch with the
///    revenue figure, a this-period bar, and the delta vs previous.
///  * Chart hover tooltips → no hover on touch; the chart shows range
///    endpoints, the peak day and totals instead.
///  * Branch filter for analytics → the endpoint supports `branchId` but
///    this screen is tenant-wide; the Finance tab owns branch scoping.
///  * Payment-count KPI card → folded into the Success-rate card's subtitle
///    (attempts count) to keep the grid at six cards.
class PaymentsAnalyticsHeader extends StatelessWidget {
  const PaymentsAnalyticsHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<PaymentsAnalyticsCubit, PaymentsAnalyticsState>(
      builder: (context, state) {
        if (state is PaymentsAnalyticsForbidden) return const SizedBox.shrink();
        final cubit = context.read<PaymentsAnalyticsCubit>();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AnalyticsPeriodChips(
              selected: state.period,
              onSelected: cubit.load,
            ),
            const SizedBox(height: 12),
            switch (state) {
              PaymentsAnalyticsLoading() => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 36),
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.staffB),
                  ),
                ),
              PaymentsAnalyticsError(:final message) => AnalyticsBlock(
                  title: 'Analytics unavailable',
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          message,
                          style: AppText.body(
                            size: 12,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: cubit.load,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              PaymentsAnalyticsLoaded(:final data) => _Loaded(data: data),
              PaymentsAnalyticsForbidden() => const SizedBox.shrink(),
            },
          ],
        );
      },
    );
  }
}

class _Loaded extends StatelessWidget {
  const _Loaded({required this.data});

  final PaymentsAnalytics data;

  @override
  Widget build(BuildContext context) {
    final k = data.kpis;
    final cards = [
      AnalyticsKpi(
        label: 'Collected',
        value: Formatters.currencyCompact(k.collected.value),
        delta: k.collected.deltaPercent,
        sub: 'vs ${Formatters.currencyCompact(k.collected.previous)} before',
      ),
      AnalyticsKpi(
        label: 'Today',
        value: Formatters.currencyCompact(k.todayCollected),
        sub: '${k.todayCount} payment${k.todayCount == 1 ? '' : 's'}',
      ),
      AnalyticsKpi(
        label: 'Outstanding',
        value: Formatters.currencyCompact(k.outstanding),
        sub: '${k.outstandingInvoiceCount} open invoice'
            '${k.outstandingInvoiceCount == 1 ? '' : 's'}',
      ),
      AnalyticsKpi(
        label: 'Refunded',
        value: Formatters.currencyCompact(k.refunded.value),
        delta: k.refunded.deltaPercent,
        invertDelta: true,
        sub: '${pctText(k.refundRate)} of collected · ${k.refundedCount}',
      ),
      AnalyticsKpi(
        label: 'Avg payment',
        value: Formatters.currencyCompact(k.avgPayment.value),
        delta: k.avgPayment.deltaPercent,
        sub: 'vs ${Formatters.currencyCompact(k.avgPayment.previous)} before',
      ),
      AnalyticsKpi(
        label: 'Success rate',
        value: pctText(k.successRate.value),
        sub: '${k.paymentCount.value} attempts',
      ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _AttentionStrip(attention: data.attention),
        const SizedBox(height: 10),
        for (var i = 0; i < cards.length; i += 2)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: [
                Expanded(child: cards[i]),
                const SizedBox(width: 10),
                Expanded(child: cards[i + 1]),
              ],
            ),
          ),
        _CollectionsChart(data: data),
        const SizedBox(height: 10),
        _MethodBlock(methods: data.methods),
        const SizedBox(height: 10),
        _StatusBlock(statuses: data.statuses),
        const SizedBox(height: 10),
        _BranchBlock(branches: data.branches),
        const SizedBox(height: 10),
        _PlansBlock(plans: data.topPlans),
        const SizedBox(height: 14),
      ],
    );
  }
}

class _AttentionStrip extends StatelessWidget {
  const _AttentionStrip({required this.attention});

  final PaymentsAttention attention;

  @override
  Widget build(BuildContext context) {
    final a = attention;
    if (a.isClear) {
      return AnalyticsBlock(
        title: 'Needs attention',
        child: analyticsEmpty('Nothing needs attention right now.'),
      );
    }
    Widget chip(String text, AppPillTone tone) =>
        AppPill(label: text, tone: tone);
    return AnalyticsBlock(
      title: 'Needs attention',
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          if (a.pendingOver24h > 0)
            chip('${a.pendingOver24h} pending > 24h', AppPillTone.warning),
          if (a.failed > 0) chip('${a.failed} failed', AppPillTone.danger),
          if (a.overdueCount > 0)
            chip(
              '${a.overdueCount} overdue invoice'
              '${a.overdueCount == 1 ? '' : 's'} · '
              '${Formatters.currencyCompact(a.overdueAmount)}',
              AppPillTone.danger,
            ),
        ],
      ),
    );
  }
}

class _CollectionsChart extends StatelessWidget {
  const _CollectionsChart({required this.data});

  final PaymentsAnalytics data;

  @override
  Widget build(BuildContext context) {
    final days = data.daily;
    final hasData = days.any((d) => d.collected > 0 || d.previousCollected > 0);
    AnalyticsDay? peak;
    for (final d in days) {
      if (d.collected > 0 && (peak == null || d.collected > peak.collected)) {
        peak = d;
      }
    }
    return AnalyticsBlock(
      title: 'Collections over time',
      trailing: '${shortDate(data.range.from)} – ${shortDate(data.range.to)}',
      child: !hasData
          ? analyticsEmpty('No collections in this period or the one before.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  height: 110,
                  width: double.infinity,
                  child: CustomPaint(
                    painter: AnalyticsTrendPainter(
                      current: days.map((d) => d.collected).toList(),
                      previous: days.map((d) => d.previousCollected).toList(),
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
                    Text(
                      '  Previous (${shortDate(data.previousRange.from)} – '
                      '${shortDate(data.previousRange.to)})',
                      style: AppText.body(size: 11, color: AppColors.inkSoft),
                    ),
                  ],
                ),
                if (peak != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Best day ${shortDate(peak.date)} · '
                    '${Formatters.currency(peak.collected)}',
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

class _MethodBlock extends StatelessWidget {
  const _MethodBlock({required this.methods});

  final List<AnalyticsMethod> methods;

  @override
  Widget build(BuildContext context) {
    final total = methods.fold<double>(0, (s, m) => s + m.amount);
    final sorted = [...methods]..sort((a, b) => b.amount.compareTo(a.amount));
    return AnalyticsBlock(
      title: 'Payment methods',
      child: total <= 0
          ? analyticsEmpty('No collected payments in this period.')
          : Column(
              children: [
                for (final m in sorted)
                  AnalyticsBar(
                    label: _methodLabel(m.method),
                    value: Formatters.currency(m.amount),
                    fraction: m.amount / total,
                    sub: '${pctText(m.amount / total)} · ${m.count} payment'
                        '${m.count == 1 ? '' : 's'}',
                  ),
              ],
            ),
    );
  }
}

class _StatusBlock extends StatelessWidget {
  const _StatusBlock({required this.statuses});

  final List<AnalyticsStatus> statuses;

  @override
  Widget build(BuildContext context) {
    return AnalyticsBlock(
      title: 'Status breakdown',
      child: statuses.isEmpty
          ? analyticsEmpty('No payments in this period.')
          : Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final s in statuses)
                  AppPill(
                    label: '${s.status.replaceAll('_', ' ')} · ${s.count}',
                    tone: paymentStatusTones[s.status] ?? AppPillTone.neutral,
                  ),
              ],
            ),
    );
  }
}

class _BranchBlock extends StatelessWidget {
  const _BranchBlock({required this.branches});

  final List<AnalyticsBranch> branches;

  @override
  Widget build(BuildContext context) {
    var maxV = 0.0;
    for (final b in branches) {
      if (b.revenue > maxV) maxV = b.revenue;
    }
    return AnalyticsBlock(
      title: 'Branch comparison',
      child: branches.isEmpty || maxV <= 0
          ? analyticsEmpty('No branch revenue in this period.')
          : Column(
              children: [
                for (final b in branches)
                  AnalyticsBar(
                    label: b.name,
                    value: Formatters.currency(b.revenue),
                    fraction: b.revenue / maxV,
                    sub: 'Previous ${Formatters.currency(b.previousRevenue)}',
                  ),
              ],
            ),
    );
  }
}

class _PlansBlock extends StatelessWidget {
  const _PlansBlock({required this.plans});

  final List<AnalyticsPlan> plans;

  @override
  Widget build(BuildContext context) {
    var maxV = 0.0;
    for (final p in plans) {
      if (p.revenue > maxV) maxV = p.revenue;
    }
    return AnalyticsBlock(
      title: 'Top plans',
      child: plans.isEmpty || maxV <= 0
          ? analyticsEmpty('No plan-linked payments in this period.')
          : Column(
              children: [
                for (final p in plans)
                  AnalyticsBar(
                    label: p.planName,
                    value: Formatters.currency(p.revenue),
                    fraction: p.revenue / maxV,
                    sub: '${p.count} payment${p.count == 1 ? '' : 's'}',
                  ),
              ],
            ),
    );
  }
}

String _methodLabel(String m) => m
    .split('_')
    .map((w) => w.isEmpty ? w : w[0] + w.substring(1).toLowerCase())
    .join(' ');
