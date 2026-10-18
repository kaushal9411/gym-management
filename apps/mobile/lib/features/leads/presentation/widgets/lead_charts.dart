import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/lead_analytics.dart';
import '../lead_ui.dart';

const leadEnquiryColor = LeadColors.indigo;
const leadConvertedColor = LeadColors.green;

class LeadLegendDot extends StatelessWidget {
  const LeadLegendDot(this.color, this.label, {super.key});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: AppText.body(
              size: 11,
              color: AppColors.inkSoft,
              weight: FontWeight.w600,
            ),
          ),
        ],
      );
}

/// Enquiries vs converted per day (`daily`), drawn in with a gradient area
/// under the enquiries line. Wider than the viewport for long ranges
/// (Month / Year / Custom), so it scrolls horizontally.
class LeadTrendChart extends StatelessWidget {
  const LeadTrendChart({super.key, required this.daily, this.height = 120});

  final List<LeadDailyPoint> daily;
  final double height;

  @override
  Widget build(BuildContext context) {
    final total = daily.fold<int>(0, (a, d) => a + d.newLeads + d.converted);
    if (daily.isEmpty || total == 0) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Text(
          'No enquiries in this range.',
          style: AppText.body(size: 12, color: AppColors.inkFaint),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Wrap(
          spacing: 14,
          children: [
            LeadLegendDot(leadEnquiryColor, 'Enquiries'),
            LeadLegendDot(leadConvertedColor, 'Converted'),
          ],
        ),
        const SizedBox(height: 8),
        LayoutBuilder(
          builder: (context, c) {
            final w = daily.length * 9.0 > c.maxWidth
                ? daily.length * 9.0
                : c.maxWidth;
            return SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              reverse: true,
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: const Duration(milliseconds: 1500),
                curve: Curves.easeOutCubic,
                builder: (context, t, _) => SizedBox(
                  width: w,
                  height: height,
                  child: CustomPaint(
                    painter: _TwoLinePainter(
                      daily.map((d) => d.newLeads.toDouble()).toList(),
                      daily.map((d) => d.converted.toDouble()).toList(),
                      t,
                    ),
                  ),
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 4),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              daily.first.date,
              style: AppText.body(size: 10, color: AppColors.inkFaint),
            ),
            Text(
              daily.last.date,
              style: AppText.body(size: 10, color: AppColors.inkFaint),
            ),
          ],
        ),
      ],
    );
  }
}

class _TwoLinePainter extends CustomPainter {
  _TwoLinePainter(this.a, this.b, this.t);

  final List<double> a;
  final List<double> b;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    var maxV = 1.0;
    for (final v in [...a, ...b]) {
      if (v > maxV) maxV = v;
    }
    final n = a.length;
    final dx = n > 1 ? size.width / (n - 1) : 0.0;
    Offset pt(List<double> s, int i) => Offset(
          n > 1 ? dx * i : size.width / 2,
          size.height - (s[i] / maxV) * (size.height - 12) - 4,
        );
    final grid = Paint()
      ..color = AppColors.line
      ..strokeWidth = 1;
    canvas.drawLine(
      Offset(0, size.height - 0.5),
      Offset(size.width, size.height - 0.5),
      grid,
    );
    canvas.drawLine(
      Offset(0, size.height / 2),
      Offset(size.width, size.height / 2),
      Paint()
        ..color = AppColors.line.withValues(alpha: 0.5)
        ..strokeWidth = 1,
    );

    void draw(List<double> s, Color c, {bool area = false}) {
      if (n < 2) {
        canvas.drawCircle(pt(s, 0), 3.5, Paint()..color = c);
        return;
      }
      final path = Path()..moveTo(pt(s, 0).dx, pt(s, 0).dy);
      for (var i = 1; i < n; i++) {
        path.lineTo(pt(s, i).dx, pt(s, i).dy);
      }
      final metric = path.computeMetrics().first;
      final drawn = metric.extractPath(0, metric.length * t);
      if (area) {
        final end = metric.getTangentForOffset(metric.length * t)?.position;
        if (end != null) {
          final fill = Path.from(drawn)
            ..lineTo(end.dx, size.height)
            ..lineTo(pt(s, 0).dx, size.height)
            ..close();
          canvas.drawPath(
            fill,
            Paint()
              ..shader = LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [c.withValues(alpha: 0.28), c.withValues(alpha: 0)],
              ).createShader(Offset.zero & size),
          );
        }
      }
      canvas.drawPath(
        drawn,
        Paint()
          ..color = c
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.6
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round,
      );
    }

    draw(a, leadEnquiryColor, area: true);
    draw(b, leadConvertedColor);
  }

  @override
  bool shouldRepaint(covariant _TwoLinePainter old) =>
      old.a != a || old.b != b || old.t != t;
}

/// Last 12 calendar months, cohort-based (`monthly`): enquiries bar and
/// converted bar per month (growing in) with the month's conversion rate
/// underneath.
class LeadMonthlyChart extends StatelessWidget {
  const LeadMonthlyChart({super.key, required this.monthly});

  final List<LeadMonthlyPoint> monthly;

  static const _names = [
    'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D', //
  ];

  @override
  Widget build(BuildContext context) {
    var maxV = 0;
    for (final m in monthly) {
      if (m.newLeads > maxV) maxV = m.newLeads;
    }
    if (monthly.isEmpty || maxV == 0) {
      return Text(
        'No enquiries in the last 12 months.',
        style: AppText.body(size: 12, color: AppColors.inkFaint),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Wrap(
          spacing: 14,
          children: [
            LeadLegendDot(leadEnquiryColor, 'Enquiries'),
            LeadLegendDot(leadConvertedColor, 'Converted'),
          ],
        ),
        const SizedBox(height: 10),
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: const Duration(milliseconds: 1200),
          curve: Curves.easeOutCubic,
          builder: (context, t, _) => SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            reverse: true,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final m in monthly)
                  SizedBox(
                    width: 40,
                    child: Column(
                      children: [
                        Text(
                          '${m.newLeads}',
                          style: AppText.tabular(size: 10),
                        ),
                        SizedBox(
                          height: 80,
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _bar(m.newLeads / maxV * t, leadEnquiryColor),
                              const SizedBox(width: 3),
                              _bar(m.converted / maxV * t, leadConvertedColor),
                            ],
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _names[((int.tryParse(
                                        m.month.length >= 7
                                            ? m.month.substring(5, 7)
                                            : '1',
                                      ) ??
                                      1) -
                                  1)
                              .clamp(0, 11)],
                          style: AppText.body(
                            size: 10,
                            weight: FontWeight.w700,
                            color: AppColors.inkSoft,
                          ),
                        ),
                        Text(
                          m.newLeads == 0
                              ? '–'
                              : '${(m.conversionRate * 100).round()}%',
                          style: AppText.body(
                            size: 9.5,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _bar(double f, Color c) => Container(
        width: 11,
        height: math.min(80, math.max(f > 0 ? 3 : 0, f * 80)),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [c, c.withValues(alpha: 0.55)],
          ),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
        ),
      );
}

/// Segmented bar splitting [parts] (value, colour) proportionally; grows in
/// from the left on first build.
class LeadSegmentBar extends StatelessWidget {
  const LeadSegmentBar({super.key, required this.parts, this.height = 14});

  final List<(int, Color)> parts;
  final double height;

  @override
  Widget build(BuildContext context) {
    final total = parts.fold<int>(0, (a, p) => a + p.$1);
    if (total == 0) return SizedBox(height: height);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 1100),
      curve: Curves.easeOutCubic,
      builder: (context, t, _) => ClipRRect(
        borderRadius: BorderRadius.circular(99),
        child: Container(
          height: height,
          color: AppColors.surface3,
          child: FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: t,
            child: Row(
              children: [
                for (final p in parts)
                  if (p.$1 > 0)
                    Expanded(
                      flex: p.$1,
                      child: Container(
                        margin: const EdgeInsets.only(right: 1.5),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [p.$2, p.$2.withValues(alpha: 0.7)],
                          ),
                        ),
                      ),
                    ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
