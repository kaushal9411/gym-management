import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_workout_progress.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'client_progress_screen.dart';

/// Design frame "9a. Workout log" — tap an exercise to cycle its status
/// (`POST /workout-plans/assignments/:id/progress`), plus the trainer note
/// (`PATCH /workout-plans/assignments/:id`). The design's "@ 62kg" load
/// isn't shown: the API tracks status per exercise, never a weight.
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

  /// The assignment's progress entries carry no sets/reps — those live on
  /// the plan, so the "4 × 10" line needs the plan fetched alongside.
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
    } on ApiException {
      if (!mounted) return;
      setState(() => _planExercises = const {});
    }
  }

  Future<void> _cycleStatus(ExerciseProgressEntry entry) async {
    final current = _statuses[entry.exerciseId]!;
    final next = switch (current) {
      ExerciseProgressStatus.pending => ExerciseProgressStatus.completed,
      ExerciseProgressStatus.completed => ExerciseProgressStatus.skipped,
      ExerciseProgressStatus.skipped => ExerciseProgressStatus.pending,
    };
    setState(() {
      _statuses[entry.exerciseId] = next;
      _error = null;
    });
    try {
      await getIt<WorkoutPlanRepository>().markProgress(
        assignmentId: widget.args.progress.id,
        exerciseId: entry.exerciseId,
        status: next,
      );
      _dirty = true;
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _statuses[entry.exerciseId] = current;
        _error = e.message;
      });
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
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final entries = _dayEntries;
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
              Text(
                '${widget.args.day.label} — Log',
                style: AppText.display(size: 18),
              ),
              Text(widget.args.member.name, style: AppText.eyebrow()),
            ],
          ),
        ),
        body: SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
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
                    onTap: () => _cycleStatus(entry),
                  ),
                  const SizedBox(height: 8),
                ],
                const SizedBox(height: 8),
                AppLabeledField(
                  label: 'Trainer note',
                  controller: _noteController,
                ),
                const SizedBox(height: 20),
                AppButton(
                  label: 'Save note',
                  loading: _saving,
                  onPressed: _saveNote,
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
    required this.onTap,
  });

  final ExerciseProgressEntry entry;
  final ExerciseProgressStatus status;
  final PlanExercise? planExercise;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final sets = planExercise?.sets;
    final reps = planExercise?.repetitions;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      entry.exerciseName,
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                  ),
                  AppPill(
                    label: switch (status) {
                      ExerciseProgressStatus.completed => 'Done',
                      ExerciseProgressStatus.skipped => 'Skipped',
                      ExerciseProgressStatus.pending => 'Pending',
                    },
                    tone: switch (status) {
                      ExerciseProgressStatus.completed => AppPillTone.success,
                      ExerciseProgressStatus.skipped => AppPillTone.danger,
                      ExerciseProgressStatus.pending => AppPillTone.warning,
                    },
                  ),
                ],
              ),
              if (sets != null && reps != null) ...[
                const SizedBox(height: 4),
                Text(
                  '$sets × $reps',
                  style: AppText.body(size: 12, color: AppColors.inkFaint),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
