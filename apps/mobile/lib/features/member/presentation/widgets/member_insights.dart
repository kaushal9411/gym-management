import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/member_overview.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../finance/presentation/widgets/analytics_parts.dart';

/// Shared building blocks for the member dashboard (`member_dashboard_*`):
/// the 12-week attendance heatmap with busiest-weekday bars and the ring
/// painter. The rest of the old "Insights" section was replaced by the web-style
/// cards in `member_dash_ui.dart` (Prompt 159).
///
/// Heatmap cells get a long-press tooltip ("date · N visits") instead of
/// web's hover.

/// Circular progress ring — a faint track plus a rounded arc from 12 o'clock.
class RingPainter extends CustomPainter {
  RingPainter({required this.fraction, required this.color});

  final double fraction;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 9.0;
    final rect = Offset.zero & size;
    final arc = rect.deflate(stroke / 2);
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = AppColors.surface3;
    canvas.drawArc(arc, 0, math.pi * 2, false, track);
    if (fraction <= 0) return;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = color;
    canvas.drawArc(
      arc,
      -math.pi / 2,
      math.pi * 2 * fraction.clamp(0, 1),
      false,
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant RingPainter old) =>
      old.fraction != fraction || old.color != color;
}

List<List<OverviewDay?>> heatmapWeeks(List<OverviewDay> daily) {
  final cols = <List<OverviewDay?>>[];
  List<OverviewDay?>? cur;
  for (final d in daily) {
    final dt = DateTime.tryParse(d.date);
    if (dt == null) continue;
    final row = dt.weekday - 1; // Mon = 0 .. Sun = 6
    if (cur == null || row == 0) {
      cur = List<OverviewDay?>.filled(7, null);
      cols.add(cur);
    }
    cur[row] = d;
  }
  return cols;
}

/// 12-week attendance heatmap + busiest-weekday bars.
class AttendanceHeatmapCard extends StatelessWidget {
  const AttendanceHeatmapCard({required this.attendance, super.key});

  final OverviewAttendance attendance;

  static const _names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // API weekday: 0 = Sunday.
  static const _apiIndex = [1, 2, 3, 4, 5, 6, 0];

  @override
  Widget build(BuildContext context) {
    final a = attendance;
    final weeks = heatmapWeeks(a.daily);
    final maxDay = a.maxDaily;
    final counts = {for (final w in a.weekday) w.weekday: w.count};
    final maxWd = a.maxWeekday;
    final busiest = maxWd == 0
        ? null
        : _names[_apiIndex.indexWhere((i) => (counts[i] ?? 0) == maxWd)];
    return AnalyticsBlock(
      title: 'Last 12 weeks',
      trailing: busiest == null ? null : 'Busiest: $busiest',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (weeks.isEmpty)
            analyticsEmpty('No attendance data yet.')
          else
            LayoutBuilder(
              builder: (context, c) {
                const gap = 3.0;
                final cell = math.min(
                  22.0,
                  (c.maxWidth - gap * (weeks.length - 1)) / weeks.length,
                );
                return Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var w = 0; w < weeks.length; w++)
                      Padding(
                        padding: EdgeInsets.only(
                          right: w == weeks.length - 1 ? 0 : gap,
                        ),
                        child: Column(
                          children: [
                            for (var r = 0; r < 7; r++)
                              Padding(
                                padding:
                                    EdgeInsets.only(bottom: r == 6 ? 0 : gap),
                                child: _HeatCell(
                                  day: weeks[w][r],
                                  size: cell,
                                  max: maxDay,
                                  order: w,
                                ),
                              ),
                          ],
                        ),
                      ),
                  ],
                );
              },
            ),
          const SizedBox(height: 14),
          Text('Busiest weekday', style: AppText.eyebrow()),
          const SizedBox(height: 8),
          if (maxWd == 0)
            analyticsEmpty('Your weekday pattern shows up after a few visits.')
          else
            SizedBox(
              height: 78,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  for (var i = 0; i < 7; i++)
                    Expanded(
                      child: _WeekdayBar(
                        label: _names[i].substring(0, 1),
                        semantics: _names[i],
                        count: counts[_apiIndex[i]] ?? 0,
                        fraction: (counts[_apiIndex[i]] ?? 0) / maxWd,
                        top: (counts[_apiIndex[i]] ?? 0) == maxWd,
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _HeatCell extends StatelessWidget {
  const _HeatCell({
    required this.day,
    required this.size,
    required this.max,
    required this.order,
  });

  final OverviewDay? day;
  final double size;
  final int max;
  final int order;

  @override
  Widget build(BuildContext context) {
    final d = day;
    if (d == null) return SizedBox(width: size, height: size);
    final color = d.visits <= 0 || max <= 0
        ? AppColors.surface3
        : AppColors.memberB.withValues(alpha: 0.3 + 0.7 * d.visits / max);
    final box = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(4),
      ),
    );
    final label =
        '${shortDate(d.date)} · ${d.visits} visit${d.visits == 1 ? '' : 's'}';
    final animated = reduceMotion(context)
        ? box
        : TweenAnimationBuilder<double>(
            tween: Tween<double>(begin: 0, end: 1),
            duration: Duration(milliseconds: 250 + order * 30),
            curve: Curves.easeOut,
            child: box,
            builder: (_, t, child) => Opacity(opacity: t, child: child),
          );
    return Tooltip(
      message: label,
      child: Semantics(label: label, child: animated),
    );
  }
}

class _WeekdayBar extends StatelessWidget {
  const _WeekdayBar({
    required this.label,
    required this.semantics,
    required this.count,
    required this.fraction,
    required this.top,
  });

  final String label;
  final String semantics;
  final int count;
  final double fraction;
  final bool top;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$semantics $count visits',
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Text(
            '$count',
            style: AppText.tabular(
              size: 10.5,
              weight: FontWeight.w800,
              color: top ? AppColors.memberPillFg : AppColors.inkFaint,
            ),
          ),
          const SizedBox(height: 3),
          Expanded(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: AnimatedFraction(
                fraction: fraction,
                builder: (_, v) => Container(
                  width: 16,
                  height: math.max(3, 40 * v),
                  decoration: BoxDecoration(
                    color: top ? AppColors.memberB : AppColors.surface3,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: AppText.body(
              size: 10.5,
              weight: FontWeight.w700,
              color: AppColors.inkFaint,
            ),
          ),
        ],
      ),
    );
  }
}
