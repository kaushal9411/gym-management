import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../bloc/communications/send_flow_cubit.dart';
import '../../../../bloc/communications/send_flow_state.dart';
import '../../../../bloc/session/session_cubit.dart';
import '../../../../bloc/session/session_state.dart';
import '../../../../core/di/service_locator.dart';
import '../../../../core/routing/app_routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/count_format.dart';
import '../../../../models/comm_audience.dart';
import '../../../../repositories/branch_repository.dart';
import '../../../../repositories/communications_repository.dart';
import '../../../../repositories/membership_plan_repository.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../team/presentation/widgets/team_ui.dart'
    show
        TeamBottomBar,
        TeamCenter,
        TeamGradientButton,
        TeamOutlineButton,
        confirmTeam,
        teamSnack;
import '../../comm_access.dart';
import '../../comm_constants.dart';
import '../../comm_logic.dart';
import 'audience_step.dart';
import 'channels_step.dart';
import 'message_step.dart';
import 'review_step.dart';
import 'send_ui.dart';

/// Optional input of the send flow: a member to start with (the "Send
/// message" action on the member screen).
class SendFlowArgs {
  const SendFlowArgs({this.member});

  /// Pre-selected member; opens the flow in "Pick members" mode with this one
  /// picked.
  final PickerMember? member;
}

/// The four-step send flow (design frames 2-5): **Audience -> Message ->
/// Channels -> Review**, with the step bar on top, one question per step and a
/// dock with the live member count / Back / Next. Logic lives in
/// [SendFlowCubit]; this widget is layout, navigation and the exit guard.
///
/// Needs `notifications:send` (without it the screen explains instead of
/// opening the flow). Leaving with a written message asks first
/// ("Discard this message?"), whether by the Back arrow or the system back
/// gesture; on a later step system-back goes to the previous step instead.
/// A successful send replaces the flow with the campaign's History detail.
class SendFlowScreen extends StatefulWidget {
  const SendFlowScreen({super.key, this.args, this.cubit});

  final SendFlowArgs? args;

  /// Test hook: supply a prepared cubit instead of building one.
  final SendFlowCubit? cubit;

  @override
  State<SendFlowScreen> createState() => _SendFlowScreenState();
}

class _SendFlowScreenState extends State<SendFlowScreen> {
  late final CommAccess _access;
  SendFlowCubit? _cubit;
  AudienceLookups _lookups = AudienceLookups.none;
  String _gymName = '';
  final _scroll = ScrollController();
  int _lastCount = 0;

  @override
  void initState() {
    super.initState();
    _access = CommAccess.of(context);
    final session = context.read<SessionCubit>().state;
    if (session is SessionAuthenticatedStaff) _gymName = session.tenant.name;
    if (_access.canSend) {
      _cubit = widget.cubit ??
          SendFlowCubit(
            getIt<CommunicationsRepository>(),
            seed: widget.args?.member,
          );
      unawaited(_loadLookups());
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    if (widget.cubit == null) _cubit?.close();
    super.dispose();
  }

  /// Plans and branches for the filter chips. Each is optional: a viewer who
  /// cannot read one simply does not get that filter group.
  Future<void> _loadLookups() async {
    List<LookupItem>? plans;
    List<LookupItem>? branches;
    try {
      final all = await getIt<MembershipPlanRepository>()
          .listAll(includeDeleted: false);
      plans = [
        for (final p in all)
          if (p.isActive) LookupItem(p.id, p.name),
      ];
    } catch (_) {
      plans = null;
    }
    try {
      final all = await getIt<BranchRepository>().assignable();
      branches = [for (final b in all) LookupItem(b.id, b.name)];
    } catch (_) {
      branches = null;
    }
    if (mounted) {
      setState(
        () => _lookups = AudienceLookups(plans: plans, branches: branches),
      );
    }
  }

  Future<bool> _confirmDiscard() => confirmTeam(
        context,
        title: 'Discard this message?',
        message: 'You have a message that has not been sent. If you leave '
            'now it will be lost.',
        confirmLabel: 'Discard',
        destructive: true,
      );

  Future<void> _leave() async {
    final cubit = _cubit!;
    final s = cubit.state;
    if (s.submitting) return;
    if (s.isDirty && s.sent == null && !await _confirmDiscard()) return;
    if (mounted) Navigator.of(context).pop();
  }

  void _onSent(SendFlowState s) {
    final c = s.sent!;
    final n = c.recipientCount;
    teamSnack(
      context,
      s.isScheduled
          ? 'Scheduled for ${commDateTime(s.scheduledAt)}'
          : 'Sending to ${groupDigits(n)} ${n == 1 ? 'member' : 'members'}',
    );
    context.pushReplacement(AppRoutes.communicationsHistoryDetail, extra: c.id);
  }

  @override
  Widget build(BuildContext context) {
    final cubit = _cubit;
    if (cubit == null) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: SafeArea(
          child: Column(
            children: [
              _Header(
                step: null,
                onBack: () => Navigator.of(context).maybePop(),
              ),
              const Expanded(
                child: AppEmptyState(
                  icon: Icons.lock_outline_rounded,
                  title: "You can't send messages",
                  message: CommAccess.sendReason,
                ),
              ),
            ],
          ),
        ),
      );
    }
    return BlocProvider<SendFlowCubit>.value(
      value: cubit,
      child: BlocConsumer<SendFlowCubit, SendFlowState>(
        listenWhen: (a, b) =>
            (a.sent == null && b.sent != null) || a.step != b.step,
        listener: (context, s) {
          if (s.sent != null) {
            _onSent(s);
          } else if (_scroll.hasClients) {
            _scroll.jumpTo(0);
          }
        },
        builder: (context, s) {
          final count = s.audienceCount;
          if (count != null) _lastCount = count;
          return PopScope(
            canPop: s.sent != null || (s.step == kStepAudience && !s.isDirty),
            onPopInvokedWithResult: (didPop, _) async {
              if (didPop || s.submitting) return;
              if (s.step > kStepAudience) {
                cubit.back();
                return;
              }
              await _leave();
            },
            child: Scaffold(
              backgroundColor: AppColors.bg,
              body: SafeArea(
                bottom: false,
                child: Column(
                  children: [
                    _Header(step: s.step, onBack: _leave),
                    Expanded(
                      child: SingleChildScrollView(
                        controller: _scroll,
                        physics: const AlwaysScrollableScrollPhysics(),
                        keyboardDismissBehavior:
                            ScrollViewKeyboardDismissBehavior.onDrag,
                        child: TeamCenter(
                          maxWidth: 720,
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                if (s.banner != null &&
                                    s.step != kStepReview) ...[
                                  FormAlert(message: s.banner!),
                                  const SizedBox(height: 12),
                                ],
                                AnimatedSwitcher(
                                  duration: reduceMotion(context)
                                      ? Duration.zero
                                      : const Duration(milliseconds: 220),
                                  transitionBuilder: (child, anim) =>
                                      FadeTransition(
                                    opacity: anim,
                                    child: SlideTransition(
                                      position: Tween(
                                        begin: const Offset(0.04, 0),
                                        end: Offset.zero,
                                      ).animate(anim),
                                      child: child,
                                    ),
                                  ),
                                  child: KeyedSubtree(
                                    key: ValueKey<int>(s.step),
                                    child: _stepBody(s.step),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    _Dock(
                      state: s,
                      lastCount: _lastCount,
                      onNext: cubit.next,
                      onBack: cubit.back,
                      onSend: cubit.submit,
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _stepBody(int step) => switch (step) {
        kStepAudience => AudienceStep(lookups: _lookups),
        kStepMessage => MessageStep(gymName: _gymName),
        kStepChannels => const ChannelsStep(),
        _ => ReviewStep(lookups: _lookups),
      };
}

class _Header extends StatelessWidget {
  const _Header({required this.step, required this.onBack});

  final int? step;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return TeamCenter(
      maxWidth: 720,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(6, 4, 16, 0),
        child: Column(
          children: [
            Row(
              children: [
                IconButton(
                  tooltip: 'Back',
                  onPressed: onBack,
                  icon: const Icon(Icons.arrow_back_rounded),
                ),
                Expanded(
                  child: Text(
                    'Send message',
                    style: AppText.display(size: 17),
                  ),
                ),
                if (step != null)
                  Text(
                    'Step ${step! + 1} of 4',
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w700,
                      color: AppColors.inkFaint,
                    ),
                  ),
              ],
            ),
            if (step != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 4, 0, 10),
                child: _StepBar(step: step!),
              ),
          ],
        ),
      ),
    );
  }
}

/// Four segments: done = brand, current = brand -> warm, upcoming = line.
class _StepBar extends StatelessWidget {
  const _StepBar({required this.step});

  final int step;

  @override
  Widget build(BuildContext context) {
    final reduce = reduceMotion(context);
    return Semantics(
      label: 'Step ${step + 1} of 4',
      child: Row(
        children: [
          for (var i = 0; i < 4; i++) ...[
            if (i > 0) const SizedBox(width: 5),
            Expanded(
              child: AnimatedContainer(
                duration:
                    reduce ? Duration.zero : const Duration(milliseconds: 250),
                height: 5,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(9),
                  color: i < step ? kCommBrand : AppColors.line,
                  gradient: i == step
                      ? const LinearGradient(colors: [kCommBrand, kCommWarm])
                      : null,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Dock extends StatelessWidget {
  const _Dock({
    required this.state,
    required this.lastCount,
    required this.onNext,
    required this.onBack,
    required this.onSend,
  });

  final SendFlowState state;
  final int lastCount;
  final bool Function() onNext;
  final VoidCallback onBack;
  final Future<void> Function() onSend;

  static const _nextLabels = {
    kStepAudience: 'Next: Message',
    kStepMessage: 'Next: Channels',
    kStepChannels: 'Next: Review',
  };

  @override
  Widget build(BuildContext context) {
    final s = state;
    final isReview = s.step == kStepReview;
    final count = s.audienceCount ?? lastCount;
    final counting = s.previewLoading && s.step == kStepAudience;
    final sendLabel = s.isScheduled
        ? 'Schedule for ${groupDigits(count)}'
        : 'Send to ${groupDigits(count)}';
    return TeamBottomBar(
      child: Row(
        children: [
          if (s.step == kStepAudience) ...[
            _Count(count: count, dim: counting),
            const SizedBox(width: 14),
          ] else ...[
            SizedBox(
              width: 92,
              child: TeamOutlineButton(
                label: 'Back',
                onTap: s.submitting ? null : onBack,
              ),
            ),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: TeamGradientButton(
              label: isReview ? sendLabel : _nextLabels[s.step]!,
              icon: isReview ? Icons.send_rounded : null,
              gradient: kCommGradient,
              loading: s.submitting,
              onTap: s.submitting || counting
                  ? null
                  : isReview
                      ? () => unawaited(onSend())
                      : () => onNext(),
            ),
          ),
        ],
      ),
    );
  }
}

/// The big member count in the dock; eases to a new number.
class _Count extends StatelessWidget {
  const _Count({required this.count, required this.dim});

  final int count;
  final bool dim;

  @override
  Widget build(BuildContext context) {
    final reduce = reduceMotion(context);
    return Semantics(
      liveRegion: true,
      label: '$count ${count == 1 ? 'member' : 'members'}',
      child: ExcludeSemantics(
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 150),
          opacity: dim ? 0.45 : 1,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TweenAnimationBuilder<double>(
                tween: Tween(end: count.toDouble()),
                duration:
                    reduce ? Duration.zero : const Duration(milliseconds: 450),
                curve: Curves.easeOutCubic,
                builder: (_, v, __) => Text(
                  groupDigits(v.round()),
                  style: AppText.display(size: 26, weight: FontWeight.w800)
                      .copyWith(
                    fontFeatures: const [FontFeature.tabularFigures()],
                    height: 1,
                  ),
                ),
              ),
              Text(
                count == 1 ? 'member' : 'members',
                style: AppText.body(
                  size: 11,
                  weight: FontWeight.w600,
                  color: AppColors.inkFaint,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
