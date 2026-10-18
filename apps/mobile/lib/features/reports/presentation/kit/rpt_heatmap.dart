import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import 'rpt_chart_card.dart';
import 'rpt_chart_math.dart';
import 'rpt_format.dart';
import 'rpt_paint.dart';
import 'rpt_theme.dart';

/// Intensity grid (web's `Heatmap`): rows x columns of rounded cells whose
/// colour strength follows the value. Cells pop in one after another, a tap
/// shows that cell's title + value above the grid, and a Less -> More ramp
/// closes it.
///
/// Build the [matrix] with [rptHourMatrix] (24 hours, one row — what the
/// backend's hourly attendance gives) or [rptCalendarMatrix] (weekday rows x
/// week columns from dated values). The API has no hour x weekday cross-tab,
/// so a true hour-by-day grid is not offered.
class RptHeatmap extends StatefulWidget {
  const RptHeatmap({
    super.key,
    required this.matrix,
    this.format = RptFormat.number,
    this.color = RptColors.teal,
    this.cellHeight = 30,
    this.labelEvery = 1,
  });

  final RptHeatMatrix matrix;
  final RptFormat format;
  final Color color;
  final double cellHeight;

  /// Show every n-th column label (3 for 24 hours on a phone).
  final int labelEvery;

  @override
  State<RptHeatmap> createState() => _RptHeatmapState();
}

class _RptHeatmapState extends State<RptHeatmap>
    with SingleTickerProviderStateMixin<RptHeatmap>, RptDrawIn<RptHeatmap> {
  final _text = RptTextCache();
  ({int r, int c})? _sel;

  static const _rowLabelW = 34.0;
  static const _bottom = 18.0;
  static const _gap = 3.0;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.matrix;
    if (m.rows.isEmpty || m.cols.isEmpty || m.max <= 0) {
      return const RptChartEmpty(height: 120);
    }
    final sel = _sel;
    final h = m.rows.length * (widget.cellHeight + _gap) + _bottom;
    final every = math.max(1, widget.labelEvery);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 24,
          child: sel == null
              ? Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Tap a cell to inspect',
                    style: AppText.body(
                      size: 11.5,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
                )
              : Text(
                  '${m.titles[sel.r][sel.c].isEmpty ? '${m.rows[sel.r]} · ${m.cols[sel.c]}' : m.titles[sel.r][sel.c]}: '
                  '${rptFormatValue(widget.format, m.values[sel.r][sel.c])}',
                  style: AppText.body(size: 12, weight: FontWeight.w800),
                ),
        ),
        LayoutBuilder(
          builder: (context, c) {
            final cellW = (c.maxWidth - _rowLabelW) / m.cols.length - _gap;
            return GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapDown: (d) {
                final col = ((d.localPosition.dx - _rowLabelW) / (cellW + _gap))
                    .floor();
                final row =
                    (d.localPosition.dy / (widget.cellHeight + _gap)).floor();
                if (col < 0 ||
                    col >= m.cols.length ||
                    row < 0 ||
                    row >= m.rows.length) {
                  return;
                }
                setState(() => _sel = (r: row, c: col));
              },
              child: CustomPaint(
                size: Size(c.maxWidth, h),
                painter: _HeatPainter(
                  matrix: m,
                  color: widget.color,
                  progress: t,
                  cellW: cellW,
                  cellH: widget.cellHeight,
                  gap: _gap,
                  rowLabelW: _rowLabelW,
                  labelEvery: every,
                  selected: sel,
                  text: _text,
                  empty: AppColors.surface3,
                  label: AppColors.inkFaint,
                  outline: AppColors.ink,
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Text(
              'Less',
              style: AppText.body(
                size: 11,
                color: AppColors.inkFaint,
                weight: FontWeight.w700,
              ),
            ),
            const SizedBox(width: 6),
            for (final a in const [0.0, 0.25, 0.5, 0.75, 1.0]) ...[
              Container(
                width: 14,
                height: 14,
                margin: const EdgeInsets.only(right: 3),
                decoration: BoxDecoration(
                  color: a == 0
                      ? AppColors.surface3
                      : widget.color.withValues(alpha: rptHeatAlpha(a, 1)),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ],
            const SizedBox(width: 3),
            Text(
              'More',
              style: AppText.body(
                size: 11,
                color: AppColors.inkFaint,
                weight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _HeatPainter extends CustomPainter {
  _HeatPainter({
    required this.matrix,
    required this.color,
    required this.progress,
    required this.cellW,
    required this.cellH,
    required this.gap,
    required this.rowLabelW,
    required this.labelEvery,
    required this.selected,
    required this.text,
    required this.empty,
    required this.label,
    required this.outline,
  }) : super(repaint: progress);

  final RptHeatMatrix matrix;
  final Color color;
  final Animation<double> progress;
  final double cellW;
  final double cellH;
  final double gap;
  final double rowLabelW;
  final int labelEvery;
  final ({int r, int c})? selected;
  final RptTextCache text;
  final Color empty;
  final Color label;
  final Color outline;

  @override
  void paint(Canvas canvas, Size size) {
    if (cellW <= 0) return;
    final max = matrix.max;
    final rows = matrix.rows.length;
    final cols = matrix.cols.length;
    final total = rows * cols;
    final p = progress.value;
    final paint = Paint();
    for (var r = 0; r < rows; r++) {
      final lp = text.get(matrix.rows[r], size: 10.5, color: label);
      lp.paint(
        canvas,
        Offset(0, r * (cellH + gap) + (cellH - lp.height) / 2),
      );
      for (var c = 0; c < cols; c++) {
        final idx = r * cols + c;
        final local = rptStagger(p, idx, total, spread: 0.7);
        final pop = Curves.easeOutBack.transform(local);
        final v = matrix.values[r][c];
        paint.color = v <= 0
            ? empty.withValues(alpha: 0.7)
            : color.withValues(alpha: rptHeatAlpha(v, max));
        final cx = rowLabelW + c * (cellW + gap) + cellW / 2;
        final cy = r * (cellH + gap) + cellH / 2;
        final w = cellW * pop;
        final h = cellH * pop;
        final rect = RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset(cx, cy), width: w, height: h),
          const Radius.circular(5),
        );
        canvas.drawRRect(rect, paint);
        if (selected?.r == r && selected?.c == c) {
          canvas.drawRRect(
            rect.inflate(1.5),
            Paint()
              ..color = outline
              ..style = PaintingStyle.stroke
              ..strokeWidth = 1.6,
          );
        }
      }
    }
    final yLabels = rows * (cellH + gap) + 3;
    for (var c = 0; c < cols; c += labelEvery) {
      final tp = text.get(matrix.cols[c], size: 10, color: label);
      final x = rowLabelW + c * (cellW + gap) + cellW / 2 - tp.width / 2;
      tp.paint(canvas, Offset(x.clamp(0, size.width - tp.width), yLabels));
    }
  }

  @override
  bool shouldRepaint(covariant _HeatPainter old) =>
      old.matrix != matrix ||
      old.selected != selected ||
      old.color != color ||
      old.cellW != cellW ||
      old.empty != empty;
}
