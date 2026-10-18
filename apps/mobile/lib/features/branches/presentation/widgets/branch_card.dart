import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/branch.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../branch_actions.dart';
import '../branch_ui.dart';

/// Value of the card's overflow menu: `view`, `edit`, or a [BranchAction] name.
typedef BranchMenuCallback = void Function(String value);

List<PopupMenuEntry<String>> branchMenuItems(
  Branch b, {
  required bool canUpdate,
  required List<BranchAction> actions,
}) {
  return [
    if (!b.isDeleted)
      const PopupMenuItem(value: 'view', child: Text('View branch')),
    if (!b.isDeleted && canUpdate)
      const PopupMenuItem(value: 'edit', child: Text('Edit branch')),
    for (final a in actions)
      PopupMenuItem(
        value: a.name,
        child: Text(
          a.label,
          style: a == BranchAction.delete
              ? const TextStyle(color: AppColors.danger)
              : null,
        ),
      ),
  ];
}

/// One branch in the list: web's `BranchCard`. The default layout is the rich
/// card (status band, avatar, tags, members / staff / hours panel, capacity
/// bar, quick actions); [compact] is web's dense list row.
class BranchCard extends StatelessWidget {
  const BranchCard({
    super.key,
    required this.branch,
    required this.onTap,
    required this.onMenu,
    required this.canUpdate,
    required this.actions,
    this.compact = false,
  });

  final Branch branch;
  final bool compact;
  final bool canUpdate;
  final List<BranchAction> actions;
  final VoidCallback onTap;
  final BranchMenuCallback onMenu;

  @override
  Widget build(BuildContext context) {
    final items =
        branchMenuItems(branch, canUpdate: canUpdate, actions: actions);
    return compact ? _compact(context, items) : _rich(context, items);
  }

  Widget _menu(List<PopupMenuEntry<String>> items) {
    if (items.isEmpty) return const SizedBox.shrink();
    return PopupMenuButton<String>(
      padding: EdgeInsets.zero,
      tooltip: 'Actions for ${branch.name}',
      color: AppColors.surface2,
      icon: Icon(Icons.more_horiz_rounded, size: 20, color: AppColors.inkSoft),
      onSelected: onMenu,
      itemBuilder: (_) => items,
    );
  }

  List<Widget> _tags() {
    final b = branch;
    return [
      if (b.branchCode.isNotEmpty)
        TeamTag(
          label: b.branchCode,
          color: TeamColors.indigo,
          icon: Icons.tag_rounded,
        ),
      if (b.isDefault)
        const TeamTag(
          label: 'Default',
          color: TeamColors.violet,
          icon: Icons.star_rounded,
        ),
      if (!b.allowCheckIn && !b.isDeleted)
        const TeamTag(
          label: 'Check-in off',
          color: TeamColors.slate,
          icon: Icons.do_not_disturb_on_rounded,
        ),
    ];
  }

  // ── compact row ───────────────────────────────────────────────────────────

  Widget _compact(BuildContext context, List<PopupMenuEntry<String>> items) {
    final b = branch;
    final tone = branchTone(b);
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
                BranchAvatar(name: b.name, color: tone, size: 38),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              b.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.body(
                                size: 14,
                                weight: FontWeight.w800,
                              ),
                            ),
                          ),
                          if (b.isDefault) ...[
                            const SizedBox(width: 5),
                            const Icon(
                              Icons.star_rounded,
                              size: 14,
                              color: TeamColors.violet,
                            ),
                          ],
                        ],
                      ),
                      Text(
                        [
                          if (b.branchCode.isNotEmpty) b.branchCode,
                          if (b.location.isNotEmpty) b.location,
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
                          Icon(branchStatusIcon(b), size: 12, color: tone),
                          const SizedBox(width: 4),
                          Text(
                            branchStatus(b),
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
                            '${b.memberCount}',
                            style: AppText.body(
                              size: 11,
                              weight: FontWeight.w700,
                              color: AppColors.inkSoft,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Icon(
                            Icons.badge_rounded,
                            size: 12,
                            color: AppColors.inkFaint,
                          ),
                          const SizedBox(width: 3),
                          Text(
                            '${b.staffCount}',
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

  Widget _rich(BuildContext context, List<PopupMenuEntry<String>> items) {
    final b = branch;
    final tone = branchTone(b);
    final hasPhone = b.phone != null && b.phone!.isNotEmpty;
    final hasEmail = b.email != null && b.email!.isNotEmpty;
    final maps = directionsUri(b);
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
                    Icon(branchStatusIcon(b), size: 14, color: tone),
                    const SizedBox(width: 6),
                    Text(
                      branchStatus(b),
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
                        BranchAvatar(name: b.name, color: tone),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                b.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 15.5,
                                  weight: FontWeight.w800,
                                ),
                              ),
                              Row(
                                children: [
                                  Icon(
                                    Icons.place_rounded,
                                    size: 12,
                                    color: tone,
                                  ),
                                  const SizedBox(width: 3),
                                  Expanded(
                                    child: Text(
                                      b.location.isEmpty
                                          ? 'No location set'
                                          : b.location,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppText.body(
                                        size: 11.5,
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
                    Container(
                      padding: const EdgeInsets.all(11),
                      decoration: BoxDecoration(
                        color: AppColors.surface3.withValues(alpha: 0.55),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              _Info(
                                icon: Icons.groups_rounded,
                                label: 'Members',
                                value: '${b.memberCount}',
                                color: TeamColors.violet,
                              ),
                              _Info(
                                icon: Icons.badge_rounded,
                                label: 'Staff',
                                value: '${b.staffCount}',
                                color: TeamColors.teal,
                              ),
                            ],
                          ),
                          const SizedBox(height: 9),
                          Row(
                            children: [
                              _Info(
                                icon: Icons.call_rounded,
                                label: 'Phone',
                                value: b.phone ?? 'No phone',
                                color: TeamColors.green,
                              ),
                              _Info(
                                icon: Icons.schedule_rounded,
                                label: 'Today',
                                value: todayHoursLabel(b),
                                color: TeamColors.amber,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    if (b.capacity != null && b.capacity! > 0) ...[
                      const SizedBox(height: 11),
                      UsageBar(
                        label: 'Capacity used',
                        used: b.memberCount,
                        limit: b.capacity,
                      ),
                    ],
                    const SizedBox(height: 8),
                    if (b.isDeleted)
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
                          TeamQuickAction(
                            icon: Icons.call_rounded,
                            label: 'Call',
                            color: TeamColors.green,
                            onTap: hasPhone
                                ? () => branchLaunch(
                                      context,
                                      Uri(scheme: 'tel', path: b.phone),
                                    )
                                : null,
                          ),
                          TeamQuickAction(
                            icon: Icons.mail_rounded,
                            label: 'Email',
                            color: TeamColors.indigo,
                            onTap: hasEmail
                                ? () => branchLaunch(
                                      context,
                                      Uri(scheme: 'mailto', path: b.email),
                                    )
                                : null,
                          ),
                          TeamQuickAction(
                            icon: Icons.directions_rounded,
                            label: 'Map',
                            color: TeamColors.sky,
                            onTap: maps == null
                                ? null
                                : () => branchLaunch(context, maps),
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
                                          'View branch',
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

class _Info extends StatelessWidget {
  const _Info({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 13, color: color),
          ),
          const SizedBox(width: 7),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: AppText.body(size: 10, color: AppColors.inkFaint),
                ),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 12.5, weight: FontWeight.w800),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
