import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/diet_plan.dart';
import '../../../models/food.dart';
import '../../../repositories/food_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "8a. + Add to meal".
class AddToMealScreen extends StatefulWidget {
  const AddToMealScreen({required this.mealType, super.key});

  final MealType mealType;

  @override
  State<AddToMealScreen> createState() => _AddToMealScreenState();
}

class _AddToMealScreenState extends State<AddToMealScreen> {
  final _searchController = TextEditingController();
  List<Food>? _foods;
  String? _error;
  final List<Food> _selected = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
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
    final search = _searchController.text.trim().toLowerCase();
    final filtered = (_foods ?? const [])
        .where((f) => f.name.toLowerCase().contains(search))
        .toList();

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text(
          'Add to ${widget.mealType.label}',
          style: AppText.display(size: 18),
        ),
      ),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: _searchController,
                onChanged: (_) => setState(() {}),
                style: AppText.body(size: 14, weight: FontWeight.w600),
                decoration: InputDecoration(
                  hintText: 'Search foods…',
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
              if (_error != null) ...[
                FormAlert(message: _error!),
                const SizedBox(height: 10),
              ],
              Expanded(
                child: _foods == null
                    ? const AppLoadingView()
                    : ListView.separated(
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          final food = filtered[i];
                          final picked = _selected.contains(food);
                          final macro = [
                            if (food.calories != null) '${food.calories} kcal',
                            if (food.protein != null)
                              '${food.protein!.toStringAsFixed(0)}g protein',
                          ].join(' · ');
                          return Material(
                            color: Colors.transparent,
                            child: InkWell(
                              borderRadius: BorderRadius.circular(
                                AppRadii.card,
                              ),
                              onTap: () => setState(() {
                                picked
                                    ? _selected.remove(food)
                                    : _selected.add(food);
                              }),
                              child: Container(
                                padding: const EdgeInsets.all(12),
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
                                            food.name,
                                            style: AppText.body(
                                              size: 13,
                                              weight: FontWeight.w700,
                                            ),
                                          ),
                                          if (macro.isNotEmpty)
                                            Text(
                                              macro,
                                              style: AppText.body(
                                                size: 11,
                                                color: AppColors.inkFaint,
                                              ),
                                            ),
                                        ],
                                      ),
                                    ),
                                    Container(
                                      width: 28,
                                      height: 28,
                                      decoration: BoxDecoration(
                                        gradient: AppColors.staffGrad,
                                        borderRadius: BorderRadius.circular(9),
                                      ),
                                      alignment: Alignment.center,
                                      child: Icon(
                                        picked
                                            ? Icons.check_rounded
                                            : Icons.add_rounded,
                                        size: 16,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
              ),
              const SizedBox(height: 10),
              AppButton(
                label: 'Save meal',
                onPressed:
                    _selected.isEmpty ? null : () => context.pop(_selected),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
