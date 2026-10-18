import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/staff_member.dart';
import '../../../repositories/staff_repository.dart';
import 'widgets/team_ui.dart';

/// Lifecycle actions on a staff account (`POST /staff/:id/{action}` and
/// `DELETE /staff/:id`). Shared by the roster card menu and the profile.
enum StaffAction { activate, deactivate, suspend, restore, delete }

extension StaffActionX on StaffAction {
  String get verb => switch (this) {
        StaffAction.activate => 'Activate',
        StaffAction.deactivate => 'Deactivate',
        StaffAction.suspend => 'Suspend',
        StaffAction.restore => 'Restore',
        StaffAction.delete => 'Delete',
      };

  String get pastTense => switch (this) {
        StaffAction.activate => 'activated',
        StaffAction.deactivate => 'deactivated',
        StaffAction.suspend => 'suspended',
        StaffAction.restore => 'restored',
        StaffAction.delete => 'deleted',
      };

  bool get destructive =>
      this == StaffAction.delete || this == StaffAction.suspend;

  IconData get icon => switch (this) {
        StaffAction.activate => Icons.play_circle_outline_rounded,
        StaffAction.deactivate => Icons.block_rounded,
        StaffAction.suspend => Icons.pause_circle_outline_rounded,
        StaffAction.restore => Icons.restore_rounded,
        StaffAction.delete => Icons.delete_outline_rounded,
      };

  Color get color => switch (this) {
        StaffAction.activate => TeamColors.green,
        StaffAction.restore => TeamColors.green,
        StaffAction.deactivate => TeamColors.slate,
        StaffAction.suspend => TeamColors.amber,
        StaffAction.delete => TeamColors.rose,
      };
}

String _msg(Object e) => e is ApiException ? e.detailedMessage : '$e';

/// Confirms, runs [action] and toasts the outcome. Returns true if it ran.
Future<bool> runStaffAction(
  BuildContext context,
  StaffMember s,
  StaffAction action,
) async {
  final ok = await confirmTeam(
    context,
    title: '${action.verb} ${s.name}?',
    message: action == StaffAction.delete
        ? 'This soft-deletes the account — it can be restored later.'
        : 'This action can be reversed later if needed.',
    confirmLabel: action.verb,
    destructive: action.destructive,
  );
  if (!ok || !context.mounted) return false;
  final repo = getIt<StaffRepository>();
  try {
    switch (action) {
      case StaffAction.activate:
        await repo.activate(s.id);
      case StaffAction.deactivate:
        await repo.deactivate(s.id);
      case StaffAction.suspend:
        await repo.suspend(s.id);
      case StaffAction.restore:
        await repo.restore(s.id);
      case StaffAction.delete:
        await repo.softDelete(s.id);
    }
    if (context.mounted) {
      teamSnack(context, '${s.name} ${action.pastTense}.');
    }
    return true;
  } catch (e) {
    if (context.mounted) teamSnack(context, _msg(e), error: true);
    return false;
  }
}

/// `POST /staff/:id/resend-activation` (needs `staff:invite`).
Future<bool> runResendActivation(BuildContext context, StaffMember s) async {
  try {
    await getIt<StaffRepository>().resendActivation(s.id);
    if (context.mounted) {
      teamSnack(context, 'Activation email resent to ${s.name}.');
    }
    return true;
  } catch (e) {
    if (context.mounted) teamSnack(context, _msg(e), error: true);
    return false;
  }
}

/// `POST /staff/:id/reset-password` — emails a reset link (needs `staff:update`).
Future<bool> runResetPassword(BuildContext context, StaffMember s) async {
  final ok = await confirmTeam(
    context,
    title: 'Send a password reset email?',
    message:
        '${s.name} will receive an email with a link to set a new password.',
    confirmLabel: 'Send email',
  );
  if (!ok || !context.mounted) return false;
  try {
    await getIt<StaffRepository>().resetPassword(s.id);
    if (context.mounted) teamSnack(context, 'Password reset email sent.');
    return true;
  } catch (e) {
    if (context.mounted) teamSnack(context, _msg(e), error: true);
    return false;
  }
}

/// `POST /staff/:id/manual-activate` — activates without the email link and
/// shows the one-time temporary password so it can be handed over in person.
Future<bool> runManualActivate(BuildContext context, StaffMember s) async {
  final ok = await confirmTeam(
    context,
    title: 'Activate ${s.name} manually?',
    message:
        'The account becomes active right away with a temporary password you '
        'share with them directly.',
    confirmLabel: 'Activate',
  );
  if (!ok || !context.mounted) return false;
  final StaffManualActivation result;
  try {
    result = await getIt<StaffRepository>().manualActivate(s.id);
  } catch (e) {
    if (context.mounted) teamSnack(context, _msg(e), error: true);
    return false;
  }
  if (!context.mounted) return true;
  await showDialog<void>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      backgroundColor: AppColors.surface2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      title: Text('${s.name} is now active', style: AppText.display(size: 18)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Share this temporary password with them directly (call, message, "
            "in person) — it won't be shown again. They should change it after "
            'signing in.',
            style: AppText.body(size: 12.5, color: AppColors.inkSoft),
          ),
          const SizedBox(height: 14),
          Text('EMAIL', style: AppText.eyebrow()),
          const SizedBox(height: 4),
          SelectableText(
            result.email,
            style: AppText.body(size: 14, weight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          Text('TEMPORARY PASSWORD', style: AppText.eyebrow()),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: TeamColors.violet.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: TeamColors.violet.withValues(alpha: 0.35),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: SelectableText(
                    result.temporaryPassword,
                    style: AppText.tabular(size: 15),
                  ),
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(
                    Icons.copy_rounded,
                    size: 18,
                    color: TeamColors.violet,
                  ),
                  onPressed: () {
                    Clipboard.setData(
                      ClipboardData(text: result.temporaryPassword),
                    );
                    teamSnack(dialogContext, 'Password copied.');
                  },
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(),
          child: Text(
            'Done',
            style: AppText.body(
              size: 13,
              weight: FontWeight.w800,
              color: TeamColors.violet,
            ),
          ),
        ),
      ],
    ),
  );
  return true;
}

/// Bulk activate / deactivate / delete across [ids]; toasts the tally.
Future<bool> runBulkStaffAction(
  BuildContext context,
  String action,
  List<String> ids,
) async {
  final label = switch (action) {
    'activate' => 'Activate',
    'deactivate' => 'Deactivate',
    _ => 'Delete',
  };
  final ok = await confirmTeam(
    context,
    title: '$label ${ids.length} staff member${ids.length == 1 ? '' : 's'}?',
    message: action == 'delete'
        ? 'This soft-deletes the accounts — they can be restored later.'
        : 'This action can be reversed later if needed.',
    confirmLabel: label,
    destructive: action == 'delete',
  );
  if (!ok || !context.mounted) return false;
  try {
    final r = await getIt<StaffRepository>().bulk(action, ids);
    if (context.mounted) {
      final past = switch (action) {
        'activate' => 'activated',
        'deactivate' => 'deactivated',
        _ => 'deleted',
      };
      teamSnack(
        context,
        '${r.succeeded.length} staff member(s) $past'
        '${r.failed.isEmpty ? '' : ', ${r.failed.length} failed'}.',
        error: r.succeeded.isEmpty && r.failed.isNotEmpty,
      );
    }
    return true;
  } catch (e) {
    if (context.mounted) teamSnack(context, _msg(e), error: true);
    return false;
  }
}
