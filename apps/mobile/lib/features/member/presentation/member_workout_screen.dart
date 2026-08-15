import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_workout_assignment.dart';
import '../../../models/member_workout_progress.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "5. Workout" — today's exercises from the member's own
/// assigned plan, with Mark done / Skip writing straight to
/// `POST /portal/workout/:id/progress`.
///
/// Two design details have no backing and are not shown: the "4×10 · 60kg"
/// line (the portal's exercise DTO carries only id/name/dayOfWeek — no
/// sets, reps or weight) and the whole "5a. Log set" screen (reps/weight
/// steppers + a "last time" comparison — the API stores a per-exercise
/// status, never a logged set).
class MemberWorkoutScreen extends StatefulWidget {
  const MemberWorkoutScreen({super.key});

  @override
  State<MemberWorkoutScreen> createState() => _MemberWorkoutScreenState();
}

class _MemberWorkoutScreenState extends State<MemberWorkoutScreen> {
  MemberWorkoutAssignment? _assignment;
  bool _loading = true;
  String? _error;
  String? _busyExerciseId;

  static final _today = WeekDay.values[DateTime.now().weekday - 1];

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
      final assignment = await getIt<MemberPortalRepository>().workout();
      if (!mounted) return;
      setState(() => _assignment = assignment);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _mark(
    MemberPlanExercise exercise,
    ExerciseProgressStatus status,
  ) async {
    final assignment = _assignment;
    if (assignment == null) return;
    setState(() {
      _busyExerciseId = exercise.exerciseId;
      _error = null;
    });
    try {
      final updated = await getIt<MemberPortalRepository>().markWorkoutProgress(
        assignmentId: assignment.id,
        exerciseId: exercise.exerciseId,
        status: status,
      );
      if (!mounted) return;
      setState(() => _assignment = updated);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busyExerciseId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const AppLoadingView(role: AppRole.member);
    final assignment = _assignment;
    if (_error != null && assignment == null) {
      return AppErrorView(
        message: _error!,
        onRetry: _load,
        role: AppRole.member,
      );
    }
    if (assignment == null) {
      return const AppEmptyState(
        icon: Icons.fitness_center_outlined,
        title: 'No workout plan yet',
        message: 'Your trainer will assign one soon.',
      );
    }

    final todays = assignment.exercisesFor(_today);
    final done = todays
        .where(
          (e) =>
              assignment.statusOf(e.exerciseId) ==
              ExerciseProgressStatus.completed,
        )
        .length;

    return RefreshIndicator(
      color: AppColors.memberB,
      backgroundColor: AppColors.surface2,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 90),
        children: [
          Text(
            '${assignment.planName} · Week ${assignment.currentWeek}',
            style: AppText.eyebrow(),
          ),
          Text(_today.label, style: AppText.display(size: 22)),
          const SizedBox(height: 14),
          if (_error != null) ...[
            FormAlert(message: _error!),
            const SizedBox(height: 10),
          ],
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0x24C6F135), Color(0x1A14E0B4)],
              ),
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.glassBorder),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$done/${todays.length}',
                        style: AppText.display(size: 20),
                      ),
                      Text('done', style: AppText.eyebrow()),
                    ],
                  ),
                ),
                AppPill(
                  label: assignment.status,
                  tone: AppPillTone.roleTint,
                  role: AppRole.member,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          if (todays.isEmpty)
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.surface2,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                children: [
                  const Icon(
                    Icons.self_improvement_rounded,
                    size: 26,
                    color: AppColors.inkFaint,
                  ),
                  const SizedBox(height: 8),
                  Text('Rest day', style: AppText.display(size: 16)),
                  Text(
                    'Nothing scheduled for ${_today.label}.',
                    style: AppText.body(size: 12, color: AppColors.inkFaint),
                  ),
                ],
              ),
            ),
          for (final exercise in todays) ...[
            _ExerciseCard(
              exercise: exercise,
              status: assignment.statusOf(exercise.exerciseId),
              busy: _busyExerciseId == exercise.exerciseId,
              onMarkDone: () =>
                  _mark(exercise, ExerciseProgressStatus.completed),
              onSkip: () => _mark(exercise, ExerciseProgressStatus.skipped),
            ),
            const SizedBox(height: 8),
          ],
          if (assignment.trainerRemarks != null &&
              assignment.trainerRemarks!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.memberSoft,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.memberB),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Trainer note', style: AppText.eyebrow()),
                  const SizedBox(height: 4),
                  Text(
                    assignment.trainerRemarks!,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: AppColors.memberPillFg,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ExerciseCard extends StatelessWidget {
  const _ExerciseCard({
    required this.exercise,
    required this.status,
    required this.busy,
    required this.onMarkDone,
    required this.onSkip,
  });

  final MemberPlanExercise exercise;
  final ExerciseProgressStatus status;
  final bool busy;
  final VoidCallback onMarkDone;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    final isDone = status == ExerciseProgressStatus.completed;
    final isSkipped = status == ExerciseProgressStatus.skipped;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(
          color: status == ExerciseProgressStatus.pending
              ? AppColors.line
              : AppColors.memberB,
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: isDone ? AppColors.successSoft : AppColors.memberSoft,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Icon(
                  isDone
                      ? Icons.check_rounded
                      : isSkipped
                          ? Icons.remove_rounded
                          : Icons.fitness_center_rounded,
                  size: 15,
                  color: isDone ? AppColors.success : AppColors.memberPillFg,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  exercise.name,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
              ),
              AppPill(
                label: switch (status) {
                  ExerciseProgressStatus.completed => 'Done',
                  ExerciseProgressStatus.skipped => 'Skipped',
                  ExerciseProgressStatus.pending => 'Up next',
                },
                tone: switch (status) {
                  ExerciseProgressStatus.completed => AppPillTone.success,
                  ExerciseProgressStatus.skipped => AppPillTone.neutral,
                  ExerciseProgressStatus.pending => AppPillTone.warning,
                },
              ),
            ],
          ),
          if (!isDone || isSkipped) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: AppButton(
                    label: 'Mark done',
                    role: AppRole.member,
                    size: AppButtonSize.small,
                    loading: busy,
                    onPressed: onMarkDone,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: AppButton(
                    label: 'Skip',
                    role: AppRole.member,
                    variant: AppButtonVariant.ghost,
                    size: AppButtonSize.small,
                    onPressed: busy ? null : onSkip,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
