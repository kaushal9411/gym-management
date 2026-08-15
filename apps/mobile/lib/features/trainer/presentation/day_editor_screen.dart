import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/exercise.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/exercise_repository.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'workout_plan_detail_screen.dart';

class _DayExerciseItem {
  _DayExerciseItem({required this.exercise, this.sets, this.reps});

  final Exercise exercise;
  int? sets;
  int? reps;
}

/// Design frame "6a. Day editor".
class DayEditorScreen extends StatefulWidget {
  const DayEditorScreen({required this.args, super.key});

  final DayEditorArgs args;

  @override
  State<DayEditorScreen> createState() => _DayEditorScreenState();
}

class _DayEditorScreenState extends State<DayEditorScreen> {
  late final List<_DayExerciseItem> _items =
      (widget.args.plan.exercisesByDay[widget.args.day] ?? const [])
          .map(
            (e) => _DayExerciseItem(
              exercise: e.exercise,
              sets: e.sets,
              reps: e.repetitions,
            ),
          )
          .toList();
  bool _saving = false;
  String? _error;

  Future<void> _addExercise() async {
    final exercise = await showModalBottomSheet<Exercise>(
      context: context,
      backgroundColor: AppColors.bg,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _ExercisePickerSheet(),
    );
    if (exercise == null || !mounted) return;
    setState(
      () => _items.add(
        _DayExerciseItem(
          exercise: exercise,
          sets: exercise.defaultSets,
          reps: exercise.defaultReps,
        ),
      ),
    );
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final drafts = <PlanExerciseDraft>[];
      widget.args.plan.exercisesByDay.forEach((day, exercises) {
        if (day == widget.args.day) return;
        for (final e in exercises) {
          drafts.add(
            PlanExerciseDraft(
              exerciseId: e.exercise.id,
              dayOfWeek: day,
              sets: e.sets,
              repetitions: e.repetitions,
            ),
          );
        }
      });
      for (final item in _items) {
        drafts.add(
          PlanExerciseDraft(
            exerciseId: item.exercise.id,
            dayOfWeek: widget.args.day,
            sets: item.sets,
            repetitions: item.reps,
          ),
        );
      }
      await getIt<WorkoutPlanRepository>().setExercises(
        widget.args.plan.id,
        drafts,
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
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.args.day.label, style: AppText.display(size: 18)),
            Text(widget.args.plan.name, style: AppText.eyebrow()),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_error != null) ...[
                FormAlert(message: _error!),
                const SizedBox(height: 10),
              ],
              Expanded(
                child: _items.isEmpty
                    ? const AppEmptyState(
                        icon: Icons.event_busy_outlined,
                        title: 'Rest day',
                        message: 'Add an exercise to give this day a workout.',
                      )
                    : ListView.separated(
                        itemCount: _items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          final item = _items[i];
                          return Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: AppColors.surface2,
                              borderRadius:
                                  BorderRadius.circular(AppRadii.card),
                              border: Border.all(color: AppColors.line),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.exercise.name,
                                        style: AppText.body(
                                          size: 13,
                                          weight: FontWeight.w700,
                                        ),
                                      ),
                                      if (item.sets != null &&
                                          item.reps != null)
                                        Text(
                                          '${item.sets} × ${item.reps}',
                                          style: AppText.body(
                                            size: 11,
                                            color: AppColors.inkFaint,
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                if (item.exercise.muscleGroup != null) ...[
                                  AppPill(
                                    label: item.exercise.muscleGroup!,
                                    tone: AppPillTone.roleTint,
                                  ),
                                  const SizedBox(width: 6),
                                ],
                                IconButton(
                                  onPressed: () =>
                                      setState(() => _items.removeAt(i)),
                                  icon: const Icon(
                                    Icons.close_rounded,
                                    size: 18,
                                    color: AppColors.inkFaint,
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
              const SizedBox(height: 10),
              AppButton(
                label: '+ Add exercise',
                variant: AppButtonVariant.ghost,
                onPressed: _addExercise,
              ),
              const SizedBox(height: 10),
              AppButton(label: 'Save', loading: _saving, onPressed: _save),
            ],
          ),
        ),
      ),
    );
  }
}

class _ExercisePickerSheet extends StatefulWidget {
  const _ExercisePickerSheet();

  @override
  State<_ExercisePickerSheet> createState() => _ExercisePickerSheetState();
}

class _ExercisePickerSheetState extends State<_ExercisePickerSheet> {
  List<Exercise>? _exercises;
  String _search = '';
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final exercises = await getIt<ExerciseRepository>().active();
      if (!mounted) return;
      setState(() => _exercises = exercises);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = (_exercises ?? const [])
        .where((e) => e.name.toLowerCase().contains(_search.toLowerCase()))
        .toList();
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 18,
          right: 18,
          top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.7,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Add exercise', style: AppText.display(size: 16)),
              const SizedBox(height: 12),
              TextField(
                onChanged: (v) => setState(() => _search = v),
                style: AppText.body(size: 14, weight: FontWeight.w600),
                decoration: InputDecoration(
                  hintText: 'Search exercises…',
                  hintStyle: AppText.body(size: 14, color: AppColors.inkFaint),
                  filled: true,
                  fillColor: AppColors.surface2,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadii.field),
                    borderSide: const BorderSide(color: AppColors.line),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadii.field),
                    borderSide: const BorderSide(color: AppColors.line),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: _error != null
                    ? AppErrorView(message: _error!, onRetry: _load)
                    : _exercises == null
                        ? const AppLoadingView()
                        : ListView.builder(
                            itemCount: filtered.length,
                            itemBuilder: (context, i) {
                              final exercise = filtered[i];
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                title: Text(
                                  exercise.name,
                                  style: AppText.body(
                                    size: 14,
                                    weight: FontWeight.w700,
                                  ),
                                ),
                                subtitle: Text(
                                  exercise.muscleGroup ?? '—',
                                  style: AppText.body(
                                    size: 11,
                                    color: AppColors.inkFaint,
                                  ),
                                ),
                                onTap: () =>
                                    Navigator.of(context).pop(exercise),
                              );
                            },
                          ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
