import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/group_class.dart';
import '../../../repositories/group_class_repository.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// The lifecycle actions web's Classes page offers on a class
/// (`ClassCardAction`): Delete and Restore only. The API has no duplicate
/// and no activate / deactivate endpoints (`isActive` is a plain field edited
/// on the form), so those are not offered.
enum ClassAction { delete, restore }

extension ClassActionX on ClassAction {
  String get label => switch (this) {
        ClassAction.delete => 'Delete',
        ClassAction.restore => 'Restore',
      };

  IconData get icon => switch (this) {
        ClassAction.delete => Icons.delete_outline_rounded,
        ClassAction.restore => Icons.restore_from_trash_rounded,
      };

  Color get color => switch (this) {
        ClassAction.delete => TeamColors.rose,
        ClassAction.restore => TeamColors.teal,
      };

  String get done => switch (this) {
        ClassAction.delete => 'deleted',
        ClassAction.restore => 'restored',
      };
}

/// Web's ConfirmDialog wording, verbatim.
String classConfirmMessage(ClassAction a) => switch (a) {
      ClassAction.delete =>
        'This soft-deletes the class and excludes it from future session '
            'generation - existing sessions are unaffected.',
      ClassAction.restore =>
        'This makes the class assignable and schedulable again.',
    };

/// Confirms, runs and reports one lifecycle [action]; returns whether the
/// server accepted it. Every error (including one thrown after the request
/// succeeded) is reported and never leaves the caller spinning.
Future<bool> runClassAction(
  BuildContext context,
  GroupClass groupClass,
  ClassAction action,
) async {
  final ok = await confirmTeam(
    context,
    title: '${action.label} "${groupClass.name}"?',
    message: classConfirmMessage(action),
    confirmLabel: action.label,
    destructive: action == ClassAction.delete,
  );
  if (!ok || !context.mounted) return false;
  final repo = getIt<GroupClassRepository>();
  try {
    switch (action) {
      case ClassAction.delete:
        await repo.delete(groupClass.id);
      case ClassAction.restore:
        await repo.restore(groupClass.id);
    }
    if (context.mounted) teamSnack(context, 'Class ${action.done}.');
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

/// Which lifecycle actions apply to [c] for a viewer holding the given
/// permissions - web's `ClassCard` menu: a deleted class offers Restore
/// (`classes:restore`), a live one offers Delete (`classes:delete`).
List<ClassAction> availableClassActions(
  GroupClass c, {
  required bool canDelete,
  required bool canRestore,
}) {
  return [
    if (c.isDeleted)
      if (canRestore) ClassAction.restore,
    if (!c.isDeleted && canDelete) ClassAction.delete,
  ];
}
