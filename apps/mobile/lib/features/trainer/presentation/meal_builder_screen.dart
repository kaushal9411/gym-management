import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/diet_plan.dart';
import '../../../models/food.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/diet_plan_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../diet/presentation/diet_ui.dart';
import '../../diet/presentation/meal_draft.dart';
import '../../diet/presentation/widgets/assign_diet_panel.dart';
import '../../diet/presentation/widgets/meal_builder_editor.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../plans/presentation/plan_ui.dart' show PlanHeroShell;
import '../../team/presentation/widgets/team_ui.dart';

/// Design frame "8. Meal builder", redesigned: the plan's hero, the meal
/// builder (one card per meal slot - food, quantity, note) with "Save plan",
/// and the "Assign to client" card. The client is already fixed by the flow
/// that got us here (My Clients -> Assign), so the card shows them instead of
/// a search and adds a start-date calendar (the old screen always started
/// today). "Save plan" persists the meal list only (`PATCH .../meals`);
/// assigning is a separate step so the trainer can save changes without
/// re-assigning (or re-assign later without editing meals). Assigning pops
/// back to the plan list, as before.
///
/// The old screen exposed only Breakfast / Lunch / Dinner and re-sent just
/// those foods (no quantity, no note) - which, because `PATCH .../meals`
/// replaces the whole list, silently wiped the other four slots, quantities
/// and notes of any plan that had them. The builder now carries all seven
/// slots and every row's quantity + note.
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
  MealPlanDraft? _draft;
  MealPlanDraft? _saved;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _saveError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _plan == null;
      _error = null;
    });
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
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _dirty =>
      _draft != null && _saved != null && !_draft!.sameAs(_saved!);

  /// Foods for a slot come from the `AddToMealScreen` route, as before.
  Future<List<Food>?> _pick(MealType type) =>
      context.push<List<Food>>(AppRoutes.trainerAddToMeal, extra: type);

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
      teamSnack(context, 'Plan saved.');
      setState(() {
        _plan = updated;
        _draft = MealPlanDraft.fromPlan(updated);
        _saved = MealPlanDraft.fromPlan(updated);
      });
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

  @override
  Widget build(BuildContext context) {
    final plan = _plan;
    final hero = plan != null && _error == null;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: hero,
      appBar: AppBar(
        backgroundColor: hero ? Colors.transparent : AppColors.bg,
        foregroundColor: hero ? Colors.white : null,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(hero ? 'Diet plan' : 'Diet plans'),
      ),
      body: SafeArea(
        top: false,
        child: _loading && plan == null
            ? const AppLoadingView()
            : _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : plan == null || _draft == null
                    ? const SizedBox.shrink()
                    : _content(plan, _draft!),
      ),
    );
  }

  Widget _content(DietPlan plan, MealPlanDraft draft) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final tone = dietTone(deleted: plan.isDeleted, active: plan.isActive);
    final side = 16 + teamSideInset(context, maxWidth: 1000);
    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          PlanHeroShell(
            topInset: top,
            child: Column(
              children: [
                FadeUp(
                  index: 0,
                  child: SpinningRing(
                    size: 92,
                    child: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFF312E81), Color(0xFFC026D3)],
                        ),
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.restaurant_rounded,
                          size: 40,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                FadeUp(
                  index: 1,
                  child: Text(
                    plan.name,
                    textAlign: TextAlign.center,
                    style: AppText.display(size: 25, color: Colors.white),
                  ),
                ),
                const SizedBox(height: 4),
                FadeUp(
                  index: 2,
                  child: Text(
                    'For ${widget.member.name}',
                    style: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                FadeUp(
                  index: 3,
                  child: Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      TeamHeroPill(
                        dietStatus(
                          deleted: plan.isDeleted,
                          active: plan.isActive,
                        ),
                        dot: tone,
                      ),
                      TeamHeroPill(
                        plan.dailyCalories != null
                            ? '${plan.dailyCalories} kcal target'
                            : daysLabel(plan.durationDays),
                        icon: Icons.local_fire_department_rounded,
                      ),
                      TeamHeroPill(
                        daysLabel(plan.durationDays),
                        icon: Icons.timelapse_rounded,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(side, 16, side, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                FadeUp(
                  index: 0,
                  child: TeamSectionCard(
                    icon: Icons.restaurant_menu_rounded,
                    color: TeamColors.violet,
                    title: 'Meal builder',
                    subtitle: 'Tap + on a meal to add foods from the library',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_saveError != null) ...[
                          FormAlert(message: _saveError!),
                          const SizedBox(height: 12),
                        ],
                        MealBuilderEditor(
                          draft: draft,
                          pickFoods: _pick,
                          onChanged: () => setState(() {}),
                        ),
                        const SizedBox(height: 14),
                        if (_dirty)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(
                              'Unsaved changes - save the plan before '
                              'assigning it.',
                              textAlign: TextAlign.center,
                              style: AppText.body(
                                size: 12,
                                weight: FontWeight.w700,
                                color: TeamColors.amber,
                              ),
                            ),
                          ),
                        TeamGradientButton(
                          label: 'Save plan',
                          icon: Icons.check_rounded,
                          loading: _saving,
                          onTap: _save,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                FadeUp(
                  index: 1,
                  child: TeamSectionCard(
                    icon: Icons.person_add_alt_1_rounded,
                    color: TeamColors.sky,
                    title: 'Assign to ${widget.member.name}',
                    subtitle: plan.isActive
                        ? 'Their current plan, if any, moves to history'
                        : 'This plan is inactive and cannot be assigned',
                    child: AssignDietPanel(
                      planId: plan.id,
                      member: widget.member,
                      onAssigned: (_) {
                        if (mounted) context.pop();
                      },
                    ),
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
