import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../bloc/session/session_cubit.dart';
import '../../bloc/session/session_state.dart';

/// What the signed-in staff user may do in Communications, from the same keys
/// the API's routes check: `notifications:view` (hub, history, read-only
/// automations), `notifications:send` (audience, send, cancel, retry) and
/// `notifications:manage` (edit / test automations).
class CommAccess {
  const CommAccess({
    required this.canView,
    required this.canSend,
    required this.canManage,
  });

  final bool canView;
  final bool canSend;
  final bool canManage;

  static const none =
      CommAccess(canView: false, canSend: false, canManage: false);

  /// Read from the session (not watched); a non-staff session gets nothing.
  factory CommAccess.of(BuildContext context) {
    final s = context.read<SessionCubit>().state;
    if (s is! SessionAuthenticatedStaff) return none;
    return CommAccess(
      canView: s.user.hasPermission('notifications:view'),
      canSend: s.user.hasPermission('notifications:send'),
      canManage: s.user.hasPermission('notifications:manage'),
    );
  }

  /// Why Send is unavailable, for a disabled control.
  static const sendReason =
      'You need the "Send messages" permission (notifications:send) to send. '
      'Ask your gym owner to grant it.';

  static const manageReason =
      'You can view automations but not change them. Changing them needs '
      'the notifications:manage permission.';
}
