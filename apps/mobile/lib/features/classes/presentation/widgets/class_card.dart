import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/group_class.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../class_actions.dart';
import '../class_ui.dart';

/// Value of the card's overflow menu: `view` or a [ClassAction] name.
typedef ClassMenuCallback = void Function(String value);

/// The overflow menu exists only when there is a lifecycle action to offer
/// (web renders its dropdown only for `canDelete || canRestore`).
List<PopupMenuEntry<String>> classMenuItems(
  GroupClass c, {
  required List<ClassAction> actions,
}) {
  if (actions.isEmpty) return const [];
  return [
    if (!c.isDeleted)
      const PopupMenuItem(value: 'view', child: Text('View / edit')),
    for (final a in actions)
      PopupMenuItem(
        value: a.name,
        child: Text(
          a.label,
          style: a == ClassAction.delete
              ? const TextStyle(color: AppColors.danger)
              : null,
        ),
      ),
  ];
}

/// One class in the catalog: web's `ClassCard`. The default layout is the
/// rich card (status band, glyph, branch / duration tags, capacity and weekly
/// slot tiles, View); [compact] is web's dense list row.
class ClassCard extends StatelessWidget {
  const ClassCard({
    super.key,
    required this.groupClass,
    required this.onTap,
    required this.onMenu,
    required this.actions,
    this.compact = false,
  });

  final GroupClass groupClass;
  final bool compact;
  final List<ClassAction> actions;
  final VoidCallback onTap;
  final ClassMenuCallback onMenu;

  @override
  Widget build(BuildContext context) {
    final items = classMenuItems(groupClass, actions: actions);
    return compact ? _compact(items) : _rich(items);
  }

  Widget _menu(List<PopupMenuEntry<String>> items) {
    if (items.isEmpty) return const SizedBox.shrink();
    return PopupMenuButton<String>(
      padding: EdgeInsets.zero,
      tooltip: 'Actions for ${groupClass.name}',
      color: AppColors.surface2,
      icon: Icon(Icons.more_horiz_rounded, size: 20, color: AppColors.inkSoft),
      onSelected: onMenu,
      itemBuilder: (_) => items,
    );
  }

  List<Widget> _tags() {
    final c = groupClass;
    return [
      TeamTag(
        label: c.branch?.name ?? 'No branch',
        color: TeamColors.indigo,
        icon: Icons.storefront_rounded,
      ),
      TeamTag(
        label: '${c.durationMinutes}m',
        color: TeamColors.teal,
        icon: Icons.timelapse_rounded,
      ),
    ];
  }

  Widget _compact(List<PopupMenuEntry<String>> items) {
    final c = groupClass;
    final tone = classTone(c);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: c.isDeleted ? tone.withValues(alpha: 0.06) : AppColors.surface2,
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
                ClassGlyph(name: c.name, color: tone, size: 40),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        c.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(size: 14, weight: FontWeight.w800),
                      ),
                      Text(
                        [
                          c.trainer?.name ?? 'No trainer',
                          c.branch?.name ?? 'No branch',
                          '${c.durationMinutes}m',
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
                          Icon(classStatusIcon(c), size: 12, color: tone),
                          const SizedBox(width: 4),
                          Text(
                            classStatus(c),
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
                            '${c.capacity} seats',
                            style: AppText.body(
                              size: 11,
                              weight: FontWeight.w700,
                              color: AppColors.inkSoft,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Icon(
                            Icons.schedule_rounded,
                            size: 12,
                            color: AppColors.inkFaint,
                          ),
                          const SizedBox(width: 3),
                          Text(
                            plural(c.schedule.length, 'slot'),
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
                if (items.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Icon(
                      Icons.chevron_right_rounded,
                      size: 20,
                      color: AppColors.inkFaint,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _stat(IconData icon, String value, String label, Color tone) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: tone.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: tone.withValues(alpha: 0.18)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 16, color: tone),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, style: AppText.display(size: 16)),
                Text(
                  label,
                  style: AppText.body(
                    size: 10.5,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _rich(List<PopupMenuEntry<String>> items) {
    final c = groupClass;
    final tone = classTone(c);
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
                    Icon(classStatusIcon(c), size: 14, color: tone),
                    const SizedBox(width: 6),
                    Text(
                      classStatus(c),
                      style: AppText.body(
                        size: 11.5,
                        weight: FontWeight.w800,
                        color: tone,
                      ),
                    ),
                    const Spacer(),
                    _menu(items),
                    if (items.isEmpty) const SizedBox(height: 40),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        ClassGlyph(name: c.name, color: tone, size: 52),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                c.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.display(size: 17),
                              ),
                              const SizedBox(height: 2),
                              Row(
                                children: [
                                  Icon(
                                    Icons.person_rounded,
                                    size: 13,
                                    color: tone,
                                  ),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      c.trainer?.name ?? 'No trainer assigned',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppText.body(
                                        size: 12.5,
                                        weight: FontWeight.w600,
                                        color: AppColors.inkFaint,
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
                    const SizedBox(height: 12),
                    Wrap(spacing: 6, runSpacing: 6, children: _tags()),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _stat(
                          Icons.groups_rounded,
                          '${c.capacity}',
                          'Capacity',
                          tone,
                        ),
                        const SizedBox(width: 8),
                        _stat(
                          Icons.schedule_rounded,
                          '${c.schedule.length}',
                          'Weekly slots',
                          tone,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    GestureDetector(
                      onTap: onTap,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 11),
                        decoration: BoxDecoration(
                          gradient: TeamColors.cta,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              c.isDeleted ? 'Review' : 'View',
                              style: AppText.body(
                                size: 13,
                                weight: FontWeight.w800,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Icon(
                              Icons.chevron_right_rounded,
                              size: 18,
                              color: Colors.white,
                            ),
                          ],
                        ),
                      ),
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
