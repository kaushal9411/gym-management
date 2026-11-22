import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/hr/leave_apply_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/app_clock.dart';
import '../../../models/hr_attendance.dart';
import '../../../models/hr_enums.dart';
import '../../../models/hr_leave.dart';
import '../../../repositories/hr_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../../shared/widgets/motion.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'hr_palette.dart';
import 'widgets/hr_ui.dart';
import 'widgets/hr_widgets.dart';

/// Route argument: apply for someone else (HR, `hr:leave_manage`).
class HrApplyLeaveArgs {
  const HrApplyLeaveArgs({this.onBehalfOf});

  final HrEmployeeRef? onBehalfOf;
}

/// **Apply leave** - the leave type, a day-part (Full day / Half day morning /
/// Half day evening), the dates, a live days-and-balance preview, a reason.
///
/// The preview is the server's (`POST /hr/me/leaves/preview`, or
/// `/hr/leaves/preview` for HR): it already excludes weekly offs and holidays
/// and checks the balance, so the phone never re-implements calendar rules.
/// Submitting pops `true` so the caller refreshes. With [HrApplyLeaveArgs.
/// onBehalfOf] the same form files the request for that employee (`POST
/// /hr/leaves`), with an "Approve immediately" switch (auto-approve; the API
/// refuses it for one's own id).
class ApplyLeaveScreen extends StatelessWidget {
  const ApplyLeaveScreen({super.key, this.args = const HrApplyLeaveArgs()});

  final HrApplyLeaveArgs args;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<LeaveApplyCubit>(
      create: (_) => LeaveApplyCubit(
        getIt<HrRepository>(),
        today: AppClock.today,
        onBehalfOf: args.onBehalfOf,
      )..init(),
      child: _ApplyView(onBehalfOf: args.onBehalfOf),
    );
  }
}

class _ApplyView extends StatefulWidget {
  const _ApplyView({this.onBehalfOf});

  final HrEmployeeRef? onBehalfOf;

  @override
  State<_ApplyView> createState() => _ApplyViewState();
}

class _ApplyViewState extends State<_ApplyView> {
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit(LeaveApplyCubit cubit) async {
    final r = await cubit.submit();
    if (!mounted) return;
    if (r != null) {
      HapticFeedback.mediumImpact();
      hrSnack(
        context,
        r.status == LeaveStatus.approved
            ? 'Leave approved'
            : 'Leave request sent for approval',
      );
      context.pop(true);
    } else if (cubit.state.submitError != null) {
      HapticFeedback.heavyImpact();
    }
  }

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<LeaveApplyCubit>();
    final top = MediaQuery.of(context).padding.top;
    final inset = teamSideInset(context, maxWidth: 840);
    final who = widget.onBehalfOf;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: BlocBuilder<LeaveApplyCubit, LeaveApplyState>(
        builder: (context, s) {
          final errors = s.showErrors ? cubit.errors : const LeaveFormErrors();
          final type = s.selectedType;
          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: ListHero(
                  title: who == null ? 'Apply leave' : 'Apply for ${who.name}',
                  subtitle: who == null
                      ? 'Choose the type, the dates and the part of the day'
                      : 'HR request on ${who.name}\'s behalf',
                  topInset: top,
                  side: 18 + inset,
                  leading: ListHeroButton(
                    icon: Icons.arrow_back_rounded,
                    onTap: () => context.pop(),
                  ),
                  chips: [
                    if (s.preview != null)
                      ListHeroChip(
                        icon: Icons.timelapse_rounded,
                        label: '${hrDays(s.preview!.days)} '
                            '${s.preview!.days == 1 ? 'day' : 'days'}',
                      ),
                    if (type != null)
                      ListHeroChip(
                        icon: Icons.label_rounded,
                        label: type.name,
                      ),
                  ],
                ),
              ),
              SliverPadding(
                padding: EdgeInsets.fromLTRB(18 + inset, 16, 18 + inset, 40),
                sliver: SliverList.list(
                  children: [
                    if (s.loadingTypes)
                      const HrSkeletonList(count: 3, height: 80)
                    else if (s.typesError != null)
                      AppErrorView(message: s.typesError!, onRetry: cubit.init)
                    else if (s.types.isEmpty)
                      const AppEmptyState(
                        title: 'No leave types',
                        message: 'HR has not set up any leave types yet.',
                        icon: Icons.beach_access_outlined,
                      )
                    else ...[
                      StaggeredReveal(
                        child: _Step(
                          number: 1,
                          title: 'Leave type',
                          error: errors.type,
                          child: _TypePicker(
                            types: s.types,
                            selected: s.leaveTypeId,
                            onPick: cubit.setType,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      StaggeredReveal(
                        index: 1,
                        child: _Step(
                          number: 2,
                          title: 'Which part of the day',
                          child: _DayPartPicker(
                            selected: s.dayPart,
                            onPick: cubit.setDayPart,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      StaggeredReveal(
                        index: 2,
                        child: _Step(
                          number: 3,
                          title: s.dayPart.isHalf ? 'Date' : 'Dates',
                          error: errors.dates,
                          child: _Dates(
                            start: s.start,
                            end: s.end,
                            half: s.dayPart.isHalf,
                            onChanged: cubit.setDates,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      StaggeredReveal(
                        index: 3,
                        child: _PreviewCard(
                          state: s,
                          color: HrPalette.leaveType(
                            type?.colorHex ?? '',
                          ),
                          balanceError: errors.balance,
                        ),
                      ),
                      const SizedBox(height: 16),
                      StaggeredReveal(
                        index: 4,
                        child: _Step(
                          number: 4,
                          title: 'Reason',
                          error: errors.reason,
                          child: AppLabeledField(
                            label: 'Why do you need leave?',
                            controller: _reason,
                            hintText: 'e.g. Family function',
                            minLines: 3,
                            maxLines: 5,
                            textCapitalization: TextCapitalization.sentences,
                            onChanged: cubit.setReason,
                          ),
                        ),
                      ),
                      if (who != null) ...[
                        const SizedBox(height: 14),
                        TeamToggleRow(
                          title: 'Approve immediately',
                          subtitle:
                              'File and approve in one step - attendance is '
                              'marked and ${who.name.split(' ').first} is '
                              'notified',
                          value: s.autoApprove,
                          onChanged: cubit.setAutoApprove,
                        ),
                      ],
                      if (s.submitError != null) ...[
                        const SizedBox(height: 14),
                        FormAlert(message: s.submitError!),
                      ],
                      const SizedBox(height: 18),
                      TeamGradientButton(
                        label: who != null && s.autoApprove
                            ? 'Apply & approve'
                            : 'Submit request',
                        icon: Icons.send_rounded,
                        loading: s.submitting,
                        onTap: () => _submit(cubit),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({
    required this.number,
    required this.title,
    required this.child,
    this.error,
  });

  final int number;
  final String title;
  final Widget child;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 22,
              height: 22,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                gradient: AppColors.staffGrad,
                shape: BoxShape.circle,
              ),
              child: Text(
                '$number',
                style: AppText.body(
                  size: 11,
                  weight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(title, style: AppText.display(size: 15)),
          ],
        ),
        const SizedBox(height: 10),
        child,
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  size: 14,
                  color: AppColors.danger,
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    error!,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w700,
                      color: AppColors.danger,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _TypePicker extends StatelessWidget {
  const _TypePicker({
    required this.types,
    required this.selected,
    required this.onPick,
  });

  final List<HrLeaveType> types;
  final String? selected;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (final t in types)
          _TypeChip(
            type: t,
            selected: t.id == selected,
            onTap: () {
              HapticFeedback.selectionClick();
              onPick(t.id);
            },
          ),
      ],
    );
  }
}

class _TypeChip extends StatelessWidget {
  const _TypeChip({
    required this.type,
    required this.selected,
    required this.onTap,
  });

  final HrLeaveType type;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = HrPalette.leaveType(type.colorHex);
    return Semantics(
      button: true,
      selected: selected,
      label: '${type.name}${type.isPaid ? '' : ', unpaid'}',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: selected ? c.withValues(alpha: 0.2) : AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected ? c : AppColors.line,
              width: selected ? 1.8 : 1,
            ),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: c.withValues(alpha: 0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(color: c, shape: BoxShape.circle),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    type.name,
                    style: AppText.body(size: 13, weight: FontWeight.w800),
                  ),
                  Text(
                    type.yearlyQuota == null
                        ? 'Unlimited${type.isPaid ? '' : ' · unpaid'}'
                        : '${hrDays(type.yearlyQuota!)} days/yr'
                            '${type.isPaid ? '' : ' · unpaid'}',
                    style: AppText.body(
                      size: 10.5,
                      weight: FontWeight.w700,
                      color: AppColors.inkFaint,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DayPartPicker extends StatelessWidget {
  const _DayPartPicker({required this.selected, required this.onPick});

  final DayPart selected;
  final ValueChanged<DayPart> onPick;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < DayPart.values.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: _PartChip(
              part: DayPart.values[i],
              selected: DayPart.values[i] == selected,
              onTap: () {
                HapticFeedback.selectionClick();
                onPick(DayPart.values[i]);
              },
            ),
          ),
        ],
      ],
    );
  }
}

class _PartChip extends StatelessWidget {
  const _PartChip({
    required this.part,
    required this.selected,
    required this.onTap,
  });

  final DayPart part;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    const c = HrPalette.onLeave;
    return Semantics(
      button: true,
      selected: selected,
      label: part.label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
          decoration: BoxDecoration(
            gradient: selected
                ? const LinearGradient(
                    colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                  )
                : null,
            color: selected ? null : AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected ? c : AppColors.line,
            ),
          ),
          child: Column(
            children: [
              Icon(
                HrPalette.dayPart(part),
                size: 20,
                color: selected ? Colors.white : AppColors.inkSoft,
              ),
              const SizedBox(height: 4),
              Text(
                switch (part) {
                  DayPart.fullDay => 'Full day',
                  DayPart.halfMorning => 'Half day',
                  DayPart.halfEvening => 'Half day',
                },
                textAlign: TextAlign.center,
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w800,
                  color: selected ? Colors.white : null,
                ),
              ),
              Text(
                switch (part) {
                  DayPart.fullDay => 'whole day',
                  DayPart.halfMorning => 'morning',
                  DayPart.halfEvening => 'evening',
                },
                style: AppText.body(
                  size: 10.5,
                  weight: FontWeight.w700,
                  color: selected
                      ? Colors.white.withValues(alpha: 0.85)
                      : AppColors.inkFaint,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Dates extends StatelessWidget {
  const _Dates({
    required this.start,
    required this.end,
    required this.half,
    required this.onChanged,
  });

  final DateTime? start;
  final DateTime? end;
  final bool half;
  final void Function(DateTime start, DateTime end) onChanged;

  @override
  Widget build(BuildContext context) {
    final today = AppClock.today();
    final first = today.subtract(const Duration(days: 90));
    final last = today.add(const Duration(days: 366));
    Widget from() => TeamDateField(
          label: half ? 'Date' : 'From',
          icon: Icons.event_rounded,
          iconColor: HrPalette.onLeave,
          value: start,
          clearable: false,
          firstDate: first,
          lastDate: last,
          onChanged: (d) {
            if (d == null) return;
            onChanged(d, end ?? d);
          },
        );
    Widget to() => TeamDateField(
          label: 'To',
          icon: Icons.event_available_rounded,
          iconColor: HrPalette.onLeave,
          value: end,
          clearable: false,
          firstDate: start ?? first,
          lastDate: last,
          onChanged: (d) {
            if (d == null) return;
            onChanged(start ?? d, d);
          },
        );
    if (half) return from();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: from()),
        const SizedBox(width: 10),
        Expanded(child: to()),
      ],
    );
  }
}

/// Live "N days · balance" card driven by the server preview.
class _PreviewCard extends StatelessWidget {
  const _PreviewCard({
    required this.state,
    required this.color,
    this.balanceError,
  });

  final LeaveApplyState state;
  final Color color;
  final String? balanceError;

  @override
  Widget build(BuildContext context) {
    final p = state.preview;
    final loading = state.previewLoading;
    final bad = (p != null && !p.sufficient) || balanceError != null;
    final tone = bad ? AppColors.danger : color;
    final remaining =
        p?.available == null || p == null ? null : p.available! - p.days;

    Widget body;
    if (state.previewError != null) {
      body = Row(
        children: [
          const Icon(Icons.info_outline_rounded, color: AppColors.danger),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              state.previewError!,
              style: AppText.body(
                size: 13,
                weight: FontWeight.w700,
                color: AppColors.danger,
              ),
            ),
          ),
        ],
      );
    } else if (p == null) {
      body = loading
          ? const HrShimmerBox(height: 56, radius: 14)
          : Text(
              'Pick the dates to see how many leave days this uses.',
              style: AppText.body(color: AppColors.inkFaint, size: 13),
            );
    } else {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              TweenAnimationBuilder<double>(
                key: ValueKey(p.days),
                tween: Tween(begin: 0, end: p.days),
                duration: reduceMotion(context)
                    ? Duration.zero
                    : const Duration(milliseconds: 600),
                curve: Curves.easeOutCubic,
                builder: (context, v, _) => Text(
                  hrDays(double.parse(v.toStringAsFixed(1))),
                  style: AppText.display(size: 38, color: tone),
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(bottom: 7),
                child: Text(
                  p.days == 1 ? 'working day' : 'working days',
                  style: AppText.body(
                    size: 13,
                    weight: FontWeight.w800,
                    color: AppColors.inkSoft,
                  ),
                ),
              ),
              const Spacer(),
              if (p.available != null)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${hrDays(p.available!)} available',
                      style: AppText.body(
                        size: 12,
                        weight: FontWeight.w800,
                        color: AppColors.inkSoft,
                      ),
                    ),
                    Text(
                      remaining! >= 0
                          ? '${hrDays(remaining)} left after'
                          : 'Short by ${hrDays(-remaining)}',
                      style: AppText.body(
                        size: 11.5,
                        weight: FontWeight.w800,
                        color: remaining >= 0 ? AppColors.success : tone,
                      ),
                    ),
                  ],
                )
              else
                Text(
                  'Unlimited balance',
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w800,
                    color: AppColors.inkSoft,
                  ),
                ),
            ],
          ),
          if (p.excluded.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Not counted',
              style: AppText.body(
                size: 11,
                weight: FontWeight.w800,
                color: AppColors.inkFaint,
              ),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final e in p.excluded.take(10))
                  HrChip(
                    label: '${hrDate(e.date)} · '
                        '${e.reason == 'HOLIDAY' ? (e.name ?? 'Holiday') : 'Weekly off'}',
                    color: e.reason == 'HOLIDAY'
                        ? HrPalette.holiday
                        : HrPalette.weeklyOff,
                    icon: e.reason == 'HOLIDAY'
                        ? Icons.celebration_rounded
                        : Icons.bedtime_rounded,
                    dense: true,
                  ),
                if (p.excluded.length > 10)
                  HrChip(
                    label: '+${p.excluded.length - 10} more',
                    color: AppColors.inkSoft,
                    dense: true,
                  ),
              ],
            ),
          ],
          if (bad)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(
                balanceError ?? 'Not enough leave balance for these dates.',
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w800,
                  color: AppColors.danger,
                ),
              ),
            ),
        ],
      );
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [tone.withValues(alpha: 0.18), tone.withValues(alpha: 0.04)],
        ),
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: tone.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.auto_graph_rounded, size: 16, color: tone),
              const SizedBox(width: 6),
              Text('LIVE PREVIEW', style: AppText.eyebrow(color: tone)),
              if (loading && p != null) ...[
                const SizedBox(width: 8),
                SizedBox(
                  width: 11,
                  height: 11,
                  child: CircularProgressIndicator(
                    strokeWidth: 1.8,
                    color: tone,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          AnimatedSize(
            duration: const Duration(milliseconds: 250),
            alignment: Alignment.topCenter,
            child: body,
          ),
        ],
      ),
    );
  }
}
