import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/income_entry.dart';
import '../../../models/user_profile.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Shared kit for the Income screens (list, add form): the access matrix,
/// period maths, category metadata, formatting helpers and the entry card.

// ── access ──────────────────────────────────────────────────────────────────

/// Single place that answers "may this signed-in staff user see / do X on the
/// Income screens?" — a thin, pure wrapper over the permission list so the
/// gating matrix can be unit-tested.
///
/// **Unchanged from before the redesign**: the Menu tiles (`finance:view` +
/// the `income` feature flag), the route, and the analytics block (needs
/// `finance:view`; a 403 hides it). **Added** (web gates them the same way and
/// the key is seeded and is exactly the API route's `requirePermission`):
/// "Add income" and the row Delete menu need `finance:income-manage`.
class IncomeAccess {
  const IncomeAccess(this.user);

  static IncomeAccess of(BuildContext context) {
    final s = context.read<SessionCubit>().state;
    return IncomeAccess(s is SessionAuthenticatedStaff ? s.user : null);
  }

  final UserProfile? user;

  bool _has(String key) => user?.hasPermission(key) ?? false;

  /// `GET /income/analytics` (and `GET /income`).
  bool get canViewAnalytics => _has('finance:view');

  /// `POST /income`, `DELETE /income/:id`.
  bool get canManage => _has('finance:income-manage');

  /// Web hides Delete on entries the system created from a payment (the API
  /// refuses them).
  bool canDelete(IncomeEntry e) => canManage && !e.isAuto;
}

// ── categories ──────────────────────────────────────────────────────────────

/// Colours per category — the same hues web's `INCOME_CATEGORY_META` uses.
Color incomeCategoryColor(IncomeCategory c) => switch (c) {
      IncomeCategory.membershipFee => TeamColors.indigo,
      IncomeCategory.personalTraining => TeamColors.teal,
      IncomeCategory.productSales => TeamColors.amber,
      IncomeCategory.other => TeamColors.slate,
    };

IconData incomeCategoryIcon(IncomeCategory c) => switch (c) {
      IncomeCategory.membershipFee => Icons.card_membership_rounded,
      IncomeCategory.personalTraining => Icons.fitness_center_rounded,
      IncomeCategory.productSales => Icons.shopping_bag_rounded,
      IncomeCategory.other => Icons.more_horiz_rounded,
    };

/// Category chips web offers, in its order (UPPER_SNAKE api value from the
/// enum, label as web shows it).
List<(String, String)> get kIncomeCategoryOptions => [
      for (final c in IncomeCategory.values) (c.apiValue, c.webLabel),
    ];

String incomeCategoryLabelOf(String api) =>
    IncomeCategoryX.fromApi(api).webLabel;

Color incomeCategoryColorOf(String api) =>
    incomeCategoryColor(IncomeCategoryX.fromApi(api));

// ── period ──────────────────────────────────────────────────────────────────

/// web's `PeriodKey`.
enum IncomePeriod { today, days7, thisMonth, lastMonth, days90, custom }

extension IncomePeriodX on IncomePeriod {
  String get label => switch (this) {
        IncomePeriod.today => 'Today',
        IncomePeriod.days7 => '7 days',
        IncomePeriod.thisMonth => 'This month',
        IncomePeriod.lastMonth => 'Last month',
        IncomePeriod.days90 => '90 days',
        IncomePeriod.custom => 'Custom',
      };

  /// web's `periodNoun` ("total this month").
  String get noun => switch (this) {
        IncomePeriod.today => 'today',
        IncomePeriod.days7 => 'in the last 7 days',
        IncomePeriod.thisMonth => 'this month',
        IncomePeriod.lastMonth => 'last month',
        IncomePeriod.days90 => 'in the last 90 days',
        IncomePeriod.custom => 'in this period',
      };

  /// web's `previousLabel`.
  String get previousLabel => switch (this) {
        IncomePeriod.thisMonth => 'Last month',
        IncomePeriod.lastMonth => 'Month before',
        _ => 'Previous period',
      };
}

/// `YYYY-MM-DD` of the *local* calendar day (never `toIso8601String` — that
/// would shift the day in non-UTC zones).
String ymd(DateTime d) => '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

/// web's `computeRange` (local days). [custom] is used for
/// [IncomePeriod.custom] (falls back to today).
({String from, String to}) incomeRange(
  IncomePeriod p,
  DateTimeRange? custom, [
  DateTime? now,
]) {
  final n = now ?? DateTime.now();
  final today = DateTime(n.year, n.month, n.day);
  switch (p) {
    case IncomePeriod.today:
      return (from: ymd(today), to: ymd(today));
    case IncomePeriod.days7:
      return (
        from: ymd(DateTime(today.year, today.month, today.day - 6)),
        to: ymd(today),
      );
    case IncomePeriod.thisMonth:
      return (from: ymd(DateTime(today.year, today.month)), to: ymd(today));
    case IncomePeriod.lastMonth:
      return (
        from: ymd(DateTime(today.year, today.month - 1)),
        to: ymd(DateTime(today.year, today.month, 0)),
      );
    case IncomePeriod.days90:
      return (
        from: ymd(DateTime(today.year, today.month, today.day - 89)),
        to: ymd(today),
      );
    case IncomePeriod.custom:
      final c = custom;
      return c == null
          ? (from: ymd(today), to: ymd(today))
          : (from: ymd(c.start), to: ymd(c.end));
  }
}

// ── numbers & dates ─────────────────────────────────────────────────────────

/// % change vs previous; null when there is no baseline to compare with
/// (web's `pctChange`).
double? pctChange(double value, double previous) {
  if (previous <= 0) return value > 0 ? null : 0;
  return (value - previous) / previous * 100;
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

/// "18 Oct" from `YYYY-MM-DD` / ISO text (no timezone maths).
String shortDay(String iso) {
  final p = (iso.length > 10 ? iso.substring(0, 10) : iso).split('-');
  if (p.length != 3) return iso;
  final m = (int.tryParse(p[1]) ?? 1).clamp(1, 12);
  return '${int.tryParse(p[2]) ?? p[2]} ${_months[m - 1]}';
}

/// "18 Oct 2026" for a `@db.Date` value (UTC midnight): keep its calendar day.
String incomeDay(DateTime d) {
  final l = d.isUtc ? d : d.toLocal();
  return '${l.day} ${_months[l.month - 1]} ${l.year}';
}

/// "18 Oct" for a local date.
String dayMonth(DateTime d) => '${d.day} ${_months[d.month - 1]}';

/// Amount text used on cards and tiles (same rounding as everywhere else in
/// the app).
String money(double v) => Formatters.currency(v);

// ── small widgets ───────────────────────────────────────────────────────────

/// "▲ 12.3% vs last month" (web's `DeltaText`). Renders just [suffix] when
/// there is no baseline.
class IncomeDeltaText extends StatelessWidget {
  const IncomeDeltaText({
    super.key,
    required this.pct,
    this.suffix,
    this.goodWhenDown = false,
  });

  final double? pct;
  final String? suffix;

  /// Expenses: a drop is good news, so the colours flip (web's
  /// `DeltaText goodWhenDown`).
  final bool goodWhenDown;

  @override
  Widget build(BuildContext context) {
    final style = AppText.body(
      size: 11,
      weight: FontWeight.w700,
      color: AppColors.inkFaint,
    );
    final p = pct;
    if (p == null) {
      return Text(
        suffix ?? '',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: style,
      );
    }
    final up = p >= 0;
    final good = goodWhenDown ? !up : up;
    final color = p == 0
        ? TeamColors.slate
        : good
            ? TeamColors.green
            : TeamColors.rose;
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: '${up ? '▲' : '▼'} ${p.abs().toStringAsFixed(1)}%',
            style: style.copyWith(color: color, fontWeight: FontWeight.w800),
          ),
          if (suffix != null) TextSpan(text: ' $suffix'),
        ],
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: style,
    );
  }
}

/// Category filter / picker chips with a coloured dot (web's category chips).
class IncomeCategoryChip extends StatelessWidget {
  const IncomeCategoryChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.color,
    this.enabled = true,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Color? color;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final c = color ?? TeamColors.violet;
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadii.pill),
          color: selected ? c.withValues(alpha: 0.18) : AppColors.surface3,
          border: Border.all(
            color: selected ? c : Colors.transparent,
            width: 1.4,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (color != null) ...[
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(color: c, shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: AppText.body(
                size: 12,
                weight: FontWeight.w800,
                color: selected ? c : AppColors.inkSoft,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One ledger entry: category glyph, description (or category), date, branch,
/// amount, recorded-by, and (when [onDelete] is given) web's row menu with its
/// single Delete action.
class IncomeEntryCard extends StatelessWidget {
  const IncomeEntryCard({super.key, required this.entry, this.onDelete});

  final IncomeEntry entry;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final color = incomeCategoryColor(entry.category);
    final hasDescription = entry.description?.isNotEmpty == true;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 14, 8, 12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      color,
                      Color.lerp(color, TeamColors.fuchsia, 0.4)!,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(
                  incomeCategoryIcon(entry.category),
                  size: 19,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      hasDescription
                          ? entry.description!
                          : entry.category.webLabel,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 13.5, weight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      incomeDay(entry.incomeDate),
                      style: AppText.body(
                        size: 11.5,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  money(entry.amount),
                  style: AppText.tabular(
                    size: 15,
                    weight: FontWeight.w800,
                    color: TeamColors.green,
                  ),
                ),
              ),
              if (onDelete != null)
                SizedBox(
                  width: 34,
                  height: 30,
                  child: PopupMenuButton<String>(
                    key: ValueKey('income-menu-${entry.id}'),
                    tooltip: 'Actions',
                    padding: EdgeInsets.zero,
                    color: AppColors.surface2,
                    icon: Icon(
                      Icons.more_vert_rounded,
                      size: 19,
                      color: AppColors.inkFaint,
                    ),
                    onSelected: (_) => onDelete!(),
                    itemBuilder: (_) => [
                      PopupMenuItem<String>(
                        value: 'delete',
                        child: Row(
                          children: [
                            const Icon(
                              Icons.delete_outline_rounded,
                              size: 18,
                              color: AppColors.danger,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Delete',
                              style: AppText.body(
                                size: 13,
                                weight: FontWeight.w700,
                                color: AppColors.danger,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                )
              else
                const SizedBox(width: 6),
            ],
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.only(right: 6),
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                IncomeTag(label: entry.category.webLabel, color: color),
                if (entry.branchName != null)
                  IncomeTag(
                    label: entry.branchName!,
                    color: TeamColors.sky,
                    icon: Icons.storefront_rounded,
                  ),
                if (entry.isAuto)
                  const IncomeTag(
                    label: 'Auto (payment)',
                    color: TeamColors.violet,
                    icon: Icons.bolt_rounded,
                  )
                else if (entry.recordedByName != null)
                  IncomeTag(
                    label: 'by ${entry.recordedByName}',
                    color: TeamColors.slate,
                    icon: Icons.person_outline_rounded,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Soft tinted pill whose text ellipsizes (the shared tag overflows on narrow
/// columns).
class IncomeTag extends StatelessWidget {
  const IncomeTag({
    super.key,
    required this.label,
    required this.color,
    this.icon,
  });

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: color),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 11,
                weight: FontWeight.w800,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
