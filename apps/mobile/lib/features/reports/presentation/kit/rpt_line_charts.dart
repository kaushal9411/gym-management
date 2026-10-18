import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import 'rpt_cartesian_chart.dart';
import 'rpt_chart_card.dart';
import 'rpt_chart_math.dart';
import 'rpt_controls.dart';
import 'rpt_format.dart';
import 'rpt_theme.dart';

Set<String> _toggled(Set<String> set, String key) {
  final next = {...set};
  if (!next.remove(key)) next.add(key);
  return next;
}

bool _hasSignal(Iterable<double?> values) => values.any((v) => (v ?? 0) != 0);

/// This-vs-previous trend (web's `TrendCompareChart`): a smooth area (or
/// line) for the current period with a dashed previous-period line, a legend
/// whose items hide / show each series, an optional Daily / Weekly /
/// Cumulative switch and tap / drag inspection with a crosshair.
///
/// Feed it **daily** [points]; the switch re-buckets them
/// ([rptBuildTrend]). Pass [mode] + [onMode] to control the mode from outside
/// (e.g. to share one switch between several charts).
class RptTrendChart extends StatefulWidget {
  const RptTrendChart({
    super.key,
    required this.points,
    this.format = RptFormat.number,
    this.color = RptColors.indigo,
    this.showPrevious = true,
    this.currentLabel = 'This period',
    this.previousLabel = 'Previous period',
    this.lineOnly = false,
    this.modes = RptTrendMode.values,
    this.mode,
    this.onMode,
    this.height = 200,
    this.showLegend = true,
  });

  final List<RptPoint> points;
  final RptFormat format;
  final Color color;

  /// Draw the dashed previous series (only if some point has a `previous`).
  final bool showPrevious;
  final String currentLabel;
  final String previousLabel;

  /// Draw a line instead of a filled area (snapshots such as retention).
  final bool lineOnly;

  /// Modes offered by the switch; a single entry hides the switch.
  final List<RptTrendMode> modes;

  /// Controlled mode (null = the chart keeps its own, starting at the first
  /// of [modes]).
  final RptTrendMode? mode;
  final ValueChanged<RptTrendMode>? onMode;
  final double height;
  final bool showLegend;

  @override
  State<RptTrendChart> createState() => _RptTrendChartState();
}

class _RptTrendChartState extends State<RptTrendChart> {
  late RptTrendMode _mode = widget.modes.first;
  Set<String> _hidden = {};

  RptTrendMode get _effective => widget.mode ?? _mode;

  @override
  Widget build(BuildContext context) {
    final pts = rptBuildTrend(widget.points, _effective);
    final hasPrev = widget.showPrevious && pts.any((p) => p.previous != null);
    if (pts.isEmpty ||
        !_hasSignal([
          for (final p in pts) ...[p.value, p.previous],
        ])) {
      return RptChartEmpty(height: widget.height);
    }
    final series = [
      if (hasPrev && !_hidden.contains('p'))
        RptSeries(
          key: 'p',
          label: widget.previousLabel,
          values: [for (final p in pts) p.previous],
          color: RptColors.previous,
          dashed: true,
        ),
      if (!_hidden.contains('c'))
        RptSeries(
          key: 'c',
          label: widget.currentLabel,
          values: [for (final p in pts) p.value],
          color: widget.color,
          type: widget.lineOnly ? RptSeriesType.line : RptSeriesType.area,
        ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: widget.showLegend
                  ? RptLegend(
                      items: [
                        RptLegendItem(
                          key: 'c',
                          label: widget.currentLabel,
                          color: widget.color,
                        ),
                        if (hasPrev)
                          RptLegendItem(
                            key: 'p',
                            label: widget.previousLabel,
                            color: RptColors.previous,
                            dashed: true,
                          ),
                      ],
                      hidden: _hidden,
                      onToggle: (k) =>
                          setState(() => _hidden = _toggled(_hidden, k)),
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
        if (widget.modes.length > 1) ...[
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: RptSegmented<RptTrendMode>(
              color: widget.color,
              options: [
                for (final m in widget.modes) RptSegment(m, m.label),
              ],
              value: _effective,
              onChanged: (m) {
                if (widget.onMode != null) widget.onMode!(m);
                setState(() => _mode = m);
              },
            ),
          ),
        ],
        const SizedBox(height: 8),
        RptCartesianChart(
          labels: [for (final p in pts) p.label],
          tips: [for (final p in pts) p.tip],
          series: series,
          format: widget.format,
          height: widget.height,
          replayKey: '${_effective.name}-${pts.length}-${widget.format.name}',
        ),
      ],
    );
  }
}

/// One row of a [RptMultiSeriesChart]: the x [label], an optional [tip]
/// heading and a value per series key.
class RptMultiRow {
  const RptMultiRow({required this.label, required this.values, String? tip})
      : tip = tip ?? label;

  final String label;
  final String tip;

  /// Series key -> value.
  final Map<String, double> values;
}

/// Definition of one series of a [RptMultiSeriesChart].
class RptSeriesDef {
  const RptSeriesDef({
    required this.key,
    required this.label,
    this.type = RptSeriesType.bar,
    this.color,
    this.dashed = false,
  });

  final String key;
  final String label;
  final RptSeriesType type;

  /// Defaults to the n-th categorical colour.
  final Color? color;
  final bool dashed;
}

/// Bars + lines + areas on one axis (web's `MultiSeriesChart`: revenue vs
/// expenses bars with a net line, leads funnels, notifications by channel).
/// The legend hides / shows series; tap / drag inspects one x position.
class RptMultiSeriesChart extends StatefulWidget {
  const RptMultiSeriesChart({
    super.key,
    required this.rows,
    required this.series,
    this.format = RptFormat.money,
    this.height = 220,
  });

  final List<RptMultiRow> rows;
  final List<RptSeriesDef> series;
  final RptFormat format;
  final double height;

  @override
  State<RptMultiSeriesChart> createState() => _RptMultiSeriesChartState();
}

class _RptMultiSeriesChartState extends State<RptMultiSeriesChart> {
  Set<String> _hidden = {};

  @override
  Widget build(BuildContext context) {
    final defs = [
      for (var i = 0; i < widget.series.length; i++)
        (widget.series[i], widget.series[i].color ?? rptSeriesColor(i)),
    ];
    final all = [
      for (final r in widget.rows) ...r.values.values,
    ];
    if (widget.rows.isEmpty || !_hasSignal(all)) {
      return RptChartEmpty(height: widget.height);
    }
    final series = [
      for (final (d, c) in defs)
        if (!_hidden.contains(d.key))
          RptSeries(
            key: d.key,
            label: d.label,
            type: d.type,
            color: c,
            dashed: d.dashed,
            values: [for (final r in widget.rows) r.values[d.key]],
          ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RptLegend(
          items: [
            for (final (d, c) in defs)
              RptLegendItem(
                key: d.key,
                label: d.label,
                color: c,
                dashed: d.dashed,
              ),
          ],
          hidden: _hidden,
          onToggle: (k) => setState(() => _hidden = _toggled(_hidden, k)),
        ),
        const SizedBox(height: 8),
        RptCartesianChart(
          labels: [for (final r in widget.rows) r.label],
          tips: [for (final r in widget.rows) r.tip],
          series: series,
          format: widget.format,
          height: widget.height,
          replayKey: '${widget.rows.length}-${widget.format.name}',
        ),
      ],
    );
  }
}

/// This-vs-previous grouped columns per category (web's `GroupedBarChart`:
/// weekday attendance, revenue by branch). Points without a `previous` give
/// single bars.
class RptGroupedBarChart extends StatefulWidget {
  const RptGroupedBarChart({
    super.key,
    required this.data,
    this.format = RptFormat.number,
    this.color = RptColors.teal,
    this.currentLabel = 'This period',
    this.previousLabel = 'Previous',
    this.height = 220,
  });

  final List<RptPoint> data;
  final RptFormat format;
  final Color color;
  final String currentLabel;
  final String previousLabel;
  final double height;

  @override
  State<RptGroupedBarChart> createState() => _RptGroupedBarChartState();
}

class _RptGroupedBarChartState extends State<RptGroupedBarChart> {
  Set<String> _hidden = {};

  @override
  Widget build(BuildContext context) {
    final d = widget.data;
    final hasPrev = d.any((p) => p.previous != null);
    if (d.isEmpty ||
        !_hasSignal([
          for (final p in d) ...[p.value, p.previous],
        ])) {
      return RptChartEmpty(height: widget.height);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RptLegend(
          items: [
            RptLegendItem(
              key: 'c',
              label: widget.currentLabel,
              color: widget.color,
            ),
            if (hasPrev)
              RptLegendItem(
                key: 'p',
                label: widget.previousLabel,
                color: AppColors.inkFaint,
              ),
          ],
          hidden: _hidden,
          onToggle: (k) => setState(() => _hidden = _toggled(_hidden, k)),
        ),
        const SizedBox(height: 8),
        RptCartesianChart(
          labels: [for (final p in d) p.label],
          tips: [for (final p in d) p.tip],
          format: widget.format,
          height: widget.height,
          replayKey: '${d.length}-${widget.format.name}',
          series: [
            if (hasPrev && !_hidden.contains('p'))
              RptSeries(
                key: 'p',
                label: widget.previousLabel,
                type: RptSeriesType.bar,
                color: AppColors.inkFaint,
                dashed: true,
                values: [for (final p in d) p.previous],
              ),
            if (!_hidden.contains('c'))
              RptSeries(
                key: 'c',
                label: widget.currentLabel,
                type: RptSeriesType.bar,
                color: widget.color,
                values: [for (final p in d) p.value],
              ),
          ],
        ),
      ],
    );
  }
}
