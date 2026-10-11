import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/lead_analytics.dart';

const leadEnquiryColor = AppColors.staffB;
const leadConvertedColor = AppColors.success;

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

/// Enquiries vs converted per day (`daily`). Wider than the viewport for
/// long ranges (Month / Year), so it scrolls horizontally.
class LeadTrendChart extends StatelessWidget {
  const LeadTrendChart({super.key, required this.daily});

  final List<LeadDailyPoint> daily;

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
              child: SizedBox(
                width: w,
                height: 120,
                child: CustomPaint(
                  painter: _TwoLinePainter(
                    daily.map((d) => d.newLeads.toDouble()).toList(),
                    daily.map((d) => d.converted.toDouble()).toList(),
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
  _TwoLinePainter(this.a, this.b);

  final List<double> a;
  final List<double> b;

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
          size.height - (s[i] / maxV) * (size.height - 10) - 4,
        );
    canvas.drawLine(
      Offset(0, size.height - 0.5),
      Offset(size.width, size.height - 0.5),
      Paint()
        ..color = AppColors.line
        ..strokeWidth = 1,
    );
    void draw(List<double> s, Color c) {
      final path = Path()..moveTo(pt(s, 0).dx, pt(s, 0).dy);
      for (var i = 1; i < n; i++) {
        path.lineTo(pt(s, i).dx, pt(s, i).dy);
      }
      canvas.drawPath(
        path,
        Paint()
          ..color = c
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeJoin = StrokeJoin.round,
      );
    }

    draw(a, leadEnquiryColor);
    draw(b, leadConvertedColor);
  }

  @override
  bool shouldRepaint(covariant _TwoLinePainter old) => old.a != a || old.b != b;
}

/// Last 12 calendar months, cohort-based (`monthly`): enquiries bar and
/// converted bar per month with the month's conversion rate underneath.
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
        SingleChildScrollView(
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
                            _bar(m.newLeads / maxV, leadEnquiryColor),
                            const SizedBox(width: 3),
                            _bar(m.converted / maxV, leadConvertedColor),
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
                        style:
                            AppText.body(size: 9.5, color: AppColors.inkFaint),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _bar(double f, Color c) => Container(
        width: 11,
        height: (f * 80).clamp(f > 0 ? 3 : 0, 80),
        decoration: BoxDecoration(
          color: c,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
        ),
      );
}
