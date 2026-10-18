import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/membership_plan.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../plan_actions.dart';
import '../plan_ui.dart';

/// Value of the card's overflow menu: `view`, `edit`, or a [PlanAction] name.
typedef PlanMenuCallback = void Function(String value);

List<PopupMenuEntry<String>> planMenuItems(
  MembershipPlan p, {
  required bool canUpdate,
  required List<PlanAction> actions,
}) {
  return [
    if (!p.isDeleted)
      const PopupMenuItem(value: 'view', child: Text('View plan')),
    if (!p.isDeleted && canUpdate)
      const PopupMenuItem(value: 'edit', child: Text('Edit plan')),
    for (final a in actions)
      PopupMenuItem(
        value: a.name,
        child: Text(
          a.label,
          style: a == PlanAction.delete
              ? const TextStyle(color: AppColors.danger)
              : null,
        ),
      ),
  ];
}

/// One membership plan in the list: web's `MembershipPlanCard`. The default
/// layout is the rich card (status band, avatar, tags, animated price with
/// its discount / tax breakdown, member count, a ✓ / ✗ perk checklist and
/// quick actions); [compact] is web's dense list row.
class PlanCard extends StatelessWidget {
  const PlanCard({
    super.key,
    required this.plan,
    required this.onTap,
    required this.onMenu,
    required this.canUpdate,
    required this.actions,
    this.compact = false,
    this.branchNames = const {},
  });

  final MembershipPlan plan;
  final bool compact;
  final bool canUpdate;
  final List<PlanAction> actions;
  final Map<String, String> branchNames;
  final VoidCallback onTap;
  final PlanMenuCallback onMenu;

  @override
  Widget build(BuildContext context) {
    final items = planMenuItems(plan, canUpdate: canUpdate, actions: actions);
    return compact ? _compact(context, items) : _rich(context, items);
  }

  Widget _menu(List<PopupMenuEntry<String>> items) {
    if (items.isEmpty) return const SizedBox.shrink();
    return PopupMenuButton<String>(
      padding: EdgeInsets.zero,
      tooltip: 'Actions for ${plan.name}',
      color: AppColors.surface2,
      icon: Icon(Icons.more_horiz_rounded, size: 20, color: AppColors.inkSoft),
      onSelected: onMenu,
      itemBuilder: (_) => items,
    );
  }

  List<Widget> _tags() {
    final p = plan;
    return [
      if (p.planCode.isNotEmpty)
        TeamTag(
          label: p.planCode,
          color: TeamColors.indigo,
          icon: Icons.tag_rounded,
        ),
      if (p.category != null)
        TeamTag(
          label: p.category!,
          color: TeamColors.violet,
          icon: Icons.sell_rounded,
        ),
      TeamTag(
        label: p.durationLabel,
        color: TeamColors.teal,
        icon: Icons.timelapse_rounded,
      ),
    ];
  }

  // ── compact row ───────────────────────────────────────────────────────────

  Widget _compact(BuildContext context, List<PopupMenuEntry<String>> items) {
    final p = plan;
    final tone = planTone(p);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
            child: Row(
              children: [
                PlanAvatar(name: p.name, color: tone, size: 38),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(size: 14, weight: FontWeight.w800),
                      ),
                      Text(
                        [
                          if (p.planCode.isNotEmpty) p.planCode,
                          p.durationLabel,
                          if (p.category != null) p.category!,
                        ].join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 11.5,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(planStatusIcon(p), size: 12, color: tone),
                          const SizedBox(width: 4),
                          Text(
                            planStatus(p),
                            style: AppText.body(
                              size: 11,
                              weight: FontWeight.w800,
                              color: tone,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Icon(
                            Icons.groups_rounded,
                            size: 12,
                            color: AppColors.inkFaint,
                          ),
                          const SizedBox(width: 3),
                          Text(
                            '${p.memberCount}',
                            style: AppText.body(
                              size: 11,
                              weight: FontWeight.w700,
                              color: AppColors.inkSoft,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      planMoney(p.finalPrice),
                      style: AppText.display(size: 15, color: tone),
                    ),
                    if (p.breakdown.hasAdjustment)
                      Text(
                        'base ${planMoney(p.price)}',
                        style: AppText.body(
                          size: 10,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
                        ).copyWith(decoration: TextDecoration.lineThrough),
                      ),
                  ],
                ),
                _menu(items),
                if (items.isEmpty)
                  Icon(
                    Icons.chevron_right_rounded,
                    size: 20,
                    color: AppColors.inkFaint,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── rich card ─────────────────────────────────────────────────────────────

  Widget _priceBlock() {
    final p = plan;
    final accent = planAccent(p.name);
    final b = p.breakdown;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            accent.withValues(alpha: 0.20),
            accent.withValues(alpha: 0.04),
          ],
        ),
        border: Border.all(color: accent.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Flexible(
                      child: PriceCountUp(
                        value: p.finalPrice,
                        style: AppText.display(size: 25, color: accent),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 3),
                      child: Text(
                        '/ ${p.durationLabel}',
                        style: AppText.body(
                          size: 11.5,
                          weight: FontWeight.w700,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (b.hasAdjustment)
                      Text(
                        'Base ${planMoney(p.price)}',
                        style: AppText.body(
                          size: 11,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
                        ).copyWith(decoration: TextDecoration.lineThrough),
                      ),
                    if (p.discountPercentage > 0)
                      TeamTag(
                        label: '-${_pct(p.discountPercentage)}%',
                        color: TeamColors.green,
                        icon: Icons.local_offer_rounded,
                      ),
                    if (p.taxPercentage > 0)
                      TeamTag(
                        label: '+${_pct(p.taxPercentage)}% tax',
                        color: TeamColors.amber,
                      ),
                    if (p.joiningFee > 0)
                      TeamTag(
                        label: '+${planMoney(p.joiningFee)} fee',
                        color: TeamColors.rose,
                        icon: Icons.how_to_reg_rounded,
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Column(
            children: [
              Icon(Icons.groups_rounded, size: 18, color: TeamColors.violet),
              Text(
                '${p.memberCount}',
                style: AppText.display(size: 18, color: TeamColors.violet),
              ),
              Text(
                p.memberCount == 1 ? 'member' : 'members',
                style: AppText.body(
                  size: 10,
                  weight: FontWeight.w600,
                  color: AppColors.inkFaint,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _pct(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();

  Widget _perks() {
    final perks = planPerks(plan, branchNames: branchNames);
    final half = (perks.length / 2).ceil();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            children: [
              for (final k in perks.take(half))
                PlanPerkRow(perk: k, dense: true),
            ],
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            children: [
              for (final k in perks.skip(half))
                PlanPerkRow(perk: k, dense: true),
            ],
          ),
        ),
      ],
    );
  }

  Widget _rich(BuildContext context, List<PopupMenuEntry<String>> items) {
    final p = plan;
    final tone = planTone(p);
    final desc = p.description;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(14, 8, 6, 8),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      tone.withValues(alpha: 0.30),
                      tone.withValues(alpha: 0.04),
                    ],
                  ),
                ),
                child: Row(
                  children: [
                    Icon(planStatusIcon(p), size: 14, color: tone),
                    const SizedBox(width: 6),
                    Text(
                      planStatus(p),
                      style: AppText.body(
                        size: 11.5,
                        weight: FontWeight.w800,
                        color: tone,
                      ),
                    ),
                    const Spacer(),
                    _menu(items),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        PlanAvatar(name: p.name, color: tone),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                p.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 15.5,
                                  weight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Wrap(
                                spacing: 6,
                                runSpacing: 4,
                                children: _tags(),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _priceBlock(),
                    const SizedBox(height: 10),
                    _perks(),
                    if (desc != null && desc.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        desc,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 11.5,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    if (p.isDeleted)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(
                          'Deleted - open the menu to restore it.',
                          style: AppText.body(
                            size: 11.5,
                            weight: FontWeight.w600,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      )
                    else
                      Row(
                        children: [
                          if (actions.contains(PlanAction.duplicate))
                            TeamQuickAction(
                              icon: Icons.copy_rounded,
                              label: 'Duplicate',
                              color: TeamColors.indigo,
                              onTap: () => onMenu(PlanAction.duplicate.name),
                            ),
                          if (canUpdate)
                            TeamQuickAction(
                              icon: Icons.edit_rounded,
                              label: 'Edit',
                              color: TeamColors.amber,
                              onTap: () => onMenu('edit'),
                            ),
                          Expanded(
                            flex: 2,
                            child: Padding(
                              padding: const EdgeInsets.only(left: 6),
                              child: GestureDetector(
                                onTap: onTap,
                                child: Container(
                                  height: 40,
                                  decoration: BoxDecoration(
                                    gradient: TeamColors.cta,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Flexible(
                                        child: Text(
                                          'View plan',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: AppText.body(
                                            size: 13,
                                            weight: FontWeight.w800,
                                            color: Colors.white,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      const Icon(
                                        Icons.arrow_forward_rounded,
                                        size: 15,
                                        color: Colors.white,
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
