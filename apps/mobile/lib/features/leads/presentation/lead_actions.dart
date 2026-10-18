import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/lead.dart';
import '../../../repositories/lead_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import 'lead_ui.dart';
import 'widgets/lead_widgets.dart';

/// Applies a stage change somewhere (detail cubit, or the repo directly for
/// list cards) and returns an error message, or null on success.
typedef LeadStageApply = Future<String?> Function(
  LeadStatus status,
  LeadLostReason? reason,
  String? note,
);

/// Stage picker (+ lost-reason sheet) shared by the detail screen and the
/// list / follow-up cards. CONVERTED is never offered (Convert only); a LOST
/// lead is reopened into an open stage. Toasts the outcome and returns true
/// when the lead actually moved.
Future<bool> pickAndChangeStage(
  BuildContext context,
  Lead lead,
  LeadStageApply apply,
) async {
  final reopen = lead.status == LeadStatus.lost;
  final options = reopen
      ? LeadStatus.pipeline.where((s) => s.isOpen).toList()
      : [
          ...LeadStatus.pipeline.where((s) => s.isOpen && s != lead.status),
          LeadStatus.lost,
        ];
  final res = await pickOne<LeadStatus>(
    context,
    title: reopen ? 'Reopen lead as' : 'Move to stage',
    icon: Icons.swap_horiz_rounded,
    options: [
      for (final s in options)
        PickerOption(
          s,
          s.label,
          icon: leadStatusIcon(s),
          color: leadStatusColor(s),
        ),
    ],
  );
  final target = res?.picked;
  if (target == null || !context.mounted) return false;
  LeadLostReason? reason;
  String? note;
  if (target == LeadStatus.lost) {
    final r = await showLeadSheet<({LeadLostReason reason, String? note})>(
      context,
      (_) => const LeadLostSheet(),
    );
    if (r == null || !context.mounted) return false;
    reason = r.reason;
    note = r.note;
  }
  final err = await apply(target, reason, note);
  if (context.mounted) {
    leadToast(
      context,
      err ??
          (target == LeadStatus.lost
              ? 'Marked as lost'
              : 'Moved to ${target.label}'),
      error: err != null,
    );
  }
  return err == null;
}

/// Direct-repo stage change for cards that have no detail cubit.
Future<bool> quickChangeStage(BuildContext context, Lead lead) {
  return pickAndChangeStage(context, lead, (status, reason, note) async {
    try {
      await getIt<LeadRepository>().changeStatus(
        lead.id,
        status: status,
        lostReason: reason,
        lostNote: note,
      );
      return null;
    } on ApiException catch (e) {
      return e.detailedMessage;
    } on Object {
      return 'Something went wrong. Please try again.';
    }
  });
}

/// "Log call" quick action from the follow-ups list.
Future<bool> quickLogCall(BuildContext context, Lead lead) async {
  String? err;
  try {
    await getIt<LeadRepository>().addActivity(
      lead.id,
      type: LeadActivityType.call,
      note: 'Follow-up call logged',
    );
  } on ApiException catch (e) {
    err = e.detailedMessage;
  } on Object {
    err = 'Something went wrong. Please try again.';
  }
  if (context.mounted) {
    leadToast(context, err ?? 'Call logged', error: err != null);
  }
  return err == null;
}

/// "Reschedule" quick action: pick date + time, log a FOLLOW_UP with it.
Future<bool> quickReschedule(BuildContext context, Lead lead) async {
  final when =
      await pickDateTime(context, initial: lead.nextFollowUpAt?.toLocal());
  if (when == null || !context.mounted) return false;
  String? err;
  try {
    await getIt<LeadRepository>().addActivity(
      lead.id,
      type: LeadActivityType.followUp,
      note: 'Follow-up rescheduled',
      nextFollowUpAt: when,
    );
  } on ApiException catch (e) {
    err = e.detailedMessage;
  } on Object {
    err = 'Something went wrong. Please try again.';
  }
  if (context.mounted) {
    leadToast(
      context,
      err ?? 'Follow-up set for ${fmtWhen(when)}',
      error: err != null,
    );
  }
  return err == null;
}

/// "Why was this lead lost?" sheet — pops `(reason, note)`.
class LeadLostSheet extends StatefulWidget {
  const LeadLostSheet({super.key});

  @override
  State<LeadLostSheet> createState() => _LeadLostSheetState();
}

class _LeadLostSheetState extends State<LeadLostSheet> {
  LeadLostReason? _reason;
  final _note = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LeadSheetScaffold(
      icon: Icons.cancel_rounded,
      color: LeadColors.rose,
      title: 'Why was this lead lost?',
      subtitle: 'Recorded for the lost-reasons report',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LeadChipGroup<LeadLostReason>(
            label: 'REASON',
            icon: Icons.flag_rounded,
            color: LeadColors.rose,
            options: LeadLostReason.values,
            value: _reason,
            labelOf: (r) => r.label,
            onChanged: (r) => setState(() {
              _reason = r;
              _error = null;
            }),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                _error!,
                style: AppText.body(
                  size: 12,
                  color: AppColors.danger,
                  weight: FontWeight.w600,
                ),
              ),
            ),
          const SizedBox(height: 14),
          AppLabeledField(
            label: 'Note (optional)',
            controller: _note,
            icon: Icons.sticky_note_2_rounded,
            iconColor: LeadColors.rose,
            minLines: 1,
            maxLines: 3,
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: () {
              if (_reason == null) {
                setState(() => _error = 'Pick a reason');
                return;
              }
              final n = _note.text.trim();
              Navigator.of(context).pop(
                (reason: _reason!, note: n.isEmpty ? null : n),
              );
            },
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: const LinearGradient(
                  colors: [LeadColors.rose, LeadColors.fuchsia],
                ),
              ),
              child: Text(
                'Mark as lost',
                style: AppText.body(
                  size: 14.5,
                  weight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
