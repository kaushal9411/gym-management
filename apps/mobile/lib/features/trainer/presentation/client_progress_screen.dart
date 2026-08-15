import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../../models/member_workout_progress.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

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

/// Design frame "9. Client progress" — the ring/percent and the per-day
/// session list both come from `GET /workout-plans/members/:memberId`. The
/// design's "On track" pill is the assignment's real status here rather
/// than a judgement the API doesn't make.
class ClientProgressScreen extends StatefulWidget {
  const ClientProgressScreen({required this.member, super.key});

  final GymMember member;

  @override
  State<ClientProgressScreen> createState() => _ClientProgressScreenState();
}

class _ClientProgressScreenState extends State<ClientProgressScreen> {
  MemberWorkoutProgress? _progress;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final progress = await getIt<WorkoutPlanRepository>()
          .currentForMember(widget.member.id);
      if (!mounted) return;
      setState(() => _progress = progress);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openLog(WeekDay day) async {
    final progress = _progress;
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
    final progress = _progress;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.member.name, style: AppText.display(size: 18)),
            if (progress != null)
              Text(
                '${progress.workoutPlanName} · Week ${progress.currentWeek}',
                style: AppText.eyebrow(),
              ),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const AppLoadingView()
            : _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : progress == null
                    ? const AppEmptyState(
                        icon: Icons.fitness_center_outlined,
                        title: 'No active workout plan',
                        message: 'Assign a plan to start tracking this client.',
                      )
                    : RefreshIndicator(
                        color: AppColors.staffB,
                        backgroundColor: AppColors.surface2,
                        onRefresh: _load,
                        child: ListView(
                          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                          children: [
                            _ProgressCard(progress: progress),
                            const SizedBox(height: 12),
                            _ThisWeekCard(
                              progress: progress,
                              onDayTap: _openLog,
                            ),
                          ],
                        ),
                      ),
      ),
    );
  }
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.progress});

  final MemberWorkoutProgress progress;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 52,
            height: 52,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 52,
                  height: 52,
                  child: CircularProgressIndicator(
                    value: progress.progressPercent / 100,
                    strokeWidth: 6,
                    strokeCap: StrokeCap.round,
                    backgroundColor: AppColors.surface3,
                    color: AppColors.staffA,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${progress.progressPercent}%',
                  style: AppText.display(size: 18),
                ),
                Text('complete', style: AppText.eyebrow()),
              ],
            ),
          ),
          AppPill(
            label: progress.status,
            tone: progress.status == 'ACTIVE'
                ? AppPillTone.success
                : AppPillTone.neutral,
          ),
        ],
      ),
    );
  }
}

class _ThisWeekCard extends StatelessWidget {
  const _ThisWeekCard({required this.progress, required this.onDayTap});

  final MemberWorkoutProgress progress;
  final ValueChanged<WeekDay> onDayTap;

  @override
  Widget build(BuildContext context) {
    final byDay = progress.progressByDay;
    final days = WeekDay.values.where(byDay.containsKey).toList();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('This week', style: AppText.eyebrow()),
          const SizedBox(height: 8),
          if (days.isEmpty)
            Text(
              'This plan has no exercises scheduled yet.',
              style: AppText.body(size: 12, color: AppColors.inkFaint),
            ),
          for (final day in days)
            _DayRow(
              day: day,
              entries: byDay[day]!,
              onTap: () => onDayTap(day),
            ),
        ],
      ),
    );
  }
}

class _DayRow extends StatelessWidget {
  const _DayRow({
    required this.day,
    required this.entries,
    required this.onTap,
  });

  final WeekDay day;
  final List<ExerciseProgressEntry> entries;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final done = entries.every(
      (e) => e.status == ExerciseProgressStatus.completed,
    );
    final skipped = entries.any(
      (e) => e.status == ExerciseProgressStatus.skipped,
    );

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Expanded(
              child: Text(
                '${day.shortLabel} — ${entries.first.exerciseName}'
                '${entries.length > 1 ? ' +${entries.length - 1}' : ''}',
                style: AppText.body(size: 13, weight: FontWeight.w700),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            AppPill(
              label: done
                  ? 'Done'
                  : skipped
                      ? 'Skipped'
                      : 'Upcoming',
              tone: done
                  ? AppPillTone.success
                  : skipped
                      ? AppPillTone.danger
                      : AppPillTone.warning,
            ),
          ],
        ),
      ),
    );
  }
}
