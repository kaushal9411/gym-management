import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/lead.dart';
import '../../../shared/widgets/app_pill.dart';

/// Whether the signed-in staff user holds [permission] (`leads:*`). Every
/// Leads action is gated through this — the menu entry needs `leads:view`,
/// Delete `leads:delete`, Assign `leads:assign`, and so on.
bool leadsCan(BuildContext context, String permission) {
  final s = context.read<SessionCubit>().state;
  return s is SessionAuthenticatedStaff && s.user.hasPermission(permission);
}

Color leadStatusColor(LeadStatus s) => switch (s) {
      LeadStatus.newLead => const Color(0xFF6EA8FF),
      LeadStatus.contacted => AppColors.staffB,
      LeadStatus.visitScheduled => const Color(0xFFC77DFF),
      LeadStatus.trialDone => AppColors.warning,
      LeadStatus.negotiation => AppColors.staffA,
      LeadStatus.converted => AppColors.success,
      LeadStatus.lost => AppColors.danger,
    };

class LeadStatusPill extends StatelessWidget {
  const LeadStatusPill(this.status, {super.key});

  final LeadStatus status;

  @override
  Widget build(BuildContext context) {
    final c = leadStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        status.label,
        style: AppText.body(size: 11, weight: FontWeight.w800, color: c),
      ),
    );
  }
}

/// Overdue / Due today / date badge for an OPEN lead; nothing otherwise.
class FollowUpBadge extends StatelessWidget {
  const FollowUpBadge(this.lead, {super.key});

  final Lead lead;

  @override
  Widget build(BuildContext context) {
    if (!lead.isOpen || lead.nextFollowUpAt == null) {
      return const SizedBox.shrink();
    }
    final when = fmtWhen(lead.nextFollowUpAt);
    return switch (lead.followUpState) {
      'overdue' => AppPill(label: 'Overdue · $when', tone: AppPillTone.danger),
      'today' => AppPill(label: 'Today · $when', tone: AppPillTone.warning),
      _ => AppPill(label: 'Follow-up · $when'),
    };
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

Future<void> _open(BuildContext context, Uri uri, String what) async {
  final messenger = ScaffoldMessenger.of(context);
  var ok = false;
  try {
    ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  } on Object {
    ok = false;
  }
  if (!ok) {
    messenger.showSnackBar(SnackBar(content: Text('Could not open $what')));
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

/// 44dp round icon button used for Call / WhatsApp on cards and the header.
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
    return Tooltip(
      message: tooltip,
      child: Material(
        color: AppColors.surface3,
        shape: CircleBorder(side: BorderSide(color: AppColors.line)),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Icon(icon, size: 20, color: color ?? AppColors.ink),
          ),
        ),
      ),
    );
  }
}

class LeadMetaChip extends StatelessWidget {
  const LeadMetaChip(this.icon, this.text, {super.key});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: AppColors.inkFaint),
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

class PickerOption<T> {
  const PickerOption(this.value, this.label, {this.sub});

  final T? value;
  final String label;
  final String? sub;
}

/// Bottom-sheet single picker. Returns `(picked: value)` so a "None" row
/// (value null) is distinguishable from dismissal (returns null).
Future<({T? picked})?> pickOne<T>(
  BuildContext context, {
  required String title,
  required List<PickerOption<T>> options,
  T? selected,
}) {
  return showModalBottomSheet<({T? picked})>(
    context: context,
    backgroundColor: AppColors.surface,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) => SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(ctx).size.height * 0.7,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
              child: Text(title, style: AppText.display(size: 17)),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  for (final o in options)
                    ListTile(
                      minTileHeight: 48,
                      title: Text(o.label, style: AppText.body(size: 14)),
                      subtitle: o.sub == null
                          ? null
                          : Text(
                              o.sub!,
                              style: AppText.body(
                                size: 11.5,
                                color: AppColors.inkFaint,
                              ),
                            ),
                      trailing: o.value == selected
                          ? const Icon(
                              Icons.check_rounded,
                              color: AppColors.staffB,
                            )
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

/// Read-only tappable field row (label above, value inside) used by the
/// forms for pickers/dates; [onClear] adds an X.
class LeadPickerField extends StatelessWidget {
  const LeadPickerField({
    super.key,
    required this.label,
    required this.value,
    required this.onTap,
    this.hint = 'Not set',
    this.onClear,
    this.error,
  });

  final String label;
  final String? value;
  final String hint;
  final VoidCallback onTap;
  final VoidCallback? onClear;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final has = value != null && value!.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(label, style: AppText.eyebrow()),
        ),
        Material(
          color: AppColors.surface2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.field),
            side: BorderSide(
              color: error != null ? AppColors.danger : AppColors.line,
            ),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadii.field),
            onTap: onTap,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 48),
              child: Padding(
                padding: const EdgeInsets.only(left: 14, right: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        has ? value! : hint,
                        style: AppText.body(
                          size: 14,
                          color: has ? AppColors.ink : AppColors.inkFaint,
                        ),
                      ),
                    ),
                    if (has && onClear != null)
                      IconButton(
                        tooltip: 'Clear',
                        icon: const Icon(Icons.close_rounded, size: 18),
                        onPressed: onClear,
                      )
                    else
                      Padding(
                        padding: EdgeInsets.only(right: 8),
                        child: Icon(
                          Icons.expand_more_rounded,
                          color: AppColors.inkFaint,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              error!,
              style: AppText.body(size: 11.5, color: AppColors.danger),
            ),
          ),
      ],
    );
  }
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
