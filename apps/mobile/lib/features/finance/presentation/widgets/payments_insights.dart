import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../models/member_payment.dart';
import '../../../../models/payments_analytics.dart';
import '../../../manager/presentation/widgets/member_detail_anim.dart';
import '../../../reports/presentation/widgets/donut_chart.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../payments_ui.dart';

/// Mobile version of web's Payments analytics (KPI strip + six panels),
/// driven by `GET /payments/analytics` (every figure is real data).
///
/// Web parity: five KPI cards with sparklines, Collections over time
/// (Daily / Weekly / Cumulative + refund days + compare line), Payment
/// methods (donut + digital share), This period vs previous (weekly bars),
/// Branch comparison, Status & refunds (+ refund rate), Top plans and Needs
/// attention (the first two rows jump to that status in the list).
///
/// Dropped vs web, and why: chart hover tooltips (no hover on touch — the
/// legend / peak line carry the same numbers), the donut's recharts hover and
/// the per-panel "Analytics unavailable" skeletons (the whole block shows one
/// retry card instead), CSV / Excel export (no file-saving package).
class PaymentsInsights extends StatefulWidget {
  const PaymentsInsights({
    super.key,
    required this.data,
    required this.compare,
    required this.previousLabel,
    required this.onStatus,
  });

  final PaymentsAnalytics data;
  final bool compare;

  /// 'Last month' / 'Month before' / 'Previous period' (web's wording).
  final String previousLabel;

  /// Attention rows: filter the list by this status.
  final ValueChanged<String> onStatus;

  @override
  State<PaymentsInsights> createState() => _PaymentsInsightsState();
}

enum _Mode { daily, weekly, cumulative }

class _PaymentsInsightsState extends State<PaymentsInsights> {
  _Mode _mode = _Mode.daily;

  PaymentsAnalytics get d => widget.data;
  bool get compare => widget.compare;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _kpis(context),
        const SizedBox(height: 14),
        _collections(),
        const SizedBox(height: 12),
        TeamAdaptive(children: [_methods(), _weekly()]),
        const SizedBox(height: 12),
        TeamAdaptive(children: [_branches(), _statusRefunds()]),
        const SizedBox(height: 12),
        TeamAdaptive(children: [_plans(), _attention()]),
      ],
    );
  }

  // ── KPI strip ─────────────────────────────────────────────────────────────

  Widget _kpis(BuildContext context) {
    final k = d.kpis;
    final vs = 'vs ${widget.previousLabel.toLowerCase()}';
    final daily = d.daily;
    final tiles = [
      PayKpiTile(
        index: 0,
        label: 'Collected',
        icon: Icons.payments_rounded,
        color: TeamColors.indigo,
        value: k.collected.value,
        caption: compare
            ? PayDelta(pct: k.collected.deltaPercent, suffix: vs)
            : null,
        spark: [for (final x in daily) x.collected],
      ),
      PayKpiTile(
        index: 1,
        label: 'Today',
        icon: Icons.today_rounded,
        color: TeamColors.teal,
        value: k.todayCollected,
        caption: _plain(
          '${k.todayCount} payment${k.todayCount == 1 ? '' : 's'} today',
        ),
        spark: [for (final x in daily) x.count.toDouble()],
      ),
      PayKpiTile(
        index: 2,
        label: 'Outstanding',
        icon: Icons.schedule_rounded,
        color: TeamColors.amber,
        value: k.outstanding,
        caption: _plain(
          '${k.outstandingInvoiceCount} unpaid invoice'
          '${k.outstandingInvoiceCount == 1 ? '' : 's'}',
        ),
      ),
      PayKpiTile(
        index: 3,
        label: 'Refunded',
        icon: Icons.undo_rounded,
        color: TeamColors.rose,
        value: k.refunded.value,
        caption: Row(
          children: [
            if (compare) ...[
              Flexible(
                child: PayDelta(
                  pct: k.refunded.deltaPercent,
                  goodWhenDown: true,
                ),
              ),
              const SizedBox(width: 4),
            ],
            Flexible(
              child: _plain(
                '${compare ? '· ' : ''}rate ${pct1(k.refundRate)}',
              ),
            ),
          ],
        ),
        spark: [for (final x in daily) x.refunded],
      ),
      PayKpiTile(
        index: 4,
        label: 'Avg. payment',
        icon: Icons.bar_chart_rounded,
        color: TeamColors.violet,
        value: k.avgPayment.value,
        caption: compare
            ? PayDelta(pct: k.avgPayment.deltaPercent, suffix: vs)
            : null,
        spark: [
          for (final x in daily) x.count > 0 ? x.collected / x.count : 0.0,
        ],
      ),
    ];
    return LayoutBuilder(
      builder: (context, c) {
        final cols = c.maxWidth >= 900 ? 5 : (c.maxWidth >= 560 ? 3 : 2);
        return GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          crossAxisCount: cols,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          mainAxisExtent: 148,
          children: tiles,
        );
      },
    );
  }

  Widget _plain(String t) => Text(
        t,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppText.body(
          size: 11,
          color: AppColors.inkFaint,
          weight: FontWeight.w700,
        ),
      );

  // ── Collections over time ─────────────────────────────────────────────────

  List<({String label, double cur, double prev, bool refund})> _series() {
    final daily = d.daily;
    if (_mode == _Mode.weekly) {
      final out = <({String label, double cur, double prev, bool refund})>[];
      for (var i = 0; i < daily.length; i += 7) {
        final chunk = daily.sublist(i, math.min(i + 7, daily.length));
        out.add(
          (
            label: 'Wk ${i ~/ 7 + 1}',
            cur: chunk.fold(0.0, (s, x) => s + x.collected),
            prev: chunk.fold(0.0, (s, x) => s + x.previousCollected),
            refund: chunk.any((x) => x.refunded > 0),
          ),
        );
      }
      return out;
    }
    var cur = 0.0;
    var prev = 0.0;
    return [
      for (final x in daily)
        () {
          cur += x.collected;
          prev += x.previousCollected;
          return (
            label: shortDay(x.date),
            cur: _mode == _Mode.cumulative ? cur : x.collected,
            prev: _mode == _Mode.cumulative ? prev : x.previousCollected,
            refund: x.refunded > 0,
          );
        }(),
    ];
  }

  Widget _collections() {
    final empty =
        d.daily.every((x) => x.collected == 0 && x.previousCollected == 0);
    final series = _series();
    return TeamInsightCard(
      icon: Icons.show_chart_rounded,
      title: 'Collections over time',
      color: TeamColors.indigo,
      trailing: '${shortDay(d.range.from)} – ${shortDay(d.range.to)}',
      child: empty
          ? const PayEmptyNote('No collections in this period yet.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    for (final m in _Mode.values) ...[
                      TeamFilterChip(
                        label: switch (m) {
                          _Mode.daily => 'Daily',
                          _Mode.weekly => 'Weekly',
                          _Mode.cumulative => 'Cumulative',
                        },
                        selected: _mode == m,
                        color: TeamColors.indigo,
                        onTap: () => setState(() => _mode = m),
                      ),
                      const SizedBox(width: 8),
                    ],
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 130,
                  width: double.infinity,
                  child: CustomPaint(
                    painter: _CollectionsPainter(
                      current: [for (final s in series) s.cur],
                      previous: [for (final s in series) s.prev],
                      refundDays: [for (final s in series) s.refund],
                      showPrevious: compare,
                      line: TeamColors.indigo,
                      previousColor: AppColors.inkFaint,
                      grid: AppColors.line,
                      refundColor: TeamColors.fuchsia,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _plain(series.first.label),
                    _plain(series.last.label),
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 14,
                  runSpacing: 6,
                  children: [
                    _legend(
                      TeamColors.indigo,
                      'This period · ${payMoney(d.kpis.collected.value)}',
                    ),
                    if (compare)
                      _legend(
                        AppColors.inkFaint,
                        '${widget.previousLabel} · '
                        '${payMoney(d.kpis.collected.previous)}',
                      ),
                    _legend(TeamColors.fuchsia, 'Refund days'),
                  ],
                ),
              ],
            ),
    );
  }

  Widget _legend(Color c, String t) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(color: c, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              t,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(size: 11.5, weight: FontWeight.w700),
            ),
          ),
        ],
      );

  // ── Payment methods ───────────────────────────────────────────────────────

  static const _digital = {
    'UPI',
    'ONLINE_GATEWAY',
    'CREDIT_CARD',
    'DEBIT_CARD',
  };

  Widget _methods() {
    final methods = d.methods.where((m) => m.amount > 0).toList()
      ..sort((a, b) => b.amount.compareTo(a.amount));
    final total = methods.fold<double>(0, (s, m) => s + m.amount);
    final digital = methods
        .where((m) => _digital.contains(m.method))
        .fold<double>(0, (s, m) => s + m.amount);
    return TeamInsightCard(
      icon: Icons.donut_large_rounded,
      title: 'Payment methods',
      color: TeamColors.teal,
      trailing: total > 0 ? Formatters.currencyCompact(total) : null,
      child: total <= 0
          ? const PayEmptyNote('No collections in this period yet.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                DonutChart(
                  size: 92,
                  slices: [
                    for (final m in methods)
                      DonutSlice(
                        label: paymentMethodLabel(m.method),
                        value: m.amount,
                        color: PayColors.method(m.method),
                      ),
                  ],
                ),
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: TeamColors.indigo.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'Digital share (UPI + online + cards) is '
                    '${(digital / total * 100).round()}% of collections.',
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w700,
                      color: TeamColors.indigo,
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  // ── This period vs previous (weekly) ──────────────────────────────────────

  Widget _weekly() {
    final weeks = <({String label, double cur, double prev})>[];
    for (var i = 0; i < d.daily.length; i += 7) {
      final chunk = d.daily.sublist(i, math.min(i + 7, d.daily.length));
      weeks.add(
        (
          label: 'Wk ${i ~/ 7 + 1}',
          cur: chunk.fold(0.0, (s, x) => s + x.collected),
          prev: chunk.fold(0.0, (s, x) => s + x.previousCollected),
        ),
      );
    }
    final empty = weeks.every((w) => w.cur == 0 && w.prev == 0);
    final maxV = weeks.fold<double>(
      1,
      (m, w) => math.max(m, math.max(w.cur, compare ? w.prev : 0)),
    );
    final labelEvery = weeks.length <= 8 ? 1 : (weeks.length / 8).ceil();
    return TeamInsightCard(
      icon: Icons.stacked_bar_chart_rounded,
      title: compare ? 'This period vs previous' : 'Weekly collections',
      color: TeamColors.violet,
      trailing: 'per week',
      child: empty
          ? const PayEmptyNote('No collections in this period yet.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  height: 130,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      for (var i = 0; i < weeks.length; i++)
                        Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Expanded(
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    _bar(
                                      weeks[i].cur / maxV,
                                      TeamColors.violet,
                                    ),
                                    if (compare) ...[
                                      const SizedBox(width: 2),
                                      _bar(
                                        weeks[i].prev / maxV,
                                        AppColors.inkFaint
                                            .withValues(alpha: 0.5),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              const SizedBox(height: 4),
                              SizedBox(
                                height: 14,
                                child: i % labelEvery == 0
                                    ? FittedBox(
                                        child: Text(
                                          weeks[i].label,
                                          style: AppText.body(
                                            size: 9.5,
                                            color: AppColors.inkFaint,
                                            weight: FontWeight.w700,
                                          ),
                                        ),
                                      )
                                    : null,
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 14,
                  children: [
                    _legend(TeamColors.violet, 'This period'),
                    if (compare)
                      _legend(AppColors.inkFaint, widget.previousLabel),
                  ],
                ),
              ],
            ),
    );
  }

  Widget _bar(double ratio, Color color) => Flexible(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 14),
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: ratio.clamp(0.0, 1.0)),
            duration: const Duration(milliseconds: 900),
            curve: Curves.easeOutCubic,
            builder: (context, v, _) => FractionallySizedBox(
              heightFactor: v < 0.015 && ratio > 0 ? 0.015 : v,
              child: Container(
                decoration: BoxDecoration(
                  color: color,
                  borderRadius:
                      const BorderRadius.vertical(top: Radius.circular(4)),
                ),
              ),
            ),
          ),
        ),
      );

  // ── Branch comparison ─────────────────────────────────────────────────────

  Widget _branches() {
    final branches = [...d.branches]
      ..sort((a, b) => b.revenue.compareTo(a.revenue));
    final maxV = branches.fold<double>(1, (m, b) => math.max(m, b.revenue));
    return TeamInsightCard(
      icon: Icons.storefront_rounded,
      title: 'Branch comparison',
      color: TeamColors.teal,
      trailing: compare ? 'vs previous' : null,
      child: branches.isEmpty
          ? const PayEmptyNote('No branch revenue in this period yet.')
          : Column(
              children: [
                for (var i = 0; i < branches.length; i++) ...[
                  if (i > 0) const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          branches[i].name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 12.5,
                            weight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        payMoney(branches[i].revenue),
                        style: AppText.tabular(size: 12.5),
                      ),
                    ],
                  ),
                  const SizedBox(height: 5),
                  GrowBar(
                    ratio: branches[i].revenue / maxV,
                    height: 8,
                    track: AppColors.surface3,
                    colors: [
                      TeamColors.rotation[(i * 2 + 2) % 8],
                      TeamColors.rotation[(i * 2 + 2) % 8]
                          .withValues(alpha: 0.55),
                    ],
                  ),
                  if (compare) ...[
                    const SizedBox(height: 3),
                    PayDelta(
                      pct: branches[i].previousRevenue > 0
                          ? (branches[i].revenue -
                                  branches[i].previousRevenue) /
                              branches[i].previousRevenue *
                              100
                          : null,
                      fallback:
                          'Previous ${payMoney(branches[i].previousRevenue)}',
                    ),
                  ],
                ],
              ],
            ),
    );
  }

  // ── Status & refunds ──────────────────────────────────────────────────────

  Widget _statusRefunds() {
    final counts = {for (final s in d.statuses) s.status: s.count};
    final total =
        paymentStatusValues.fold<int>(0, (s, k) => s + (counts[k] ?? 0));
    final r = d.kpis.refunded;
    return TeamInsightCard(
      icon: Icons.fact_check_rounded,
      title: 'Status & refunds',
      color: TeamColors.fuchsia,
      trailing: '$total attempts',
      child: total == 0
          ? const PayEmptyNote('No payments in this period yet.')
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox(
                    height: 14,
                    child: Row(
                      children: [
                        for (final k in paymentStatusValues)
                          if ((counts[k] ?? 0) > 0)
                            Expanded(
                              flex: counts[k]!,
                              child: Container(
                                margin: const EdgeInsets.only(right: 2),
                                color: PayColors.status(k),
                              ),
                            ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final k in paymentStatusValues)
                      TeamTag(
                        label: '${paymentStatusLabel(k)} ${counts[k] ?? 0}',
                        color: PayColors.status(k),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: TeamColors.rose.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: TeamColors.rose.withValues(alpha: 0.28),
                    ),
                  ),
                  child: Row(
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'REFUND RATE',
                            style: AppText.eyebrow(color: TeamColors.rose),
                          ),
                          Text(
                            pct1(d.kpis.refundRate),
                            style: AppText.display(
                              size: 22,
                              color: TeamColors.rose,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          '${payMoney(r.value)} across ${d.kpis.refundedCount} '
                          'refund${d.kpis.refundedCount == 1 ? '' : 's'}',
                          textAlign: TextAlign.right,
                          style: AppText.body(
                            size: 12,
                            weight: FontWeight.w800,
                            color: TeamColors.rose,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  // ── Top plans ─────────────────────────────────────────────────────────────

  Widget _plans() {
    final plans = d.topPlans.take(4).toList();
    final collected = d.kpis.collected.value;
    const tones = [
      TeamColors.indigo,
      TeamColors.teal,
      TeamColors.amber,
      TeamColors.fuchsia,
    ];
    String share(double revenue) => collected > 0
        ? '${math.min((revenue / collected * 100).round(), 100)}% of revenue · '
        : '';
    Widget planTile(int i) => Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                tones[i % 4].withValues(alpha: 0.18),
                tones[i % 4].withValues(alpha: 0.04),
              ],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                plans[i].planName.toUpperCase(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.eyebrow(),
              ),
              const SizedBox(height: 4),
              Text(
                payMoney(plans[i].revenue),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.display(size: 18),
              ),
              const SizedBox(height: 2),
              Text(
                '${share(plans[i].revenue)}${plans[i].count} sold',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(
                  size: 11,
                  weight: FontWeight.w700,
                  color: tones[i % 4],
                ),
              ),
            ],
          ),
        );
    return TeamInsightCard(
      icon: Icons.workspace_premium_rounded,
      title: 'Top plans by revenue',
      color: TeamColors.amber,
      child: plans.isEmpty
          ? const PayEmptyNote('No plan-linked payments in this period yet.')
          : Column(
              children: [
                for (var r = 0; r < plans.length; r += 2) ...[
                  if (r > 0) const SizedBox(height: 10),
                  IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(child: planTile(r)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: r + 1 < plans.length
                              ? planTile(r + 1)
                              : const SizedBox.shrink(),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
    );
  }

  // ── Needs attention ───────────────────────────────────────────────────────

  Widget _attention() {
    final a = d.attention;
    final rows = <({int n, String text, Color color, String? status})>[
      (
        n: a.pendingOver24h,
        text: 'Payments pending over 24h',
        color: TeamColors.amber,
        status: 'PENDING',
      ),
      (
        n: a.failed,
        text: 'Failed online payments to retry',
        color: TeamColors.rose,
        status: 'FAILED',
      ),
      (
        n: a.overdueCount,
        text: 'Overdue invoices, ${payMoney(a.overdueAmount)} due',
        color: TeamColors.indigo,
        status: null,
      ),
    ];
    return TeamInsightCard(
      icon: Icons.notification_important_rounded,
      title: 'Needs attention',
      color: TeamColors.rose,
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            _attentionRow(rows[i]),
          ],
        ],
      ),
    );
  }

  Widget _attentionRow(({int n, String text, Color color, String? status}) r) {
    final tappable = r.status != null && r.n > 0;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: tappable ? () => widget.onStatus(r.status!) : null,
        child: Container(
          padding: const EdgeInsets.all(11),
          decoration: BoxDecoration(
            color: r.color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Container(
                constraints: const BoxConstraints(minWidth: 26),
                height: 26,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(
                  color: r.color.withValues(alpha: 0.22),
                  borderRadius: BorderRadius.circular(99),
                ),
                alignment: Alignment.center,
                child: Text(
                  '${r.n}',
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w800,
                    color: r.color,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  r.text,
                  style: AppText.body(size: 12.5, weight: FontWeight.w800),
                ),
              ),
              if (tappable)
                Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: AppColors.inkFaint,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// `12.3%` from a 0..1 ratio.
String pct1(double ratio) => '${(ratio * 100).toStringAsFixed(1)}%';

/// `18 Oct` from an ISO day (`YYYY-MM-DD…`); falls back to the raw string.
String shortDay(String iso) {
  final d = DateTime.tryParse(iso.length >= 10 ? iso.substring(0, 10) : iso);
  return d == null ? iso : payDate(d, year: false);
}

/// One analytics KPI card (web's `KpiCard`): icon chip, label, animated
/// value, caption (delta / count) and a drawn sparkline.
class PayKpiTile extends StatelessWidget {
  const PayKpiTile({
    super.key,
    required this.index,
    required this.label,
    required this.icon,
    required this.color,
    required this.value,
    this.caption,
    this.spark,
  });

  final int index;
  final String label;
  final IconData icon;
  final Color color;
  final double value;
  final Widget? caption;
  final List<double>? spark;

  @override
  Widget build(BuildContext context) {
    final canSpark = spark != null && spark!.length >= 2;
    return FadeUp(
      index: index,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [color.withValues(alpha: 0.15), Colors.transparent],
          ),
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Icon(icon, size: 14, color: color),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    label.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 9.5,
                      weight: FontWeight.w800,
                      color: AppColors.inkFaint,
                    ).copyWith(letterSpacing: 0.6),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            PayMoneyCount(
              value: value,
              compact: true,
              style: AppText.display(size: 22, color: color),
            ),
            const SizedBox(height: 2),
            SizedBox(height: 16, child: caption),
            const Spacer(),
            if (canSpark)
              DrawnSparkline(
                values: spark!,
                height: 34,
                colors: [color.withValues(alpha: 0.6), color],
              )
            else
              const SizedBox(height: 34),
          ],
        ),
      ),
    );
  }
}

/// Line + area chart for the collections series: dashed previous line, dots
/// on refund days, three hairline gridlines.
class _CollectionsPainter extends CustomPainter {
  _CollectionsPainter({
    required this.current,
    required this.previous,
    required this.refundDays,
    required this.showPrevious,
    required this.line,
    required this.previousColor,
    required this.grid,
    required this.refundColor,
  });

  final List<double> current;
  final List<double> previous;
  final List<bool> refundDays;
  final bool showPrevious;
  final Color line;
  final Color previousColor;
  final Color grid;
  final Color refundColor;

  @override
  void paint(Canvas canvas, Size size) {
    final n = current.length;
    if (n == 0) return;
    const top = 8.0;
    const bottom = 10.0;
    final h = size.height - top - bottom;
    var maxV = 0.0;
    for (var i = 0; i < n; i++) {
      maxV = math.max(maxV, current[i]);
      if (showPrevious) maxV = math.max(maxV, previous[i]);
    }
    if (maxV <= 0) maxV = 1;

    final gridPaint = Paint()
      ..color = grid
      ..strokeWidth = 1;
    for (var g = 0; g < 3; g++) {
      final y = top + h * g / 2;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    double x(int i) => n == 1 ? size.width / 2 : size.width * i / (n - 1);
    double y(double v) => top + h * (1 - v / maxV);

    Path pathOf(List<double> v) {
      final p = Path()..moveTo(x(0), y(v[0]));
      for (var i = 1; i < n; i++) {
        p.lineTo(x(i), y(v[i]));
      }
      return p;
    }

    if (showPrevious && n > 1) {
      final metric = pathOf(previous).computeMetrics();
      final dash = Paint()
        ..color = previousColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2;
      for (final m in metric) {
        var d = 0.0;
        while (d < m.length) {
          canvas.drawPath(m.extractPath(d, math.min(d + 6, m.length)), dash);
          d += 11;
        }
      }
    }

    final cur = pathOf(current);
    if (n > 1) {
      final area = Path.from(cur)
        ..lineTo(x(n - 1), top + h)
        ..lineTo(x(0), top + h)
        ..close();
      canvas.drawPath(
        area,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [line.withValues(alpha: 0.3), line.withValues(alpha: 0)],
          ).createShader(Offset.zero & size),
      );
      canvas.drawPath(
        cur,
        Paint()
          ..color = line
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.6
          ..strokeJoin = StrokeJoin.round,
      );
    } else {
      canvas.drawCircle(Offset(x(0), y(current[0])), 4, Paint()..color = line);
    }

    final dot = Paint()..color = refundColor;
    for (var i = 0; i < n; i++) {
      if (refundDays[i]) {
        canvas.drawCircle(Offset(x(i), top + h + 5), 3, dot);
      }
    }
  }

  @override
  bool shouldRepaint(_CollectionsPainter old) =>
      old.current != current ||
      old.previous != previous ||
      old.showPrevious != showPrevious ||
      old.refundDays != refundDays;
}
