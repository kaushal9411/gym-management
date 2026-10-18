import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/routing/app_routes.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Which parts of the Communication > Notifications area the viewer may use,
/// from the same keys web checks: `notifications:view` (inbox, stats, mark
/// read, message log) and `notifications:manage` (delete a notification,
/// notification settings / templates). The API's route permissions are the
/// same (`tenant-notification.routes.ts`, `message-log.routes.ts`,
/// `notification-template.routes.ts`).
class NotificationAccess {
  const NotificationAccess({required this.canView, required this.canManage});

  final bool canView;
  final bool canManage;

  /// Read from the session (not watched); a non-staff session gets nothing.
  factory NotificationAccess.of(BuildContext context) {
    final s = context.read<SessionCubit>().state;
    if (s is! SessionAuthenticatedStaff) {
      return const NotificationAccess(canView: false, canManage: false);
    }
    return NotificationAccess(
      canView: s.user.hasPermission('notifications:view'),
      canManage: s.user.hasPermission('notifications:manage'),
    );
  }
}

/// Orange used for attendance (web's `--chart-2`), not part of [TeamColors].
const kNotifOrange = Color(0xFFF97316);

/// API category values, in web's `CATEGORY_LABEL` order.
const kNotificationCategories = <String>[
  'ANNOUNCEMENT',
  'SYSTEM',
  'SUBSCRIPTION',
  'GENERAL',
  'MEMBER',
  'MEMBERSHIP',
  'PAYMENT',
  'ATTENDANCE',
  'WORKOUT',
  'DIET',
  'STAFF',
];

String notifCategoryLabel(String c) => switch (c) {
      'ANNOUNCEMENT' => 'Announcements',
      'SYSTEM' => 'System',
      'SUBSCRIPTION' => 'Subscription',
      'GENERAL' => 'General',
      'MEMBER' => 'Members',
      'MEMBERSHIP' => 'Memberships',
      'PAYMENT' => 'Payments',
      'ATTENDANCE' => 'Attendance',
      'WORKOUT' => 'Workouts',
      'DIET' => 'Diet',
      'STAFF' => 'Staff',
      _ => c.isEmpty ? 'Other' : '${c[0]}${c.substring(1).toLowerCase()}',
    };

/// Web's `CATEGORY_COLOR` (chart tokens): announcements violet, system
/// green, subscription red, members indigo, memberships amber, payments teal,
/// attendance orange, workouts / staff magenta, diet green.
Color notifCategoryColor(String c) => switch (c) {
      'ANNOUNCEMENT' => TeamColors.violet,
      'SYSTEM' => TeamColors.green,
      'SUBSCRIPTION' => TeamColors.rose,
      'MEMBER' => TeamColors.indigo,
      'MEMBERSHIP' => TeamColors.amber,
      'PAYMENT' => TeamColors.teal,
      'ATTENDANCE' => kNotifOrange,
      'WORKOUT' => TeamColors.fuchsia,
      'DIET' => TeamColors.green,
      'STAFF' => TeamColors.fuchsia,
      _ => TeamColors.slate,
    };

IconData notifCategoryIcon(String c) => switch (c) {
      'ANNOUNCEMENT' => Icons.campaign_rounded,
      'SYSTEM' => Icons.settings_rounded,
      'SUBSCRIPTION' => Icons.shield_rounded,
      'MEMBER' => Icons.person_rounded,
      'MEMBERSHIP' => Icons.card_membership_rounded,
      'PAYMENT' => Icons.account_balance_wallet_rounded,
      'ATTENDANCE' => Icons.event_available_rounded,
      'WORKOUT' => Icons.fitness_center_rounded,
      'DIET' => Icons.restaurant_rounded,
      'STAFF' => Icons.manage_accounts_rounded,
      _ => Icons.notifications_rounded,
    };

/// 'Today' / 'Yesterday' / 'Mon, 5 Oct' (+ year when not this year) for the
/// day-grouped feed (device-local time), web's `dayGroupLabel`.
String notifDayLabel(DateTime when, [DateTime? now]) {
  final n = now ?? DateTime.now();
  final d = when.toLocal();
  final a = DateTime(n.year, n.month, n.day);
  final b = DateTime(d.year, d.month, d.day);
  final diff = a.difference(b).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const mo = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov',
    'Dec', //
  ];
  final year = d.year == n.year ? '' : ' ${d.year}';
  return '${wd[d.weekday - 1]}, ${d.day} ${mo[d.month - 1]}$year';
}

/// "5m ago" / "3h ago" / "2d ago" / a date, web's `formatRelativeTime`.
String notifAgo(DateTime when, [DateTime? now]) {
  final diff = (now ?? DateTime.now()).difference(when);
  if (diff.inMinutes < 1) return 'Just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  final d = when.toLocal();
  return '${d.day}/${d.month}/${d.year}';
}

enum NotificationPage { inbox, log, settings }

/// Web's hero route tabs: Inbox / Message log / Settings. The log needs
/// `notifications:view` (the same key the page needs); Settings is only
/// offered to `notifications:manage`.
class NotificationTabs extends StatelessWidget {
  const NotificationTabs({
    super.key,
    required this.active,
    required this.access,
  });

  final NotificationPage active;
  final NotificationAccess access;

  @override
  Widget build(BuildContext context) {
    Widget chip(NotificationPage page, String label, String route) {
      return Padding(
        padding: const EdgeInsets.only(right: 8),
        child: TeamFilterChip(
          label: label,
          selected: active == page,
          color: TeamColors.violet,
          onTap: () {
            if (active != page) context.pushReplacement(route);
          },
        ),
      );
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          chip(NotificationPage.inbox, 'Inbox', AppRoutes.notifications),
          if (access.canView)
            chip(NotificationPage.log, 'Message log', AppRoutes.messageLog),
          if (access.canManage)
            chip(
              NotificationPage.settings,
              'Settings',
              AppRoutes.notificationTemplates,
            ),
        ],
      ),
    );
  }
}
