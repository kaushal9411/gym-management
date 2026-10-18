import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/lead.dart';

/// Whether the signed-in staff user holds [permission] (`leads:*`). Every
/// Leads action is gated through this — the menu entry needs `leads:view`,
/// Delete `leads:delete`, Assign `leads:assign`, and so on.
bool leadsCan(BuildContext context, String permission) {
  final s = context.read<SessionCubit>().state;
  return s is SessionAuthenticatedStaff && s.user.hasPermission(permission);
}

// ── palette (same family as the redesigned Members screens) ────────────────

class LeadColors {
  LeadColors._();

  static const indigo = Color(0xFF6366F1);
  static const violet = Color(0xFF8B5CF6);
  static const teal = Color(0xFF14B8A6);
  static const amber = Color(0xFFF59E0B);
  static const rose = Color(0xFFFF5C7A);
  static const green = Color(0xFF10B981);
  static const fuchsia = Color(0xFFC026D3);
  static const sky = Color(0xFF0EA5E9);
  static const slate = Color(0xFF64748B);

  /// Gradient used by hero banners / primary CTAs.
  static const cta = LinearGradient(colors: [indigo, violet, fuchsia]);
}

Color leadStatusColor(LeadStatus s) => switch (s) {
      LeadStatus.newLead => LeadColors.indigo,
      LeadStatus.contacted => LeadColors.teal,
      LeadStatus.visitScheduled => LeadColors.violet,
      LeadStatus.trialDone => LeadColors.amber,
      LeadStatus.negotiation => LeadColors.fuchsia,
      LeadStatus.converted => LeadColors.green,
      LeadStatus.lost => LeadColors.rose,
    };

IconData leadStatusIcon(LeadStatus s) => switch (s) {
      LeadStatus.newLead => Icons.auto_awesome_rounded,
      LeadStatus.contacted => Icons.phone_in_talk_rounded,
      LeadStatus.visitScheduled => Icons.event_available_rounded,
      LeadStatus.trialDone => Icons.fitness_center_rounded,
      LeadStatus.negotiation => Icons.handshake_rounded,
      LeadStatus.converted => Icons.verified_rounded,
      LeadStatus.lost => Icons.cancel_rounded,
    };

Color leadSourceColor(LeadSource s) => switch (s) {
      LeadSource.walkIn => LeadColors.indigo,
      LeadSource.phoneCall => LeadColors.teal,
      LeadSource.website => LeadColors.sky,
      LeadSource.socialMedia => LeadColors.fuchsia,
      LeadSource.referral => LeadColors.green,
      LeadSource.advertisement => LeadColors.amber,
      LeadSource.other => LeadColors.slate,
    };

IconData leadSourceIcon(LeadSource s) => switch (s) {
      LeadSource.walkIn => Icons.directions_walk_rounded,
      LeadSource.phoneCall => Icons.call_rounded,
      LeadSource.website => Icons.language_rounded,
      LeadSource.socialMedia => Icons.share_rounded,
      LeadSource.referral => Icons.groups_rounded,
      LeadSource.advertisement => Icons.campaign_rounded,
      LeadSource.other => Icons.category_rounded,
    };

IconData leadActivityIcon(LeadActivityType? t) => switch (t) {
      LeadActivityType.call => Icons.call_rounded,
      LeadActivityType.whatsapp => Icons.chat_rounded,
      LeadActivityType.email => Icons.mail_rounded,
      LeadActivityType.visit => Icons.directions_walk_rounded,
      LeadActivityType.trial => Icons.fitness_center_rounded,
      LeadActivityType.followUp => Icons.event_repeat_rounded,
      LeadActivityType.note => Icons.sticky_note_2_rounded,
      LeadActivityType.statusChange => Icons.swap_horiz_rounded,
      LeadActivityType.assignment => Icons.person_add_alt_rounded,
      LeadActivityType.created => Icons.add_circle_rounded,
      LeadActivityType.converted => Icons.verified_rounded,
      null => Icons.circle_outlined,
    };

Color leadActivityColor(LeadActivityType? t) => switch (t) {
      LeadActivityType.call => LeadColors.teal,
      LeadActivityType.whatsapp => LeadColors.green,
      LeadActivityType.email => LeadColors.sky,
      LeadActivityType.visit => LeadColors.indigo,
      LeadActivityType.trial => LeadColors.amber,
      LeadActivityType.followUp => LeadColors.violet,
      LeadActivityType.note => LeadColors.fuchsia,
      LeadActivityType.statusChange => LeadColors.indigo,
      LeadActivityType.assignment => LeadColors.violet,
      LeadActivityType.created => LeadColors.slate,
      LeadActivityType.converted => LeadColors.green,
      null => LeadColors.slate,
    };

/// Follow-up colour for a server `followUpState`.
Color leadFollowUpColor(String state) => switch (state) {
      'overdue' => LeadColors.rose,
      'today' => LeadColors.amber,
      'upcoming' => LeadColors.indigo,
      _ => LeadColors.slate,
    };

// ── small display pieces ───────────────────────────────────────────────────

/// Gradient initials circle tinted with [color] (status colour by default).
class LeadAvatar extends StatelessWidget {
  const LeadAvatar({
    super.key,
    required this.name,
    this.size = 44,
    this.color = LeadColors.indigo,
  });

  final String name;
  final double size;
  final Color color;

  String get _initials {
    final w =
        name.trim().split(RegExp(r'\s+')).where((x) => x.isNotEmpty).toList();
    if (w.isEmpty) return '?';
    if (w.length == 1) return w.first[0].toUpperCase();
    return (w.first[0] + w.last[0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [color, Color.lerp(color, LeadColors.fuchsia, 0.55)!],
        ),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.35),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Text(
        _initials,
        style: AppText.display(size: size * 0.38, color: Colors.white),
      ),
    );
  }
}

class LeadStatusPill extends StatelessWidget {
  const LeadStatusPill(this.status, {super.key, this.onDark = false});

  final LeadStatus status;

  /// White-on-glass variant for the gradient hero.
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final c = leadStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: onDark
            ? Colors.white.withValues(alpha: 0.2)
            : c.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(
          color: onDark
              ? Colors.white.withValues(alpha: 0.35)
              : c.withValues(alpha: 0.4),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            leadStatusIcon(status),
            size: 12,
            color: onDark ? Colors.white : c,
          ),
          const SizedBox(width: 4),
          Text(
            status.label,
            style: AppText.body(
              size: 11,
              weight: FontWeight.w800,
              color: onDark ? Colors.white : c,
            ),
          ),
        ],
      ),
    );
  }
}

/// Icon + label chip tinted with [color] (source, plan, assignee...).
class LeadTagChip extends StatelessWidget {
  const LeadTagChip({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    this.maxWidth = 170,
  });

  final IconData icon;
  final String label;
  final Color color;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: maxWidth),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(
                  size: 11,
                  weight: FontWeight.w700,
                  color: color,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Overdue / Due today / date badge for an OPEN lead; nothing otherwise.
class FollowUpBadge extends StatelessWidget {
  const FollowUpBadge(this.lead, {super.key, this.onDark = false});

  final Lead lead;
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    if (!lead.isOpen || lead.nextFollowUpAt == null) {
      return const SizedBox.shrink();
    }
    final when = fmtWhen(lead.nextFollowUpAt);
    final c = leadFollowUpColor(lead.followUpState);
    final label = switch (lead.followUpState) {
      'overdue' => 'Overdue · $when',
      'today' => 'Today · $when',
      _ => 'Follow-up · $when',
    };
    final icon = lead.followUpState == 'overdue'
        ? Icons.alarm_rounded
        : Icons.event_rounded;
    if (onDark) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.2),
          borderRadius: BorderRadius.circular(AppRadii.pill),
          border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: Colors.white),
            const SizedBox(width: 4),
            Text(
              label,
              style: AppText.body(
                size: 11,
                weight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ],
        ),
      );
    }
    return LeadTagChip(icon: icon, label: label, color: c, maxWidth: 240);
  }
}

const _months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', //
];

/// "4 Oct, 15:30" in device-local time.
String fmtWhen(DateTime? d) {
  if (d == null) return '';
  final l = d.toLocal();
  return '${l.day} ${_months[l.month - 1]}, '
      '${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
}

/// "4 Oct 2026" from a `YYYY-MM-DD` string or DateTime.
String fmtDay(Object? v) {
  final d = v is DateTime ? v.toLocal() : DateTime.tryParse('${v ?? ''}');
  if (d == null) return '';
  return '${d.day} ${_months[d.month - 1]} ${d.year}';
}

String ymd(DateTime d) => '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String leadAgeText(Lead l) {
  final d = l.ageDays();
  if (d == null) return '';
  if (d == 0) return 'Today';
  return d == 1 ? '1 day old' : '$d days old';
}

/// "just now" / "5m ago" / "3h ago" / "2d ago" / date.
String relativeTime(DateTime? d, [DateTime? now]) {
  if (d == null) return '';
  final diff = (now ?? DateTime.now()).difference(d);
  if (diff.inMinutes < 1) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 30) return '${diff.inDays}d ago';
  return fmtDay(d);
}

Future<void> _open(BuildContext context, Uri uri, String what) async {
  final messenger = ScaffoldMessenger.of(context);
  var ok = false;
  try {
    ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  } on Object {
    ok = false;
  }
  if (!ok) {
    messenger.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        content: Text('Could not open $what'),
      ),
    );
  }
}

Future<void> leadCall(BuildContext context, String phone) => _open(
      context,
      Uri(scheme: 'tel', path: phone.replaceAll(' ', '')),
      'dialer',
    );

Future<void> leadWhatsApp(BuildContext context, String phone) => _open(
      context,
      Uri.parse('https://wa.me/${leadWaNumber(phone)}'),
      'WhatsApp',
    );

Future<void> leadEmail(BuildContext context, String email) => _open(
      context,
      Uri(scheme: 'mailto', path: email),
      'mail app',
    );

/// Floating success / error snackbar used after every save.
void leadToast(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: error ? AppColors.danger : null,
        content: Text(message),
      ),
    );
}

/// 40dp round icon button used for Call / WhatsApp on cards.
class LeadIconAction extends StatelessWidget {
  const LeadIconAction({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.color,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.ink;
    return Tooltip(
      message: tooltip,
      child: Material(
        color: c.withValues(alpha: 0.14),
        shape: CircleBorder(side: BorderSide(color: c.withValues(alpha: 0.3))),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(
            width: 40,
            height: 40,
            child: Icon(icon, size: 19, color: c),
          ),
        ),
      ),
    );
  }
}

class LeadMetaChip extends StatelessWidget {
  const LeadMetaChip(this.icon, this.text, {super.key, this.color});

  final IconData icon;
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: color ?? AppColors.inkFaint),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            text,
            overflow: TextOverflow.ellipsis,
            style: AppText.body(
              size: 11.5,
              color: AppColors.inkSoft,
              weight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

// ── pickers ────────────────────────────────────────────────────────────────

class PickerOption<T> {
  const PickerOption(this.value, this.label, {this.sub, this.icon, this.color});

  final T? value;
  final String label;
  final String? sub;
  final IconData? icon;
  final Color? color;
}

/// Bottom-sheet single picker. Returns `(picked: value)` so a "None" row
/// (value null) is distinguishable from dismissal (returns null).
Future<({T? picked})?> pickOne<T>(
  BuildContext context, {
  required String title,
  required List<PickerOption<T>> options,
  T? selected,
  IconData icon = Icons.tune_rounded,
  Color color = LeadColors.violet,
}) {
  return showModalBottomSheet<({T? picked})>(
    context: context,
    backgroundColor: AppColors.surface2,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
    ),
    builder: (ctx) => SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(ctx).size.height * 0.75,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10, bottom: 6),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.line,
                  borderRadius: BorderRadius.circular(9),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 4, 18, 8),
              child: Row(
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, size: 16, color: color),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(title, style: AppText.display(size: 17)),
                  ),
                ],
              ),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                padding: const EdgeInsets.only(bottom: 8),
                children: [
                  for (final o in options)
                    ListTile(
                      minTileHeight: 50,
                      leading: o.icon == null
                          ? null
                          : Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(
                                color:
                                    (o.color ?? color).withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(11),
                              ),
                              child: Icon(
                                o.icon,
                                size: 18,
                                color: o.color ?? color,
                              ),
                            ),
                      title: Text(
                        o.label,
                        style: AppText.body(size: 14, weight: FontWeight.w700),
                      ),
                      subtitle: o.sub == null
                          ? null
                          : Text(
                              o.sub!,
                              style: AppText.body(
                                size: 11.5,
                                color: AppColors.inkFaint,
                              ),
                            ),
                      trailing: o.value == selected && o.value != null
                          ? Icon(Icons.check_circle_rounded, color: color)
                          : null,
                      onTap: () => Navigator.of(ctx).pop((picked: o.value)),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

Future<DateTime?> pickDate(
  BuildContext context, {
  DateTime? initial,
  DateTime? first,
  DateTime? last,
}) {
  final now = DateTime.now();
  return showDatePicker(
    context: context,
    initialDate: initial ?? now,
    firstDate: first ?? DateTime(now.year - 100),
    lastDate: last ?? DateTime(now.year + 5),
  );
}

/// Date then time, both local; returns a local DateTime.
Future<DateTime?> pickDateTime(
  BuildContext context, {
  DateTime? initial,
}) async {
  final now = DateTime.now();
  final d = await showDatePicker(
    context: context,
    initialDate: initial ?? now,
    firstDate: DateTime(now.year - 1),
    lastDate: DateTime(now.year + 3),
  );
  if (d == null || !context.mounted) return null;
  final t = await showTimePicker(
    context: context,
    initialTime:
        TimeOfDay.fromDateTime(initial ?? now.add(const Duration(hours: 1))),
  );
  if (t == null) return null;
  return DateTime(d.year, d.month, d.day, t.hour, t.minute);
}
