import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/branch.dart';
import '../../../repositories/branch_repository.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// The lifecycle actions web's Branches page offers on a branch.
enum BranchAction { activate, deactivate, setDefault, delete, restore }

extension BranchActionX on BranchAction {
  String get label => switch (this) {
        BranchAction.activate => 'Activate',
        BranchAction.deactivate => 'Deactivate',
        BranchAction.setDefault => 'Set as default',
        BranchAction.delete => 'Delete',
        BranchAction.restore => 'Restore',
      };

  IconData get icon => switch (this) {
        BranchAction.activate => Icons.play_circle_rounded,
        BranchAction.deactivate => Icons.pause_circle_rounded,
        BranchAction.setDefault => Icons.star_rounded,
        BranchAction.delete => Icons.delete_outline_rounded,
        BranchAction.restore => Icons.restore_from_trash_rounded,
      };

  Color get color => switch (this) {
        BranchAction.activate => TeamColors.green,
        BranchAction.deactivate => TeamColors.amber,
        BranchAction.setDefault => TeamColors.violet,
        BranchAction.delete => TeamColors.rose,
        BranchAction.restore => TeamColors.teal,
      };

  String get done => switch (this) {
        BranchAction.activate => 'activated',
        BranchAction.deactivate => 'deactivated',
        BranchAction.setDefault => 'is now the default branch',
        BranchAction.delete => 'deleted',
        BranchAction.restore => 'restored',
      };
}

String _confirmMessage(Branch b, BranchAction a) => switch (a) {
      BranchAction.delete =>
        'This soft-deletes ${b.name} — it can be restored later. The default '
            "branch and a tenant's last active branch can't be deleted.",
      BranchAction.deactivate =>
        "The default branch and a tenant's last active branch can't be "
            'deactivated.',
      BranchAction.setDefault =>
        'Only one branch can be the default at a time.',
      BranchAction.activate => '${b.name} will be available again.',
      BranchAction.restore => '${b.name} will come back as an active branch.',
    };

/// Confirms, runs and reports one lifecycle [action]. Returns true when the
/// server accepted it. The business rules (default branch can't be deleted or
/// deactivated, last active branch, inactive can't be default) are enforced
/// server-side; the 409 message is shown as-is.
Future<bool> runBranchAction(
  BuildContext context,
  Branch branch,
  BranchAction action,
) async {
  final title = action == BranchAction.setDefault
      ? 'Set "${branch.name}" as the default branch?'
      : '${action.label} "${branch.name}"?';
  final ok = await confirmTeam(
    context,
    title: title,
    message: _confirmMessage(branch, action),
    confirmLabel:
        action == BranchAction.setDefault ? 'Set default' : action.label,
    destructive: action == BranchAction.delete,
  );
  if (!ok || !context.mounted) return false;
  final repo = getIt<BranchRepository>();
  try {
    switch (action) {
      case BranchAction.activate:
        await repo.setActive(branch.id, active: true);
      case BranchAction.deactivate:
        await repo.setActive(branch.id, active: false);
      case BranchAction.setDefault:
        await repo.setDefault(branch.id);
      case BranchAction.delete:
        await repo.softDelete(branch.id);
      case BranchAction.restore:
        await repo.restore(branch.id);
    }
    if (context.mounted) {
      teamSnack(
        context,
        action == BranchAction.setDefault
            ? '${branch.name} ${action.done}.'
            : 'Branch ${branch.name} ${action.done}.',
      );
    }
    return true;
  } on ApiException catch (e) {
    if (context.mounted) teamSnack(context, e.detailedMessage, error: true);
    return false;
  } catch (e) {
    if (context.mounted) {
      teamSnack(context, 'Something went wrong ($e).', error: true);
    }
    return false;
  }
}

/// Which lifecycle actions apply to [b] for a viewer holding the given
/// permissions — mirrors web's `BranchCard` menu exactly:
/// deleted -> Restore only; otherwise Set default (update, active & not
/// default), Activate / Deactivate (activate perm), Delete (delete perm).
List<BranchAction> availableBranchActions(
  Branch b, {
  required bool canUpdate,
  required bool canActivate,
  required bool canDelete,
  required bool canRestore,
}) {
  if (b.isDeleted) {
    return [if (canRestore) BranchAction.restore];
  }
  return [
    if (canUpdate && !b.isDefault && b.isActive) BranchAction.setDefault,
    if (canActivate)
      b.isActive ? BranchAction.deactivate : BranchAction.activate,
    if (canDelete) BranchAction.delete,
  ];
}
