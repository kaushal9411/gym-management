import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/diet_plan.dart';
import '../../../../models/food.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../diet_ui.dart';
import '../meal_draft.dart';
import 'food_picker.dart';

/// Edits a [MealPlanDraft] in place - web's meal builder: one card per meal
/// slot (all seven, a diet plan repeats every day so there is no day axis),
/// each row a food with its quantity, a note and a remove button, and an Add
/// button that picks foods from the library (new rows start at 1 serving).
///
/// The widget mutates [draft] and calls [onChanged]; the parent owns saving
/// (the API replaces the whole meal list - see [MealPlanDraft.toDrafts]).
/// [pickFoods] picks the foods for a slot; the default is the bottom-sheet
/// picker, the Trainer's builder passes its `AddToMealScreen` route instead.
class MealBuilderEditor extends StatefulWidget {
  const MealBuilderEditor({
    super.key,
    required this.draft,
    required this.onChanged,
    this.readOnly = false,
    this.pickFoods,
  });

  final MealPlanDraft draft;
  final VoidCallback onChanged;
  final bool readOnly;
  final Future<List<Food>?> Function(MealType type)? pickFoods;

  @override
  State<MealBuilderEditor> createState() => _MealBuilderEditorState();
}

class _MealBuilderEditorState extends State<MealBuilderEditor> {
  void _changed() {
    setState(() {});
    widget.onChanged();
  }

  Future<void> _add(MealType type) async {
    final picked = widget.pickFoods != null
        ? await widget.pickFoods!(type)
        : await showFoodPickerSheet(context, title: 'Add to ${type.label}');
    if (picked == null || picked.isEmpty || !mounted) return;
    widget.draft
        .slot(type)
        .addAll([for (final f in picked) MealDraft(food: f)]);
    _changed();
  }

  void _remove(MealType type, int i) {
    widget.draft.slot(type).removeAt(i);
    _changed();
  }

  Future<void> _editNotes(MealDraft d) async {
    final result = await showDialog<String>(
      context: context,
      builder: (_) => _NotesDialog(name: d.food.name, initial: d.notes ?? ''),
    );
    if (result == null || !mounted) return;
    d.notes = result.isEmpty ? null : result;
    _changed();
  }

  Widget _card(MealType type) {
    final color = mealColor(type);
    final items = widget.draft.slot(type);
    return Container(
      key: ValueKey('slot-${type.apiValue}'),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          MealHeading(
            type: type,
            count: items.length,
            trailing: widget.readOnly
                ? null
                : IconButton(
                    key: ValueKey('add-${type.apiValue}'),
                    tooltip: 'Add food to ${type.label}',
                    visualDensity: VisualDensity.compact,
                    icon: Icon(Icons.add_circle_rounded, color: color),
                    onPressed: () => _add(type),
                  ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
            child: items.isEmpty
                ? Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      'No foods added.',
                      style: AppText.body(
                        size: 12,
                        weight: FontWeight.w600,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  )
                : Column(
                    children: [
                      for (var i = 0; i < items.length; i++) ...[
                        if (i > 0) const SizedBox(height: 8),
                        _Row(
                          key: ValueKey('meal-${items[i].key}'),
                          draft: items[i],
                          color: color,
                          readOnly: widget.readOnly,
                          onQty: (q) {
                            items[i].quantity = q;
                            _changed();
                          },
                          onNotes: () => _editNotes(items[i]),
                          onRemove: () => _remove(type, i),
                        ),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cards = [for (final t in MealType.values) _card(t)];
    return LayoutBuilder(
      builder: (context, c) {
        Widget stack(List<Widget> items) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < items.length; i++) ...[
                  if (i > 0) const SizedBox(height: 12),
                  items[i],
                ],
              ],
            );
        if (c.maxWidth < 720) return stack(cards);
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: stack([
                for (var i = 0; i < cards.length; i += 2) cards[i],
              ]),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: stack([
                for (var i = 1; i < cards.length; i += 2) cards[i],
              ]),
            ),
          ],
        );
      },
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    super.key,
    required this.draft,
    required this.color,
    required this.readOnly,
    required this.onQty,
    required this.onNotes,
    required this.onRemove,
  });

  final MealDraft draft;
  final Color color;
  final bool readOnly;
  final ValueChanged<double> onQty;
  final VoidCallback onNotes;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final f = draft.food;
    final deleted = f.deletedAt != null;
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 8, 4, 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(13),
        border: Border.all(
          color: deleted
              ? TeamColors.rose.withValues(alpha: 0.6)
              : color.withValues(alpha: 0.16),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      f.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 13, weight: FontWeight.w800),
                    ),
                    if (deleted)
                      Text(
                        'This food was deleted - remove it to save the plan.',
                        style: AppText.body(
                          size: 11,
                          weight: FontWeight.w700,
                          color: TeamColors.rose,
                        ),
                      )
                    else if ((f.servingSize ?? '').isNotEmpty ||
                        f.calories != null)
                      Text(
                        [
                          if ((f.servingSize ?? '').isNotEmpty) f.servingSize!,
                          if (f.calories != null) '${f.calories} kcal',
                        ].join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 11,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
                        ),
                      ),
                  ],
                ),
              ),
              if (readOnly)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Text(
                    '×${qtyLabel(draft.quantity)}',
                    style: AppText.display(size: 14, color: color),
                  ),
                )
              else ...[
                _QtyField(
                  key: ValueKey('qty-${draft.key}'),
                  value: draft.quantity,
                  color: color,
                  onChanged: onQty,
                ),
                IconButton(
                  key: ValueKey('notes-${draft.key}'),
                  tooltip: 'Note',
                  visualDensity: VisualDensity.compact,
                  icon: Icon(
                    Icons.edit_note_rounded,
                    size: 20,
                    color: (draft.notes ?? '').isEmpty
                        ? AppColors.inkFaint
                        : color,
                  ),
                  onPressed: onNotes,
                ),
                IconButton(
                  key: ValueKey('remove-${draft.key}'),
                  tooltip: 'Remove ${f.name}',
                  visualDensity: VisualDensity.compact,
                  icon: Icon(
                    Icons.close_rounded,
                    size: 19,
                    color: AppColors.danger.withValues(alpha: 0.85),
                  ),
                  onPressed: onRemove,
                ),
              ],
            ],
          ),
          if ((draft.notes ?? '').isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 2, right: 8),
              child: Text(
                draft.notes!,
                style: AppText.body(
                  size: 11.5,
                  weight: FontWeight.w600,
                  color: AppColors.inkSoft,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// [-] [ 1.5 ] [+] servings control. Typing commits any positive number; the
/// buttons step by a quarter serving.
class _QtyField extends StatefulWidget {
  const _QtyField({
    super.key,
    required this.value,
    required this.color,
    required this.onChanged,
  });

  final double value;
  final Color color;
  final ValueChanged<double> onChanged;

  @override
  State<_QtyField> createState() => _QtyFieldState();
}

class _QtyFieldState extends State<_QtyField> {
  late final _c = TextEditingController(text: qtyLabel(widget.value));

  @override
  void didUpdateWidget(covariant _QtyField old) {
    super.didUpdateWidget(old);
    // Buttons change the value from outside; typing keeps the text as typed.
    if (double.tryParse(_c.text) != widget.value) {
      _c.text = qtyLabel(widget.value);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _step(double delta) {
    final next = ((widget.value + delta) * 100).round() / 100;
    widget.onChanged(next < 0.25 ? 0.25 : next);
  }

  @override
  Widget build(BuildContext context) {
    Widget btn(IconData icon, String tip, double delta) => InkWell(
          borderRadius: BorderRadius.circular(9),
          onTap: () => _step(delta),
          child: Tooltip(
            message: tip,
            child: Container(
              width: 28,
              height: 30,
              decoration: BoxDecoration(
                color: widget.color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(icon, size: 16, color: widget.color),
            ),
          ),
        );
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        btn(Icons.remove_rounded, 'Less', -0.25),
        SizedBox(
          width: 46,
          child: TextField(
            controller: _c,
            textAlign: TextAlign.center,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d{0,3}\.?\d{0,2}')),
            ],
            style: AppText.body(size: 13, weight: FontWeight.w800),
            decoration: const InputDecoration(
              isDense: true,
              border: InputBorder.none,
              contentPadding: EdgeInsets.symmetric(vertical: 6),
            ),
            onChanged: (v) {
              final q = double.tryParse(v);
              if (q != null && q > 0) widget.onChanged(q);
            },
          ),
        ),
        btn(Icons.add_rounded, 'More', 0.25),
      ],
    );
  }
}

class _NotesDialog extends StatefulWidget {
  const _NotesDialog({required this.name, required this.initial});

  final String name;
  final String initial;

  @override
  State<_NotesDialog> createState() => _NotesDialogState();
}

class _NotesDialogState extends State<_NotesDialog> {
  late final _c = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppColors.surface2,
      title: Text(
        'Note - ${widget.name}',
        style: AppText.display(size: 16),
      ),
      content: TextField(
        controller: _c,
        maxLines: 3,
        maxLength: 1000,
        style: AppText.body(size: 13, weight: FontWeight.w600),
        decoration: const InputDecoration(hintText: 'Optional note'),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(_c.text.trim()),
          child: const Text('Save'),
        ),
      ],
    );
  }
}
