import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../../models/member_workout_progress.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../plans/presentation/plan_ui.dart' show PlanHeroShell;
import '../../team/presentation/widgets/team_ui.dart';
import '../../workouts/presentation/workout_ui.dart';

class WorkoutLogArgs {
  const WorkoutLogArgs({
    required this.progress,
    required this.day,
    required this.member,
  });

  final MemberWorkoutProgress progress;
  final WeekDay day;
  final GymMember member;
}

Color progressTone(String status) => switch (status) {
      'ACTIVE' => TeamColors.green,
      'COMPLETED' => TeamColors.indigo,
      _ => TeamColors.slate,
    };

/// Design frame "9. Client progress", redesigned: the animated completion
/// ring in the hero (progress %, completed / total exercises - the figures
/// web's member workout card shows), the week as per-day progress rows (tap
/// one to log it) and the member's earlier plans (web's "Plan history").
/// Everything comes from `GET /workout-plans/members/:memberId` (`current` +
/// `history`); the design's "On track" pill is the assignment's real status
/// rather than a judgement the API doesn't make.
class ClientProgressScreen extends StatefulWidget {
  const ClientProgressScreen({required this.member, super.key});

  final GymMember member;

  @override
  State<ClientProgressScreen> createState() => _ClientProgressScreenState();
}

class _ClientProgressScreenState extends State<ClientProgressScreen> {
  MemberWorkoutPlans? _plans;
  bool _loading = true;
  String? _error;

  MemberWorkoutProgress? get _current => _plans?.current;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _plans == null;
      _error = null;
    });
    try {
      final plans =
          await getIt<WorkoutPlanRepository>().memberPlans(widget.member.id);
      if (!mounted) return;
      setState(() => _plans = plans);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not load progress ($e)');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openLog(WeekDay day) async {
    final progress = _current;
    if (progress == null) return;
    final changed = await context.push<bool>(
      AppRoutes.workoutLog,
      extra: WorkoutLogArgs(
        progress: progress,
        day: day,
        member: widget.member,
      ),
    );
    if (changed == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final hero = _current != null && _error == null;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: hero,
      appBar: AppBar(
        backgroundColor: hero ? Colors.transparent : AppColors.bg,
        foregroundColor: hero ? Colors.white : null,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(hero ? 'Client progress' : widget.member.name),
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const AppLoadingView()
            : _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : _content(),
      ),
    );
  }

  Widget _content() {
    final progress = _current;
    final side = 16 + teamSideInset(context, maxWidth: 840);
    final past = _plans?.past ?? const <MemberWorkoutProgress>[];
    if (progress == null) {
      return RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.fromLTRB(side, 8, side, 32),
          children: [
            const SizedBox(height: 40),
            const AppEmptyState(
              icon: Icons.fitness_center_outlined,
              title: 'No active workout plan',
              message: 'Assign a plan to start tracking this client.',
            ),
            if (past.isNotEmpty) ...[
              const SizedBox(height: 18),
              _history(past),
            ],
          ],
        ),
      );
    }
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final tone = progressTone(progress.status);
    final weeks = progress.durationWeeks < 1 ? 1 : progress.durationWeeks;
    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          PlanHeroShell(
            topInset: top,
            child: Column(
              children: [
                Row(
                  children: [
                    UserAvatar(
                      avatarUrl: widget.member.profilePhotoUrl,
                      name: widget.member.name,
                      size: 44,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.member.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                AppText.display(size: 18, color: Colors.white),
                          ),
                          Text(
                            widget.member.memberId,
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w700,
                              color: Colors.white.withValues(alpha: 0.85),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                FadeUp(
                  index: 0,
                  child: AnimatedRing(
                    value: progress.progressPercent / 100,
                    size: 132,
                    stroke: 12,
                    colors: const [Colors.white, Color(0xFFA7F3D0)],
                    track: Colors.white.withValues(alpha: 0.22),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CountUp(
                          value: progress.progressPercent,
                          suffix: '%',
                          style: AppText.display(size: 30, color: Colors.white),
                        ),
                        Text(
                          '${progress.completedCount}/${progress.totalExercises}',
                          style: AppText.body(
                            size: 11,
                            weight: FontWeight.w700,
                            color: Colors.white.withValues(alpha: 0.85),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                FadeUp(
                  index: 1,
                  child: Text(
                    progress.workoutPlanName,
                    textAlign: TextAlign.center,
                    style: AppText.display(size: 22, color: Colors.white),
                  ),
                ),
                const SizedBox(height: 4),
                FadeUp(
                  index: 2,
                  child: Text(
                    'Week ${progress.currentWeek.clamp(1, weeks)} of '
                    '${progress.durationWeeks}',
                    style: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w700,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                FadeUp(
                  index: 3,
                  child: Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      TeamHeroPill(prettyEnum(progress.status), dot: tone),
                      TeamHeroPill(
                        progress.level.label,
                        icon: levelIcon(progress.level),
                      ),
                      TeamHeroPill(
                        'Since ${fmtDate(progress.startDate)}',
                        icon: Icons.event_available_rounded,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(side, 16, side, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                FadeUp(index: 0, child: _week(progress)),
                if (past.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  FadeUp(index: 1, child: _history(past)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _week(MemberWorkoutProgress progress) {
    final by = progress.progressByDay;
    final days = WeekDay.values.where(by.containsKey).toList();
    return TeamSectionCard(
      icon: Icons.calendar_view_week_rounded,
      color: TeamColors.violet,
      title: 'This week',
      subtitle: 'Tap a day to log its exercises',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (days.isEmpty)
            Text(
              'This plan has no exercises scheduled yet.',
              style: AppText.body(size: 12, color: AppColors.inkFaint),
            ),
          for (final d in days)
            _DayProgressRow(
              day: d,
              entries: by[d]!,
              onTap: () => _openLog(d),
            ),
        ],
      ),
    );
  }

  Widget _history(List<MemberWorkoutProgress> past) {
    return TeamSectionCard(
      icon: Icons.history_rounded,
      color: TeamColors.sky,
      title: 'Plan history',
      subtitle: '${past.length} earlier ${past.length == 1 ? 'plan' : 'plans'}',
      child: Column(
        children: [
          for (final h in past)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: progressTone(h.status).withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.fitness_center_rounded,
                      size: 17,
                      color: progressTone(h.status),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          h.workoutPlanName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              AppText.body(size: 13, weight: FontWeight.w800),
                        ),
                        Text(
                          '${fmtDate(h.startDate)} – '
                          '${h.endDate == null ? 'now' : fmtDate(h.endDate)}',
                          style: AppText.body(
                            size: 11.5,
                            weight: FontWeight.w600,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ],
                    ),
                  ),
                  MiniChip(
                    label: prettyEnum(h.status),
                    color: progressTone(h.status),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _DayProgressRow extends StatelessWidget {
  const _DayProgressRow({
    required this.day,
    required this.entries,
    required this.onTap,
  });

  final WeekDay day;
  final List<ExerciseProgressEntry> entries;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final done = entries
        .where((e) => e.status == ExerciseProgressStatus.completed)
        .length;
    final skipped =
        entries.where((e) => e.status == ExerciseProgressStatus.skipped).length;
    final allDone = done == entries.length;
    final color = dayColor(day);
    final label = allDone
        ? 'Done'
        : skipped > 0 && done + skipped == entries.length
            ? 'Skipped'
            : 'Upcoming';
    final tone = allDone
        ? TeamColors.green
        : skipped > 0 && done + skipped == entries.length
            ? TeamColors.rose
            : TeamColors.amber;
    return Material(
      key: ValueKey('progress-${day.name}'),
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 2),
          child: Row(
            children: [
              Container(
                width: 44,
                padding: const EdgeInsets.symmetric(vertical: 6),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(11),
                ),
                alignment: Alignment.center,
                child: Text(
                  day.shortLabel,
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w900,
                    color: color,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${entries.first.exerciseName}'
                      '${entries.length > 1 ? ' +${entries.length - 1}' : ''}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                    const SizedBox(height: 5),
                    GrowBar(
                      ratio: (done + skipped) / entries.length,
                      height: 6,
                      track: AppColors.surface3,
                      colors: [tone, tone.withValues(alpha: 0.55)],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              MiniChip(label: label, color: tone),
            ],
          ),
        ),
      ),
    );
  }
}
