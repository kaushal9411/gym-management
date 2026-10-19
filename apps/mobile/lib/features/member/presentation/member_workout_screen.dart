import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_workout_assignment.dart';
import '../../../models/member_workout_tracking.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/menu_button.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'member_workout_history_screen.dart';
import 'member_workout_logic.dart';
import 'member_workout_sheets.dart';
import 'widgets/member_profile_blocks.dart';
import 'widgets/workout_day_widgets.dart';
import 'widgets/workout_progress_widgets.dart';

/// The member's Workout tab — daily workout tracking.
///
/// **Beyond web's old read-only/mark-only page (member-initiated):** the
/// member logs each scheduled exercise per day (Done / Skip / Undo, optional
/// sets / reps / weight / minutes / note), finishes a whole workout (+ optional
/// duration and a 1-5 effort rating), picks any day of the last
/// `tracking.backdateDays` days, and sees real progress: the weekly completion
/// ring, 7-day streak dots, 8-week consistency bars, per-exercise and
/// per-muscle-group chips, count-up stat tiles, personal bests (only when
/// weights were logged) and rule-based advice ("How to get better results").
/// Everything comes from `GET /portal/workout` (legacy plan fields + the
/// additive `tracking` block) and every write
/// (`POST/PATCH/DELETE /portal/workout/log*`) returns the refreshed payload
/// the screen replaces its state with — no optimistic UI. The API mirrors each
/// log into the old per-exercise progress so staff views keep working.
///
/// Dropped, because nothing backs them: calories / heart-rate style numbers
/// (no endpoint), rest timers and exercise videos (not part of the member DTO).
/// Minutes, volume, effort and personal bests only appear once the member has
/// logged them. Member palette (lime -> teal) throughout.
///
/// It is an `IndexedStack` tab: it loads once and refreshes by pull-to-refresh
/// (the tab-cache trap).
class MemberWorkoutScreen extends StatefulWidget {
  const MemberWorkoutScreen({super.key});

  @override
  State<MemberWorkoutScreen> createState() => _MemberWorkoutScreenState();
}

class _MemberWorkoutScreenState extends State<MemberWorkoutScreen> {
  MemberWorkoutAssignment? _assignment;
  bool _loading = true;
  String? _error;
  String? _notice;
  String? _selected;
  String? _weekStart;

  /// `exerciseId|action` of the running request, or `*` for day-level ones.
  String? _busy;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final a = await getIt<MemberPortalRepository>().workout();
      if (!mounted) return;
      setState(() {
        _assignment = a;
        _loading = false;
        _error = null;
      });
    } on ApiException catch (e) {
      _fail(e.message);
    } catch (e) {
      _fail('Could not load your workout.');
    }
  }

  void _fail(String message) {
    if (!mounted) return;
    if (_assignment != null) {
      setState(() => _loading = false);
      teamSnack(context, message, error: true);
    } else {
      setState(() {
        _loading = false;
        _error = message;
      });
    }
  }

  /// Replaces state with the server's refreshed payload.
  void _apply(WorkoutWriteResult r) {
    if (!mounted) return;
    setState(() => _assignment = r.workout);
  }

  Future<void> _run(
    String busyKey,
    Future<WorkoutWriteResult> Function() call, {
    String? success,
  }) async {
    setState(() {
      _busy = busyKey;
      _notice = null;
    });
    try {
      final r = await call();
      _apply(r);
      if (mounted && success != null) teamSnack(context, success);
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) {
        teamSnack(context, 'Could not save. Try again.', error: true);
      }
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _mark(
    TrackingDay day,
    TrackingExercise ex,
    LogStatus status,
  ) =>
      _run(
        '${ex.exerciseId}|${status == LogStatus.completed ? 'done' : 'skip'}',
        () => getIt<MemberPortalRepository>().logWorkout(
          exerciseId: ex.exerciseId,
          date: day.date,
          status: status,
        ),
      );

  Future<void> _undo(TrackingExercise ex) {
    final id = ex.logId;
    if (id == null) return Future.value();
    return _run(
      '${ex.exerciseId}|undo',
      () => getIt<MemberPortalRepository>().deleteWorkoutLog(id),
    );
  }

  Future<void> _details(TrackingDay day, TrackingExercise ex) async {
    final editing = ex.isDone;
    final target = ex.targetLabel;
    await showWorkoutDetailsSheet(
      context,
      title: ex.name,
      subtitle: '${dayLong(day.date)} · saving marks it done',
      submitLabel: editing ? 'Save changes' : 'Save as done',
      hint: target == null ? null : 'Plan: $target',
      initial: editing
          ? WorkoutDetails(
              setsDone: ex.setsDone,
              repsDone: ex.repsDone,
              weightKg: ex.weightKg,
              durationMin: ex.durationMin,
              notes: ex.logNotes,
            )
          : WorkoutDetails(setsDone: ex.sets, repsDone: ex.reps),
      onSave: (details) async {
        final r = await getIt<MemberPortalRepository>().logWorkout(
          exerciseId: ex.exerciseId,
          date: day.date,
          status: LogStatus.completed,
          details: details,
        );
        _apply(r);
        return 'Saved - nice work!';
      },
    );
  }

  Future<void> _finish(TrackingDay day) async {
    final message = await showFinishWorkoutSheet(
      context,
      dayLabel: day.isToday ? 'today' : day.label,
      remaining: day.remaining,
      initial: day.session,
      onSave: ({durationMin, effort, notes}) async {
        final r = await getIt<MemberPortalRepository>().completeWorkoutDay(
          date: day.date,
          durationMin: durationMin,
          effort: effort,
          notes: notes,
        );
        _apply(r);
        return r.completedNow > 0
            ? 'Workout complete - ${r.completedNow} '
                '${r.completedNow == 1 ? 'exercise' : 'exercises'} marked done'
            : 'Workout saved';
      },
    );
    if (message != null && mounted) teamSnack(context, message);
  }

  Future<void> _reset(TrackingDay day) async {
    final ok = await confirmTeam(
      context,
      title: 'Reset this day?',
      message: 'Everything you logged for '
          '${day.isToday ? 'today' : day.label} (exercises, duration and '
          'effort) will be cleared.',
      confirmLabel: 'Reset day',
      destructive: true,
    );
    if (!ok || !mounted) return;
    await _run(
      '*',
      () => getIt<MemberPortalRepository>().resetWorkoutDay(day.date),
      success: 'Day cleared.',
    );
  }

  Future<void> _openHistory() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => const MemberWorkoutHistoryScreen()),
    );
    if (mounted) await _load(silent: true);
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_loading) return const AppLoadingView(role: AppRole.member);
    final a = _assignment;
    if (a == null) {
      if (_error != null) {
        return AppErrorView(
          message: _error!,
          onRetry: _load,
          role: AppRole.member,
        );
      }
      return RefreshIndicator(
        color: AppColors.memberB,
        backgroundColor: AppColors.surface2,
        onRefresh: () => _load(silent: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 90),
          children: const [
            Align(alignment: Alignment.centerLeft, child: MenuButton()),
            SizedBox(height: 60),
            AppEmptyState(
              icon: Icons.fitness_center_outlined,
              title: 'No workout plan yet',
              message: 'Your trainer will assign one soon.',
            ),
          ],
        ),
      );
    }
    final t = a.tracking;
    final todayDay = t?.todayDay;
    if (t == null || todayDay == null) {
      return AppErrorView(
        message: 'Workout tracking is not available right now.',
        onRetry: _load,
        role: AppRole.member,
      );
    }

    final selectedKey =
        _selected != null && t.dayOf(_selected!) != null ? _selected! : t.today;
    final day = t.dayOf(selectedKey)!;
    final weekStart = _weekStart ?? weekStartOf(selectedKey);

    return RefreshIndicator(
      color: AppColors.memberB,
      backgroundColor: AppColors.surface2,
      onRefresh: () => _load(silent: true),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 100),
        children: [
          _hero(a, t, todayDay),
          TeamCenter(
            maxWidth: 1000,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_notice != null) ...[
                    FormAlert(message: _notice!),
                    const SizedBox(height: 12),
                  ],
                  if (a.trainerRemarks != null &&
                      a.trainerRemarks!.isNotEmpty) ...[
                    _TrainerNote(a.trainerRemarks!),
                    const SizedBox(height: 14),
                  ],
                  _weekCard(t, day, weekStart, selectedKey),
                  const SizedBox(height: 14),
                  WorkoutWeekCard(tracking: t),
                  const SizedBox(height: 14),
                  _tiles(t),
                  const SizedBox(height: 14),
                  TeamSectionCard(
                    icon: Icons.bar_chart_rounded,
                    color: AppColors.memberB,
                    title: 'Consistency',
                    subtitle: 'Planned sessions you completed, last 8 weeks',
                    child: WorkoutConsistencyChart(weeks: t.consistency),
                  ),
                  const SizedBox(height: 14),
                  _exercisesCard(t),
                  const SizedBox(height: 14),
                  WorkoutInsightsCard(insights: t.insights),
                  if (t.insights.isNotEmpty) const SizedBox(height: 14),
                  _historyTile(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _hero(
    MemberWorkoutAssignment a,
    WorkoutTracking t,
    TrackingDay today,
  ) {
    final w = t.week;
    final title = today.isRest
        ? 'Rest day'
        : (today.focus != null ? '${today.focus} day' : 'Today’s workout');
    final subtitle = today.isRest
        ? (t.nextDay != null
            ? 'Recover well - next up ${t.nextDay!.label}'
                '${t.nextDay!.focus != null ? ': ${t.nextDay!.focus}' : ''}'
            : 'Nothing scheduled today')
        : today.state == DayState.done
            ? 'Workout complete - great job today'
            : '${today.loggedCount} of ${today.plannedCount} exercises logged';
    final showFinish =
        !today.isRest && today.state != DayState.done && today.canLog;
    return WorkoutHero(
      eyebrow: '${a.planName} · ${a.planLevel.label}',
      title: title,
      subtitle: subtitle,
      weekPercent: w.completionPercent,
      chips: [
        if (t.streak > 0) '${t.streak} in a row',
        'Started ${shortDay(dayKey(a.startDate))}',
      ],
      stats: [
        if (w.plannedSessions > 0)
          (
            'Sessions',
            w.completedSessions,
            (v) => '$v/${w.plannedSessions}',
          ),
        if (w.plannedExercises > 0)
          (
            'This week',
            w.completedExercises,
            (v) => '$v/${w.plannedExercises}',
          ),
        ('Streak', t.streak, (v) => '$v'),
      ],
      action: showFinish
          ? WorkoutHeroButton(
              key: const ValueKey('hero-finish'),
              label: 'Finish today’s workout',
              icon: Icons.done_all_rounded,
              onTap: _busy != null
                  ? null
                  : () {
                      setState(() {
                        _selected = t.today;
                        _weekStart = null;
                      });
                      _finish(today);
                    },
            )
          : null,
    );
  }

  Widget _weekCard(
    WorkoutTracking t,
    TrackingDay day,
    String weekStart,
    String selectedKey,
  ) {
    final locked = lockedReason(day, t.backdateDays);
    return TeamSectionCard(
      icon: Icons.calendar_month_rounded,
      color: AppColors.memberB,
      title: 'Your week',
      subtitle: 'Pick a day to log it',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          WorkoutWeekStrip(
            tracking: t,
            weekStart: weekStart,
            selected: selectedKey,
            onSelect: (d) => setState(() => _selected = d.date),
            onWeek: (start) => setState(() {
              _weekStart = start;
              final first = t.weekOf(start);
              if (first.isNotEmpty) {
                _selected =
                    start == weekStartOf(t.today) ? t.today : first.first.date;
              }
            }),
          ),
          const SizedBox(height: 18),
          WorkoutDayHeader(day: day),
          const SizedBox(height: 12),
          if (day.state == DayState.outside)
            _Note(
              icon: Icons.event_busy_rounded,
              text: 'Your plan has not started on this day.',
            )
          else if (day.isRest)
            _Note(
              icon: Icons.self_improvement_rounded,
              text: 'Rest day - nothing scheduled. Recover well.',
            )
          else ...[
            for (var i = 0; i < day.exercises.length; i++) ...[
              if (i > 0) const SizedBox(height: 10),
              WorkoutExerciseCard(
                key: ValueKey('${day.date}-${day.exercises[i].exerciseId}'),
                exercise: day.exercises[i],
                index: i,
                canLog: day.canLog,
                lockedReason: locked,
                busyAction: _busyAction(day.exercises[i]),
                anyBusy: _busy != null,
                onDone: () => _mark(day, day.exercises[i], LogStatus.completed),
                onSkip: () => _mark(day, day.exercises[i], LogStatus.skipped),
                onUndo: () => _undo(day.exercises[i]),
                onDetails: () => _details(day, day.exercises[i]),
              ),
            ],
            if (day.canLog) ...[
              const SizedBox(height: 14),
              _finishBar(day),
            ],
          ],
        ],
      ),
    );
  }

  WorkoutAction? _busyAction(TrackingExercise ex) {
    final b = _busy;
    if (b == null || !b.startsWith('${ex.exerciseId}|')) return null;
    return switch (b.split('|').last) {
      'done' => WorkoutAction.done,
      'skip' => WorkoutAction.skip,
      _ => WorkoutAction.undo,
    };
  }

  Widget _finishBar(TrackingDay day) {
    final done = day.state == DayState.done;
    final hasLogs = day.loggedCount > 0 || day.session != null;
    return Column(
      children: [
        ShimmerButton(
          key: const ValueKey('finish-workout'),
          colors: done
              ? const [Color(0xFF475569), Color(0xFF64748B)]
              : WorkoutColors.done,
          onTap: _busy != null ? null : () => _finish(day),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.done_all_rounded, size: 18, color: Colors.white),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  done ? 'Edit duration & effort' : 'Finish workout',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 14,
                    weight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (hasLogs) ...[
          const SizedBox(height: 8),
          GestureDetector(
            key: const ValueKey('reset-day'),
            behavior: HitTestBehavior.opaque,
            onTap: _busy != null ? null : () => _reset(day),
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.restart_alt_rounded,
                    size: 17,
                    color: AppColors.inkFaint,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'Reset day',
                    style: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w800,
                      color: AppColors.inkFaint,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _tiles(WorkoutTracking t) {
    final tiles = workoutStatTiles(t);
    final wide = MediaQuery.sizeOf(context).width >= kTeamWideBreak;
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: wide ? 4 : 2,
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: wide ? 1.7 : 1.45,
      children: tiles,
    );
  }

  Widget _exercisesCard(WorkoutTracking t) {
    final groups = [
      for (final g in t.muscleGroups)
        if (g.planned > 0) g,
    ];
    return TeamSectionCard(
      icon: Icons.fitness_center_rounded,
      color: TeamColors.sky,
      title: 'Your exercises',
      subtitle: 'Done / due over the last 4 weeks',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          WorkoutExerciseChips(stats: t.exercises),
          if (groups.isNotEmpty) ...[
            const SizedBox(height: 18),
            WorkoutMuscleBars(groups: t.muscleGroups),
          ],
          if (t.personalBests.isNotEmpty) ...[
            const SizedBox(height: 18),
            Text(
              'PERSONAL BESTS · HEAVIEST WEIGHT YOU LOGGED',
              style: AppText.eyebrow(color: AppColors.inkFaint),
            ),
            const SizedBox(height: 8),
            WorkoutPersonalBests(bests: t.personalBests),
          ],
        ],
      ),
    );
  }

  Widget _historyTile() => PressBounce(
        onTap: _openHistory,
        child: Container(
          key: const ValueKey('open-history'),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.memberB.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.history_rounded,
                  color: AppColors.memberB,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Workout history',
                      style: AppText.body(size: 14, weight: FontWeight.w800),
                    ),
                    Text(
                      'Review, edit or delete what you logged',
                      style: AppText.body(
                        size: 11.5,
                        weight: FontWeight.w600,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: AppColors.inkFaint),
            ],
          ),
        ),
      );
}

class _Note extends StatelessWidget {
  const _Note({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          children: [
            Icon(icon, size: 26, color: AppColors.inkFaint),
            const SizedBox(height: 8),
            Text(
              text,
              textAlign: TextAlign.center,
              style: AppText.body(
                size: 12.5,
                weight: FontWeight.w700,
                color: AppColors.inkFaint,
              ),
            ),
          ],
        ),
      );
}

class _TrainerNote extends StatelessWidget {
  const _TrainerNote(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              TeamColors.amber.withValues(alpha: 0.18),
              TeamColors.amber.withValues(alpha: 0.04),
            ],
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: TeamColors.amber.withValues(alpha: 0.4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'TRAINER NOTE',
              style: AppText.eyebrow(color: TeamColors.amber),
            ),
            const SizedBox(height: 4),
            Text(
              text,
              style: AppText.body(size: 13, weight: FontWeight.w600),
            ),
          ],
        ),
      );
}
