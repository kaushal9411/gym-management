import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import 'rpt_chart_card.dart';
import 'rpt_chart_math.dart';
import 'rpt_format.dart';
import 'rpt_paint.dart';
import 'rpt_theme.dart';

/// One slice of a [RptDonut].
class RptDonutDatum {
  const RptDonutDatum({required this.label, required this.value, this.color});

  final String label;
  final double value;

  /// Defaults to the n-th categorical colour.
  final Color? color;
}

/// Slice geometry as fractions of a full turn, clockwise from 12 o'clock.
typedef RptSlice = ({double start, double sweep});

/// Positions of the slices for [values] (negatives count as 0). Slices with
/// no value get a zero sweep.
List<RptSlice> rptDonutSlices(List<double> values) {
  final shares = rptShares(values);
  var at = 0.0;
  return [
    for (final s in shares)
      () {
        final slice = (start: at, sweep: s);
        at += s;
        return slice;
      }(),
  ];
}

/// Which slice contains [p] on a ring that fills a square of [size]
/// (null = the tap missed the ring or the donut is empty).
int? rptDonutHit(Offset p, double size, List<RptSlice> slices) {
  final c = Offset(size / 2, size / 2);
  final d = p - c;
  final dist = d.distance;
  // Tolerate fat fingers: anywhere between the hole's edge and the outside.
  if (dist > size / 2 + 6 || dist < size * 0.22) return null;
  var turn = (math.atan2(d.dy, d.dx) + math.pi / 2) / (2 * math.pi);
  if (turn < 0) turn += 1;
  for (var i = 0; i < slices.length; i++) {
    final s = slices[i];
    if (s.sweep > 0 && turn >= s.start && turn < s.start + s.sweep) return i;
  }
  return null;
}

/// Share ring with a legend (web's `DonutChart`): animated sweep, tap a slice
/// or a legend row to inspect it (the centre swaps to that slice's value and
/// share). The legend sits beside the ring when there is room (>= 440 dp),
/// below it otherwise.
class RptDonut extends StatefulWidget {
  const RptDonut({
    super.key,
    required this.data,
    this.format = RptFormat.number,
    this.centerLabel = 'Total',
    this.centerValue,
    this.size = 168,
    this.maxLegend = 8,
  });

  final List<RptDonutDatum> data;

  /// Unit of the legend values and the centre figure.
  final RptFormat format;
  final String centerLabel;

  /// Overrides the centre figure (default: the sum, compact-formatted).
  final String? centerValue;
  final double size;
  final int maxLegend;

  @override
  State<RptDonut> createState() => _RptDonutState();
}

class _RptDonutState extends State<RptDonut>
    with SingleTickerProviderStateMixin<RptDonut>, RptDrawIn<RptDonut> {
  int? _active;

  @override
  void didUpdateWidget(RptDonut old) {
    super.didUpdateWidget(old);
    if (old.data.length != widget.data.length) {
      _active = null;
      replay();
    }
  }

  void _toggle(int? i) => setState(() => _active = i == _active ? null : i);

  @override
  Widget build(BuildContext context) {
    final items = [
      for (var i = 0; i < widget.data.length; i++)
        RptDonutDatum(
          label: widget.data[i].label,
          value: math.max(widget.data[i].value, 0),
          color: widget.data[i].color ?? rptSeriesColor(i),
        ),
    ];
    final total = items.fold<double>(0, (s, d) => s + d.value);
    if (items.isEmpty || total <= 0) {
      return RptChartEmpty(height: widget.size);
    }
    final slices = rptDonutSlices([for (final d in items) d.value]);
    final active = _active != null && _active! < items.length ? _active : null;
    final hovered = active == null ? null : items[active];
    final ring = SizedBox(
      width: widget.size,
      height: widget.size,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (d) => setState(() {
          final hit = rptDonutHit(d.localPosition, widget.size, slices);
          _active = hit == _active ? null : hit;
        }),
        child: Stack(
          alignment: Alignment.center,
          children: [
            CustomPaint(
              size: Size.square(widget.size),
              painter: _DonutPainter(
                items: items,
                slices: slices,
                active: active,
                progress: t,
                track: RptColors.track,
              ),
            ),
            Padding(
              padding: EdgeInsets.all(widget.size * 0.24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    hovered?.label ?? widget.centerLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.eyebrow(),
                  ),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      hovered != null
                          ? rptFormatValue(
                              widget.format,
                              hovered.value,
                              compact: true,
                            )
                          : (widget.centerValue ??
                              rptFormatValue(
                                widget.format,
                                total,
                                compact: true,
                              )),
                      style: AppText.display(size: 21),
                    ),
                  ),
                  if (hovered != null)
                    Text(
                      '${(hovered.value / total * 100).toStringAsFixed(1)}%',
                      style: AppText.body(
                        size: 11,
                        weight: FontWeight.w700,
                        color: AppColors.inkFaint,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
    final shown = math.min(items.length, widget.maxLegend);
    final legend = Column(
      children: [
        for (var i = 0; i < shown; i++)
          _LegendRow(
            datum: items[i],
            total: total,
            format: widget.format,
            selected: active == i,
            onTap: () => _toggle(i),
          ),
        if (items.length > shown)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '+${items.length - shown} more',
                style: AppText.body(size: 11.5, color: AppColors.inkFaint),
              ),
            ),
          ),
      ],
    );
    return LayoutBuilder(
      builder: (context, c) {
        if (c.maxWidth >= 440) {
          return Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              ring,
              const SizedBox(width: 20),
              Expanded(child: legend),
            ],
          );
        }
        return Column(
          children: [
            ring,
            const SizedBox(height: 12),
            legend,
          ],
        );
      },
    );
  }
}

class _LegendRow extends StatelessWidget {
  const _LegendRow({
    required this.datum,
    required this.total,
    required this.format,
    required this.selected,
    required this.onTap,
  });

  final RptDonutDatum datum;
  final double total;
  final RptFormat format;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? AppColors.surface3 : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: datum.color,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  datum.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 12.5, weight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 6),
              Text(
                rptFormatValue(format, datum.value, compact: true),
                style: AppText.tabular(size: 12.5, weight: FontWeight.w800),
              ),
              SizedBox(
                width: 40,
                child: Text(
                  '${(datum.value / total * 100).round()}%',
                  textAlign: TextAlign.right,
                  style: AppText.tabular(
                    size: 11.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({
    required this.items,
    required this.slices,
    required this.active,
    required this.progress,
    required this.track,
  }) : super(repaint: progress);

  final List<RptDonutDatum> items;
  final List<RptSlice> slices;
  final int? active;
  final Animation<double> progress;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.width * 0.15;
    final rect = Rect.fromLTWH(
      stroke / 2 + 3,
      stroke / 2 + 3,
      size.width - stroke - 6,
      size.height - stroke - 6,
    );
    canvas.drawArc(
      rect,
      0,
      math.pi * 2,
      false,
      Paint()
        ..color = track
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke,
    );
    final gap = slices.where((s) => s.sweep > 0).length > 1 ? 0.012 : 0.0;
    final p = progress.value;
    for (var i = 0; i < slices.length; i++) {
      final s = slices[i];
      if (s.sweep <= 0) continue;
      final sweep = (s.sweep - gap) * 2 * math.pi * p;
      if (sweep <= 0) continue;
      canvas.drawArc(
        rect,
        -math.pi / 2 + s.start * 2 * math.pi + gap * math.pi,
        sweep,
        false,
        Paint()
          ..color = items[i].color!
          ..style = PaintingStyle.stroke
          ..strokeWidth = active == i ? stroke + 6 : stroke
          ..strokeCap = StrokeCap.butt,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter old) =>
      old.active != active || old.items != items || old.track != track;
}
