import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// The lifecycle actions web's Membership Plans page offers on a plan
/// (`PlanCardAction`).
enum PlanAction { duplicate, activate, deactivate, delete, restore }

extension PlanActionX on PlanAction {
  String get label => switch (this) {
        PlanAction.duplicate => 'Duplicate',
        PlanAction.activate => 'Activate',
        PlanAction.deactivate => 'Deactivate',
        PlanAction.delete => 'Delete',
        PlanAction.restore => 'Restore',
      };

  IconData get icon => switch (this) {
        PlanAction.duplicate => Icons.copy_rounded,
        PlanAction.activate => Icons.play_circle_rounded,
        PlanAction.deactivate => Icons.pause_circle_rounded,
        PlanAction.delete => Icons.delete_outline_rounded,
        PlanAction.restore => Icons.restore_from_trash_rounded,
      };

  Color get color => switch (this) {
        PlanAction.duplicate => TeamColors.indigo,
        PlanAction.activate => TeamColors.green,
        PlanAction.deactivate => TeamColors.amber,
        PlanAction.delete => TeamColors.rose,
        PlanAction.restore => TeamColors.teal,
      };

  String get done => switch (this) {
        PlanAction.duplicate => 'duplicated',
        PlanAction.activate => 'activated',
        PlanAction.deactivate => 'deactivated',
        PlanAction.delete => 'deleted',
        PlanAction.restore => 'restored',
      };
}

String _confirmMessage(MembershipPlan p, PlanAction a) => switch (a) {
      // Same wording as web's ConfirmDialog.
      PlanAction.delete =>
        'This soft-deletes the plan - it can no longer be assigned to members '
            'until restored. Members already on it are untouched.',
      PlanAction.duplicate =>
        'Creates "${p.name} (Copy)" as an inactive draft you can edit before '
            'activating.',
      PlanAction.activate => '${p.name} can be assigned to members again.',
      PlanAction.deactivate =>
        '${p.name} can no longer be assigned to members. Members already on '
            'it keep it.',
      PlanAction.restore => '${p.name} comes back as it was.',
    };

/// Outcome of [runPlanAction]: whether the server accepted it and, for
/// Duplicate, the new draft plan.
typedef PlanActionResult = ({bool ok, MembershipPlan? created});

/// Confirms, runs and reports one lifecycle [action]. Duplicate runs
/// straight away like web (it is non-destructive); the rest ask first. Every
/// error — including a parse failure after a successful call — is reported
/// and never leaves the caller spinning.
Future<PlanActionResult> runPlanAction(
  BuildContext context,
  MembershipPlan plan,
  PlanAction action,
) async {
  if (action != PlanAction.duplicate) {
    final ok = await confirmTeam(
      context,
      title: '${action.label} "${plan.name}"?',
      message: _confirmMessage(plan, action),
      confirmLabel: action.label,
      destructive: action == PlanAction.delete,
    );
    if (!ok || !context.mounted) return (ok: false, created: null);
  }
  final repo = getIt<MembershipPlanRepository>();
  MembershipPlan? created;
  try {
    switch (action) {
      case PlanAction.duplicate:
        created = await repo.duplicate(plan.id);
      case PlanAction.activate:
        await repo.activate(plan.id);
      case PlanAction.deactivate:
        await repo.deactivate(plan.id);
      case PlanAction.delete:
        await repo.delete(plan.id);
      case PlanAction.restore:
        await repo.restore(plan.id);
    }
    if (context.mounted) {
      teamSnack(
        context,
        action == PlanAction.duplicate && created != null
            ? 'Duplicated as "${created.name}" (inactive draft).'
            : 'Plan ${action.done}.',
      );
    }
    return (ok: true, created: created);
  } on ApiException catch (e) {
    if (context.mounted) teamSnack(context, e.detailedMessage, error: true);
    return (ok: false, created: null);
  } catch (e) {
    if (context.mounted) {
      teamSnack(context, 'Something went wrong ($e).', error: true);
    }
    // A parse failure can follow a request the server already applied.
    return (ok: false, created: null);
  }
}

/// Which lifecycle actions apply to [p] for a viewer holding the given
/// permissions — mirrors web's `MembershipPlanCard` menu exactly: Duplicate
/// (create), deleted -> Restore (restore) only, otherwise Activate /
/// Deactivate (update) and Delete (delete).
List<PlanAction> availablePlanActions(
  MembershipPlan p, {
  required bool canCreate,
  required bool canUpdate,
  required bool canDelete,
  required bool canRestore,
}) {
  return [
    if (canCreate && !p.isDeleted) PlanAction.duplicate,
    if (p.isDeleted)
      if (canRestore) PlanAction.restore,
    if (!p.isDeleted && canUpdate)
      p.isActive ? PlanAction.deactivate : PlanAction.activate,
    if (!p.isDeleted && canDelete) PlanAction.delete,
  ];
}
