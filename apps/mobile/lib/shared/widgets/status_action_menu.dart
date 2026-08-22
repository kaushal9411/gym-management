import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';

/// The "⋯" status-actions menu (Duplicate / Activate‑Deactivate / Delete /
/// Restore) + its confirm-dialog wording, extracted from
/// `membership_plans_screen.dart`/`membership_plan_form_screen.dart` once
/// the exact same menu was needed a second and third time (Workout Plans,
/// Diet Plans, Classes). Each callback is the actual repository call —
/// this widget only owns "which items make sense for the current status"
/// and "confirm before calling," not busy-state/snackbar orchestration,
/// which stays with the caller since it's tied to that screen's own
/// `setState`/`mounted` lifecycle.
class StatusActionMenu extends StatelessWidget {
  const StatusActionMenu({
    super.key,
    required this.subjectName,
    required this.isDeleted,
    required this.isActive,
    this.canDuplicate = true,
    this.onDuplicate,
    this.showActivateDeactivate = true,
    this.onActivate,
    this.onDeactivate,
    required this.onDelete,
    required this.onRestore,
    this.deleteDescription = 'This soft-deletes the plan — it can no '
        'longer be assigned to members until restored.',
    this.iconColor = AppColors.inkFaint,
  });

  final String subjectName;
  final bool isDeleted;
  final bool isActive;

  /// Classes have no `duplicate` endpoint on the backend — set false there
  /// rather than faking a client-side duplicate.
  final bool canDuplicate;
  final Future<void> Function()? onDuplicate;

  /// Exercises/Foods have no `activate`/`deactivate` endpoints — `isActive`
  /// is just a field toggled via their edit form. Set false there to show
  /// only Delete/Restore; [onActivate]/[onDeactivate] become unused.
  final bool showActivateDeactivate;
  final Future<void> Function()? onActivate;
  final Future<void> Function()? onDeactivate;
  final Future<void> Function() onDelete;
  final Future<void> Function() onRestore;

  /// Delete's dialog body differs per resource (plans mention "assigned to
  /// members," classes mention "session generation") — everything else
  /// (activate/deactivate/restore) shares one generic body.
  final String deleteDescription;
  final Color iconColor;

  Future<bool> _confirm(
    BuildContext context,
    String action, {
    required bool destructive,
  }) async {
    final label = '${action[0].toUpperCase()}${action.substring(1)}';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface2,
        title: Text('$label "$subjectName"?'),
        content: Text(
          action == 'delete'
              ? deleteDescription
              : 'This action can be reversed later if needed.',
        ),
        actions: [
          TextButton(
            onPressed: () => context.pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => context.pop(true),
            child: Text(
              label,
              style: TextStyle(
                color: destructive ? AppColors.danger : AppColors.staffPillFg,
              ),
            ),
          ),
        ],
      ),
    );
    return confirmed ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      padding: EdgeInsets.zero,
      icon: Icon(Icons.more_vert_rounded, color: iconColor),
      color: AppColors.surface2,
      onSelected: (value) async {
        switch (value) {
          case 'duplicate':
            final duplicate = onDuplicate;
            if (duplicate != null) await duplicate();
          case 'activate':
            final activate = onActivate;
            if (activate != null &&
                await _confirm(context, 'activate', destructive: false)) {
              await activate();
            }
          case 'deactivate':
            final deactivate = onDeactivate;
            if (deactivate != null &&
                await _confirm(context, 'deactivate', destructive: false)) {
              await deactivate();
            }
          case 'restore':
            if (await _confirm(context, 'restore', destructive: false)) {
              await onRestore();
            }
          case 'delete':
            if (await _confirm(context, 'delete', destructive: true)) {
              await onDelete();
            }
        }
      },
      itemBuilder: (context) => [
        if (canDuplicate)
          const PopupMenuItem(value: 'duplicate', child: Text('Duplicate')),
        if (isDeleted)
          const PopupMenuItem(value: 'restore', child: Text('Restore'))
        else ...[
          if (showActivateDeactivate)
            PopupMenuItem(
              value: isActive ? 'deactivate' : 'activate',
              child: Text(isActive ? 'Deactivate' : 'Activate'),
            ),
          const PopupMenuItem(
            value: 'delete',
            child: Text('Delete', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ],
    );
  }
}
