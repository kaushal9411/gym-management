import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/workout_plan.dart';
import '../../../../models/workout_plan_summary.dart';
import '../../../plans/presentation/plan_ui.dart' show PlanAvatar;
import '../../../team/presentation/widgets/team_ui.dart';
import '../workout_actions.dart';
import '../workout_ui.dart';

/// Value of the card's overflow menu: `view`, `edit`, or a [WorkoutAction]
/// name.
typedef WorkoutMenuCallback = void Function(String value);

List<PopupMenuEntry<String>> workoutMenuItems(
  WorkoutPlanSummary p, {
  required List<WorkoutAction> actions,
  String viewLabel = 'View / edit',
}) {
  return [
    if (!p.isDeleted) PopupMenuItem(value: 'view', child: Text(viewLabel)),
    for (final a in actions)
      PopupMenuItem(
        value: a.name,
        child: Text(
          a.label,
          style: a == WorkoutAction.delete
              ? const TextStyle(color: AppColors.danger)
              : null,
        ),
      ),
  ];
}

/// One workout plan in a list: web's `WorkoutPlanCard`. The default layout is
/// the rich card (status band, avatar, level + duration tags, goal, members /
/// trainer stats, Duplicate and View, the overflow menu); [compact] is web's
/// dense list row.
class WorkoutPlanCard extends StatelessWidget {
  const WorkoutPlanCard({
    super.key,
    required this.plan,
    required this.onTap,
    required this.onMenu,
    this.actions = const [],
    this.compact = false,
    this.primaryLabel = 'View',
  });

  final WorkoutPlanSummary plan;
  final List<WorkoutAction> actions;
  final bool compact;
  final String primaryLabel;
  final VoidCallback onTap;
  final WorkoutMenuCallback onMenu;

  @override
  Widget build(BuildContext context) {
    final items = workoutMenuItems(
      plan,
      actions: actions,
      viewLabel: primaryLabel == 'View' ? 'View / edit' : primaryLabel,
    );
    return compact ? _compact(items) : _rich(items);
  }

  Widget _menu(List<PopupMenuEntry<String>> items) {
    // A card with only "view" has nothing worth a menu.
    if (items.length < 2) return const SizedBox.shrink();
    return PopupMenuButton<String>(
      padding: EdgeInsets.zero,
      tooltip: 'Actions for ${plan.name}',
      color: AppColors.surface2,
      icon: Icon(Icons.more_horiz_rounded, size: 20, color: AppColors.inkSoft),
      onSelected: onMenu,
      itemBuilder: (_) => items,
    );
  }

  Color get _tone =>
      workoutTone(deleted: plan.isDeleted, active: plan.isActive);

  List<Widget> _tags() {
    final level = plan.levelValue;
    return [
      TeamTag(
        label: level.label,
        color: levelColor(level),
        icon: levelIcon(level),
      ),
      if (plan.durationWeeks > 0)
        TeamTag(
          label: '${plan.durationWeeks}w',
          color: TeamColors.indigo,
          icon: Icons.timelapse_rounded,
        ),
    ];
  }

  // ── compact row ───────────────────────────────────────────────────────────

  Widget _compact(List<PopupMenuEntry<String>> items) {
    final p = plan;
    final tone = _tone;
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
                          p.levelValue.label,
                          if (p.durationWeeks > 0) '${p.durationWeeks}w',
                          if (p.goal != null && p.goal!.isNotEmpty) p.goal!,
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
                          Icon(
                            workoutStatusIcon(
                              deleted: p.isDeleted,
                              active: p.isActive,
                            ),
                            size: 12,
                            color: tone,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            workoutStatus(
                              deleted: p.isDeleted,
                              active: p.isActive,
                            ),
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
                            '${p.activeMemberCount}',
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
                _menu(items),
                if (items.length < 2)
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

  Widget _stat(IconData icon, Color color, String value, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.22)),
        ),
        child: Column(
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(height: 3),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.display(size: 14, color: color),
            ),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 10,
                weight: FontWeight.w700,
                color: AppColors.inkFaint,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _rich(List<PopupMenuEntry<String>> items) {
    final p = plan;
    final tone = _tone;
    final goal = p.goal;
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
                    Icon(
                      workoutStatusIcon(
                        deleted: p.isDeleted,
                        active: p.isActive,
                      ),
                      size: 14,
                      color: tone,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      workoutStatus(deleted: p.isDeleted, active: p.isActive),
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
                              const SizedBox(height: 2),
                              Row(
                                children: [
                                  Icon(
                                    Icons.track_changes_rounded,
                                    size: 13,
                                    color: tone,
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      goal == null || goal.isEmpty
                                          ? 'No goal set'
                                          : goal,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppText.body(
                                        size: 12,
                                        weight: FontWeight.w600,
                                        color: AppColors.inkFaint,
                                      ),
                                    ),
                                  ),
                                ],
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
                    Row(
                      children: [
                        _stat(
                          Icons.groups_rounded,
                          TeamColors.violet,
                          '${p.activeMemberCount}',
                          p.activeMemberCount == 1 ? 'Member' : 'Members',
                        ),
                        const SizedBox(width: 8),
                        _stat(
                          Icons.sports_gymnastics_rounded,
                          TeamColors.teal,
                          p.trainerName ?? '—',
                          'Trainer',
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (p.isDeleted)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(
                          'Deleted - tap the card to restore it.',
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
                          if (actions.contains(WorkoutAction.duplicate))
                            TeamQuickAction(
                              icon: Icons.copy_rounded,
                              label: 'Duplicate',
                              color: TeamColors.indigo,
                              onTap: () => onMenu(WorkoutAction.duplicate.name),
                            ),
                          Expanded(
                            flex: 2,
                            child: Padding(
                              padding: EdgeInsets.only(
                                left: actions.contains(WorkoutAction.duplicate)
                                    ? 6
                                    : 0,
                              ),
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
                                          primaryLabel,
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
