import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/diet_plan.dart';
import '../../../../models/food.dart';
import '../../../../repositories/diet_plan_repository.dart';
import '../../../../repositories/food_repository.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_pill.dart';
import '../../../../shared/widgets/app_state_views.dart';

class _MealItem {
  _MealItem({required this.food, this.quantity = 1, this.notes});

  final Food food;
  double quantity;
  String? notes;
}

/// A plan's whole meal builder — one section per [MealType] (all 7 values;
/// the Trainer's own `MealBuilderScreen` only exposes Breakfast/Lunch/
/// Dinner, a real gap this fills for the Owner/Manager catalog form). Each
/// item carries food + quantity + notes, matching `PlanMealDraft`'s full
/// field set. One "Save meal plan" button full-replaces the whole list via
/// `PATCH /diet-plans/:id/meals`, same mechanics as [WeeklyExerciseEditor].
class MealTypeEditor extends StatefulWidget {
  const MealTypeEditor({super.key, required this.plan, required this.onSaved});

  final DietPlan plan;
  final ValueChanged<DietPlan> onSaved;

  @override
  State<MealTypeEditor> createState() => _MealTypeEditorState();
}

class _MealTypeEditorState extends State<MealTypeEditor> {
  late final Map<MealType, List<_MealItem>> _byType = {
    for (final type in MealType.values)
      type: (widget.plan.mealsByType[type] ?? const [])
          .map(
            (m) => _MealItem(
              food: m.food,
              quantity: m.quantity,
              notes: m.notes,
            ),
          )
          .toList(),
  };
  bool _saving = false;
  String? _error;

  Future<void> _addFood(MealType type) async {
    final food = await showModalBottomSheet<Food>(
      context: context,
      backgroundColor: AppColors.surface2,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
      ),
      builder: (_) => const _FoodPickerSheet(),
    );
    if (food == null || !mounted) return;
    setState(() => _byType[type]!.add(_MealItem(food: food)));
  }

  Future<void> _editNotes(_MealItem item) async {
    final controller = TextEditingController(text: item.notes ?? '');
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface2,
        title: Text('Notes — ${item.food.name}'),
        content: TextField(
          controller: controller,
          maxLines: 3,
          style: AppText.body(size: 13, weight: FontWeight.w600),
          decoration: const InputDecoration(hintText: 'Optional notes'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (result == null || !mounted) return;
    setState(() => item.notes = result.isEmpty ? null : result);
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final drafts = <PlanMealDraft>[];
      _byType.forEach((type, items) {
        for (final item in items) {
          drafts.add(
            PlanMealDraft(
              foodId: item.food.id,
              mealType: type,
              quantity: item.quantity,
              notes: item.notes,
            ),
          );
        }
      });
      final updated =
          await getIt<DietPlanRepository>().setMeals(widget.plan.id, drafts);
      if (!mounted) return;
      widget.onSaved(updated);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Meal plan saved.')),
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
                Icons.restaurant_menu_rounded,
                size: 15,
                color: AppColors.staffPillFg,
              ),
              const SizedBox(width: 6),
              Text('Meal plan', style: AppText.eyebrow()),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Covers all 7 meal slots — leave a section empty to skip it.',
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
          for (final type in MealType.values) ...[
            _MealSection(
              type: type,
              items: _byType[type]!,
              onAdd: () => _addFood(type),
              onRemove: (i) => setState(() => _byType[type]!.removeAt(i)),
              onQuantityChanged: (i, q) =>
                  setState(() => _byType[type]![i].quantity = q),
              onEditNotes: (item) => _editNotes(item),
            ),
            const SizedBox(height: 10),
          ],
          AppButton(
            label: 'Save meal plan',
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

class _MealSection extends StatelessWidget {
  const _MealSection({
    required this.type,
    required this.items,
    required this.onAdd,
    required this.onRemove,
    required this.onQuantityChanged,
    required this.onEditNotes,
  });

  final MealType type;
  final List<_MealItem> items;
  final VoidCallback onAdd;
  final ValueChanged<int> onRemove;
  final void Function(int index, double quantity) onQuantityChanged;
  final ValueChanged<_MealItem> onEditNotes;

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
                type.label,
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
                'No foods added',
                style: AppText.body(size: 11, color: AppColors.inkFaint),
              ),
            )
          else
            for (var i = 0; i < items.length; i++)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            items[i].food.name,
                            style:
                                AppText.body(size: 12, weight: FontWeight.w600),
                          ),
                          if (items[i].notes != null &&
                              items[i].notes!.isNotEmpty)
                            Text(
                              items[i].notes!,
                              style: AppText.body(
                                size: 10,
                                color: AppColors.inkFaint,
                              ),
                            ),
                        ],
                      ),
                    ),
                    SizedBox(
                      width: 46,
                      child: TextFormField(
                        initialValue: _formatQuantity(items[i].quantity),
                        textAlign: TextAlign.center,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(
                            RegExp(r'^\d*\.?\d{0,2}'),
                          ),
                        ],
                        style: AppText.body(size: 12, weight: FontWeight.w700),
                        decoration: const InputDecoration(
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(vertical: 6),
                        ),
                        onChanged: (v) =>
                            onQuantityChanged(i, double.tryParse(v) ?? 1),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => onEditNotes(items[i]),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        child: Icon(
                          Icons.edit_note_rounded,
                          size: 17,
                          color: items[i].notes == null
                              ? AppColors.inkFaint
                              : AppColors.staffPillFg,
                        ),
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

  String _formatQuantity(double q) =>
      q == q.roundToDouble() ? q.toStringAsFixed(0) : q.toString();
}

class _FoodPickerSheet extends StatefulWidget {
  const _FoodPickerSheet();

  @override
  State<_FoodPickerSheet> createState() => _FoodPickerSheetState();
}

class _FoodPickerSheetState extends State<_FoodPickerSheet> {
  List<Food>? _foods;
  String _search = '';
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final foods = await getIt<FoodRepository>().active();
      if (!mounted) return;
      setState(() => _foods = foods);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = (_foods ?? const [])
        .where((f) => f.name.toLowerCase().contains(_search.toLowerCase()))
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
            Text('Add food', style: AppText.display(size: 16)),
            const SizedBox(height: 12),
            TextField(
              onChanged: (v) => setState(() => _search = v),
              style: AppText.body(size: 14, weight: FontWeight.w600),
              decoration: InputDecoration(
                hintText: 'Search foods…',
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
                  : _foods == null
                      ? const AppLoadingView()
                      : filtered.isEmpty
                          ? const AppEmptyState(
                              icon: Icons.search_off_outlined,
                              title: 'No foods found',
                            )
                          : ListView.builder(
                              itemCount: filtered.length,
                              itemBuilder: (context, i) {
                                final food = filtered[i];
                                return ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  title: Text(
                                    food.name,
                                    style: AppText.body(
                                      size: 14,
                                      weight: FontWeight.w700,
                                    ),
                                  ),
                                  subtitle: Text(
                                    food.servingSize ?? '—',
                                    style: AppText.body(
                                      size: 11,
                                      color: AppColors.inkFaint,
                                    ),
                                  ),
                                  trailing: food.calories != null
                                      ? AppPill(
                                          label: '${food.calories} kcal',
                                          tone: AppPillTone.roleTint,
                                        )
                                      : null,
                                  onTap: () => Navigator.of(context).pop(food),
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
