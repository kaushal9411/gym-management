import 'package:flutter/material.dart';

import '../../../../bloc/finance/payments_analytics_cubit.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/motion.dart';

/// Building blocks shared by the Payments and Income/Expenses analytics
/// headers (period chips, card shell, KPI card, share bar, this-vs-previous
/// trend painter). Extracted from `payments_analytics_header.dart` so the
/// three screens look identical.

class AnalyticsPeriodChips extends StatelessWidget {
  const AnalyticsPeriodChips({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  final PaymentsPeriod selected;
  final ValueChanged<PaymentsPeriod> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 34,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (final p in PaymentsPeriod.values)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(p.label),
                selected: p == selected,
                showCheckmark: false,
                onSelected: (_) => onSelected(p),
                backgroundColor: AppColors.surface2,
                selectedColor: AppColors.staffSoft,
                side: BorderSide(
                  color: p == selected ? AppColors.staffB : AppColors.line,
                ),
                labelStyle: AppText.body(
                  size: 12,
                  weight: FontWeight.w700,
                  color:
                      p == selected ? AppColors.staffPillFg : AppColors.inkSoft,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

String pctText(double ratio) => '${(ratio * 100).toStringAsFixed(1)}%';

String shortDate(String iso) {
  final p = (iso.length > 10 ? iso.substring(0, 10) : iso).split('-');
  if (p.length != 3) return iso;
  const m = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', //
  ];
  final mi = int.tryParse(p[1]) ?? 1;
  return '${int.tryParse(p[2]) ?? p[2]} ${m[(mi - 1).clamp(0, 11)]}';
}

class AnalyticsBlock extends StatelessWidget {
  const AnalyticsBlock({
    super.key,
    required this.title,
    required this.child,
    this.trailing,
  });

  final String title;
  final Widget child;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(title, style: AppText.eyebrow())),
              if (trailing != null)
                Flexible(
                  child: Text(
                    trailing!,
                    textAlign: TextAlign.end,
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
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

Widget analyticsEmpty(String text) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Text(
        text,
        style: AppText.body(size: 12, color: AppColors.inkFaint),
      ),
    );

class AnalyticsKpi extends StatelessWidget {
  const AnalyticsKpi({
    super.key,
    required this.label,
    required this.value,
    required this.sub,
    this.delta,
    this.invertDelta = false,
    this.numeric,
    this.formatNumeric,
    this.valueColor,
  });

  final String label;
  final String value;
  final String sub;

  /// Optional headline colour (e.g. warning for a stale-ticket age).
  final Color? valueColor;
  final double? delta;
  final bool invertDelta;

  /// Optional: when both are given the headline counts up to [numeric]
  /// (formatted by [formatNumeric]) instead of showing the static [value].
  final double? numeric;
  final String Function(double)? formatNumeric;

  @override
  Widget build(BuildContext context) {
    final d = delta;
    final good = d == null ? true : (invertDelta ? d <= 0 : d >= 0);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppText.eyebrow()),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: numeric != null && formatNumeric != null
                      ? AnimatedNumber(
                          value: numeric!,
                          format: formatNumeric!,
                          style: AppText.display(size: 22, color: valueColor ?? AppColors.ink),
                        )
                      : Text(
                          value,
                          style: AppText.display(size: 22, color: valueColor ?? AppColors.ink),
                        ),
                ),
              ),
              if (d != null) ...[
                const SizedBox(width: 6),
                Text(
                  '${d >= 0 ? '▲' : '▼'}${d.abs().toStringAsFixed(0)}%',
                  style: AppText.body(
                    size: 11,
                    weight: FontWeight.w800,
                    color: good ? AppColors.success : AppColors.danger,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 4),
          Text(
            sub,
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
    );
  }
}

class AnalyticsDot extends StatelessWidget {
  const AnalyticsDot({super.key, required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      );
}

/// Two-line chart (solid this period, dashed previous), shared 0..max scale.
/// `CustomPainter`, same approach as `RevenueExpenseChart`.
class AnalyticsTrendPainter extends CustomPainter {
  AnalyticsTrendPainter({required this.current, required this.previous});

  final List<double> current;
  final List<double> previous;

  @override
  void paint(Canvas canvas, Size size) {
    if (current.isEmpty) return;
    var maxV = 0.0;
    for (final v in [...current, ...previous]) {
      if (v > maxV) maxV = v;
    }
    if (maxV <= 0) return;
    final n = current.length;
    final dx = n > 1 ? size.width / (n - 1) : 0.0;
    Offset pt(List<double> s, int i) => Offset(
          n > 1 ? dx * i : size.width / 2,
          size.height - (s[i] / maxV) * (size.height - 8) - 4,
        );

    canvas.drawLine(
      Offset(0, size.height - 0.5),
      Offset(size.width, size.height - 0.5),
      Paint()
        ..color = AppColors.line
        ..strokeWidth = 1,
    );

    Path path(List<double> s) {
      final p = Path()..moveTo(pt(s, 0).dx, pt(s, 0).dy);
      for (var i = 1; i < s.length; i++) {
        p.lineTo(pt(s, i).dx, pt(s, i).dy);
      }
      return p;
    }

    // Previous (dashed).
    final dashPaint = Paint()
      ..color = AppColors.inkFaint
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    for (final m in path(previous).computeMetrics()) {
      var d = 0.0;
      while (d < m.length) {
        canvas.drawPath(m.extractPath(d, d + 4), dashPaint);
        d += 7;
      }
    }
    if (n == 1) {
      canvas.drawCircle(pt(current, 0), 4, Paint()..color = AppColors.staffB);
      return;
    }
    canvas.drawPath(
      path(current),
      Paint()
        ..color = AppColors.staffB
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant AnalyticsTrendPainter old) =>
      old.current != current || old.previous != previous;
}

class AnalyticsBar extends StatelessWidget {
  const AnalyticsBar({
    super.key,
    required this.label,
    required this.value,
    required this.fraction,
    this.sub,
    this.previousFraction,
    this.animate = false,
    this.color,
  });

  final String label;
  final String value;
  final double fraction;
  final String? sub;

  /// When set, a thinner faint bar under the main one shows the previous
  /// period on the same scale (this-vs-previous without a grouped chart).
  final double? previousFraction;

  /// Grow the bar(s) from 0 on first paint (respects reduce-motion).
  final bool animate;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 12.5, weight: FontWeight.w700),
                ),
              ),
              Text(
                value,
                style: AppText.tabular(size: 12.5, weight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 4),
          animate
              ? AnimatedFraction(
                  fraction: fraction.clamp(0, 1),
                  builder: (_, v) => _track(v, 6, color ?? AppColors.staffB),
                )
              : _track(fraction, 6, color ?? AppColors.staffB),
          if (previousFraction != null) ...[
            const SizedBox(height: 3),
            animate
                ? AnimatedFraction(
                    fraction: previousFraction!.clamp(0, 1),
                    builder: (_, v) => _track(v, 3, AppColors.inkFaint),
                  )
                : _track(previousFraction!, 3, AppColors.inkFaint),
          ],
          if (sub != null) ...[
            const SizedBox(height: 3),
            Text(
              sub!,
              style: AppText.body(
                size: 10.5,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _track(double v, double height, Color c) => ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.pill),
        child: LinearProgressIndicator(
          value: v.clamp(0, 1),
          minHeight: height,
          backgroundColor: AppColors.surface3,
          color: c,
        ),
      );
}

/// Centered spinner used while an analytics block loads.
class AnalyticsLoading extends StatelessWidget {
  const AnalyticsLoading({super.key});

  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.symmetric(vertical: 36),
        child: Center(
          child: CircularProgressIndicator(color: AppColors.staffB),
        ),
      );
}

/// "<title> unavailable" card with a Retry button.
class AnalyticsErrorBlock extends StatelessWidget {
  const AnalyticsErrorBlock({
    super.key,
    required this.title,
    required this.message,
    required this.onRetry,
  });

  final String title;
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => AnalyticsBlock(
        title: title,
        child: Row(
          children: [
            Expanded(
              child: Text(
                message,
                style: AppText.body(size: 12, color: AppColors.inkFaint),
              ),
            ),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      );
}

/// `▲12%` / `▼3%` text, or null when there is no baseline.
String? deltaText(double? d) =>
    d == null ? null : '${d >= 0 ? '▲' : '▼'}${d.abs().toStringAsFixed(0)}%';

/// "SOME_ENUM" -> "Some enum".
String prettyEnum(String raw) {
  if (raw.isEmpty) return raw;
  final t = raw.replaceAll('_', ' ').toLowerCase();
  return t[0].toUpperCase() + t.substring(1);
}

/// "4 Oct, 15:30" from an ISO instant (device-local time); empty when null
/// or unparsable.
String shortDateTime(String? iso) {
  final d = iso == null ? null : DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '';
  final hh = d.hour.toString().padLeft(2, '0');
  final mm = d.minute.toString().padLeft(2, '0');
  return '${shortDate('${d.year}-${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}')}, $hh:$mm';
}
