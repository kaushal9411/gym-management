import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/branch_comparison_row.dart';
import '../../../manager/presentation/widgets/member_detail_anim.dart';
import '../kit/kit.dart';
import 'analytics_logic.dart';

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

BranchComparisonRow? _prev(List<BranchComparisonRow>? prev, String id) {
  if (prev == null) return null;
  for (final p in prev) {
    if (p.branchId == id) return p;
  }
  return null;
}

/// Compact revenue ranking for the overview (web's `BranchOverviewChart`):
/// ranked bars per branch with a tick for the previous period when comparing.
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
    return RptHBarChart(
      rankBadges: true,
      format: RptFormat.money,
      color: AnalyticsView.branches.color,
      limit: 12,
      data: [
        for (final r in rows)
          RptHBarDatum(
            label: r.branch,
            value: r.revenue,
            previous:
                compare ? (_prev(previous, r.branchId)?.revenue ?? 0) : null,
          ),
      ],
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
/// this-vs-previous grouped columns for that metric, then the ranking with
/// each branch's revenue share, members, revenue (with delta) and attendance.
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
    final color = AnalyticsView.branches.color;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RptSegmented<BranchMetric>(
          color: color,
          value: _metric,
          onChanged: (m) => setState(() => _metric = m),
          options: [
            for (final m in BranchMetric.values) RptSegment(m, m.label),
          ],
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
        const SizedBox(height: 6),
        RptGroupedBarChart(
          key: ValueKey(_metric),
          data: [
            for (final r in sorted)
              RptPoint(
                label: r.branch,
                value: _metric.of(r),
                previous: hasPrev
                    ? (_prev(widget.previous, r.branchId) == null
                        ? 0
                        : _metric.of(_prev(widget.previous, r.branchId)!))
                    : null,
              ),
          ],
          format: _metric.format.rpt,
          color: color,
          previousLabel: 'Previous period',
          height: 240,
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
                  color: rank == 1
                      ? color.withValues(alpha: 0.22)
                      : AppColors.surface3,
                  borderRadius: BorderRadius.circular(7),
                ),
                child: Text(
                  '$rank',
                  style: AppText.body(
                    size: 11,
                    weight: FontWeight.w800,
                    color: rank == 1 ? color : AppColors.inkSoft,
                  ),
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
                RptDeltaBadge(value: row.revenue, previous: previous!.revenue),
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
              stat('Revenue', rptFormatValue(RptFormat.money, row.revenue)),
              stat('Members', rptGrouped(row.members.toDouble())),
              stat('Attendance', rptGrouped(row.attendance.toDouble())),
            ],
          ),
        ],
      ),
    );
  }
}
