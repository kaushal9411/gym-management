import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Shared kit for the Billing screens (overview hub, payment history,
/// invoices, billing address, plan comparison + checkout): money / date
/// formatting, the status palette, the hub hero, KPI tiles and small blocks.
///
/// Gating note: **there is no per-action gating in Billing**, exactly as
/// before the redesign and as on web (web gates only the sidebar entry with
/// `billing:read`; the API enforces `billing:manage` on the mutations and
/// answers 403, whose message is shown). The Menu tile (`billing:read`, Owner
/// and Manager menus) is the only gate.

// ── money & dates ───────────────────────────────────────────────────────────

const _symbols = {
  'INR': '₹',
  'USD': r'$',
  'EUR': '€',
  'GBP': '£',
  'AUD': r'A$',
  'CAD': r'C$',
  'SGD': r'S$',
  'JPY': '¥',
};

String _group(int whole, {required bool indian}) {
  final digits = whole.abs().toString();
  if (digits.length <= 3) return digits;
  final head = digits.substring(0, digits.length - 3);
  final tail = digits.substring(digits.length - 3);
  final grouped = indian
      ? head.replaceAllMapped(RegExp(r'(\d)(?=(\d\d)+$)'), (m) => '${m[1]},')
      : head.replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
  return '$grouped,$tail';
}

/// web's `formatMoney(amount, currency, fractionDigits)`: the *plan's own*
/// currency (the platform bills in its own currency, which is not the gym's
/// currency), symbol where known, otherwise `CODE 1,234`. [decimals] is 0 on
/// plan cards and 2 on payment / invoice rows and the checkout breakdown.
String billingMoney(double amount, String currency, {int decimals = 0}) {
  final negative = amount < 0;
  final fixed = amount.abs().toStringAsFixed(decimals);
  final parts = fixed.split('.');
  final whole = _group(int.parse(parts[0]), indian: currency == 'INR');
  final body = decimals > 0 ? '$whole.${parts[1]}' : whole;
  final symbol = _symbols[currency];
  return '${negative ? '-' : ''}${symbol ?? '$currency '}$body';
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

/// "18 Oct 2026" in the device's local time (server timestamps are UTC);
/// "—" for null — web's `formatDate`.
String billingDate(DateTime? d) {
  if (d == null) return '—';
  final l = d.toLocal();
  return '${l.day} ${_months[l.month - 1]} ${l.year}';
}

/// "18 Oct 2026, 3:42 PM" in local time — a payment attempt's `createdAt`.
String billingDateTime(DateTime d) {
  final l = d.toLocal();
  final h = l.hour % 12 == 0 ? 12 : l.hour % 12;
  final m = l.minute.toString().padLeft(2, '0');
  return '${billingDate(l)}, $h:$m ${l.hour >= 12 ? 'PM' : 'AM'}';
}

/// "Oct 26" — a month label on the spend chart.
String billingMonthLabel(int year, int month) =>
    "${_months[month - 1]} '${(year % 100).toString().padLeft(2, '0')}";

/// `SENT_BACK` -> `Sent back` (web shows the raw status with `_` -> space in
/// upper case; the app's pills are sentence case).
String billingStatusLabel(String status) => prettyEnum(status);

// ── status palette ──────────────────────────────────────────────────────────

/// web's `STATUS_TONE`: subscription, payment and invoice statuses share one
/// map. Unknown statuses fall back to the muted tone.
Color billingStatusColor(String status) => switch (status) {
      'ACTIVE' || 'SUCCEEDED' || 'PAID' => TeamColors.green,
      'TRIALING' => TeamColors.indigo,
      'PAST_DUE' || 'GRACE' || 'PENDING' || 'OPEN' => TeamColors.amber,
      'SUSPENDED' || 'FAILED' || 'UNCOLLECTIBLE' => TeamColors.rose,
      _ => TeamColors.slate,
    };

/// Tinted pill with a dot — web's `StatusPill`.
class BillingStatusPill extends StatelessWidget {
  const BillingStatusPill({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final c = billingStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: c, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              billingStatusLabel(status),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 11,
                weight: FontWeight.w800,
                color: c,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── period maths (web's `periodProgress`) ───────────────────────────────────

/// Days left until the period end (ceil, floored at 0) and the % of the
/// current period already used. Null when the period has no end.
({int daysLeft, double elapsedPct})? billingPeriodProgress({
  required DateTime start,
  required DateTime? end,
  DateTime? now,
}) {
  if (end == null) return null;
  final n = (now ?? DateTime.now()).millisecondsSinceEpoch;
  final s = start.millisecondsSinceEpoch;
  final e = end.millisecondsSinceEpoch;
  final total = (e - s) <= 0 ? 1 : (e - s);
  const day = 86400000;
  final left = ((e - n) / day).ceil();
  return (
    daysLeft: left < 0 ? 0 : left,
    elapsedPct: (((n - s) / total) * 100).clamp(0.0, 100.0),
  );
}

// ── hero (hub) ──────────────────────────────────────────────────────────────

/// One headline figure on the hub hero (web's `BillingHeroStat`).
class BillingHeroStat {
  const BillingHeroStat({required this.value, required this.label, this.dot});

  final String value;
  final String label;

  /// Pulsing status dot beside the value (the subscription status).
  final Color? dot;
}

/// The gradient hero of the Billing overview hub (a hub, not a list, so it
/// sizes to its content instead of using the fixed-height `ListHero`): back
/// button, eyebrow + title + subtitle, the headline stats and the hero actions
/// (web's "Change plan" / "Cancel subscription"). Full-bleed; the content is
/// inset by [teamSideInset] on tablets.
class BillingHero extends StatelessWidget {
  const BillingHero({
    super.key,
    required this.topInset,
    required this.subtitle,
    required this.stats,
    required this.statsLoading,
    required this.actions,
    this.onBack,
  });

  final double topInset;
  final String subtitle;
  final List<BillingHeroStat> stats;
  final bool statsLoading;
  final List<Widget> actions;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final side = 18 + teamSideInset(context);
    return MeshHeroBackground(
      radius: const BorderRadius.vertical(bottom: Radius.circular(30)),
      child: Padding(
        padding: EdgeInsets.fromLTRB(side, 14 + topInset, side, 22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (onBack != null)
                  ListHeroButton(
                    icon: Icons.arrow_back_rounded,
                    onTap: onBack,
                  ),
                const Spacer(),
                Floating(
                  child: Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.35),
                      ),
                    ),
                    child: const Icon(
                      Icons.credit_card_rounded,
                      color: Colors.white,
                      size: 22,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            FadeUp(
              index: 0,
              child: Text(
                'SUBSCRIPTION',
                style: AppText.body(
                  size: 11,
                  weight: FontWeight.w800,
                  color: Colors.white.withValues(alpha: 0.82),
                ).copyWith(letterSpacing: 1.6),
              ),
            ),
            const SizedBox(height: 2),
            FadeUp(
              index: 1,
              child: Text(
                'Billing & Subscription',
                style: AppText.display(size: 26, color: Colors.white),
              ),
            ),
            const SizedBox(height: 4),
            FadeUp(
              index: 2,
              child: Text(
                subtitle,
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w600,
                  color: Colors.white.withValues(alpha: 0.9),
                ),
              ),
            ),
            if (statsLoading || stats.isNotEmpty) ...[
              const SizedBox(height: 16),
              FadeUp(
                index: 3,
                child: Wrap(
                  spacing: 26,
                  runSpacing: 12,
                  children: statsLoading
                      ? [
                          for (var i = 0; i < 3; i++) const _HeroStatSkeleton(),
                        ]
                      : [for (final s in stats) _HeroStat(stat: s)],
                ),
              ),
            ],
            if (actions.isNotEmpty) ...[
              const SizedBox(height: 18),
              FadeUp(
                index: 4,
                child: Wrap(spacing: 10, runSpacing: 10, children: actions),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.stat});

  final BillingHeroStat stat;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (stat.dot != null) ...[
              Container(
                padding: const EdgeInsets.all(3),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                ),
                child: PulseDot(color: stat.dot!, size: 8),
              ),
              const SizedBox(width: 7),
            ],
            Text(
              stat.value,
              style: AppText.display(size: 19, color: Colors.white),
            ),
          ],
        ),
        Text(
          stat.label,
          style: AppText.body(
            size: 11.5,
            weight: FontWeight.w700,
            color: Colors.white.withValues(alpha: 0.82),
          ),
        ),
      ],
    );
  }
}

class _HeroStatSkeleton extends StatelessWidget {
  const _HeroStatSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 84,
          height: 22,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.25),
            borderRadius: BorderRadius.circular(7),
          ),
        ),
        const SizedBox(height: 6),
        Container(
          width: 56,
          height: 10,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.18),
            borderRadius: BorderRadius.circular(5),
          ),
        ),
      ],
    );
  }
}

/// Button on the hub hero: [solid] = white with indigo text (primary action),
/// otherwise frosted glass.
class BillingHeroButton extends StatelessWidget {
  const BillingHeroButton({
    super.key,
    required this.label,
    required this.icon,
    required this.onTap,
    this.solid = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final bool solid;

  @override
  Widget build(BuildContext context) {
    final fg = solid ? const Color(0xFF4338CA) : Colors.white;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
        decoration: BoxDecoration(
          color: solid ? Colors.white : Colors.white.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(16),
          border: solid
              ? null
              : Border.all(color: Colors.white.withValues(alpha: 0.32)),
          boxShadow: solid
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.18),
                    blurRadius: 14,
                    offset: const Offset(0, 6),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: fg),
            const SizedBox(width: 7),
            Text(
              label,
              style: AppText.body(size: 13, weight: FontWeight.w800, color: fg),
            ),
          ],
        ),
      ),
    );
  }
}

// ── KPI tiles ───────────────────────────────────────────────────────────────

class BillingKpi {
  const BillingKpi({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    this.hint,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? hint;
  final Color color;
}

/// web's `SummaryCard` row: 2 columns on phones, [wideColumns] from 560 dp.
/// Static tiles (no tap target), like web's.
class BillingKpiGrid extends StatelessWidget {
  const BillingKpiGrid({
    super.key,
    required this.tiles,
    required this.loading,
    this.wideColumns = 4,
  });

  final List<BillingKpi> tiles;
  final bool loading;
  final int wideColumns;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        final cols = c.maxWidth >= 560 ? wideColumns : 2;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          itemCount: tiles.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: cols,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            mainAxisExtent: 112,
          ),
          itemBuilder: (context, i) => FadeUp(
            index: i,
            child: _KpiTile(tile: tiles[i], loading: loading),
          ),
        );
      },
    );
  }
}

class _KpiTile extends StatelessWidget {
  const _KpiTile({required this.tile, required this.loading});

  final BillingKpi tile;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final c = tile.color;
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [c.withValues(alpha: 0.16), Colors.transparent],
        ),
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: c.withValues(alpha: 0.24)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: c.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Icon(tile.icon, size: 14, color: c),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  tile.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 11.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const Spacer(),
          if (loading)
            Container(
              width: 70,
              height: 20,
              decoration: BoxDecoration(
                color: AppColors.surface3,
                borderRadius: BorderRadius.circular(6),
              ),
            )
          else
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                tile.value,
                maxLines: 1,
                style: AppText.display(size: 22, color: c),
              ),
            ),
          if (tile.hint != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                tile.hint!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(
                  size: 10.5,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w700,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── small blocks ────────────────────────────────────────────────────────────

/// web's `EmptyBlock` — dashed card with an icon tile, title and a message.
class BillingEmptyBlock extends StatelessWidget {
  const BillingEmptyBlock({
    super.key,
    required this.icon,
    required this.title,
    this.message,
  });

  final IconData icon;
  final String title;
  final String? message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 30),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [TeamColors.indigo, TeamColors.fuchsia],
              ),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Icon(icon, color: Colors.white, size: 26),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: AppText.display(size: 17),
          ),
          if (message != null) ...[
            const SizedBox(height: 6),
            Text(
              message!,
              textAlign: TextAlign.center,
              style: AppText.body(
                size: 12.5,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Filter chip row with counts — web's `Chip small` list (`All · 12`).
class BillingFilterChips extends StatelessWidget {
  const BillingFilterChips({
    super.key,
    required this.options,
    required this.current,
    required this.onChanged,
    this.counts = const {},
  });

  /// `(value, label)` pairs; value `ALL` = no filter.
  final List<(String, String)> options;
  final String current;
  final Map<String, int> counts;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final o in options)
          TeamFilterChip(
            label: '${o.$2} · ${counts[o.$1] ?? 0}',
            selected: current == o.$1,
            color: o.$1 == 'ALL' ? TeamColors.violet : billingStatusColor(o.$1),
            onTap: () => onChanged(o.$1),
          ),
      ],
    );
  }
}

/// A row of label / value pairs separated by hairlines — web's `<dl>` rows.
class BillingDetailRow extends StatelessWidget {
  const BillingDetailRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.last = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(bottom: last ? 0 : 11, top: 0),
      margin: EdgeInsets.only(bottom: last ? 0 : 11),
      decoration: BoxDecoration(
        border: last ? null : Border(bottom: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.inkFaint),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: AppText.body(
                size: 13,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: AppText.body(size: 13, weight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

// ── spend chart ─────────────────────────────────────────────────────────────

/// "₹13k" / "₹4.1L" / "$1.2M" — web's `compactMoney` for axis / bar labels.
String billingCompact(double v, String currency) {
  final symbol = _symbols[currency] ?? '$currency ';
  final abs = v.abs();
  String body;
  if (currency == 'INR' && abs >= 100000) {
    body = '${(abs / 100000).toStringAsFixed(abs >= 1000000 ? 1 : 2)}L';
  } else if (currency != 'INR' && abs >= 1000000) {
    final m = abs / 1000000;
    body = '${m.toStringAsFixed(m >= 10 ? 0 : 1)}M';
  } else if (abs >= 1000) {
    final k = abs / 1000;
    body = '${k.toStringAsFixed(k >= 10 ? 0 : 1)}k';
  } else {
    body = abs.toStringAsFixed(0);
  }
  return '${v < 0 ? '-' : ''}$symbol$body';
}

/// One calendar month of successful payments.
class SpendPoint {
  const SpendPoint({required this.label, required this.amount});

  final String label;
  final double amount;
}

/// web's `SpendChart`: one bar per month (successful payments only). Bars grow
/// in; tap one to read its exact amount (web's hover tooltip). Scrolls
/// sideways when there are more months than fit.
class BillingSpendChart extends StatefulWidget {
  const BillingSpendChart({
    super.key,
    required this.points,
    required this.currency,
  });

  final List<SpendPoint> points;
  final String currency;

  @override
  State<BillingSpendChart> createState() => _BillingSpendChartState();
}

class _BillingSpendChartState extends State<BillingSpendChart> {
  int? _selected;

  @override
  Widget build(BuildContext context) {
    final points = widget.points;
    final maxAmount =
        points.fold<double>(0, (m, p) => p.amount > m ? p.amount : m);
    final sel = _selected != null && _selected! < points.length
        ? points[_selected!]
        : null;
    return LayoutBuilder(
      builder: (context, c) {
        const barSlot = 56.0;
        final fits = points.length * barSlot <= c.maxWidth;
        final slotWidth = fits ? c.maxWidth / points.length : barSlot;
        final chart = SizedBox(
          height: 190,
          width: fits ? c.maxWidth : points.length * barSlot,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (var i = 0; i < points.length; i++)
                SizedBox(
                  width: slotWidth,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(
                      () => _selected = _selected == i ? null : i,
                    ),
                    child: _SpendBar(
                      point: points[i],
                      ratio: maxAmount <= 0 ? 0 : points[i].amount / maxAmount,
                      currency: widget.currency,
                      selected: _selected == i,
                    ),
                  ),
                ),
            ],
          ),
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            fits
                ? chart
                : SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: chart,
                  ),
            const SizedBox(height: 8),
            Text(
              sel == null
                  ? 'Tap a bar for the exact amount'
                  : '${sel.label} · Paid '
                      '${billingMoney(sel.amount, widget.currency, decimals: 2)}',
              key: const ValueKey('spend-caption'),
              style: AppText.body(
                size: 11.5,
                weight: FontWeight.w700,
                color: sel == null ? AppColors.inkFaint : TeamColors.indigo,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _SpendBar extends StatelessWidget {
  const _SpendBar({
    required this.point,
    required this.ratio,
    required this.currency,
    required this.selected,
  });

  final SpendPoint point;
  final double ratio;
  final String currency;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Text(
          billingCompact(point.amount, currency),
          maxLines: 1,
          style: AppText.body(
            size: 10.5,
            weight: FontWeight.w800,
            color: selected ? TeamColors.indigo : AppColors.inkFaint,
          ),
        ),
        const SizedBox(height: 4),
        Flexible(
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: ratio.clamp(0.02, 1.0)),
            duration: const Duration(milliseconds: 900),
            curve: Curves.easeOutCubic,
            builder: (context, v, _) => FractionallySizedBox(
              heightFactor: v,
              child: Container(
                width: 30,
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(9),
                  ),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: selected
                        ? const [TeamColors.fuchsia, TeamColors.indigo]
                        : [
                            TeamColors.indigo,
                            TeamColors.indigo.withValues(alpha: 0.55),
                          ],
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          point.label,
          maxLines: 1,
          style: AppText.body(
            size: 10.5,
            weight: FontWeight.w700,
            color: AppColors.inkFaint,
          ),
        ),
      ],
    );
  }
}
