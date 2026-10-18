import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/diet_plan.dart';
import '../../../repositories/diet_plan_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../plans/presentation/plan_ui.dart' show PlanHeroShell;
import '../../team/presentation/widgets/team_ui.dart';
import 'diet_actions.dart';
import 'diet_ui.dart';
import 'meal_draft.dart';
import 'widgets/assign_diet_panel.dart';
import 'widgets/meal_builder_editor.dart';

/// Diet plan profile (`GET /diet-plans/:id`), redesigned to mirror web's
/// `/diet-plans/[planId]` page and the Membership / Workout Plan, Branch and
/// Staff profiles: animated gradient hero (status, duration, calories,
/// members, trainer; Edit / Duplicate / Activate), four summary tiles and
/// tabs.
///
/// - **Overview** - web's plan fields (description, goal, trainer, duration,
///   daily calories, notes); Edit (`diets:update`) opens the form.
/// - **Meals** - web's meal builder, read-only: one card per meal slot with
///   its foods and quantities. "Edit meals" (`diets:update`) opens the
///   builder.
/// - **Assign** (`diets:assign`, active plans only) - member search and a
///   start date, like web's "Assign to a member" card.
/// - **Manage** - the lifecycle actions web puts in the hero (Duplicate
///   `diets:create`, Activate / Deactivate `diets:update`, Delete
///   `diets:delete`).
///
/// Soft-deleted plans 404 on this endpoint, so the list opens a restore sheet
/// for them instead. Pops with a plan id when Duplicate created a draft (the
/// list opens it), else with null.
///
/// **Dropped vs. web**: nothing with an endpoint. Inline editing of the plan
/// fields moved to the Edit form (like the other redesigned catalogs), and
/// there is no "members on this plan" list because no endpoint provides one.
class DietPlanProfileScreen extends StatefulWidget {
  const DietPlanProfileScreen({super.key, required this.planId});

  final String planId;

  @override
  State<DietPlanProfileScreen> createState() => _DietPlanProfileScreenState();
}

class _DietPlanProfileScreenState extends State<DietPlanProfileScreen> {
  DietPlan? _plan;
  String? _error;
  bool _busy = false;
  int _tab = 0;

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
      setState(() => _plan = plan);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not load this plan ($e)');
    }
  }

  Future<void> _edit(DietPlan p) =>
      context.push(AppRoutes.dietPlanForm, extra: p.id).then((_) => _load());

  Future<void> _editMeals(DietPlan p) => context
      .push<bool>(AppRoutes.dietPlanMeals, extra: p.id)
      .then((_) => _load());

  Future<void> _run(DietAction action) async {
    final p = _plan!;
    setState(() => _busy = true);
    try {
      final r = await runDietAction(
        context,
        planId: p.id,
        planName: p.name,
        action: action,
      );
      if (!mounted || !r.ok) return;
      if (action == DietAction.delete) {
        context.pop();
        return;
      }
      if (action == DietAction.duplicate && r.created != null) {
        context.pop(r.created!.id);
        return;
      }
      await _load();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  List<DietAction> _actions(DietPlan p) => availableDietActions(
        deleted: p.isDeleted,
        active: p.isActive,
        canCreate: teamCan(context, 'diets:create'),
        canUpdate: teamCan(context, 'diets:update'),
        canDelete: teamCan(context, 'diets:delete'),
        canRestore: teamCan(context, 'diets:restore'),
      );

  List<String> _tabNames(DietPlan p) => [
        'Overview',
        'Meals',
        if (teamCan(context, 'diets:assign') && p.isActive && !p.isDeleted)
          'Assign',
        'Manage',
      ];

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final p = _plan;
    final hero = p != null && _error == null;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: hero,
      appBar: AppBar(
        backgroundColor: hero ? Colors.transparent : AppColors.bg,
        foregroundColor: hero ? Colors.white : null,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(hero ? 'Diet plan' : 'Diet Plans'),
        actions: [if (p != null && _error == null) _overflow(p)],
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : p == null
                ? const AppLoadingView()
                : _content(p),
      ),
    );
  }

  Widget _overflow(DietPlan p) {
    final canUpdate = teamCan(context, 'diets:update');
    final actions = _actions(p);
    if (!canUpdate && actions.isEmpty) return const SizedBox.shrink();
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert_rounded),
      color: AppColors.surface2,
      enabled: !_busy,
      onSelected: (v) {
        if (v == 'edit') {
          _edit(p);
        } else if (v == 'meals') {
          _editMeals(p);
        } else {
          _run(DietAction.values.firstWhere((a) => a.name == v));
        }
      },
      itemBuilder: (_) => [
        if (canUpdate && !p.isDeleted)
          const PopupMenuItem(value: 'edit', child: Text('Edit plan')),
        if (canUpdate && !p.isDeleted)
          const PopupMenuItem(value: 'meals', child: Text('Edit meals')),
        for (final a in actions)
          PopupMenuItem(
            value: a.name,
            child: Text(
              a.label,
              style: a == DietAction.delete
                  ? const TextStyle(color: AppColors.danger)
                  : null,
            ),
          ),
      ],
    );
  }

  Widget _content(DietPlan p) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final canUpdate = teamCan(context, 'diets:update');
    final canCreate = teamCan(context, 'diets:create');
    final tone = dietTone(deleted: p.isDeleted, active: p.isActive);
    final names = _tabNames(p);
    final tab = _tab.clamp(0, names.length - 1);
    final tabName = names[tab];

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
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      SpinningRing(
                        size: 104,
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
                              size: 44,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        left: 4,
                        top: 6,
                        child: Container(
                          padding: const EdgeInsets.all(3),
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: PulseDot(color: tone, size: 10),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                FadeUp(
                  index: 1,
                  child: Text(
                    p.name,
                    textAlign: TextAlign.center,
                    style: AppText.display(size: 27, color: Colors.white),
                  ),
                ),
                const SizedBox(height: 4),
                FadeUp(
                  index: 2,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.track_changes_rounded,
                        size: 14,
                        color: Colors.white70,
                      ),
                      const SizedBox(width: 5),
                      Flexible(
                        child: Text(
                          (p.goal ?? '').isEmpty ? 'No goal set' : p.goal!,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 12.5,
                            weight: FontWeight.w600,
                            color: Colors.white.withValues(alpha: 0.88),
                          ),
                        ),
                      ),
                    ],
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
                        dietStatus(deleted: p.isDeleted, active: p.isActive),
                        dot: tone,
                      ),
                      TeamHeroPill(
                        '${p.durationDays}d',
                        icon: Icons.timelapse_rounded,
                      ),
                      if (p.dailyCalories != null)
                        TeamHeroPill(
                          '${p.dailyCalories} kcal/day',
                          icon: Icons.local_fire_department_rounded,
                        ),
                      TeamHeroPill(
                        '${p.activeMemberCount} '
                        '${p.activeMemberCount == 1 ? 'member' : 'members'}',
                        icon: Icons.groups_rounded,
                      ),
                      if (p.trainer != null)
                        TeamHeroPill(
                          p.trainer!.name,
                          icon: Icons.sports_gymnastics_rounded,
                        ),
                    ],
                  ),
                ),
                if ((canUpdate || canCreate) && !p.isDeleted) ...[
                  const SizedBox(height: 14),
                  FadeUp(
                    index: 4,
                    child: Row(
                      children: [
                        if (canUpdate)
                          TeamHeroAction(
                            label: 'Edit',
                            icon: Icons.edit_rounded,
                            onTap: _busy ? null : () => _edit(p),
                          ),
                        if (canCreate) ...[
                          if (canUpdate) const SizedBox(width: 8),
                          TeamHeroAction(
                            label: 'Duplicate',
                            icon: Icons.copy_rounded,
                            onTap:
                                _busy ? null : () => _run(DietAction.duplicate),
                          ),
                        ],
                        if (canUpdate) ...[
                          const SizedBox(width: 8),
                          TeamHeroAction(
                            label: p.isActive ? 'Deactivate' : 'Activate',
                            icon: p.isActive
                                ? Icons.pause_circle_rounded
                                : Icons.play_circle_rounded,
                            onTap: _busy
                                ? null
                                : () => _run(
                                      p.isActive
                                          ? DietAction.deactivate
                                          : DietAction.activate,
                                    ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              16 + teamSideInset(context),
              14,
              16 + teamSideInset(context),
              14,
            ),
            child: TeamSummaryGrid(
              tiles: [
                TeamSummaryTile(
                  index: 0,
                  icon: Icons.timelapse_rounded,
                  color: TeamColors.teal,
                  label: 'Duration',
                  text: daysLabel(p.durationDays),
                  hint: 'Meals repeat daily',
                ),
                TeamSummaryTile(
                  index: 1,
                  icon: Icons.local_fire_department_rounded,
                  color: TeamColors.amber,
                  label: 'Daily calories',
                  text: kcalLabel(p.dailyCalories),
                  hint: 'Target per day',
                ),
                TeamSummaryTile(
                  index: 2,
                  icon: Icons.sports_gymnastics_rounded,
                  color: TeamColors.violet,
                  label: 'Trainer',
                  text: p.trainer?.name ?? '—',
                  hint: 'Trainer / nutritionist',
                ),
                TeamSummaryTile(
                  index: 3,
                  icon: Icons.groups_rounded,
                  color: TeamColors.indigo,
                  label: 'Members',
                  number: p.activeMemberCount,
                  hint: 'Currently on it',
                ),
              ],
            ),
          ),
          TeamTabBar(
            names: names,
            index: tab,
            onChanged: (i) => setState(() => _tab = i),
          ),
          const SizedBox(height: 14),
          Padding(
            padding:
                EdgeInsets.symmetric(horizontal: 16 + teamSideInset(context)),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 260),
              transitionBuilder: (child, anim) => FadeTransition(
                opacity: anim,
                child: SlideTransition(
                  position: Tween(
                    begin: const Offset(0.04, 0),
                    end: Offset.zero,
                  ).animate(anim),
                  child: child,
                ),
              ),
              child: Column(
                key: ValueKey(tabName),
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: switch (tabName) {
                  'Overview' => _overview(p, canUpdate),
                  'Meals' => _meals(p, canUpdate),
                  'Assign' => _assign(p),
                  _ => _manage(p),
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Overview ──────────────────────────────────────────────────────────────

  List<Widget> _overview(DietPlan p, bool canUpdate) {
    return [
      FadeUp(
        index: 0,
        child: TeamSectionCard(
          icon: Icons.notes_rounded,
          color: TeamColors.indigo,
          title: 'Plan information',
          subtitle: 'Name, goal, duration, calories, trainer and notes',
          onEdit: canUpdate && !p.isDeleted ? () => _edit(p) : null,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                (p.description ?? '').isEmpty
                    ? 'No description yet.'
                    : p.description!,
                style: AppText.body(
                  size: 13,
                  weight: FontWeight.w600,
                  color: (p.description ?? '').isEmpty
                      ? AppColors.inkFaint
                      : AppColors.ink,
                ),
              ),
              const SizedBox(height: 12),
              TeamTileGrid(
                tiles: [
                  TeamFieldTile(
                    icon: Icons.track_changes_rounded,
                    label: 'Goal',
                    value: p.goal,
                    color: TeamColors.amber,
                  ),
                  TeamFieldTile(
                    icon: Icons.sports_gymnastics_rounded,
                    label: 'Trainer / Nutritionist',
                    value: p.trainer?.name,
                    color: TeamColors.violet,
                  ),
                  TeamFieldTile(
                    icon: Icons.timelapse_rounded,
                    label: 'Duration',
                    value: daysLabel(p.durationDays),
                    color: TeamColors.teal,
                  ),
                  TeamFieldTile(
                    icon: Icons.local_fire_department_rounded,
                    label: 'Daily calories',
                    value: p.dailyCalories == null
                        ? null
                        : kcalLabel(p.dailyCalories),
                    color: TeamColors.rose,
                  ),
                  TeamFieldTile(
                    icon: Icons.sticky_note_2_rounded,
                    label: 'Notes',
                    value: (p.notes ?? '').isEmpty ? null : p.notes,
                    color: TeamColors.sky,
                    maxLines: 4,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ];
  }

  // ── Meals ─────────────────────────────────────────────────────────────────

  List<Widget> _meals(DietPlan p, bool canUpdate) {
    final draft = MealPlanDraft.fromPlan(p);
    return [
      FadeUp(
        index: 0,
        child: TeamSectionCard(
          icon: Icons.restaurant_menu_rounded,
          color: TeamColors.violet,
          title: 'Meal builder',
          subtitle: 'Grouped by meal - the plan repeats every day',
          onEdit: canUpdate && !p.isDeleted ? () => _editMeals(p) : null,
          editLabel: 'Edit',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (draft.total == 0) ...[
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 22),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: TeamColors.violet.withValues(alpha: 0.07),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: TeamColors.violet.withValues(alpha: 0.25),
                    ),
                  ),
                  child: Column(
                    children: [
                      const Icon(
                        Icons.no_meals_rounded,
                        size: 30,
                        color: TeamColors.violet,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'This plan has no meals yet',
                        style: AppText.display(
                          size: 15,
                          color: TeamColors.violet,
                        ),
                      ),
                      if (canUpdate && !p.isDeleted) ...[
                        const SizedBox(height: 12),
                        SizedBox(
                          width: 220,
                          child: TeamGradientButton(
                            label: 'Build the meal plan',
                            icon: Icons.add_rounded,
                            onTap: () => _editMeals(p),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
              MealBuilderEditor(
                draft: draft,
                readOnly: true,
                onChanged: () {},
              ),
            ],
          ),
        ),
      ),
    ];
  }

  // ── Assign ────────────────────────────────────────────────────────────────

  List<Widget> _assign(DietPlan p) {
    return [
      FadeUp(
        index: 0,
        child: TeamSectionCard(
          icon: Icons.person_add_alt_1_rounded,
          color: TeamColors.sky,
          title: 'Assign to a member',
          subtitle: 'Their current plan, if any, moves to history',
          child: AssignDietPanel(
            planId: p.id,
            onAssigned: (_) => _load(),
          ),
        ),
      ),
    ];
  }

  // ── Manage ────────────────────────────────────────────────────────────────

  List<Widget> _manage(DietPlan p) {
    final actions = _actions(p);
    final canUpdate = teamCan(context, 'diets:update');
    return [
      FadeUp(
        index: 0,
        child: TeamSectionCard(
          icon: Icons.tune_rounded,
          color: TeamColors.indigo,
          title: 'Manage plan',
          subtitle: 'Changes apply to new assignments only',
          child: actions.isEmpty && !canUpdate
              ? Text(
                  'You do not have permission to change this plan.',
                  style: AppText.body(size: 12.5, color: AppColors.inkFaint),
                )
              : Column(
                  children: [
                    if (canUpdate && !p.isDeleted) ...[
                      TeamActionTile(
                        icon: Icons.edit_rounded,
                        label: 'Edit plan details',
                        color: TeamColors.amber,
                        hint: 'Name, goal, duration, calories, trainer',
                        onTap: () => _edit(p),
                      ),
                      TeamActionTile(
                        icon: Icons.restaurant_menu_rounded,
                        label: 'Edit meals',
                        color: TeamColors.violet,
                        hint: 'Foods and quantities per meal',
                        onTap: () => _editMeals(p),
                      ),
                    ],
                    for (final a in actions)
                      TeamActionTile(
                        icon: a.icon,
                        label: a.label,
                        color: a.color,
                        busy: _busy,
                        hint: a.hint,
                        onTap: () => _run(a),
                      ),
                  ],
                ),
        ),
      ),
    ];
  }
}
