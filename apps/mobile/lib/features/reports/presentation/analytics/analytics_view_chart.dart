import 'package:flutter/material.dart';

import '../kit/kit.dart';
import 'analytics_logic.dart';

/// Chart for one analytics view (web's `ViewChart`), built on the report kit:
///
///  * single-series views -> [RptTrendChart] (area, or a line for the retention
///    snapshot) with the dashed previous period and a hide / show legend;
///  * revenue and payment collection (two series) -> [RptMultiSeriesChart]
///    with both areas and, when comparing, one dashed previous line each.
///
/// Tap or drag to inspect a day (web shows a hover tooltip instead).
class AnalyticsViewChart extends StatelessWidget {
  const AnalyticsViewChart({
    super.key,
    required this.view,
    required this.rows,
    required this.compare,
    this.height = 200,
  });

  final AnalyticsView view;
  final List<AnalyticsRow> rows;
  final bool compare;
  final double height;

  @override
  Widget build(BuildContext context) {
    final format = view.format.rpt;
    final dual = view.dual;
    if (dual == null) {
      return RptTrendChart(
        points: [
          for (final r in rows)
            RptPoint(
              label: r.label,
              tip: analyticsShortDate(r.tip),
              value: r.a,
              previous: compare ? r.pa : null,
            ),
        ],
        format: format,
        color: view.color,
        currentLabel: view.seriesLabel,
        previousLabel: 'Previous period',
        showPrevious: compare,
        lineOnly: view.lineOnly,
        modes: const [RptTrendMode.daily],
        height: height,
      );
    }
    final colorB =
        view == AnalyticsView.collection ? RptColors.amber : RptColors.rose;
    final hasPrev = compare && rows.any((r) => r.pa != null);
    return RptMultiSeriesChart(
      format: format,
      height: height,
      rows: [
        for (final r in rows)
          RptMultiRow(
            label: r.label,
            tip: analyticsShortDate(r.tip),
            values: {
              'a': r.a,
              if (r.b != null) 'b': r.b!,
              if (hasPrev && r.pa != null) 'pa': r.pa!,
              if (hasPrev && r.pb != null) 'pb': r.pb!,
            },
          ),
      ],
      series: [
        RptSeriesDef(
          key: 'a',
          label: dual.$1,
          type: RptSeriesType.area,
          color: view.color,
        ),
        RptSeriesDef(
          key: 'b',
          label: dual.$2,
          type: RptSeriesType.area,
          color: colorB,
        ),
        if (hasPrev) ...[
          RptSeriesDef(
            key: 'pa',
            label: '${dual.$1} (previous)',
            type: RptSeriesType.line,
            color: RptColors.previous,
            dashed: true,
          ),
          RptSeriesDef(
            key: 'pb',
            label: '${dual.$2} (previous)',
            type: RptSeriesType.line,
            color: RptColors.previous.withValues(alpha: 0.65),
            dashed: true,
          ),
        ],
      ],
    );
  }
}
