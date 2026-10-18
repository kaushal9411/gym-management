import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_workout_progress.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart';
import '../../workouts/presentation/workout_ui.dart';
import 'client_progress_screen.dart';

/// Design frame "9a. Workout log", redesigned: the day's exercises as cards
/// (sets x reps, rest and notes from the plan) each with a Pending / Done /
/// Skipped switch (`POST /workout-plans/assignments/:id/progress`, applied
/// from the server's answer, one row at a time), the day's completion ring,
/// plus the trainer note (`PATCH /workout-plans/assignments/:id`). The design's
/// "@ 62kg" load isn't shown: the API tracks status per exercise, never a
/// weight.
class WorkoutLogScreen extends StatefulWidget {
  const WorkoutLogScreen({required this.args, super.key});

  final WorkoutLogArgs args;

  @override
  State<WorkoutLogScreen> createState() => _WorkoutLogScreenState();
}

class _WorkoutLogScreenState extends State<WorkoutLogScreen> {
  late final Map<String, ExerciseProgressStatus> _statuses = {
    for (final e in _dayEntries) e.exerciseId: e.status,
  };
  late final _noteController = TextEditingController(
    text: widget.args.progress.trainerRemarks ?? '',
  );
  final Set<String> _busy = {};
  Map<String, PlanExercise>? _planExercises;
  bool _saving = false;
  bool _dirty = false;
  String? _error;

  List<ExerciseProgressEntry> get _dayEntries =>
      widget.args.progress.progressByDay[widget.args.day] ?? const [];

  @override
  void initState() {
    super.initState();
    _loadPlan();
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  /// The assignment's progress entries carry no sets/reps - those live on
  /// the plan, so the "4 x 10" line needs the plan fetched alongside.
  Future<void> _loadPlan() async {
    try {
      final plan = await getIt<WorkoutPlanRepository>()
          .getById(widget.args.progress.workoutPlanId);
      if (!mounted) return;
      setState(() {
        _planExercises = {
          for (final e in plan.exercises)
            if (e.dayOfWeek == widget.args.day) e.exercise.id: e,
        };
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _planExercises = const {});
    }
  }

  Future<void> _setStatus(
    ExerciseProgressEntry entry,
    ExerciseProgressStatus next,
  ) async {
    final id = entry.exerciseId;
    if (_busy.contains(id) || _statuses[id] == next) return;
    setState(() {
      _busy.add(id);
      _error = null;
    });
    try {
      await getIt<WorkoutPlanRepository>().markProgress(
        assignmentId: widget.args.progress.id,
        exerciseId: id,
        status: next,
      );
      if (!mounted) return;
      _dirty = true;
      setState(() => _statuses[id] = next);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Something went wrong ($e).');
    } finally {
      if (mounted) setState(() => _busy.remove(id));
    }
  }

  Future<void> _saveNote() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<WorkoutPlanRepository>().updateTrainerRemarks(
        assignmentId: widget.args.progress.id,
        trainerRemarks: _noteController.text.trim(),
      );
      if (!mounted) return;
      context.pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Something went wrong ($e).');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final entries = _dayEntries;
    final day = widget.args.day;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.pop(_dirty);
      },
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('${day.label} — Log', style: AppText.display(size: 18)),
              Text(widget.args.member.name, style: AppText.eyebrow()),
            ],
          ),
        ),
        body: SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              16 + teamSideInset(context, maxWidth: 840),
              8,
              16 + teamSideInset(context, maxWidth: 840),
              24,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null) ...[
                  FormAlert(message: _error!),
                  const SizedBox(height: 10),
                ],
                for (final entry in entries) ...[
                  _ExerciseLogCard(
                    entry: entry,
                    status: _statuses[entry.exerciseId]!,
                    planExercise: _planExercises?[entry.exerciseId],
                    busy: _busy.contains(entry.exerciseId),
                    onChanged: (s) => _setStatus(entry, s),
                  ),
                  const SizedBox(height: 10),
                ],
                const SizedBox(height: 6),
                AppLabeledField(
                  label: 'Trainer note',
                  hintText: 'Feedback for this session (optional)',
                  icon: Icons.chat_bubble_outline_rounded,
                  iconColor: TeamColors.teal,
                  controller: _noteController,
                  minLines: 2,
                  maxLines: 5,
                  textCapitalization: TextCapitalization.sentences,
                  inputFormatters: [LengthLimitingTextInputFormatter(2000)],
                ),
                const SizedBox(height: 16),
                TeamGradientButton(
                  label: 'Save note',
                  icon: Icons.check_rounded,
                  loading: _saving,
                  onTap: _saveNote,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ExerciseLogCard extends StatelessWidget {
  const _ExerciseLogCard({
    required this.entry,
    required this.status,
    required this.planExercise,
    required this.busy,
    required this.onChanged,
  });

  final ExerciseProgressEntry entry;
  final ExerciseProgressStatus status;
  final PlanExercise? planExercise;
  final bool busy;
  final ValueChanged<ExerciseProgressStatus> onChanged;

  @override
  Widget build(BuildContext context) {
    final p = planExercise;
    final line = ExerciseLine(
      name: entry.exerciseName,
      muscle: p?.exercise.muscleGroup,
      sets: p?.sets,
      reps: p?.repetitions,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ExerciseTile(
          key: ValueKey('log-${entry.exerciseId}'),
          line: line,
          trailing: busy
              ? const Padding(
                  padding: EdgeInsets.all(10),
                  child: SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : null,
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            for (final s in ExerciseProgressStatus.values) ...[
              if (s != ExerciseProgressStatus.pending) const SizedBox(width: 6),
              Expanded(
                child: _StatusButton(
                  key: ValueKey('mark-${entry.exerciseId}-${s.name}'),
                  status: s,
                  selected: status == s,
                  onTap: busy ? null : () => onChanged(s),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class _StatusButton extends StatelessWidget {
  const _StatusButton({
    super.key,
    required this.status,
    required this.selected,
    required this.onTap,
  });

  final ExerciseProgressStatus status;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final (label, icon, color) = switch (status) {
      ExerciseProgressStatus.pending => (
          'Pending',
          Icons.hourglass_bottom_rounded,
          TeamColors.amber,
        ),
      ExerciseProgressStatus.completed => (
          'Done',
          Icons.check_circle_rounded,
          TeamColors.green,
        ),
      ExerciseProgressStatus.skipped => (
          'Skipped',
          Icons.skip_next_rounded,
          TeamColors.rose,
        ),
    };
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: selected ? color.withValues(alpha: 0.18) : AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? color : AppColors.line,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 15,
                color: selected ? color : AppColors.inkFaint,
              ),
              const SizedBox(width: 5),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w800,
                    color: selected ? color : AppColors.inkSoft,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
