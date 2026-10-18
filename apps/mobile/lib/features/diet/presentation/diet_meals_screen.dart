import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/diet_plan.dart';
import '../../../repositories/diet_plan_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'meal_draft.dart';
import 'widgets/meal_builder_editor.dart';

/// The meal builder for the Owner / Manager catalog - web's "Meal builder"
/// card (`PATCH /diet-plans/:id/meals`). One card per meal slot: add foods
/// from the library, change quantities, add a note, remove, then **Save meal
/// plan** (enabled once something changed). The API replaces the whole array,
/// so every save sends every slot - including each row's quantity and note.
///
/// Pushed from the plan page's Meals / Manage tabs, which only offer it with
/// `diets:update`; without it this screen is a read-only view. Pops `true`
/// after a successful save. Leaving with unsaved changes asks first.
class DietMealsScreen extends StatefulWidget {
  const DietMealsScreen({super.key, required this.planId});

  final String planId;

  @override
  State<DietMealsScreen> createState() => _DietMealsScreenState();
}

class _DietMealsScreenState extends State<DietMealsScreen> {
  DietPlan? _plan;
  MealPlanDraft? _draft;
  MealPlanDraft? _saved;
  String? _error;
  String? _saveError;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final plan = await getIt<DietPlanRepository>().getById(widget.planId);
      if (!mounted) return;
      setState(() {
        _plan = plan;
        _draft = MealPlanDraft.fromPlan(plan);
        _saved = MealPlanDraft.fromPlan(plan);
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not load this plan ($e)');
    }
  }

  bool get _dirty =>
      _draft != null && _saved != null && !_draft!.sameAs(_saved!);

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _saveError = null;
    });
    try {
      final updated = await getIt<DietPlanRepository>().setMeals(
        widget.planId,
        _draft!.toDrafts(),
      );
      if (!mounted) return;
      teamSnack(context, 'Meal plan saved.');
      setState(() {
        _plan = updated;
        _draft = MealPlanDraft.fromPlan(updated);
        _saved = MealPlanDraft.fromPlan(updated);
      });
      context.pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _saveError = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saveError = 'Something went wrong while saving ($e).');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _confirmLeave() async {
    final leave = await confirmTeam(
      context,
      title: 'Discard changes?',
      message: 'Your edits to this meal plan have not been saved.',
      confirmLabel: 'Discard',
      destructive: true,
    );
    if (leave && mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final plan = _plan;
    final draft = _draft;
    final canUpdate = teamCan(context, 'diets:update');
    final side = 16 + teamSideInset(context, maxWidth: 1000);
    return PopScope(
      canPop: !_dirty || _saving,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
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
              Text('Meal builder', style: AppText.display(size: 18)),
              if (plan != null) Text(plan.name, style: AppText.eyebrow()),
            ],
          ),
        ),
        bottomNavigationBar: plan == null || !canUpdate
            ? null
            : TeamBottomBar(
                child: TeamGradientButton(
                  label: 'Save meal plan',
                  icon: Icons.check_rounded,
                  loading: _saving,
                  gradient: TeamColors.ctaGreen,
                  onTap: _dirty && !_saving ? _save : null,
                ),
              ),
        body: SafeArea(
          top: false,
          child: _error != null
              ? AppErrorView(message: _error!, onRetry: _load)
              : draft == null
                  ? const AppLoadingView()
                  : SingleChildScrollView(
                      padding: EdgeInsets.fromLTRB(side, 8, side, 28),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (_saveError != null) ...[
                            FormAlert(message: _saveError!),
                            const SizedBox(height: 12),
                          ],
                          Text(
                            'Repeats every day for '
                            '${plan!.durationDays} '
                            '${plan.durationDays == 1 ? 'day' : 'days'}.',
                            style: AppText.body(
                              size: 12.5,
                              weight: FontWeight.w600,
                              color: AppColors.inkFaint,
                            ),
                          ),
                          const SizedBox(height: 14),
                          MealBuilderEditor(
                            draft: draft,
                            readOnly: !canUpdate,
                            onChanged: () => setState(() {}),
                          ),
                        ],
                      ),
                    ),
        ),
      ),
    );
  }
}
