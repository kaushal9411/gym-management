import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/communications/send_flow_cubit.dart';
import '../../../../bloc/communications/send_flow_state.dart';
import '../../../../core/network/comm_failure.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/count_format.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../comm_constants.dart';
import '../../comm_logic.dart';
import '../widgets/comm_widgets.dart';
import 'send_ui.dart';
import '../../../../models/comm_channel.dart';

/// Step 4 — "Ready to send?" (design frame 5).
///
/// A summary card (To / Channels / Message / When / Uses), the confirm box
/// when more than 100 people are involved (or the server asked for it with
/// `CONFIRMATION_REQUIRED`), and **Schedule instead** (date + time, 1 minute
/// to 90 days ahead). The Send button lives in the flow's dock. A failed send
/// shows here as a banner with the specific reason; the same Idempotency-Key
/// is reused for a plain retry so nothing can be sent twice.
class ReviewStep extends StatelessWidget {
  const ReviewStep({super.key, required this.lookups, this.clock});

  final AudienceLookups lookups;

  /// Injectable "now" for the schedule picker (tests).
  final DateTime Function()? clock;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<SendFlowCubit>();
    return BlocBuilder<SendFlowCubit, SendFlowState>(
      builder: (context, s) {
        final p = s.preview;
        final attempted = s.attempted.contains(kStepReview);
        final Map<String, String> errors =
            attempted ? cubit.errorsFor(kStepReview) : <String, String>{};
        final count = p?.total ?? s.audienceCount ?? 0;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const StepHeading(
              title: 'Ready to send?',
              hint: 'Check this once. You can cancel a scheduled send later.',
            ),
            if (s.banner != null) ...[
              _BannerView(state: s),
              const SizedBox(height: 12),
            ],
            _Summary(
              rows: [
                (
                  'To',
                  describeAudience(
                    mode: s.mode,
                    filter: s.filter,
                    pickedCount: s.picked.length,
                    names: lookups.names,
                  ),
                  '${groupDigits(count)} ${count == 1 ? 'person' : 'people'}',
                ),
                ('Channels', joinChannelLabels(s.orderedChannels), null),
                ('Message', s.title.trim(), null),
                (
                  'When',
                  s.isScheduled ? commDateTime(s.scheduledAt) : 'Now',
                  null,
                ),
                (
                  'Uses',
                  p == null ? '—' : usesLine(p, s.orderedChannels),
                  null,
                ),
              ],
            ),
            if (s.needsConfirm) ...[
              const SizedBox(height: 12),
              CommNotice(
                text: 'More than ${p?.largeSendThreshold ?? kCommLargeSend} '
                    'people. Tick the box below to confirm.',
                icon: Icons.warning_amber_rounded,
              ),
              const SizedBox(height: 8),
              _ConfirmBox(
                checked: s.confirmed,
                error: errors['confirm'] != null,
                onChanged: cubit.setConfirmed,
              ),
              if (errors['confirm'] != null) InlineError(errors['confirm']!),
            ],
            const SizedBox(height: 14),
            _ScheduleField(
              at: s.scheduledAt,
              error: errors['schedule'],
              clock: clock ?? DateTime.now,
              onChanged: cubit.setSchedule,
            ),
          ],
        );
      },
    );
  }
}

class _BannerView extends StatelessWidget {
  const _BannerView({required this.state});

  final SendFlowState state;

  @override
  Widget build(BuildContext context) {
    final kind = state.bannerKind;
    final message = state.banner!;
    if (kind == CommFailureKind.confirmationRequired) {
      return CommNotice(text: message, icon: Icons.warning_amber_rounded);
    }
    if (kind == CommFailureKind.network) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FormAlert(message: message),
          const SizedBox(height: 6),
          Text(
            'Your message is still here. Tap Send again — it will not be '
            'sent twice.',
            style: AppText.body(
              size: 12,
              weight: FontWeight.w600,
              color: AppColors.inkFaint,
            ),
          ),
        ],
      );
    }
    return FormAlert(message: message);
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.rows});

  final List<(String, String, String?)> rows;

  @override
  Widget build(BuildContext context) {
    return CommCard(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                border: i == 0
                    ? null
                    : Border(top: BorderSide(color: AppColors.line)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 78,
                    child: Text(
                      rows[i].$1,
                      style: AppText.body(
                        size: 13.5,
                        weight: FontWeight.w600,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          rows[i].$2,
                          textAlign: TextAlign.right,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 13.5,
                            weight: FontWeight.w800,
                          ),
                        ),
                        if (rows[i].$3 != null)
                          Text(
                            rows[i].$3!,
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w600,
                              color: AppColors.inkFaint,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _ConfirmBox extends StatelessWidget {
  const _ConfirmBox({
    required this.checked,
    required this.error,
    required this.onChanged,
  });

  final bool checked;
  final bool error;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return CommPress(
      onTap: () => onChanged(!checked),
      selected: checked,
      scale: 0.98,
      semanticLabel: 'I checked the audience and message',
      child: Container(
        constraints: const BoxConstraints(minHeight: 48),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: checked ? kCommBrand : AppColors.surface2,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: checked
                ? kCommBrand
                : error
                    ? AppColors.danger
                    : AppColors.line,
          ),
        ),
        child: Row(
          children: [
            Icon(
              checked
                  ? Icons.check_circle_rounded
                  : Icons.radio_button_unchecked_rounded,
              size: 20,
              color: checked ? Colors.white : AppColors.inkFaint,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'I checked the audience and message',
                style: AppText.body(
                  size: 13.5,
                  weight: FontWeight.w700,
                  color: checked ? Colors.white : AppColors.ink,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ScheduleField extends StatelessWidget {
  const _ScheduleField({
    required this.at,
    required this.error,
    required this.clock,
    required this.onChanged,
  });

  final DateTime? at;
  final String? error;
  final DateTime Function() clock;
  final ValueChanged<DateTime?> onChanged;

  Future<void> _pick(BuildContext context) async {
    final now = clock();
    final first = DateTime(now.year, now.month, now.day);
    final last = now.add(const Duration(days: kCommMaxScheduleDays));
    final start = at ?? now.add(const Duration(hours: 1));
    final date = await showDatePicker(
      context: context,
      initialDate: start.isBefore(first)
          ? first
          : start.isAfter(last)
              ? last
              : start,
      firstDate: first,
      lastDate: last,
      helpText: 'Send on',
    );
    if (date == null || !context.mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(start),
      helpText: 'Send at',
    );
    if (time == null) return;
    onChanged(
      DateTime(date.year, date.month, date.day, time.hour, time.minute),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const FieldLabel('Schedule instead'),
        CommPress(
          onTap: () => _pick(context),
          semanticLabel: at == null
              ? 'Schedule instead. Choose date and time.'
              : 'Scheduled for ${commDateTime(at)}. Tap to change.',
          child: Container(
            constraints: const BoxConstraints(minHeight: 46),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: error != null
                    ? AppColors.danger
                    : at != null
                        ? kCommBrand
                        : AppColors.line,
                width: at != null ? 1.5 : 1,
              ),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.event_outlined,
                  size: 18,
                  color: at != null ? kCommBrand : AppColors.inkFaint,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    at == null ? 'Choose date and time' : commDateTime(at),
                    style: AppText.body(
                      size: 14,
                      weight: FontWeight.w600,
                      color: at == null ? AppColors.inkFaint : AppColors.ink,
                    ),
                  ),
                ),
                if (at != null)
                  CommPress(
                    onTap: () => onChanged(null),
                    semanticLabel: 'Send now instead',
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Icon(
                        Icons.close_rounded,
                        size: 18,
                        color: AppColors.inkSoft,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (error != null) InlineError(error!),
      ],
    );
  }
}
