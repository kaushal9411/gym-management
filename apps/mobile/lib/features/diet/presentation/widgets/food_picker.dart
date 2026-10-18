import 'package:flutter/material.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/food.dart';
import '../../../../repositories/food_repository.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../../team/presentation/widgets/team_ui.dart';

/// Search + multi-select list of the tenant's active foods (`GET
/// /foods/active`) - web's "Food" select in the meal builder. [onDone] gets
/// the ticked foods (in the order they were ticked). Hosted by
/// [showFoodPickerSheet] (the catalog's meal builder) and by the Trainer's
/// `AddToMealScreen` page.
class FoodPicker extends StatefulWidget {
  const FoodPicker({
    super.key,
    required this.onDone,
    this.actionLabel = 'Add',
    this.excludeIds = const {},
  });

  final ValueChanged<List<Food>> onDone;

  /// Verb on the confirm button ("Add 3 foods" / "Save meal").
  final String actionLabel;

  /// Foods to hide (already in the slot).
  final Set<String> excludeIds;

  @override
  State<FoodPicker> createState() => _FoodPickerState();
}

class _FoodPickerState extends State<FoodPicker> {
  final _search = TextEditingController();
  List<Food>? _foods;
  String? _error;
  final List<Food> _picked = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final foods = await getIt<FoodRepository>().active();
      if (!mounted) return;
      setState(() => _foods = foods);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not load foods ($e)');
    }
  }

  bool _isPicked(Food f) => _picked.any((p) => p.id == f.id);

  void _toggle(Food f) => setState(() {
        if (_isPicked(f)) {
          _picked.removeWhere((p) => p.id == f.id);
        } else {
          _picked.add(f);
        }
      });

  @override
  Widget build(BuildContext context) {
    final q = _search.text.trim().toLowerCase();
    final shown = [
      for (final f in _foods ?? const <Food>[])
        if (!widget.excludeIds.contains(f.id) &&
            (q.isEmpty ||
                f.name.toLowerCase().contains(q) ||
                (f.category ?? '').toLowerCase().contains(q)))
          f,
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _search,
          onChanged: (_) => setState(() {}),
          style: AppText.body(size: 14, weight: FontWeight.w600),
          decoration: InputDecoration(
            hintText: 'Search foods…',
            hintStyle: AppText.body(size: 14, color: AppColors.inkFaint),
            filled: true,
            fillColor: AppColors.surface3,
            prefixIcon: Icon(
              Icons.search_rounded,
              size: 19,
              color: AppColors.inkFaint,
            ),
            contentPadding: const EdgeInsets.symmetric(vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.field),
              borderSide: BorderSide.none,
            ),
          ),
        ),
        const SizedBox(height: 10),
        Expanded(
          child: _error != null
              ? AppErrorView(message: _error!, onRetry: _load)
              : _foods == null
                  ? const AppLoadingView()
                  : shown.isEmpty
                      ? AppEmptyState(
                          icon: Icons.search_off_outlined,
                          title: (_foods ?? const []).isEmpty
                              ? 'No active foods yet'
                              : 'No foods found',
                          message: (_foods ?? const []).isEmpty
                              ? 'Add foods to the food library first.'
                              : 'Try a different search.',
                        )
                      : ListView.separated(
                          itemCount: shown.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (context, i) => _FoodTile(
                            key: ValueKey('food-${shown[i].id}'),
                            food: shown[i],
                            picked: _isPicked(shown[i]),
                            onTap: () => _toggle(shown[i]),
                          ),
                        ),
        ),
        const SizedBox(height: 10),
        TeamGradientButton(
          label: _picked.isEmpty
              ? widget.actionLabel
              : '${widget.actionLabel} ${_picked.length} '
                  '${_picked.length == 1 ? 'food' : 'foods'}',
          icon: Icons.check_rounded,
          onTap: _picked.isEmpty ? null : () => widget.onDone([..._picked]),
        ),
      ],
    );
  }
}

class _FoodTile extends StatelessWidget {
  const _FoodTile({
    super.key,
    required this.food,
    required this.picked,
    required this.onTap,
  });

  final Food food;
  final bool picked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final macro = [
      if (food.servingSize != null && food.servingSize!.isNotEmpty)
        food.servingSize!,
      if (food.calories != null) '${food.calories} kcal',
      if (food.protein != null) '${food.protein!.toStringAsFixed(0)}g protein',
    ].join(' · ');
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: picked
                ? TeamColors.violet.withValues(alpha: 0.10)
                : AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(
              color: picked ? TeamColors.violet : AppColors.line,
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      food.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 13.5, weight: FontWeight.w800),
                    ),
                    if (macro.isNotEmpty)
                      Text(
                        macro,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 11.5,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w600,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  gradient: picked ? TeamColors.cta : null,
                  color: picked ? null : AppColors.surface3,
                  borderRadius: BorderRadius.circular(9),
                ),
                alignment: Alignment.center,
                child: Icon(
                  picked ? Icons.check_rounded : Icons.add_rounded,
                  size: 16,
                  color: picked ? Colors.white : AppColors.inkFaint,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bottom sheet around [FoodPicker]; resolves to the picked foods (null when
/// dismissed).
Future<List<Food>?> showFoodPickerSheet(
  BuildContext context, {
  required String title,
  Set<String> excludeIds = const {},
}) {
  return showTeamSheet<List<Food>>(
    context,
    (sheetContext) => TeamSheetScaffold(
      icon: Icons.restaurant_menu_rounded,
      title: title,
      subtitle: 'Tick one or more foods',
      color: TeamColors.violet,
      child: SizedBox(
        height: MediaQuery.of(sheetContext).size.height * 0.55,
        child: FoodPicker(
          excludeIds: excludeIds,
          onDone: (foods) => Navigator.of(sheetContext).pop(foods),
        ),
      ),
    ),
  );
}
