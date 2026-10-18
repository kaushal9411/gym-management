import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/branch_option.dart';
import 'team_ui.dart';

/// Branch access for a staff member: tick one or more branches and mark
/// exactly one as primary (web `StaffBranchesEditor` — staff always belong to
/// at least one explicit branch; there is no "all branches" shortcut).
class StaffBranchPicker extends StatelessWidget {
  const StaffBranchPicker({
    super.key,
    required this.options,
    required this.branchIds,
    required this.primaryId,
    required this.onChanged,
    this.enabled = true,
  });

  final List<BranchOption> options;
  final Set<String> branchIds;
  final String? primaryId;
  final bool enabled;
  final void Function(Set<String> branchIds, String? primaryId) onChanged;

  void _toggle(String id) {
    final next = {...branchIds};
    if (!next.add(id)) next.remove(id);
    String? primary = primaryId;
    if (!next.contains(primary)) primary = null;
    primary ??= next.isEmpty ? null : (next.contains(id) ? id : next.first);
    onChanged(next, primary);
  }

  @override
  Widget build(BuildContext context) {
    if (options.isEmpty) {
      return Text(
        'No branches found.',
        style: AppText.body(size: 13, color: AppColors.inkFaint),
      );
    }
    return Column(
      children: [
        for (final b in options) ...[
          Builder(
            builder: (context) {
              final on = branchIds.contains(b.id);
              final primary = on && primaryId == b.id;
              return Row(
                children: [
                  Expanded(
                    child: TeamChoiceCard(
                      title: b.name,
                      icon: Icons.place_rounded,
                      color: TeamColors.teal,
                      multi: true,
                      selected: on,
                      onTap: enabled ? () => _toggle(b.id) : null,
                    ),
                  ),
                  if (on) ...[
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: enabled ? () => onChanged(branchIds, b.id) : null,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 160),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: primary
                              ? TeamColors.amber
                              : TeamColors.amber.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              primary
                                  ? Icons.star_rounded
                                  : Icons.star_outline_rounded,
                              size: 18,
                              color: primary ? Colors.white : TeamColors.amber,
                            ),
                            Text(
                              primary ? 'Primary' : 'Make\nprimary',
                              textAlign: TextAlign.center,
                              style: AppText.body(
                                size: 9.5,
                                weight: FontWeight.w800,
                                color:
                                    primary ? Colors.white : TeamColors.amber,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              );
            },
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}
