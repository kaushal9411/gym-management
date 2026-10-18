import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/diet_plan.dart';
import '../../../repositories/diet_plan_repository.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// The lifecycle actions web's Diet Plans page offers on a plan
/// (`DietPlanCardAction`).
enum DietAction { duplicate, activate, deactivate, delete, restore }

extension DietActionX on DietAction {
  String get label => switch (this) {
        DietAction.duplicate => 'Duplicate',
        DietAction.activate => 'Activate',
        DietAction.deactivate => 'Deactivate',
        DietAction.delete => 'Delete',
        DietAction.restore => 'Restore',
      };

  IconData get icon => switch (this) {
        DietAction.duplicate => Icons.copy_rounded,
        DietAction.activate => Icons.play_circle_rounded,
        DietAction.deactivate => Icons.pause_circle_rounded,
        DietAction.delete => Icons.delete_outline_rounded,
        DietAction.restore => Icons.restore_from_trash_rounded,
      };

  Color get color => switch (this) {
        DietAction.duplicate => TeamColors.indigo,
        DietAction.activate => TeamColors.green,
        DietAction.deactivate => TeamColors.amber,
        DietAction.delete => TeamColors.rose,
        DietAction.restore => TeamColors.teal,
      };

  String get done => switch (this) {
        DietAction.duplicate => 'duplicated',
        DietAction.activate => 'activated',
        DietAction.deactivate => 'deactivated',
        DietAction.delete => 'deleted',
        DietAction.restore => 'restored',
      };

  String get hint => switch (this) {
        DietAction.duplicate =>
          'Creates an inactive "(Copy)" draft with the same meals',
        DietAction.activate => 'Members can be assigned to it again',
        DietAction.deactivate =>
          'Stops new assignments; current members keep it',
        DietAction.delete => 'Soft-delete; restorable, members untouched',
        DietAction.restore => 'Brings the plan back as it was',
      };
}

String _confirmMessage(String name, DietAction a) => switch (a) {
      // Same wording as web's ConfirmDialog.
      DietAction.delete =>
        'This soft-deletes the plan - it can no longer be assigned to members '
            'until restored.',
      DietAction.duplicate =>
        'Creates "$name (Copy)" as an inactive draft you can edit before '
            'activating.',
      DietAction.activate => '$name can be assigned to members again.',
      DietAction.deactivate =>
        '$name can no longer be assigned to members. Members already on it '
            'keep it.',
      DietAction.restore => '$name comes back as it was.',
    };

/// Outcome of [runDietAction]: whether the server accepted it and, for
/// Duplicate, the new draft plan.
typedef DietActionResult = ({bool ok, DietPlan? created});

/// Confirms, runs and reports one lifecycle [action]. Duplicate runs straight
/// away like web (it is non-destructive); the rest ask first. Every error -
/// including a parse failure after a successful call - is reported and never
/// leaves the caller spinning.
Future<DietActionResult> runDietAction(
  BuildContext context, {
  required String planId,
  required String planName,
  required DietAction action,
}) async {
  if (action != DietAction.duplicate) {
    final ok = await confirmTeam(
      context,
      title: '${action.label} "$planName"?',
      message: _confirmMessage(planName, action),
      confirmLabel: action.label,
      destructive: action == DietAction.delete,
    );
    if (!ok || !context.mounted) return (ok: false, created: null);
  }
  final repo = getIt<DietPlanRepository>();
  DietPlan? created;
  try {
    switch (action) {
      case DietAction.duplicate:
        created = await repo.duplicate(planId);
      case DietAction.activate:
        await repo.activate(planId);
      case DietAction.deactivate:
        await repo.deactivate(planId);
      case DietAction.delete:
        await repo.delete(planId);
      case DietAction.restore:
        await repo.restore(planId);
    }
    if (context.mounted) {
      teamSnack(
        context,
        action == DietAction.duplicate && created != null
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
    return (ok: false, created: null);
  }
}

/// Which lifecycle actions apply to a plan for a viewer holding the given
/// permissions - mirrors web's `DietPlanCard` menu: Duplicate
/// (`diets:create`), deleted -> Restore (`diets:restore`) only, otherwise
/// Activate / Deactivate (`diets:update`) and Delete (`diets:delete`).
List<DietAction> availableDietActions({
  required bool deleted,
  required bool active,
  required bool canCreate,
  required bool canUpdate,
  required bool canDelete,
  required bool canRestore,
}) {
  return [
    if (canCreate && !deleted) DietAction.duplicate,
    if (deleted && canRestore) DietAction.restore,
    if (!deleted && canUpdate)
      active ? DietAction.deactivate : DietAction.activate,
    if (!deleted && canDelete) DietAction.delete,
  ];
}
