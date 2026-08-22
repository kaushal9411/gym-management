import 'package:flutter/material.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/exercise.dart';
import '../../../../models/workout_plan.dart';
import '../../../../repositories/exercise_repository.dart';
import '../../../../repositories/workout_plan_repository.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_pill.dart';
import '../../../../shared/widgets/app_state_views.dart';

class _DayItem {
  _DayItem({required this.exercise, this.sets, this.reps});

  final Exercise exercise;
  int? sets;
  int? reps;
}

/// A plan's weekly recurring exercise schedule — one section per day of
/// the week, each with its own exercise list + "+ Add" picker. Web shows
/// this as a 2-column drag-reorderable grid; this mobile version keeps the
/// same "one save button replaces the whole schedule" mechanics
/// (`PATCH /workout-plans/:id/exercises`, full replace) but lays days out
/// as a vertical stack instead — more appropriate for a narrow screen than
/// trying to reproduce drag-and-drop.
class WeeklyExerciseEditor extends StatefulWidget {
  const WeeklyExerciseEditor({
    super.key,
    required this.plan,
    required this.onSaved,
  });

  final WorkoutPlan plan;
  final ValueChanged<WorkoutPlan> onSaved;

  @override
  State<WeeklyExerciseEditor> createState() => _WeeklyExerciseEditorState();
}

class _WeeklyExerciseEditorState extends State<WeeklyExerciseEditor> {
  late final Map<WeekDay, List<_DayItem>> _byDay = {
    for (final day in WeekDay.values)
      day: (widget.plan.exercisesByDay[day] ?? const [])
          .map(
            (e) => _DayItem(
              exercise: e.exercise,
              sets: e.sets,
              reps: e.repetitions,
            ),
          )
          .toList(),
  };
  bool _saving = false;
  String? _error;

  Future<void> _addExercise(WeekDay day) async {
    final exercise = await showModalBottomSheet<Exercise>(
      context: context,
      backgroundColor: AppColors.surface2,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
      ),
      builder: (_) => const _ExercisePickerSheet(),
    );
    if (exercise == null || !mounted) return;
    setState(
      () => _byDay[day]!.add(
        _DayItem(
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
      _byDay.forEach((day, items) {
        for (final item in items) {
          drafts.add(
            PlanExerciseDraft(
              exerciseId: item.exercise.id,
              dayOfWeek: day,
              sets: item.sets,
              repetitions: item.reps,
            ),
          );
        }
      });
      final updated = await getIt<WorkoutPlanRepository>().setExercises(
        widget.plan.id,
        drafts,
      );
      if (!mounted) return;
      widget.onSaved(updated);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Weekly schedule saved.')),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.calendar_view_week_rounded,
                size: 15,
                color: AppColors.staffPillFg,
              ),
              const SizedBox(width: 6),
              Text('Weekly schedule', style: AppText.eyebrow()),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Repeats every week for the duration of the plan.',
            style: AppText.body(size: 11, color: AppColors.inkFaint),
          ),
          const SizedBox(height: 12),
          if (_error != null) ...[
            Text(
              _error!,
              style: AppText.body(size: 12, color: AppColors.danger),
            ),
            const SizedBox(height: 8),
          ],
          for (final day in WeekDay.values) ...[
            _DaySection(
              day: day,
              items: _byDay[day]!,
              onAdd: () => _addExercise(day),
              onRemove: (i) => setState(() => _byDay[day]!.removeAt(i)),
            ),
            const SizedBox(height: 10),
          ],
          AppButton(
            label: 'Save weekly schedule',
            size: AppButtonSize.small,
            fullWidth: false,
            loading: _saving,
            onPressed: _save,
          ),
        ],
      ),
    );
  }
}

class _DaySection extends StatelessWidget {
  const _DaySection({
    required this.day,
    required this.items,
    required this.onAdd,
    required this.onRemove,
  });

  final WeekDay day;
  final List<_DayItem> items;
  final VoidCallback onAdd;
  final ValueChanged<int> onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.tile),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                day.label,
                style: AppText.body(size: 12, weight: FontWeight.w800),
              ),
              GestureDetector(
                onTap: onAdd,
                child: const Icon(
                  Icons.add_circle_outline_rounded,
                  size: 18,
                  color: AppColors.staffPillFg,
                ),
              ),
            ],
          ),
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Rest day',
                style: AppText.body(size: 11, color: AppColors.inkFaint),
              ),
            )
          else
            for (var i = 0; i < items.length; i++)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        items[i].sets != null && items[i].reps != null
                            ? '${items[i].exercise.name} · '
                                '${items[i].sets}×${items[i].reps}'
                            : items[i].exercise.name,
                        style: AppText.body(size: 12, weight: FontWeight.w600),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => onRemove(i),
                      child: const Icon(
                        Icons.close_rounded,
                        size: 15,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
              ),
        ],
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
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 18,
        bottom: MediaQuery.of(context).viewInsets.bottom + 18,
      ),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.65,
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
                prefixIcon: const Icon(
                  Icons.search_rounded,
                  color: AppColors.inkFaint,
                ),
                filled: true,
                fillColor: AppColors.surface3,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadii.field),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: _error != null
                  ? AppErrorView(message: _error!, onRetry: _load)
                  : _exercises == null
                      ? const AppLoadingView()
                      : filtered.isEmpty
                          ? const AppEmptyState(
                              icon: Icons.search_off_outlined,
                              title: 'No exercises found',
                            )
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
                                  trailing: exercise.muscleGroup != null
                                      ? AppPill(
                                          label: exercise.muscleGroup!,
                                          tone: AppPillTone.roleTint,
                                        )
                                      : null,
                                  onTap: () =>
                                      Navigator.of(context).pop(exercise),
                                );
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }
}
