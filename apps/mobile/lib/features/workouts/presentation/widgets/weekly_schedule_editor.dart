import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/workout_plan.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../schedule_draft.dart';
import '../workout_ui.dart';
import 'exercise_picker_sheet.dart';

/// Edits a [ScheduleDraft] in place, like web's weekly schedule editor: a
/// Mon-Sun strip to choose the day, then that day's exercises as a list you
/// can reorder (drag the handle, within the day), remove from, and add to
/// from the exercise library (a new row takes the exercise's default sets,
/// reps and rest). With [singleDay] only that day is editable (the Trainer's
/// day editor) and the strip is hidden.
///
/// The widget mutates [draft] and calls [onChanged]; the parent owns saving
/// (the API replaces the whole schedule - see [ScheduleDraft.toDrafts]).
class WeeklyScheduleEditor extends StatefulWidget {
  const WeeklyScheduleEditor({
    super.key,
    required this.draft,
    required this.onChanged,
    this.singleDay,
    this.initialDay = WeekDay.monday,
    this.readOnly = false,
  });

  final ScheduleDraft draft;
  final VoidCallback onChanged;
  final WeekDay? singleDay;
  final WeekDay initialDay;
  final bool readOnly;

  @override
  State<WeeklyScheduleEditor> createState() => _WeeklyScheduleEditorState();
}

class _WeeklyScheduleEditorState extends State<WeeklyScheduleEditor> {
  late WeekDay _day = widget.singleDay ?? widget.initialDay;

  List<DraftExercise> get _items => widget.draft.day(_day);

  void _changed() {
    setState(() {});
    widget.onChanged();
  }

  Future<void> _add() async {
    final picked = await showExercisePicker(
      context,
      title: 'Add to ${_day.label}',
    );
    if (picked == null || !mounted) return;
    _items.add(DraftExercise.fresh(picked));
    _changed();
  }

  void _remove(int i) {
    _items.removeAt(i);
    _changed();
  }

  /// `onReorderItem` hands over the index already adjusted for the removal.
  void _reorder(int from, int to) {
    final item = _items.removeAt(from);
    _items.insert(to, item);
    _changed();
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    final color = dayColor(_day);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.singleDay == null) ...[
          WeekStrip(
            counts: widget.draft.counts,
            selected: _day,
            onTap: (d) => setState(() => _day = d),
          ),
          const SizedBox(height: 14),
        ],
        Row(
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                _day.label,
                style: AppText.display(size: 18, color: color),
              ),
            ),
            Text(
              items.isEmpty
                  ? 'Rest day'
                  : '${items.length} '
                      '${items.length == 1 ? 'exercise' : 'exercises'}',
              style: AppText.body(
                size: 12,
                weight: FontWeight.w700,
                color: AppColors.inkFaint,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (items.isEmpty)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 26, horizontal: 16),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.07),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: color.withValues(alpha: 0.25)),
            ),
            child: Column(
              children: [
                Icon(Icons.hotel_rounded, size: 32, color: color),
                const SizedBox(height: 8),
                Text(
                  'Rest day',
                  style: AppText.display(size: 16, color: color),
                ),
                const SizedBox(height: 2),
                Text(
                  widget.readOnly
                      ? 'No exercises on ${_day.label}.'
                      : 'Add an exercise to give ${_day.label} a workout.',
                  textAlign: TextAlign.center,
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
              ],
            ),
          )
        else if (widget.readOnly)
          Column(
            children: [
              for (var i = 0; i < items.length; i++) ...[
                if (i > 0) const SizedBox(height: 8),
                ExerciseTile(line: _line(items[i]), index: i + 1),
              ],
            ],
          )
        else
          ReorderableListView(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            buildDefaultDragHandles: false,
            onReorderItem: _reorder,
            proxyDecorator: (child, _, __) =>
                Material(color: Colors.transparent, child: child),
            children: [
              for (var i = 0; i < items.length; i++)
                Padding(
                  key: ValueKey(items[i].key),
                  padding: const EdgeInsets.only(bottom: 8),
                  child: ExerciseTile(
                    line: _line(items[i]),
                    index: i + 1,
                    trailing: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        ReorderableDragStartListener(
                          index: i,
                          child: Padding(
                            padding: const EdgeInsets.all(6),
                            child: Icon(
                              Icons.drag_indicator_rounded,
                              size: 20,
                              color: AppColors.inkFaint,
                            ),
                          ),
                        ),
                        InkWell(
                          key: ValueKey('remove-${items[i].key}'),
                          borderRadius: BorderRadius.circular(99),
                          onTap: () => _remove(i),
                          child: Padding(
                            padding: const EdgeInsets.all(6),
                            child: Icon(
                              Icons.close_rounded,
                              size: 18,
                              color: AppColors.danger.withValues(alpha: 0.8),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        if (!widget.readOnly) ...[
          const SizedBox(height: 6),
          TeamGradientButton(
            label: 'Add exercise',
            icon: Icons.add_rounded,
            onTap: _add,
          ),
        ],
      ],
    );
  }

  ExerciseLine _line(DraftExercise e) => ExerciseLine(
        name: e.exercise.name,
        muscle: e.exercise.muscleGroup,
        sets: e.sets,
        reps: e.reps,
      );
}
