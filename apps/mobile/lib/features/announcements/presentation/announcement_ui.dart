import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../models/announcement.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Per-action permissions for announcements — the same keys web checks
/// (`announcements/page.tsx`) and the routes enforce
/// (`tenant-announcement.routes.ts`): `view` (list, stats), `create`,
/// `update` (Edit a draft / scheduled one), `publish` (Publish now and
/// Schedule), `delete`.
class AnnouncementAccess {
  const AnnouncementAccess({
    required this.canView,
    required this.canCreate,
    required this.canUpdate,
    required this.canPublish,
    required this.canDelete,
  });

  final bool canView;
  final bool canCreate;
  final bool canUpdate;
  final bool canPublish;
  final bool canDelete;

  factory AnnouncementAccess.of(BuildContext context) {
    final s = context.read<SessionCubit>().state;
    if (s is! SessionAuthenticatedStaff) {
      return const AnnouncementAccess(
        canView: false,
        canCreate: false,
        canUpdate: false,
        canPublish: false,
        canDelete: false,
      );
    }
    bool has(String k) => s.user.hasPermission(k);
    return AnnouncementAccess(
      canView: has('announcements:view'),
      canCreate: has('announcements:create'),
      canUpdate: has('announcements:update'),
      canPublish: has('announcements:publish'),
      canDelete: has('announcements:delete'),
    );
  }
}

/// API status values in web's tab order.
const kAnnouncementStatuses = <String>[
  'DRAFT',
  'SCHEDULED',
  'PUBLISHED',
  'EXPIRED',
];

String announcementStatusLabel(String s) => switch (s) {
      'DRAFT' => 'Draft',
      'SCHEDULED' => 'Scheduled',
      'PUBLISHED' => 'Published',
      'EXPIRED' => 'Expired',
      _ => s,
    };

/// Web's `STATUS_META` colours: draft grey, scheduled amber, published green,
/// expired rose.
Color announcementStatusColor(String s) => switch (s) {
      'SCHEDULED' => TeamColors.amber,
      'PUBLISHED' => TeamColors.green,
      'EXPIRED' => TeamColors.rose,
      _ => TeamColors.slate,
    };

/// Web's `AUDIENCE_META`: label, short label, hint, icon, colour.
String audienceLabel(AnnouncementAudience a) => switch (a) {
      AnnouncementAudience.all => 'Everyone',
      AnnouncementAudience.members => 'Members only',
      AnnouncementAudience.staff => 'Staff only',
    };

String audienceShort(AnnouncementAudience a) => switch (a) {
      AnnouncementAudience.all => 'Everyone',
      AnnouncementAudience.members => 'Members',
      AnnouncementAudience.staff => 'Staff',
    };

String audienceHint(AnnouncementAudience a) => switch (a) {
      AnnouncementAudience.all => 'Members and staff',
      AnnouncementAudience.members => 'Visible to gym members',
      AnnouncementAudience.staff => 'Visible to your team',
    };

IconData audienceIcon(AnnouncementAudience a) => switch (a) {
      AnnouncementAudience.all => Icons.public_rounded,
      AnnouncementAudience.members => Icons.groups_rounded,
      AnnouncementAudience.staff => Icons.manage_accounts_rounded,
    };

Color audienceColor(AnnouncementAudience a) => switch (a) {
      AnnouncementAudience.all => TeamColors.indigo,
      AnnouncementAudience.members => TeamColors.teal,
      AnnouncementAudience.staff => TeamColors.fuchsia,
    };

AnnouncementAudience audienceFromApi(String v) =>
    AnnouncementAudienceX.fromApi(v);

const _mo = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov',
  'Dec', //
];

String _time(DateTime l) {
  final h = l.hour % 12 == 0 ? 12 : l.hour % 12;
  return '$h:${l.minute.toString().padLeft(2, '0')} ${l.hour >= 12 ? 'pm' : 'am'}';
}

/// "5 Oct, 3:30 pm" (device-local), web's `fmtDateTime`.
String annDateTime(DateTime d) {
  final l = d.toLocal();
  return '${l.day} ${_mo[l.month - 1]}, ${_time(l)}';
}

/// "5 Oct 2026", web's `fmtDay`. Date-only values (`@db.Date`, UTC midnight)
/// keep their calendar day instead of shifting in western time zones.
String annDay(DateTime d) {
  final dateOnly = d.isUtc && d.hour == 0 && d.minute == 0 && d.second == 0;
  final l = dateOnly ? d : d.toLocal();
  return '${l.day} ${_mo[l.month - 1]} ${l.year}';
}

/// "in 2h 15m" / "in 3d" / "now" / "2d ago" relative to [now], web's
/// `relativeTo`.
String annRelative(DateTime when, DateTime now) {
  final diff = when.difference(now);
  final mins = diff.inMinutes.abs();
  final hours = mins ~/ 60;
  final days = hours ~/ 24;
  final text = days >= 2
      ? '${days}d'
      : hours >= 1
          ? '${hours}h ${mins % 60}m'
          : mins >= 1
              ? '${mins}m'
              : '';
  if (text.isEmpty) return 'now';
  return diff.isNegative ? '$text ago' : 'in $text';
}

/// Expiry timestamps are stored as dates: count down to the end of that day
/// (web's `expiryRelative`).
String annExpiryRelative(DateTime when, DateTime now) {
  final l =
      when.isUtc ? DateTime(when.year, when.month, when.day, 23, 59, 59) : when;
  return annRelative(l, now);
}
