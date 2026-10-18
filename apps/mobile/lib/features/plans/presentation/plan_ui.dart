import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/app_currency.dart';
import '../../../models/membership_plan.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Shared building blocks for the Membership Plans screens (list, detail,
/// add / edit). Same visual language as the Branches / Team / Members
/// redesigns: it reuses the Team kit (`team_ui.dart`) and the
/// `member_detail_anim` primitives and only adds what is plan-specific.

// ── money ───────────────────────────────────────────────────────────────────

String _groupDigits(String digits) {
  if (digits.length <= 3) return digits;
  if (AppCurrency.code == 'INR') {
    final last3 = digits.substring(digits.length - 3);
    final rest = digits.substring(0, digits.length - 3);
    final grouped = rest.replaceAllMapped(
      RegExp(r'(\d)(?=(\d\d)+(?!\d))'),
      (m) => '${m[1]},',
    );
    return '$grouped,$last3';
  }
  return digits.replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
    (m) => '${m[1]},',
  );
}

/// A plan amount with the gym's currency symbol. Unlike
/// `Formatters.currency` (which rounds to whole units) plan prices keep their
/// paise: `₹4,999.50`, but a whole amount stays `₹4,999` (web shows
/// `toFixed(2)`; the zeros add nothing on a phone).
String planMoney(double amount) {
  final negative = amount < 0;
  final abs = amount.abs();
  final fixed = abs.toStringAsFixed(2);
  final dot = fixed.indexOf('.');
  final whole = fixed.substring(0, dot);
  final cents = fixed.substring(dot + 1);
  final symbol = AppCurrency.symbol;
  final body =
      cents == '00' ? _groupDigits(whole) : '${_groupDigits(whole)}.$cents';
  return '${negative ? '-' : ''}$symbol$body';
}

/// Money that counts up from zero (`CountUp` only does whole numbers).
class PriceCountUp extends StatelessWidget {
  const PriceCountUp({
    super.key,
    required this.value,
    required this.style,
    this.prefix = '',
  });

  final double value;
  final TextStyle style;
  final String prefix;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value),
      duration: const Duration(milliseconds: 1100),
      curve: Curves.easeOutCubic,
      builder: (context, v, _) => Text(
        '$prefix${planMoney(v)}',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: style,
      ),
    );
  }
}

// ── status helpers ──────────────────────────────────────────────────────────

Color planTone(MembershipPlan p) => p.isDeleted
    ? TeamColors.rose
    : p.isActive
        ? TeamColors.green
        : TeamColors.amber;

String planStatus(MembershipPlan p) => p.isDeleted
    ? 'Deleted'
    : p.isActive
        ? 'Active'
        : 'Inactive';

IconData planStatusIcon(MembershipPlan p) => p.isDeleted
    ? Icons.delete_outline_rounded
    : p.isActive
        ? Icons.check_circle_rounded
        : Icons.pause_circle_rounded;

String planInitials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
  final letters = parts.take(2).map((p) => p[0].toUpperCase()).join();
  return letters.isEmpty ? 'P' : letters;
}

/// Stable accent per plan (spread over the palette by a name hash).
Color planAccent(String name) {
  final h = name.codeUnits.fold<int>(0, (a, c) => (a * 31 + c) & 0x7fffffff);
  return TeamColors.rotation[h % TeamColors.rotation.length];
}

/// Final price spread over the plan length, per 30 days. Null for plans
/// shorter than a month (where it would be misleading) or free ones.
double? planPricePerMonth(MembershipPlan p) {
  final days = p.approxDays;
  if (days < 30 || p.finalPrice <= 0) return null;
  return p.finalPrice / (days / 30);
}

/// Where the plan can be used: "All branches", "2 branches" or the names.
String planBranchAccess(
  MembershipPlan p, {
  Map<String, String> names = const {},
}) {
  if (p.gymAccessAllBranches) return 'All branches';
  if (p.accessBranchIds.isEmpty) return 'No branches';
  final labels = [for (final id in p.accessBranchIds) names[id] ?? ''];
  if (labels.every((l) => l.isNotEmpty)) return labels.join(', ');
  return '${p.accessBranchIds.length} '
      '${p.accessBranchIds.length == 1 ? 'branch' : 'branches'}';
}

// ── perks ───────────────────────────────────────────────────────────────────

class PlanPerk {
  const PlanPerk({
    required this.icon,
    required this.label,
    required this.on,
    required this.color,
    this.detail,
  });

  final IconData icon;
  final String label;
  final bool on;
  final Color color;
  final String? detail;
}

/// Everything a plan includes (or doesn't) as a ✓/✗ list — the card, the
/// detail Features tab and the review step all render the same list.
List<PlanPerk> planPerks(
  MembershipPlan p, {
  Map<String, String> branchNames = const {},
}) {
  final branchOn = p.gymAccessAllBranches || p.accessBranchIds.isNotEmpty;
  return [
    PlanPerk(
      icon: Icons.fitness_center_rounded,
      label: 'Gym access',
      on: branchOn,
      color: TeamColors.indigo,
      detail: planBranchAccess(p, names: branchNames),
    ),
    PlanPerk(
      icon: Icons.sports_gymnastics_rounded,
      label: 'PT sessions',
      on: p.ptSessionsIncluded > 0,
      color: TeamColors.violet,
      detail: p.ptSessionsIncluded > 0 ? '${p.ptSessionsIncluded}' : null,
    ),
    PlanPerk(
      icon: Icons.groups_rounded,
      label: 'Group classes',
      on: p.groupClassesIncluded > 0,
      color: TeamColors.teal,
      detail: p.groupClassesIncluded > 0 ? '${p.groupClassesIncluded}' : null,
    ),
    PlanPerk(
      icon: Icons.restaurant_rounded,
      label: 'Diet consultation',
      on: p.dietConsultationIncluded,
      color: TeamColors.green,
    ),
    PlanPerk(
      icon: Icons.lock_rounded,
      label: 'Locker access',
      on: p.lockerAccess,
      color: TeamColors.amber,
    ),
    PlanPerk(
      icon: Icons.person_add_alt_1_rounded,
      label: 'Guest passes',
      on: p.guestPasses > 0,
      color: TeamColors.rose,
      detail: p.guestPasses > 0 ? '${p.guestPasses}' : null,
    ),
    PlanPerk(
      icon: Icons.ac_unit_rounded,
      label: 'Freeze',
      on: p.freezeAllowed,
      color: TeamColors.sky,
      detail: !p.freezeAllowed
          ? null
          : p.freezeDaysLimit == null
              ? 'No cap'
              : '${p.freezeDaysLimit} days',
    ),
  ];
}

/// One ✓ / ✗ perk line: coloured icon chip, label, optional quota and a
/// tick / cross badge. [dense] is the card variant.
class PlanPerkRow extends StatelessWidget {
  const PlanPerkRow({super.key, required this.perk, this.dense = false});

  final PlanPerk perk;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final on = perk.on;
    final color = on ? perk.color : AppColors.inkFaint;
    final chip = dense ? 22.0 : 28.0;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: dense ? 3 : 5),
      child: Row(
        children: [
          Container(
            width: chip,
            height: chip,
            decoration: BoxDecoration(
              color: color.withValues(alpha: on ? 0.16 : 0.08),
              borderRadius: BorderRadius.circular(dense ? 7 : 9),
            ),
            child: Icon(perk.icon, size: dense ? 12 : 15, color: color),
          ),
          SizedBox(width: dense ? 7 : 10),
          Expanded(
            child: Text(
              perk.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: dense ? 11.5 : 13,
                weight: FontWeight.w700,
                color: on ? AppColors.ink : AppColors.inkFaint,
              ),
            ),
          ),
          if (perk.detail != null && on)
            Flexible(
              child: Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Text(
                  perk.detail!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: dense ? 10.5 : 11.5,
                    weight: FontWeight.w800,
                    color: perk.color,
                  ),
                ),
              ),
            ),
          Icon(
            on ? Icons.check_circle_rounded : Icons.cancel_rounded,
            size: dense ? 14 : 17,
            color: on
                ? TeamColors.green
                : AppColors.danger.withValues(alpha: 0.55),
          ),
        ],
      ),
    );
  }
}

// ── hero shell + glyphs ─────────────────────────────────────────────────────

/// Full-bleed animated gradient (never capped) with [child] laid out inside
/// the capped content column. Use under a transparent AppBar
/// (`extendBodyBehindAppBar`); [topInset] = status bar + toolbar height.
class PlanHeroShell extends StatelessWidget {
  const PlanHeroShell({
    super.key,
    required this.topInset,
    required this.child,
    this.bottom = 22,
  });

  final double topInset;
  final double bottom;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        const Positioned.fill(
          child: MeshHeroBackground(
            radius: BorderRadius.vertical(bottom: Radius.circular(34)),
            child: SizedBox.expand(),
          ),
        ),
        TeamCenter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(18, 8 + topInset, 18, bottom),
            child: child,
          ),
        ),
      ],
    );
  }
}

/// The membership-card glyph (web's `IdCard` icon): a gradient disc.
class PlanGlyph extends StatelessWidget {
  const PlanGlyph({
    super.key,
    this.size = 54,
    this.colors = const [Color(0xFF4338CA), Color(0xFFC026D3)],
    this.icon = Icons.card_membership_rounded,
  });

  final double size;
  final List<Color> colors;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: colors,
        ),
      ),
      alignment: Alignment.center,
      child: Icon(icon, size: size * 0.5, color: Colors.white),
    );
  }
}

/// Card avatar: a hue ring in the status colour around the plan initials.
class PlanAvatar extends StatelessWidget {
  const PlanAvatar({
    super.key,
    required this.name,
    required this.color,
    this.size = 52,
  });

  final String name;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final accent = planAccent(name);
    return Container(
      padding: const EdgeInsets.all(2.5),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: SweepGradient(
          colors: [color, TeamColors.fuchsia, TeamColors.indigo, color],
        ),
      ),
      child: Container(
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.surface2,
        ),
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [accent, Color.lerp(accent, TeamColors.fuchsia, 0.55)!],
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            planInitials(name),
            style: AppText.display(size: size * 0.34, color: Colors.white),
          ),
        ),
      ),
    );
  }
}

/// Gradient banner under a transparent AppBar for the edit screen.
class PlanBanner extends StatelessWidget {
  const PlanBanner({
    super.key,
    required this.top,
    required this.name,
    required this.subtitle,
    required this.chip,
    required this.chipIcon,
  });

  final double top;
  final String name;
  final String subtitle;
  final String chip;
  final IconData chipIcon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(18, top + 4, 18, 22),
      decoration: const BoxDecoration(
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(30)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF312E81), Color(0xFF7C3AED), TeamColors.fuchsia],
        ),
      ),
      child: TeamCenter(
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(3),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white,
              ),
              child: const PlanGlyph(),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.display(size: 20, color: Colors.white),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.85),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TeamHeroPill(chip, icon: chipIcon),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Frosted quick-filter chip on the list hero (white when selected).
class PlanHeroChip extends StatelessWidget {
  const PlanHeroChip({
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

// ── price summary ───────────────────────────────────────────────────────────

/// The price → discount → tax → registration fee → total summary, as a
/// gradient card (the add / edit form's live preview and the detail screen's
/// Pricing tab). Driven by a [PlanPriceBreakdown] so it matches
/// `MembershipPlan.finalPrice` exactly.
class PlanPriceCard extends StatelessWidget {
  const PlanPriceCard({
    super.key,
    required this.breakdown,
    required this.name,
    required this.durationLabel,
    this.perMonth,
  });

  final PlanPriceBreakdown breakdown;
  final String name;
  final String durationLabel;
  final double? perMonth;

  String _pct(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();

  @override
  Widget build(BuildContext context) {
    final b = breakdown;
    Widget row(
      String label,
      String value, {
      bool strong = false,
      Color? color,
      IconData? icon,
    }) {
      final c = color ?? Colors.white.withValues(alpha: strong ? 1 : 0.86);
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            if (icon != null) ...[
              Icon(icon, size: 14, color: c),
              const SizedBox(width: 6),
            ],
            Expanded(
              child: Text(
                label,
                style: AppText.body(
                  size: strong ? 13.5 : 12.5,
                  weight: strong ? FontWeight.w800 : FontWeight.w600,
                  color: c,
                ),
              ),
            ),
            Text(
              value,
              style: AppText.body(
                size: strong ? 14 : 12.5,
                weight: FontWeight.w800,
                color: c,
              ),
            ),
          ],
        ),
      );
    }

    final divider = Container(
      height: 1,
      margin: const EdgeInsets.symmetric(vertical: 6),
      color: Colors.white.withValues(alpha: 0.22),
    );

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF4338CA), Color(0xFF7C3AED), TeamColors.fuchsia],
        ),
        boxShadow: [
          BoxShadow(
            color: TeamColors.violet.withValues(alpha: 0.35),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.receipt_long_rounded,
                size: 16,
                color: Colors.white,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  name.isEmpty ? 'Price summary' : name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 12.5,
                    weight: FontWeight.w800,
                    color: Colors.white.withValues(alpha: 0.9),
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  durationLabel,
                  style: AppText.body(
                    size: 11,
                    weight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          PriceCountUp(
            value: b.finalPrice,
            style: AppText.display(size: 34, color: Colors.white),
          ),
          Text(
            b.hasAdjustment
                ? 'Plan price after discount & tax'
                : 'Plan price (no discount or tax)',
            style: AppText.body(
              size: 11.5,
              weight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.8),
            ),
          ),
          if (perMonth != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                'About ${planMoney(perMonth!)} per month',
                style: AppText.body(
                  size: 11.5,
                  weight: FontWeight.w700,
                  color: Colors.white.withValues(alpha: 0.9),
                ),
              ),
            ),
          const SizedBox(height: 12),
          row('Base price', planMoney(b.basePrice), icon: Icons.sell_rounded),
          if (b.discountPercentage > 0) ...[
            row(
              'Discount (${_pct(b.discountPercentage)}%)',
              '- ${planMoney(b.discountAmount)}',
              icon: Icons.local_offer_rounded,
              color: const Color(0xFFA7F3D0),
            ),
            row(
              'After discount',
              planMoney(b.taxable),
              icon: Icons.south_rounded,
            ),
          ],
          if (b.taxPercentage > 0)
            row(
              'Tax (${_pct(b.taxPercentage)}%)',
              '+ ${planMoney(b.taxAmount)}',
              icon: Icons.account_balance_rounded,
              color: const Color(0xFFFDE68A),
            ),
          divider,
          row('Plan price', planMoney(b.finalPrice), strong: true),
          if (b.joiningFee > 0)
            row(
              'Registration fee',
              '+ ${planMoney(b.joiningFee)}',
              icon: Icons.how_to_reg_rounded,
            ),
          divider,
          row(
            'Total at sign-up',
            planMoney(b.totalWithJoiningFee),
            strong: true,
            icon: Icons.payments_rounded,
          ),
        ],
      ),
    );
  }
}

// ── small shared bits ───────────────────────────────────────────────────────

/// Horizontal bars labelled with money (the price ladder insight).
class PlanMoneyBars extends StatelessWidget {
  const PlanMoneyBars({super.key, required this.rows, required this.colors});

  final List<(String, double)> rows;
  final List<Color> colors;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return Text(
        'No data yet.',
        style: AppText.body(size: 12.5, color: AppColors.inkFaint),
      );
    }
    final max = rows.map((r) => r.$2).fold(1.0, (a, b) => b > a ? b : a);
    return Column(
      children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) const SizedBox(height: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      rows[i].$1,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 12.5, weight: FontWeight.w700),
                    ),
                  ),
                  Text(
                    planMoney(rows[i].$2),
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w800,
                      color: colors[i % colors.length],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              GrowBar(
                ratio: rows[i].$2 / max,
                height: 7,
                track: AppColors.surface3,
                colors: [
                  colors[i % colors.length],
                  colors[i % colors.length].withValues(alpha: 0.55),
                ],
              ),
            ],
          ),
        ],
      ],
    );
  }
}
