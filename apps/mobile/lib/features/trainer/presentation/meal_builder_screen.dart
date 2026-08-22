import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/diet_plan.dart';
import '../../../models/food.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/diet_plan_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';

const _mealSections = [MealType.breakfast, MealType.lunch, MealType.dinner];

/// Design frame "8. Meal builder" — Breakfast/Lunch/Dinner sections only
/// (the backend's `MealType` has 7 values; the design shows exactly these
/// 3). "Save plan" persists the meal list only (`PATCH .../meals`);
/// "Assign to {member}" is a separate step so the trainer can save changes
/// without re-assigning (or re-assign later without editing meals).
class MealBuilderScreen extends StatefulWidget {
  const MealBuilderScreen({
    required this.planId,
    required this.member,
    super.key,
  });

  final String planId;
  final GymMember member;

  @override
  State<MealBuilderScreen> createState() => _MealBuilderScreenState();
}

class _MealBuilderScreenState extends State<MealBuilderScreen> {
  DietPlan? _plan;
  final Map<MealType, List<Food>> _mealFoods = {};
  bool _loading = true;
  bool _saving = false;
  bool _assigning = false;
  String? _error;

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
      final plan = await getIt<DietPlanRepository>().getById(widget.planId);
      if (!mounted) return;
      setState(() {
        _plan = plan;
        _mealFoods.clear();
        plan.mealsByType.forEach((type, meals) {
          _mealFoods[type] = meals.map((m) => m.food).toList();
        });
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _addToMeal(MealType type) async {
    final added = await context.push<List<Food>>(
      AppRoutes.trainerAddToMeal,
      extra: type,
    );
    if (added == null || added.isEmpty || !mounted) return;
    setState(
      () => (_mealFoods[type] ??= []).addAll(added),
    );
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final drafts = <PlanMealDraft>[];
      for (final type in _mealSections) {
        for (final food in _mealFoods[type] ?? const <Food>[]) {
          drafts.add(PlanMealDraft(foodId: food.id, mealType: type));
        }
      }
      await getIt<DietPlanRepository>().setMeals(widget.planId, drafts);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Plan saved.')));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _assign() async {
    setState(() {
      _assigning = true;
      _error = null;
    });
    try {
      await getIt<DietPlanRepository>().assign(
        planId: widget.planId,
        memberId: widget.member.id,
        startDate: DateTime.now(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Assigned to ${widget.member.name}')),
      );
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _assigning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final plan = _plan;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: plan == null
            ? null
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(plan.name, style: AppText.display(size: 18)),
                  Text(
                    plan.dailyCalories != null
                        ? '${plan.dailyCalories} kcal target'
                        : '${plan.durationDays} days',
                    style: AppText.eyebrow(),
                  ),
                ],
              ),
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const AppLoadingView()
            : _error != null && plan == null
                ? AppErrorView(message: _error!, onRetry: _load)
                : plan == null
                    ? const SizedBox.shrink()
                    : SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (_error != null) ...[
                              FormAlert(message: _error!),
                              const SizedBox(height: 10),
                            ],
                            for (final type in _mealSections) ...[
                              _MealSection(
                                type: type,
                                foods: _mealFoods[type] ?? const [],
                                onAdd: () => _addToMeal(type),
                                onRemove: (food) => setState(
                                  () => _mealFoods[type]?.remove(food),
                                ),
                              ),
                              const SizedBox(height: 10),
                            ],
                            const SizedBox(height: 6),
                            AppButton(
                              label: 'Save plan',
                              loading: _saving,
                              onPressed: _save,
                            ),
                            const SizedBox(height: 10),
                            AppButton(
                              label: 'Assign to ${widget.member.name}',
                              variant: AppButtonVariant.ghost,
                              loading: _assigning,
                              onPressed: _assign,
                            ),
                          ],
                        ),
                      ),
      ),
    );
  }
}

class _MealSection extends StatelessWidget {
  const _MealSection({
    required this.type,
    required this.foods,
    required this.onAdd,
    required this.onRemove,
  });

  final MealType type;
  final List<Food> foods;
  final VoidCallback onAdd;
  final ValueChanged<Food> onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(type.label, style: AppText.eyebrow()),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final food in foods)
                GestureDetector(
                  onTap: () => onRemove(food),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 11,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surface3,
                      borderRadius: BorderRadius.circular(AppRadii.pill),
                    ),
                    child: Text(
                      food.name,
                      style: AppText.body(
                        size: 11,
                        weight: FontWeight.w700,
                        color: AppColors.inkSoft,
                      ),
                    ),
                  ),
                ),
              GestureDetector(
                onTap: onAdd,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                  decoration: BoxDecoration(
                    gradient: AppColors.staffGrad,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                  child: Text(
                    '+ Add',
                    style: AppText.body(
                      size: 11,
                      weight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
