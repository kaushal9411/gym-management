import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/branch_comparison_row.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../manager/presentation/widgets/member_detail_anim.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import 'analytics_logic.dart';

/// Web's `DeltaBadge`: a % change chip vs the previous period. [invert]
/// makes a decrease green (expenses). Shows "New" when there was nothing
/// before; renders nothing without a previous value.
class AnalyticsDeltaChip extends StatelessWidget {
  const AnalyticsDeltaChip({
    super.key,
    required this.value,
    required this.previous,
    this.invert = false,
  });

  final double value;
  final double? previous;
  final bool invert;

  @override
  Widget build(BuildContext context) {
    if (previous == null) return const SizedBox.shrink();
    final pct = analyticsPct(value, previous);
    final flat = pct == 0;
    final up = (pct ?? 1) >= 0;
    final good = invert ? !up : up;
    final color = (flat || pct == null)
        ? TeamColors.slate
        : good
            ? TeamColors.green
            : TeamColors.rose;
    final icon = (flat || pct == null)
        ? Icons.remove_rounded
        : up
            ? Icons.arrow_upward_rounded
            : Icons.arrow_downward_rounded;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 2),
          Text(
            pct == null ? 'New' : '${pct.abs().toStringAsFixed(1)}%',
            style: AppText.tabular(
              size: 11,
              color: color,
              weight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

/// Card with a tinted gradient header band (icon chip, title, subtitle and an
/// optional trailing widget) — web's `ChartCard`. Handles its own loading,
/// error (with Retry) and empty states.
class AnalyticsCard extends StatelessWidget {
  const AnalyticsCard({
    super.key,
    required this.title,
    required this.color,
    required this.icon,
    required this.child,
    this.subtitle,
    this.trailing,
    this.loading = false,
    this.error = false,
    this.empty = false,
    this.emptyText = 'No data for this period.',
    this.onRetry,
  });

  final String title;
  final String? subtitle;
  final Color color;
  final IconData icon;
  final Widget? trailing;
  final bool loading;
  final bool error;
  final bool empty;
  final String emptyText;
  final VoidCallback? onRetry;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (loading) {
      body = const Padding(
        padding: EdgeInsets.symmetric(vertical: 44),
        child: Center(
          child: SizedBox(
            width: 26,
            height: 26,
            child: CircularProgressIndicator(strokeWidth: 3),
          ),
        ),
      );
    } else if (error) {
      body = Padding(
        padding: const EdgeInsets.symmetric(vertical: 18),
        child: Row(
          children: [
            Expanded(
              child: Text(
                'Could not load this view.',
                style: AppText.body(size: 12.5, color: AppColors.inkFaint),
              ),
            ),
            if (onRetry != null)
              TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      );
    } else if (empty) {
      body = Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Center(
          child: Text(
            emptyText,
            style: AppText.body(size: 12.5, color: AppColors.inkFaint),
          ),
        ),
      );
    } else {
      body = child;
    }
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 12, 10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color.withValues(alpha: 0.18), Colors.transparent],
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [color, color.withValues(alpha: 0.65)],
                    ),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, size: 16, color: Colors.white),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.display(size: 15),
                      ),
                      if (subtitle != null)
                        Text(
                          subtitle!,
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
                if (trailing != null) ...[const SizedBox(width: 8), trailing!],
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 6, 14, 14),
            child: body,
          ),
        ],
      ),
    );
  }
}

/// "Deep dive ›" pill that opens a view's focus page.
class AnalyticsDeepDive extends StatelessWidget {
  const AnalyticsDeepDive({
    super.key,
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: 'Open $label',
        child: InkWell(
          borderRadius: BorderRadius.circular(99),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(99),
              border: Border.all(color: AppColors.line),
            ),
            child: Text(
              'Deep dive ›',
              style: AppText.body(size: 11, weight: FontWeight.w800),
            ),
          ),
        ),
      );
}

/// One headline tile of a focused view (web's `KpiTile`): icon chip, label,
/// count-up value, delta vs previous and an optional hint.
class AnalyticsStatTile extends StatelessWidget {
  const AnalyticsStatTile({
    super.key,
    required this.label,
    required this.value,
    required this.format,
    required this.icon,
    required this.color,
    this.previous,
    this.invert = false,
    this.hint,
    this.compact = false,
  });

  final String label;
  final double value;
  final AnalyticsFormat format;
  final IconData icon;
  final Color color;
  final double? previous;
  final bool invert;
  final String? hint;

  /// Use the short money form (`₹3.8L`) — for big currency totals.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [color.withValues(alpha: 0.15), Colors.transparent],
        ),
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.24)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.eyebrow(),
                ),
              ),
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Icon(icon, size: 14, color: color),
              ),
            ],
          ),
          const SizedBox(height: 8),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: AnimatedNumber(
              value: value,
              style: AppText.display(size: 24, color: color),
              format: (v) => compact
                  ? compactAnalytics(format, v)
                  : formatAnalytics(format, v),
            ),
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: 22,
            child: Row(
              children: [
                AnalyticsDeltaChip(
                  value: value,
                  previous: previous,
                  invert: invert,
                ),
                if (hint != null) ...[
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      hint!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Compact revenue ranking for the overview (web's `BranchOverviewChart`):
/// one bar per branch, a thin previous-period bar when comparing.
class AnalyticsBranchBars extends StatelessWidget {
  const AnalyticsBranchBars({
    super.key,
    required this.rows,
    required this.previous,
    required this.compare,
  });

  final List<BranchComparisonRow> rows;
  final List<BranchComparisonRow>? previous;
  final bool compare;

  @override
  Widget build(BuildContext context) {
    final sorted = [...rows]..sort((a, b) => b.revenue.compareTo(a.revenue));
    var maxV = 1.0;
    for (final r in sorted) {
      if (r.revenue > maxV) maxV = r.revenue;
      final p = _prev(previous, r.branchId)?.revenue;
      if (compare && p != null && p > maxV) maxV = p;
    }
    return Column(
      children: [
        for (var i = 0; i < sorted.length; i++)
          _BarRow(
            rank: i + 1,
            label: sorted[i].branch,
            value: formatAnalytics(AnalyticsFormat.money, sorted[i].revenue),
            fraction: sorted[i].revenue / maxV,
            previousFraction: compare
                ? (_prev(previous, sorted[i].branchId)?.revenue ?? 0) / maxV
                : null,
            color: AnalyticsView.branches.color,
          ),
      ],
    );
  }
}

BranchComparisonRow? _prev(List<BranchComparisonRow>? prev, String id) {
  if (prev == null) return null;
  for (final p in prev) {
    if (p.branchId == id) return p;
  }
  return null;
}

class _BarRow extends StatelessWidget {
  const _BarRow({
    required this.rank,
    required this.label,
    required this.value,
    required this.fraction,
    required this.color,
    this.previousFraction,
  });

  final int rank;
  final String label;
  final String value;
  final double fraction;
  final double? previousFraction;
  final Color color;

  @override
  Widget build(BuildContext context) {
    Widget track(double v, double h, Color c) => ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(
            value: v.clamp(0.0, 1.0),
            minHeight: h,
            backgroundColor: AppColors.surface3,
            color: c,
          ),
        );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.surface3,
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Text(
                  '$rank',
                  style: AppText.body(size: 11, weight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
              ),
              Text(
                value,
                style: AppText.tabular(size: 13, weight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 6),
          track(fraction, 7, color),
          if (previousFraction != null) ...[
            const SizedBox(height: 3),
            track(previousFraction!, 3, AppColors.inkFaint),
          ],
        ],
      ),
    );
  }
}

enum BranchMetric { revenue, members, attendance }

extension BranchMetricX on BranchMetric {
  String get label => switch (this) {
        BranchMetric.revenue => 'Revenue',
        BranchMetric.members => 'Members',
        BranchMetric.attendance => 'Attendance',
      };

  String get title => switch (this) {
        BranchMetric.revenue => 'Revenue',
        BranchMetric.members => 'Active members',
        BranchMetric.attendance => 'Check-ins',
      };

  AnalyticsFormat get format => this == BranchMetric.revenue
      ? AnalyticsFormat.money
      : AnalyticsFormat.number;

  double of(BranchComparisonRow r) => switch (this) {
        BranchMetric.revenue => r.revenue,
        BranchMetric.members => r.members.toDouble(),
        BranchMetric.attendance => r.attendance.toDouble(),
      };
}

/// Focus view of Branch Comparison (web's `BranchFocus`): a metric switcher,
/// this-vs-previous bars for that metric, and the ranking with each branch's
/// revenue share, members, revenue (with delta) and attendance.
class AnalyticsBranchFocus extends StatefulWidget {
  const AnalyticsBranchFocus({
    super.key,
    required this.rows,
    required this.previous,
    required this.compare,
  });

  final List<BranchComparisonRow> rows;
  final List<BranchComparisonRow>? previous;
  final bool compare;

  @override
  State<AnalyticsBranchFocus> createState() => _AnalyticsBranchFocusState();
}

class _AnalyticsBranchFocusState extends State<AnalyticsBranchFocus> {
  BranchMetric _metric = BranchMetric.revenue;

  @override
  Widget build(BuildContext context) {
    final sorted = [...widget.rows]
      ..sort((a, b) => b.revenue.compareTo(a.revenue));
    final hasPrev = widget.compare && (widget.previous?.isNotEmpty ?? false);
    final total = sorted.fold<double>(0, (s, r) => s + r.revenue);
    final shareBase = total <= 0 ? 1.0 : total;
    var maxV = 1.0;
    for (final r in sorted) {
      final v = _metric.of(r);
      if (v > maxV) maxV = v;
      final p = _prev(widget.previous, r.branchId);
      if (hasPrev && p != null && _metric.of(p) > maxV) maxV = _metric.of(p);
    }
    final color = AnalyticsView.branches.color;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final m in BranchMetric.values) ...[
                TeamFilterChip(
                  label: m.label,
                  selected: _metric == m,
                  color: color,
                  onTap: () => setState(() => _metric = m),
                ),
                const SizedBox(width: 8),
              ],
            ],
          ),
        ),
        const SizedBox(height: 10),
        Text(
          '${_metric.title} by branch',
          style: AppText.body(
            size: 12.5,
            weight: FontWeight.w700,
            color: AppColors.inkSoft,
          ),
        ),
        const SizedBox(height: 4),
        for (var i = 0; i < sorted.length; i++)
          _BarRow(
            rank: i + 1,
            label: sorted[i].branch,
            value: formatAnalytics(_metric.format, _metric.of(sorted[i])),
            fraction: _metric.of(sorted[i]) / maxV,
            previousFraction: hasPrev
                ? (_prev(widget.previous, sorted[i].branchId) == null
                        ? 0
                        : _metric
                            .of(_prev(widget.previous, sorted[i].branchId)!)) /
                    maxV
                : null,
            color: color,
          ),
        const SizedBox(height: 14),
        Text('RANKING', style: AppText.eyebrow()),
        const SizedBox(height: 6),
        for (var i = 0; i < sorted.length; i++)
          _RankingRow(
            rank: i + 1,
            row: sorted[i],
            share: sorted[i].revenue / shareBase * 100,
            previous:
                hasPrev ? _prev(widget.previous, sorted[i].branchId) : null,
            color: color,
          ),
      ],
    );
  }
}

class _RankingRow extends StatelessWidget {
  const _RankingRow({
    required this.rank,
    required this.row,
    required this.share,
    required this.previous,
    required this.color,
  });

  final int rank;
  final BranchComparisonRow row;
  final double share;
  final BranchComparisonRow? previous;
  final Color color;

  @override
  Widget build(BuildContext context) {
    Widget stat(String label, String value) => Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: AppText.body(
                  size: 10.5,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w700,
                ),
              ),
              Text(
                value,
                style: AppText.tabular(size: 13, weight: FontWeight.w800),
              ),
            ],
          ),
        );
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.surface3,
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Text(
                  '$rank',
                  style: AppText.body(size: 11, weight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  row.branch,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 14, weight: FontWeight.w800),
                ),
              ),
              if (previous != null)
                AnalyticsDeltaChip(
                  value: row.revenue,
                  previous: previous!.revenue,
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: GrowBar(
                  ratio: (share / 100).clamp(0.0, 1.0),
                  colors: [color, color.withValues(alpha: 0.6)],
                  height: 7,
                  track: AppColors.surface3,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '${share.round()}%',
                style: AppText.tabular(size: 12, weight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              stat(
                'Revenue',
                formatAnalytics(AnalyticsFormat.money, row.revenue),
              ),
              stat(
                'Members',
                formatAnalytics(
                  AnalyticsFormat.number,
                  row.members.toDouble(),
                ),
              ),
              stat(
                'Attendance',
                formatAnalytics(
                  AnalyticsFormat.number,
                  row.attendance.toDouble(),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
