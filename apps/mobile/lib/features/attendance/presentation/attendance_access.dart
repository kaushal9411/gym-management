import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../models/tenant_branding.dart';
import '../../../models/user_profile.dart';

/// Single place that answers "may this signed-in staff user see / do X on the
/// Attendance screens?". It is deliberately a thin, pure wrapper over the
/// permission list so the gating matrix can be unit-tested.
///
/// **What the redesign did NOT change** (the pre-redesign behaviour, kept 1:1):
/// the screens themselves are reached through the same menu tiles / shell tabs
/// (`attendance:view` + the `attendance` feature flag on the menu tiles; the
/// Manager and Receptionist shell tabs are ungated) and the two actions that
/// already existed on the pushed Attendance dashboard — *History* and
/// *Check in / out* — stay visible to everyone who can open it
/// ([showHistoryOnPushed] / [showCheckInOnPushed] are constant `true`).
///
/// **New elements** (nothing in the old screens to preserve) follow the same
/// keys web's UI and the API's `requirePermission` use:
/// * quick Check out / detail-sheet Check out -> `attendance:checkout`
/// * Edit record -> `attendance:update`, Delete record -> `attendance:delete`
/// * the Manager tab's History / Check in / out shortcuts mirror the menu
///   tile (`attendance:view` + flag) and web (`attendance:checkin`).
/// * "View member" in the detail sheet -> `members:view`.
class AttendanceAccess {
  const AttendanceAccess(this.user, this.tenant);

  /// Resolved from the session; a non-staff session can do nothing.
  static AttendanceAccess of(BuildContext context) {
    final s = context.read<SessionCubit>().state;
    if (s is SessionAuthenticatedStaff) {
      return AttendanceAccess(s.user, s.tenant);
    }
    return const AttendanceAccess(null, null);
  }

  final UserProfile? user;
  final TenantBranding? tenant;

  bool _has(String key) => user?.hasPermission(key) ?? false;

  bool get canView => _has('attendance:view');
  bool get canCheckIn => _has('attendance:checkin');
  bool get canCheckOut => _has('attendance:checkout');
  bool get canUpdate => _has('attendance:update');
  bool get canDelete => _has('attendance:delete');
  bool get canViewMembers => _has('members:view');

  bool get _flagOn => tenant?.featureFlags.contains('attendance') ?? false;

  /// The pushed Attendance dashboard always showed these two actions.
  static const showHistoryOnPushed = true;
  static const showCheckInOnPushed = true;

  /// Manager's Attendance *tab* never had them — same visibility rule as the
  /// "Attendance History" menu tile / web's `attendance:checkin` button.
  bool get showHistoryOnTab => canView && _flagOn;
  bool get showCheckInOnTab => canCheckIn;

  bool showHistory({required bool asTab}) =>
      asTab ? showHistoryOnTab : showHistoryOnPushed;

  bool showCheckIn({required bool asTab}) =>
      asTab ? showCheckInOnTab : showCheckInOnPushed;
}
