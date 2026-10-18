import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// The lifecycle actions web's Workout Plans page offers on a plan
/// (`WorkoutPlanCardAction`).
enum WorkoutAction { duplicate, activate, deactivate, delete, restore }

extension WorkoutActionX on WorkoutAction {
  String get label => switch (this) {
        WorkoutAction.duplicate => 'Duplicate',
        WorkoutAction.activate => 'Activate',
        WorkoutAction.deactivate => 'Deactivate',
        WorkoutAction.delete => 'Delete',
        WorkoutAction.restore => 'Restore',
      };

  IconData get icon => switch (this) {
        WorkoutAction.duplicate => Icons.copy_rounded,
        WorkoutAction.activate => Icons.play_circle_rounded,
        WorkoutAction.deactivate => Icons.pause_circle_rounded,
        WorkoutAction.delete => Icons.delete_outline_rounded,
        WorkoutAction.restore => Icons.restore_from_trash_rounded,
      };

  Color get color => switch (this) {
        WorkoutAction.duplicate => TeamColors.indigo,
        WorkoutAction.activate => TeamColors.green,
        WorkoutAction.deactivate => TeamColors.amber,
        WorkoutAction.delete => TeamColors.rose,
        WorkoutAction.restore => TeamColors.teal,
      };

  String get done => switch (this) {
        WorkoutAction.duplicate => 'duplicated',
        WorkoutAction.activate => 'activated',
        WorkoutAction.deactivate => 'deactivated',
        WorkoutAction.delete => 'deleted',
        WorkoutAction.restore => 'restored',
      };

  String get hint => switch (this) {
        WorkoutAction.duplicate => 'Creates an inactive "(Copy)" draft',
        WorkoutAction.activate => 'Members can be assigned to it again',
        WorkoutAction.deactivate =>
          'Stops new assignments; current members keep it',
        WorkoutAction.delete => 'Soft-delete; restorable, members untouched',
        WorkoutAction.restore => 'Brings the plan back as it was',
      };
}

String _confirmMessage(String name, WorkoutAction a) => switch (a) {
      // Same wording as web's ConfirmDialog.
      WorkoutAction.delete =>
        'This soft-deletes the plan - it can no longer be assigned to members '
            'until restored.',
      WorkoutAction.duplicate =>
        'Creates "$name (Copy)" as an inactive draft you can edit before '
            'activating.',
      WorkoutAction.activate => '$name can be assigned to members again.',
      WorkoutAction.deactivate =>
        '$name can no longer be assigned to members. Members already on it '
            'keep it.',
      WorkoutAction.restore => '$name comes back as it was.',
    };

/// Outcome of [runWorkoutAction]: whether the server accepted it and, for
/// Duplicate, the new draft plan.
typedef WorkoutActionResult = ({bool ok, WorkoutPlan? created});

/// Confirms, runs and reports one lifecycle [action]. Duplicate runs straight
/// away like web (it is non-destructive); the rest ask first. Every error -
/// including a parse failure after a successful call - is reported and never
/// leaves the caller spinning.
Future<WorkoutActionResult> runWorkoutAction(
  BuildContext context, {
  required String planId,
  required String planName,
  required WorkoutAction action,
}) async {
  if (action != WorkoutAction.duplicate) {
    final ok = await confirmTeam(
      context,
      title: '${action.label} "$planName"?',
      message: _confirmMessage(planName, action),
      confirmLabel: action.label,
      destructive: action == WorkoutAction.delete,
    );
    if (!ok || !context.mounted) return (ok: false, created: null);
  }
  final repo = getIt<WorkoutPlanRepository>();
  WorkoutPlan? created;
  try {
    switch (action) {
      case WorkoutAction.duplicate:
        created = await repo.duplicate(planId);
      case WorkoutAction.activate:
        await repo.activate(planId);
      case WorkoutAction.deactivate:
        await repo.deactivate(planId);
      case WorkoutAction.delete:
        await repo.delete(planId);
      case WorkoutAction.restore:
        await repo.restore(planId);
    }
    if (context.mounted) {
      teamSnack(
        context,
        action == WorkoutAction.duplicate && created != null
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
/// permissions - mirrors web's `WorkoutPlanCard` menu: Duplicate
/// (`workouts:create`), deleted -> Restore (`workouts:restore`) only,
/// otherwise Activate / Deactivate (`workouts:update`) and Delete
/// (`workouts:delete`).
List<WorkoutAction> availableWorkoutActions({
  required bool deleted,
  required bool active,
  required bool canCreate,
  required bool canUpdate,
  required bool canDelete,
  required bool canRestore,
}) {
  return [
    if (canCreate && !deleted) WorkoutAction.duplicate,
    if (deleted && canRestore) WorkoutAction.restore,
    if (!deleted && canUpdate)
      active ? WorkoutAction.deactivate : WorkoutAction.activate,
    if (!deleted && canDelete) WorkoutAction.delete,
  ];
}
