import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/communications/send_flow_cubit.dart';
import '../../../../bloc/communications/send_flow_state.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/count_format.dart';
import '../../../../models/comm_audience.dart';
import '../../comm_constants.dart';
import '../../comm_logic.dart';
import '../widgets/comm_widgets.dart';
import 'member_picker.dart';
import 'send_ui.dart';

/// Step 1 — "Who should get it?" (design frame 2).
///
/// A segmented control switches between **By filters** (membership status,
/// plan, branch, overdue / not visited / birthday — AND-combined, the count
/// updates as you tap) and **Pick members** (search + select, see
/// [MemberPicker]). Below, an "Includes" card lists real sample names from the
/// audience preview. Errors: no one matches / nobody picked / over 5,000, a
/// failed count (with Retry), and the server's own audience errors.
///
/// Plan and branch chips come from the viewer's own `membership-plans` /
/// `branches` access ([AudienceLookups]); the Communications API has no lookup
/// of its own, so a group is hidden when its list cannot be read.
class AudienceStep extends StatelessWidget {
  const AudienceStep({super.key, required this.lookups});

  final AudienceLookups lookups;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<SendFlowCubit>();
    return BlocBuilder<SendFlowCubit, SendFlowState>(
      builder: (context, s) {
        final errors = s.attempted.contains(kStepAudience)
            ? cubit.errorsFor(kStepAudience)
            : const <String, String>{};
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            StepHeading(
              title: 'Who should get it?',
              hint: s.mode == AudienceMode.filters
                  ? 'Filters combine. Each one narrows the list.'
                  : 'Tap members to pick them. Search to find someone.',
            ),
            _Segmented(
              mode: s.mode,
              onChanged: cubit.setMode,
            ),
            if (s.mode == AudienceMode.filters)
              _Filters(
                filter: s.filter,
                lookups: lookups,
                onChanged: cubit.setFilter,
              )
            else
              const MemberPicker(),
            CommSectionLabel(
              s.mode == AudienceMode.picked ? 'Picked' : 'Includes',
            ),
            _Includes(state: s, onRetry: cubit.refreshPreview),
            if (errors['audience'] != null) InlineError(errors['audience']!),
          ],
        );
      },
    );
  }
}

class _Segmented extends StatelessWidget {
  const _Segmented({required this.mode, required this.onChanged});

  final AudienceMode mode;
  final ValueChanged<AudienceMode> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget tab(AudienceMode m, String label) {
      final selected = mode == m;
      return Expanded(
        child: CommPress(
          onTap: () => onChanged(m),
          selected: selected,
          semanticLabel: label,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            constraints: const BoxConstraints(minHeight: 40),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? kCommBrand : Colors.transparent,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Text(
              label,
              style: AppText.body(
                size: 13,
                weight: FontWeight.w800,
                color: selected ? Colors.white : AppColors.inkFaint,
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          tab(AudienceMode.filters, 'By filters'),
          tab(AudienceMode.picked, 'Pick members'),
        ],
      ),
    );
  }
}

class _Filters extends StatelessWidget {
  const _Filters({
    required this.filter,
    required this.lookups,
    required this.onChanged,
  });

  final AudienceFilter filter;
  final AudienceLookups lookups;
  final ValueChanged<AudienceFilter> onChanged;

  @override
  Widget build(BuildContext context) {
    final plans = lookups.plans ?? const <LookupItem>[];
    final branches = lookups.branches ?? const <LookupItem>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Group(
          label: 'Membership',
          chips: [
            CommChip(
              label: 'Expiring in 7 days',
              selected: filter.membershipStatus == kAudienceStatusExpiring,
              onTap: () =>
                  onChanged(filter.withStatus(kAudienceStatusExpiring)),
            ),
            CommChip(
              label: 'Expired',
              selected: filter.membershipStatus == kAudienceStatusExpired,
              onTap: () => onChanged(filter.withStatus(kAudienceStatusExpired)),
            ),
            CommChip(
              label: 'Frozen',
              selected: filter.membershipStatus == kAudienceStatusFrozen,
              onTap: () => onChanged(filter.withStatus(kAudienceStatusFrozen)),
            ),
          ],
        ),
        if (plans.isNotEmpty)
          _Group(
            label: 'Plan',
            chips: [
              for (final p in plans)
                CommChip(
                  label: p.name,
                  selected: filter.planIds.contains(p.id),
                  onTap: () => onChanged(filter.togglePlan(p.id)),
                ),
            ],
          ),
        if (branches.length > 1)
          _Group(
            label: 'Branch',
            chips: [
              for (final b in branches)
                CommChip(
                  label: b.name,
                  selected: filter.branchIds.contains(b.id),
                  onTap: () => onChanged(filter.toggleBranch(b.id)),
                ),
            ],
          ),
        _Group(
          label: 'Payment and activity',
          chips: [
            CommChip(
              label: 'Overdue invoice',
              selected: filter.hasOverdueInvoice,
              onTap: () => onChanged(filter.toggleOverdue()),
            ),
            CommChip(
              label: 'Not visited 14 days',
              selected: filter.notVisitedDays == 14,
              onTap: () => onChanged(filter.toggleNotVisited(14)),
            ),
            CommChip(
              label: 'Birthday this week',
              selected: filter.birthdayThisWeek,
              onTap: () => onChanged(filter.toggleBirthday()),
            ),
          ],
        ),
      ],
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({required this.label, required this.chips});

  final String label;
  final List<Widget> chips;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(
              label.toUpperCase(),
              style: AppText.body(
                size: 10.5,
                weight: FontWeight.w800,
                color: AppColors.inkFaint,
              ).copyWith(letterSpacing: 0.6),
            ),
          ),
          Wrap(spacing: 6, runSpacing: 6, children: chips),
        ],
      ),
    );
  }
}

/// The "Includes" card: sample names, or why there are none.
class _Includes extends StatelessWidget {
  const _Includes({required this.state, required this.onRetry});

  final SendFlowState state;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final s = state;
    final p = s.preview;
    Widget content;
    if (s.previewError != null && p == null) {
      return CommNotice(
        text: s.previewError!,
        tone: CommTone.bad,
        icon: Icons.error_outline_rounded,
        actionLabel: 'Retry',
        onAction: onRetry,
      );
    } else if (p == null) {
      if (s.mode == AudienceMode.picked && s.picked.isEmpty) {
        content = _text('Nobody picked yet. Tap members above.');
      } else {
        content = const CommSkeleton(height: 16, radius: 6);
      }
    } else if (p.total == 0) {
      content = _text(
        s.mode == AudienceMode.picked
            ? 'Nobody picked yet. Tap members above.'
            : 'No members match. Remove a filter.',
      );
    } else {
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _text(p.sampleLine ?? '${groupDigits(p.total)} members'),
          if (p.exceedsMax) ...[
            const SizedBox(height: 8),
            CommNotice(
              text: 'More than ${groupDigits(p.maxRecipients)} members. '
                  'Narrow the audience to continue.',
              tone: CommTone.bad,
              icon: Icons.error_outline_rounded,
            ),
          ],
        ],
      );
    }
    return CommCard(
      radius: 16,
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
      child: AnimatedSize(
        duration: const Duration(milliseconds: 180),
        alignment: Alignment.topCenter,
        child: content,
      ),
    );
  }

  Widget _text(String t) => Text(
        t,
        style: AppText.body(
          size: 12.5,
          weight: FontWeight.w600,
          color: AppColors.inkSoft,
        ),
      );
}
