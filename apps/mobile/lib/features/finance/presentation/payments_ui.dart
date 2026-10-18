import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/member_payment.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Shared kit for the redesigned Payments screens (list, detail, record):
/// status / method colours, money + date formatting, hero chip, avatar and
/// small row widgets. The layout pieces come from the Team kit
/// (`team_ui.dart`) like every other redesigned feature.

/// Palette per status / method — web's `PAYMENT_STATUS_META` and
/// `PAYMENT_METHOD_COLORS` mapped onto the Team palette.
class PayColors {
  PayColors._();

  static Color status(String s) => switch (s) {
        'SUCCESS' => TeamColors.green,
        'PENDING' => TeamColors.amber,
        'PARTIALLY_REFUNDED' => TeamColors.fuchsia,
        'REFUNDED' => TeamColors.violet,
        'FAILED' => TeamColors.rose,
        _ => TeamColors.slate, // CANCELLED / unknown
      };

  static Color method(String m) => switch (m) {
        'UPI' => TeamColors.indigo,
        'CASH' => TeamColors.teal,
        'ONLINE_GATEWAY' => TeamColors.green,
        'CREDIT_CARD' => TeamColors.amber,
        'BANK_TRANSFER' => TeamColors.fuchsia,
        'DEBIT_CARD' => TeamColors.sky,
        'CHEQUE' => TeamColors.violet,
        _ => TeamColors.slate,
      };

  static IconData statusIcon(String s) => switch (s) {
        'SUCCESS' => Icons.check_circle_rounded,
        'PENDING' => Icons.schedule_rounded,
        'PARTIALLY_REFUNDED' => Icons.undo_rounded,
        'REFUNDED' => Icons.replay_circle_filled_rounded,
        'FAILED' => Icons.error_rounded,
        _ => Icons.cancel_rounded,
      };
}

/// Money with paise when the amount has them. `Formatters.currency` rounds to
/// whole rupees, which would hide a ₹0.50 refund balance or a decimal tax —
/// payments are the one place the cents matter.
String payMoney(double v) {
  final cents = (v.abs() * 100).round();
  final r = cents / 100;
  final signed = v < 0 ? -r : r;
  if (cents % 100 == 0 || r >= 100000) return Formatters.currency(signed);
  final frac = (cents % 100).toString().padLeft(2, '0');
  final whole = Formatters.currency(r.truncateToDouble());
  return '${v < 0 ? '-' : ''}$whole.$frac';
}

const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// `18 Oct 2026` — `payment_date` arrives as a bare `YYYY-MM-DD`, so it is
/// shown as the calendar day it names (no time zone shift, no invented
/// time-of-day).
String payDate(DateTime d, {bool year = true}) =>
    '${d.day} ${_months[d.month - 1]}${year ? ' ${d.year}' : ''}';

/// `18 Oct, 4:05 pm` in local time (for server instants like `createdAt`,
/// `refundedAt`).
String payDateTime(DateTime d) {
  final l = d.toLocal();
  final h = l.hour % 12 == 0 ? 12 : l.hour % 12;
  final m = l.minute.toString().padLeft(2, '0');
  return '${payDate(l, year: false)}, $h:$m ${l.hour >= 12 ? 'pm' : 'am'}';
}

/// `YYYY-MM-DD` of a local calendar day.
String payIso(DateTime d) => '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// Status chip (dot + label) in the status colour.
Widget payStatusTag(String status) => TeamTag(
      label: paymentStatusLabel(status),
      color: PayColors.status(status),
      icon: PayColors.statusIcon(status),
    );

Widget payMethodTag(String method) => TeamTag(
      label: paymentMethodLabel(method),
      color: PayColors.method(method),
    );

/// Selectable translucent chip for the hero (white when selected).
class PayHeroChip extends StatelessWidget {
  const PayHeroChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? const Color(0xFF6D28D9) : Colors.white;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.white.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
        ),
        child: Text(
          label,
          style: AppText.body(size: 12.5, weight: FontWeight.w800, color: fg),
        ),
      ),
    );
  }
}

String payInitials(String name) {
  final words =
      name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  if (words.isEmpty) return '?';
  if (words.length == 1) {
    return words.first
        .substring(0, words.first.length.clamp(0, 2))
        .toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

/// Gradient disc with the member's initials, hue picked by a stable hash of
/// [seed] (web's `MemberAvatar`).
class PayAvatar extends StatelessWidget {
  const PayAvatar({super.key, required this.name, this.seed, this.size = 44});

  final String name;
  final String? seed;
  final double size;

  @override
  Widget build(BuildContext context) {
    final s = seed ?? name;
    var h = 0;
    for (final c in s.codeUnits) {
      h = (h * 31 + c) & 0x7fffffff;
    }
    final color = TeamColors.rotation[h % TeamColors.rotation.length];
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [color, Color.lerp(color, TeamColors.fuchsia, 0.45)!],
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        payInitials(name),
        style: AppText.display(size: size * 0.34, color: Colors.white),
      ),
    );
  }
}

/// Money that counts up from zero the first time it shows (the stock
/// `CountUp` rounds to whole numbers and has no currency formatting).
class PayMoneyCount extends StatelessWidget {
  const PayMoneyCount({
    super.key,
    required this.value,
    required this.style,
    this.compact = false,
  });

  final double value;
  final TextStyle style;

  /// `₹13k` style for tight tiles.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value),
      duration: const Duration(milliseconds: 1100),
      curve: Curves.easeOutCubic,
      builder: (context, v, _) => Text(
        compact ? Formatters.currencyCompact(v) : payMoney(v),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: style,
      ),
    );
  }
}

/// `▲ 12.3%` / `▼ 4.0%` against the previous period; [goodWhenDown] flips the
/// colours (refunds). Renders [fallback] when there is no baseline.
class PayDelta extends StatelessWidget {
  const PayDelta({
    super.key,
    required this.pct,
    this.goodWhenDown = false,
    this.suffix,
    this.fallback,
  });

  final double? pct;
  final bool goodWhenDown;
  final String? suffix;
  final String? fallback;

  @override
  Widget build(BuildContext context) {
    final p = pct;
    if (p == null) {
      return Text(
        fallback ?? suffix ?? '',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppText.body(
          size: 11,
          color: AppColors.inkFaint,
          weight: FontWeight.w600,
        ),
      );
    }
    final up = p >= 0;
    final good = goodWhenDown ? !up : up;
    final color = p == 0
        ? AppColors.inkFaint
        : good
            ? TeamColors.green
            : TeamColors.rose;
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: '${up ? '▲' : '▼'} ${p.abs().toStringAsFixed(1)}%',
            style:
                AppText.body(size: 11.5, weight: FontWeight.w800, color: color),
          ),
          if (suffix != null)
            TextSpan(
              text: ' $suffix',
              style: AppText.body(
                size: 11,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
        ],
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }
}

/// Label on the left, value on the right, hairline above (details card).
class PayInfoRow extends StatelessWidget {
  const PayInfoRow({
    super.key,
    required this.label,
    this.value,
    this.child,
    this.first = false,
  });

  final String label;
  final String? value;
  final Widget? child;
  final bool first;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 11),
      decoration: BoxDecoration(
        border: first ? null : Border(top: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: AppText.body(
              size: 12.5,
              color: AppColors.inkFaint,
              weight: FontWeight.w700,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Align(
              alignment: Alignment.centerRight,
              child: child ??
                  Text(
                    (value == null || value!.isEmpty) ? '—' : value!,
                    textAlign: TextAlign.right,
                    style: AppText.body(size: 13, weight: FontWeight.w800),
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Fade + rise entrance for list items.
class PayRise extends StatelessWidget {
  const PayRise({super.key, required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 380 + (index.clamp(0, 6)) * 60),
      curve: Curves.easeOutCubic,
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(0, 14 * (1 - t)),
          child: child,
        ),
      ),
      child: child,
    );
  }
}

/// Plain "no data" line used inside insight cards.
class PayEmptyNote extends StatelessWidget {
  const PayEmptyNote(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Text(
          text,
          style: AppText.body(size: 12.5, color: AppColors.inkFaint),
        ),
      );
}
