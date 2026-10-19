import 'package:flutter/material.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/member_plan.dart';
import '../../../../repositories/member_portal_repository.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../manager/presentation/widgets/member_detail_anim.dart'
    show CountUp, GrowBar, MeshHeroBackground;
import 'member_profile_blocks.dart' show BounceIn;

// Accent per benefit (gradient pair, light → deep). Palette per the playbook.
const _gymColors = [Color(0xFF2DD4BF), Color(0xFF0D9488)];
const _ptColors = [Color(0xFFA78BFA), Color(0xFF7C3AED)];
const _classColors = [Color(0xFF38BDF8), Color(0xFF0284C7)];
const _dietColors = [Color(0xFF4ADE80), Color(0xFF16A34A)];
const _lockerColors = [Color(0xFFFBBF24), Color(0xFFEA580C)];
const _guestColors = [Color(0xFFF472B6), Color(0xFFC026D3)];
const _freezeColors = [Color(0xFF818CF8), Color(0xFF4F46E5)];
const _otherColors = [Color(0xFF94A3B8), Color(0xFF475569)];

List<Color> _colorsFor(PlanBenefitKey k) => switch (k) {
      PlanBenefitKey.gymAccess => _gymColors,
      PlanBenefitKey.ptSessions => _ptColors,
      PlanBenefitKey.groupClasses => _classColors,
      PlanBenefitKey.dietConsultation => _dietColors,
      PlanBenefitKey.locker => _lockerColors,
      PlanBenefitKey.guestPasses => _guestColors,
      PlanBenefitKey.freeze => _freezeColors,
      PlanBenefitKey.other => _otherColors,
    };

IconData _iconFor(PlanBenefitKey k) => switch (k) {
      PlanBenefitKey.gymAccess => Icons.meeting_room_rounded,
      PlanBenefitKey.ptSessions => Icons.sports_gymnastics_rounded,
      PlanBenefitKey.groupClasses => Icons.groups_rounded,
      PlanBenefitKey.dietConsultation => Icons.restaurant_menu_rounded,
      PlanBenefitKey.locker => Icons.lock_rounded,
      PlanBenefitKey.guestPasses => Icons.group_add_rounded,
      PlanBenefitKey.freeze => Icons.ac_unit_rounded,
      PlanBenefitKey.other => Icons.star_rounded,
    };

const _months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', //
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/// `2026-10-17` → `17 Oct 2026` (calendar day, no timezone).
String planDay(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return iso;
  return '${d.day} ${_months[d.month - 1]} ${d.year}';
}

/// "1 session" / "3 sessions" — the server sends the plural unit.
String planUnit(String? unit, int n) {
  if (unit == null || unit.isEmpty) return '';
  if (n == 1 && unit.endsWith('s')) return unit.substring(0, unit.length - 1);
  return unit;
}

/// Self-loading "What's included in your plan" block: fetches `GET /portal/plan`
/// and shows the shared [MemberPlanBenefitsCard]. Renders nothing while loading
/// (a calm placeholder) or when the member has no membership; a failure shows a
/// small tap-to-retry line — it never blocks the screen it sits on. Change the
/// [reloadToken] to refetch (pull-to-refresh).
class MemberPlanBenefitsSection extends StatefulWidget {
  const MemberPlanBenefitsSection({this.reloadToken = 0, super.key});

  final int reloadToken;

  @override
  State<MemberPlanBenefitsSection> createState() =>
      _MemberPlanBenefitsSectionState();
}

class _MemberPlanBenefitsSectionState extends State<MemberPlanBenefitsSection> {
  MemberPlan? _plan;
  bool _loading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant MemberPlanBenefitsSection old) {
    super.didUpdateWidget(old);
    if (old.reloadToken != widget.reloadToken) _load();
  }

  Future<void> _load() async {
    if (_plan == null) setState(() => _loading = true);
    try {
      final plan = await getIt<MemberPortalRepository>().plan();
      if (!mounted) return;
      setState(() {
        _plan = plan;
        _failed = false;
      });
    } catch (_) {
      if (mounted) setState(() => _failed = _plan == null);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final plan = _plan;
    if (plan != null) return MemberPlanBenefitsCard(plan: plan);
    if (_loading) {
      return Container(
        height: 120,
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: AppColors.line),
        ),
      );
    }
    if (_failed) {
      return GestureDetector(
        onTap: _load,
        behavior: HitTestBehavior.opaque,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            children: [
              Icon(Icons.refresh_rounded, size: 16, color: AppColors.inkFaint),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Couldn’t load what’s included in your plan — tap to retry',
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w700,
                    color: AppColors.inkFaint,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }
    return const SizedBox.shrink();
  }
}

/// The colourful "What's included" card: a gradient header (plan name, code,
/// category, duration, validity bar) over a grid of benefit tiles — icon,
/// label, Included / Not included, and for quotas the remaining count + a
/// usage bar. Gym access spans the full width with branch-name chips.
class MemberPlanBenefitsCard extends StatelessWidget {
  const MemberPlanBenefitsCard({required this.plan, super.key});

  final MemberPlan plan;

  @override
  Widget build(BuildContext context) {
    final gym =
        plan.benefits.where((b) => b.key == PlanBenefitKey.gymAccess).toList();
    final rest =
        plan.benefits.where((b) => b.key != PlanBenefitKey.gymAccess).toList();
    return BounceIn(
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: AppColors.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _PlanHeader(plan: plan),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'What’s included',
                              style: AppText.display(size: 17),
                            ),
                            Text(
                              'For this membership period',
                              style: AppText.body(
                                size: 11.5,
                                weight: FontWeight.w600,
                                color: AppColors.inkFaint,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      _CountChip(
                        included: plan.includedCount,
                        total: plan.benefits.length,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  LayoutBuilder(
                    builder: (context, c) {
                      final cols = c.maxWidth >= 560 ? 3 : 2;
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (final g in gym)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _BenefitTile(benefit: g, index: 1),
                            ),
                          ..._rows(rest, cols),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _rows(List<PlanBenefit> items, int cols) {
    final rows = <Widget>[];
    for (var i = 0; i < items.length; i += cols) {
      final slice = items.sublist(i, (i + cols).clamp(0, items.length));
      rows.add(
        Padding(
          padding: EdgeInsets.only(bottom: i + cols < items.length ? 10 : 0),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var k = 0; k < cols; k++) ...[
                  if (k > 0) const SizedBox(width: 10),
                  Expanded(
                    child: k < slice.length
                        ? _BenefitTile(benefit: slice[k], index: 2 + i + k)
                        : const SizedBox.shrink(),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    }
    return rows;
  }
}

// ───────────────────────────────────────────────────────────────── header

class _PlanHeader extends StatelessWidget {
  const _PlanHeader({required this.plan});

  final MemberPlan plan;

  @override
  Widget build(BuildContext context) {
    final content = SizedBox(
      width: double.infinity,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.workspace_premium_rounded,
                  size: 16,
                  color: Colors.white.withValues(alpha: 0.9),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'YOUR PLAN',
                    style: AppText.eyebrow(
                      color: Colors.white.withValues(alpha: 0.85),
                    ),
                  ),
                ),
                _StatusChip(plan: plan),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              plan.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppText.display(size: 26, color: Colors.white),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                if (plan.code.isNotEmpty) _HeaderChip(plan.code),
                if (plan.category != null) _HeaderChip(plan.category!),
                if (plan.durationLabel.isNotEmpty)
                  _HeaderChip(plan.durationLabel),
              ],
            ),
            if (plan.description != null) ...[
              const SizedBox(height: 10),
              Text(
                plan.description!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w600,
                  color: Colors.white.withValues(alpha: 0.88),
                ),
              ),
            ],
            const SizedBox(height: 14),
            _Validity(plan: plan),
          ],
        ),
      ),
    );
    if (reduceMotion(context)) {
      return DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF4338CA), Color(0xFF7C3AED), Color(0xFFC026D3)],
          ),
        ),
        child: content,
      );
    }
    return MeshHeroBackground(child: content);
  }
}

class _HeaderChip extends StatelessWidget {
  const _HeaderChip(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.18),
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: Colors.white.withValues(alpha: 0.28)),
        ),
        child: Text(
          text,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppText.body(
            size: 11,
            weight: FontWeight.w800,
            color: Colors.white,
          ),
        ),
      );
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.plan});

  final MemberPlan plan;

  @override
  Widget build(BuildContext context) {
    final (label, dot) = plan.expired || plan.status == 'EXPIRED'
        ? ('Expired', const Color(0xFFFF5C7A))
        : plan.status == 'PENDING'
            ? ('Starts soon', const Color(0xFFFBBF24))
            : ('Active', const Color(0xFF4ADE80));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: dot, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: AppText.body(
              size: 11,
              weight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class _Validity extends StatelessWidget {
  const _Validity({required this.plan});

  final MemberPlan plan;

  @override
  Widget build(BuildContext context) {
    final String right;
    if (plan.status == 'PENDING') {
      right = 'Starts ${planDay(plan.startDate)}';
    } else if (plan.expired) {
      right = 'Ended';
    } else {
      right = '${plan.daysLeft} ${plan.daysLeft == 1 ? 'day' : 'days'} left';
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(
              Icons.event_available_rounded,
              size: 14,
              color: Colors.white.withValues(alpha: 0.85),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                '${planDay(plan.startDate)} → ${planDay(plan.endDate)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w700,
                  color: Colors.white.withValues(alpha: 0.9),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              right,
              maxLines: 1,
              style: AppText.body(
                size: 12,
                weight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        _Bar(
          ratio: plan.remainingFraction,
          colors: const [Colors.white, Color(0xFFFDE68A)],
          track: Colors.white.withValues(alpha: 0.22),
          height: 7,
        ),
      ],
    );
  }
}

class _CountChip extends StatelessWidget {
  const _CountChip({required this.included, required this.total});

  final int included;
  final int total;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: AppColors.success.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Text(
          '$included of $total',
          style: AppText.body(
            size: 12,
            weight: FontWeight.w800,
            color: AppColors.success,
          ),
        ),
      );
}

// ────────────────────────────────────────────────────────────────── tiles

/// Usage bar that fills in (static when the OS asks for reduced motion).
class _Bar extends StatelessWidget {
  const _Bar({
    required this.ratio,
    required this.colors,
    this.track,
    this.height = 8,
  });

  final double ratio;
  final List<Color> colors;
  final Color? track;
  final double height;

  @override
  Widget build(BuildContext context) {
    final t = track ?? AppColors.line;
    if (reduceMotion(context)) {
      return Container(
        height: height,
        decoration: BoxDecoration(
          color: t,
          borderRadius: BorderRadius.circular(9),
        ),
        child: FractionallySizedBox(
          alignment: Alignment.centerLeft,
          widthFactor: ratio.clamp(0.02, 1.0),
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(9),
              gradient: LinearGradient(colors: colors),
            ),
          ),
        ),
      );
    }
    return GrowBar(ratio: ratio, colors: colors, height: height, track: t);
  }
}

class _BenefitTile extends StatelessWidget {
  const _BenefitTile({required this.benefit, required this.index});

  final PlanBenefit benefit;
  final int index;

  @override
  Widget build(BuildContext context) {
    final b = benefit;
    final colors = _colorsFor(b.key);
    final on = b.included;
    final accent = colors.last;
    return BounceIn(
      index: index,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          gradient: on
              ? LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    accent.withValues(alpha: 0.2),
                    accent.withValues(alpha: 0.06),
                  ],
                )
              : null,
          color: on ? null : AppColors.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: on ? accent.withValues(alpha: 0.4) : AppColors.line,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    gradient: on
                        ? LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: colors,
                          )
                        : null,
                    color: on ? null : AppColors.line,
                    borderRadius: BorderRadius.circular(11),
                    boxShadow: on
                        ? [
                            BoxShadow(
                              color: accent.withValues(alpha: 0.35),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ]
                        : null,
                  ),
                  child: Icon(
                    _iconFor(b.key),
                    size: 18,
                    color: on ? Colors.white : AppColors.inkFaint,
                  ),
                ),
                const Spacer(),
                Icon(
                  on
                      ? Icons.check_circle_rounded
                      : Icons.remove_circle_outline_rounded,
                  size: 20,
                  color: on ? AppColors.success : AppColors.inkFaint,
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              b.label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 13,
                weight: FontWeight.w800,
                color: on ? AppColors.ink : AppColors.inkSoft,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              on ? 'Included' : 'Not included',
              style: AppText.body(
                size: 11.5,
                weight: FontWeight.w800,
                color: on ? AppColors.success : AppColors.inkFaint,
              ),
            ),
            if (on) _body(context, accent, colors),
          ],
        ),
      ),
    );
  }

  Widget _body(BuildContext context, Color accent, List<Color> colors) {
    final b = benefit;
    if (b.key == PlanBenefitKey.gymAccess) {
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (b.note != null)
              Text(
                b.note!,
                style: AppText.display(size: 16, color: AppColors.ink),
              ),
            if (b.items.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final name in b.items)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.16),
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.place_rounded, size: 12, color: accent),
                          const SizedBox(width: 4),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 220),
                            child: Text(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.body(
                                size: 11.5,
                                weight: FontWeight.w800,
                                color: AppColors.ink,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      );
    }
    if (b.hasQuota) {
      final remaining = b.remaining ?? 0;
      final ratio = 1 - b.usedFraction;
      final low = remaining == 0
          ? const [Color(0xFFFF5C7A), Color(0xFFE11D48)]
          : ratio <= 0.25
              ? const [Color(0xFFFBBF24), Color(0xFFF97316)]
              : colors;
      final unit = b.unit ?? '';
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                if (reduceMotion(context))
                  Text(
                    '$remaining',
                    style: AppText.display(size: 24, color: AppColors.ink),
                  )
                else
                  CountUp(
                    value: remaining,
                    style: AppText.display(size: 24, color: AppColors.ink),
                  ),
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    'left',
                    maxLines: 1,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w800,
                      color: AppColors.inkSoft,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            _Bar(ratio: ratio, colors: low),
            const SizedBox(height: 6),
            Text(
              '${b.used} of ${b.quota} ${planUnit(unit, b.quota ?? 0)} used',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 11,
                weight: FontWeight.w700,
                color: AppColors.inkFaint,
              ),
            ),
          ],
        ),
      );
    }
    if (b.note != null) {
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Text(
          b.note!,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppText.display(size: 16, color: AppColors.ink),
        ),
      );
    }
    return const SizedBox.shrink();
  }
}
