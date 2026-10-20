import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/communications/send_flow_cubit.dart';
import '../../../../bloc/communications/send_flow_state.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/count_format.dart';
import '../../../../models/comm_audience.dart';
import '../../../../models/comm_automation.dart' show disabledReasonText;
import '../../../../models/comm_channel.dart';
import '../../../../shared/widgets/motion.dart';
import '../../comm_constants.dart';
import '../../comm_logic.dart';
import '../widgets/comm_widgets.dart';
import 'send_ui.dart';

/// Step 3 — "Where should it go?" (design frame 4).
///
/// Five channel rows, each with its colour dot, a monthly-allowance line and a
/// meter. Everything comes from the live audience preview: `quota.remaining`,
/// `quota.wouldUse` (what this send would take), `over` / `shortBy`,
/// `enabled`. A selected channel that would not fit turns **red** and says
/// "Only 240 left, you need 412"; a channel the plan or gym has switched off
/// is locked with the reason. Selected rows also say how many members will
/// actually receive it (and how many opted out / have no contact), and SMS
/// shows its character and segment count.
///
/// Next is blocked while a chosen channel is over its limit or off, nobody
/// can receive the message, or the text is too long for SMS. Quiet-hours and
/// WhatsApp caveats from the API are shown when those channels are chosen.
class ChannelsStep extends StatelessWidget {
  const ChannelsStep({super.key});

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<SendFlowCubit>();
    return BlocBuilder<SendFlowCubit, SendFlowState>(
      builder: (context, s) {
        final p = s.preview;
        final attempted = s.attempted.contains(kStepChannels);
        final Map<String, String> errors =
            attempted ? cubit.errorsFor(kStepChannels) : <String, String>{};
        final over = [
          for (final c in s.orderedChannels)
            if ((p != null && channelBlockReason(p, c) != null) ||
                s.serverBlocked.containsKey(c))
              c,
        ];
        final usesQuiet = s.channels.contains(CommChannel.sms) ||
            s.channels.contains(CommChannel.whatsapp);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const StepHeading(
              title: 'Where should it go?',
              hint: "Each member uses one message from that channel's "
                  'monthly limit.',
            ),
            if (p == null && s.previewError != null) ...[
              CommNotice(
                text: s.previewError!,
                tone: CommTone.bad,
                icon: Icons.error_outline_rounded,
                actionLabel: 'Retry',
                onAction: cubit.refreshPreview,
              ),
              const SizedBox(height: 10),
            ],
            for (final c in CommChannel.values)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _ChannelRow(
                  channel: c,
                  selected: s.channels.contains(c),
                  audience: p?.forChannel(c),
                  total: p?.total ?? 0,
                  loading: p == null && s.previewError == null,
                  blockReason: s.channels.contains(c)
                      ? (p == null ? null : channelBlockReason(p, c)) ??
                          s.serverBlocked[c]
                      : null,
                  onTap: () {
                    final a = p?.forChannel(c);
                    if (!s.channels.contains(c) &&
                        a != null &&
                        !a.quota.enabled) {
                      ScaffoldMessenger.of(context)
                        ..hideCurrentSnackBar()
                        ..showSnackBar(
                          SnackBar(
                            behavior: SnackBarBehavior.floating,
                            content: Text(
                              '${c.label} is ${disabledReasonText(a.quota.disabledReason)}.',
                            ),
                          ),
                        );
                      return;
                    }
                    cubit.toggleChannel(c);
                  },
                ),
              ),
            if (over.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 2, bottom: 8),
                child: CommNotice(
                  text:
                      '${joinChannelLabels(over)} would go over the limit. Turn '
                      '${over.length == 1 ? 'it' : 'them'} off or narrow the '
                      'audience.',
                  icon: Icons.warning_amber_rounded,
                ),
              ),
            if (errors['channels'] != null && over.isEmpty)
              InlineError(errors['channels']!),
            if (errors['reach'] != null) InlineError(errors['reach']!),
            if (s.usesSms && p?.sms != null) ...[
              const SizedBox(height: 4),
              _Info(
                icon: Icons.sms_outlined,
                color: kSmsColor,
                text: 'SMS text: ${groupDigits(p!.sms!.characters)} '
                    'characters, ${p.sms!.segments} '
                    '${p.sms!.segments == 1 ? 'segment' : 'segments'} '
                    '(${p.sms!.encoding}).',
              ),
            ],
            if (errors['sms'] != null) InlineError(errors['sms']!),
            if (usesQuiet) ...[
              const SizedBox(height: 6),
              const _Info(
                icon: Icons.bedtime_outlined,
                color: kSmsColor,
                text: kCommQuietNote,
              ),
            ],
            if (s.channels.contains(CommChannel.whatsapp)) ...[
              const SizedBox(height: 6),
              const _Info(
                icon: Icons.info_outline_rounded,
                color: kWhatsAppColor,
                text: kCommWhatsAppNote,
              ),
            ],
          ],
        );
      },
    );
  }
}

class _Info extends StatelessWidget {
  const _Info({required this.icon, required this.color, required this.text});

  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 1),
          child: Icon(icon, size: 15, color: color),
        ),
        const SizedBox(width: 7),
        Expanded(
          child: Text(
            text,
            style: AppText.body(
              size: 12,
              weight: FontWeight.w600,
              color: AppColors.inkSoft,
            ),
          ),
        ),
      ],
    );
  }
}

class _ChannelRow extends StatelessWidget {
  const _ChannelRow({
    required this.channel,
    required this.selected,
    required this.audience,
    required this.total,
    required this.loading,
    required this.blockReason,
    required this.onTap,
  });

  final CommChannel channel;
  final bool selected;
  final ChannelAudience? audience;
  final int total;
  final bool loading;

  /// Set when the channel is selected but cannot be used (over limit / off).
  final String? blockReason;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = channel;
    final q = audience?.quota;
    final short = selected && blockReason != null;
    final disabled = q != null && !q.enabled;
    final color = c.color;

    String line;
    if (loading) {
      line = 'Checking your allowance…';
    } else if (short) {
      line = q != null && q.enabled
          ? 'Only ${groupDigits(q.remaining ?? 0)} left, you need '
              '${groupDigits(q.wouldUse)}'
          : blockReason!;
    } else if (disabled) {
      line = 'Not available: ${disabledReasonText(q.disabledReason)}';
    } else if (q == null || q.limit == null) {
      line = c.freeNote;
    } else {
      line = '${groupDigits(q.remaining ?? 0)} left this month';
    }

    var fraction = 0.06;
    if (q != null && q.limit != null && q.limit! > 0) {
      fraction = (q.used + (selected ? q.wouldUse : 0)) / q.limit!;
    }

    final a = audience;
    String? reach;
    if (selected && a != null && !short) {
      final noContact = (total - a.contactable).clamp(0, total);
      final parts = <String>[
        '${groupDigits(a.willReceive)} will receive',
        if (a.optedOut > 0) '${groupDigits(a.optedOut)} opted out',
        if (noContact > 0) '${groupDigits(noContact)} no contact',
      ];
      reach = parts.join(' · ');
    }

    final reduce = reduceMotion(context);
    return CommPress(
      onTap: onTap,
      selected: selected,
      scale: 0.98,
      semanticLabel: '${c.label}. $line',
      child: AnimatedContainer(
        duration: reduce ? Duration.zero : const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: short
              ? AppColors.dangerSoft
              : selected
                  ? color.withValues(alpha: 0.10)
                  : AppColors.surface2,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: short
                ? AppColors.danger
                : selected
                    ? color
                    : AppColors.line,
            width: 1.5,
          ),
        ),
        child: Opacity(
          opacity: disabled && !selected ? 0.55 : 1,
          child: Row(
            children: [
              ChannelDot(channel: c),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      c.label,
                      style: AppText.body(size: 14, weight: FontWeight.w800),
                    ),
                    Text(
                      line,
                      style: AppText.body(
                        size: 12,
                        weight: short ? FontWeight.w800 : FontWeight.w600,
                        color: short ? AppColors.danger : AppColors.inkFaint,
                      ),
                    ),
                    if (reach != null)
                      Text(
                        reach,
                        style: AppText.body(
                          size: 11.5,
                          weight: FontWeight.w600,
                          color: AppColors.inkSoft,
                        ),
                      ),
                    const SizedBox(height: 6),
                    CommMeter(
                      fraction: fraction,
                      color: short ? AppColors.danger : color,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              ExcludeSemantics(
                child: IgnorePointer(
                  child: CommSwitch(value: selected, onChanged: (_) {}),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
