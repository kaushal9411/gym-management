import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../models/support_ticket.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Where "Contact us" opens a mail app — web hard-codes the same address.
const kSupportEmail = 'support@fitcloud.com';

/// Web's support accent (teal) — the hero, tiles and charts use it.
const kSupportColor = TeamColors.teal;

/// Subject / description limits from web's `new-ticket-dialog` and the API.
const kSubjectMin = 3;
const kSubjectMax = 200;
const kDescriptionMin = 10;
const kDescriptionMax = 5000;

/// What the signed-in user may do on Support — the same checks web's
/// `/support` page makes: plan flag `support_tickets`, `support:view` (list,
/// stats, detail) and `support:create` (raise a ticket). The API enforces the
/// same keys on `GET`/`POST /support/tickets`.
class SupportAccess {
  const SupportAccess({
    required this.hasPlan,
    required this.canView,
    required this.canCreate,
  });

  final bool hasPlan;
  final bool canView;
  final bool canCreate;

  bool get ticketsEnabled => hasPlan && canView;
  bool get canRaise => hasPlan && canCreate;

  factory SupportAccess.of(BuildContext context) {
    final s = context.read<SessionCubit>().state;
    if (s is! SessionAuthenticatedStaff) {
      return const SupportAccess(
        hasPlan: false,
        canView: false,
        canCreate: false,
      );
    }
    return SupportAccess(
      hasPlan: s.tenant.featureFlags.contains('support_tickets'),
      canView: s.user.hasPermission('support:view'),
      canCreate: s.user.hasPermission('support:create'),
    );
  }
}

const kTicketStatuses = <String>['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const kTicketPriorities = <TicketPriority>[
  TicketPriority.low,
  TicketPriority.medium,
  TicketPriority.high,
  TicketPriority.urgent,
];

String ticketStatusLabel(String s) => switch (s) {
      'OPEN' => 'Open',
      'IN_PROGRESS' => 'In progress',
      'RESOLVED' => 'Resolved',
      'CLOSED' => 'Closed',
      _ => s,
    };

/// Web's `STATUS_META` colours: open orange, in progress teal, resolved green,
/// closed grey.
Color ticketStatusColor(String s) => switch (s) {
      'OPEN' => const Color(0xFFF97316),
      'IN_PROGRESS' => TeamColors.teal,
      'RESOLVED' => TeamColors.green,
      _ => TeamColors.slate,
    };

IconData ticketStatusIcon(String s) => switch (s) {
      'OPEN' => Icons.radio_button_checked_rounded,
      'IN_PROGRESS' => Icons.schedule_rounded,
      'RESOLVED' => Icons.check_circle_outline_rounded,
      _ => Icons.lock_outline_rounded,
    };

/// Web's `PRIORITY_META`: label, colour, hint.
Color ticketPriorityColor(TicketPriority p) => switch (p) {
      TicketPriority.low => TeamColors.slate,
      TicketPriority.medium => TeamColors.teal,
      TicketPriority.high => const Color(0xFFF97316),
      TicketPriority.urgent => TeamColors.rose,
    };

String ticketPriorityHint(TicketPriority p) => switch (p) {
      TicketPriority.low => 'Whenever you get a chance',
      TicketPriority.medium => 'Normal everyday issue',
      TicketPriority.high => 'Blocking part of your work',
      TicketPriority.urgent => 'Gym operations are stopped',
    };

IconData ticketPriorityIcon(TicketPriority p) => switch (p) {
      TicketPriority.low => Icons.arrow_downward_rounded,
      TicketPriority.medium => Icons.remove_rounded,
      TicketPriority.high => Icons.arrow_upward_rounded,
      TicketPriority.urgent => Icons.priority_high_rounded,
    };

/// "AB" from a name or e-mail (web's `initials`).
String supportInitials(String? name) {
  final parts = (name ?? '')
      .trim()
      .split(RegExp(r'[\s@._-]+'))
      .where((p) => p.isNotEmpty)
      .toList();
  if (parts.isEmpty) return '?';
  if (parts.length == 1) return parts.first[0].toUpperCase();
  return (parts.first[0] + parts[1][0]).toUpperCase();
}

/// "3d ago" / "5h ago" / "just now" (web's `relativeTo` for past times).
String supportAgo(DateTime when, [DateTime? now]) {
  final diff = (now ?? DateTime.now()).difference(when);
  if (diff.inMinutes < 1) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  return '${diff.inDays}d ago';
}
