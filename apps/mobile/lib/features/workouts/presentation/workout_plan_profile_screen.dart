import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../plans/presentation/plan_ui.dart' show PlanHeroShell;
import '../../team/presentation/widgets/team_ui.dart';
import 'widgets/assign_workout_panel.dart';
import 'workout_actions.dart';
import 'workout_ui.dart';

/// Workout plan profile (`GET /workout-plans/:id`), redesigned to mirror web's
/// `/workout-plans/[planId]` page and the Membership Plan / Branch / Staff
/// profiles: animated gradient hero (status, level, weeks, members, trainer;
/// Edit / Duplicate / Activate), four summary tiles and tabs.
///
/// - **Overview** - web's plan fields (description, goal, trainer, duration,
///   notes); Edit (`workouts:update`) opens the form.
/// - **Schedule** - the Mon-Sun strip; pick a day to see its exercises with
///   sets x reps. "Edit" (`workouts:update`) opens the weekly editor.
/// - **Assign** (`workouts:assign`, active plans only) - member search and a
///   start date, like web's "Assign to a member" card.
/// - **Manage** - the lifecycle actions web puts in the hero (Duplicate
///   `workouts:create`, Activate / Deactivate `workouts:update`, Delete
///   `workouts:delete`).
///
/// Soft-deleted plans 404 on this endpoint, so the list opens a restore sheet
/// for them instead. Pops with a plan id when Duplicate created a draft (the
/// list opens it), else with null.
///
/// **Dropped vs. web**: nothing with an endpoint. Inline editing of the plan
/// fields moved to the Edit form (like the other redesigned catalogs), and
/// there is no "members on this plan" list because no endpoint provides one.
class WorkoutPlanProfileScreen extends StatefulWidget {
  const WorkoutPlanProfileScreen({super.key, required this.planId});

  final String planId;

  @override
  State<WorkoutPlanProfileScreen> createState() =>
      _WorkoutPlanProfileScreenState();
}

class _WorkoutPlanProfileScreenState extends State<WorkoutPlanProfileScreen> {
  WorkoutPlan? _plan;
  String? _error;
  bool _busy = false;
  int _tab = 0;
  WeekDay? _day;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final plan = await getIt<WorkoutPlanRepository>().getById(widget.planId);
      if (!mounted) return;
      setState(() {
        _plan = plan;
        _day ??= _firstTrainingDay(plan);
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not load this plan ($e)');
    }
  }

  WeekDay _firstTrainingDay(WorkoutPlan p) {
    final by = p.exercisesByDay;
    for (final d in WeekDay.values) {
      if (by.containsKey(d)) return d;
    }
    return WeekDay.monday;
  }

  Future<void> _edit(WorkoutPlan p) =>
      context.push(AppRoutes.workoutPlanForm, extra: p.id).then((_) => _load());

  Future<void> _editSchedule(WorkoutPlan p) => context
      .push<bool>(AppRoutes.workoutPlanSchedule, extra: p.id)
      .then((_) => _load());

  Future<void> _run(WorkoutAction action) async {
    final p = _plan!;
    setState(() => _busy = true);
    try {
      final r = await runWorkoutAction(
        context,
        planId: p.id,
        planName: p.name,
        action: action,
      );
      if (!mounted || !r.ok) return;
      if (action == WorkoutAction.delete) {
        context.pop();
        return;
      }
      if (action == WorkoutAction.duplicate && r.created != null) {
        context.pop(r.created!.id);
        return;
      }
      await _load();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  List<WorkoutAction> _actions(WorkoutPlan p) => availableWorkoutActions(
        deleted: p.isDeleted,
        active: p.isActive,
        canCreate: teamCan(context, 'workouts:create'),
        canUpdate: teamCan(context, 'workouts:update'),
        canDelete: teamCan(context, 'workouts:delete'),
        canRestore: teamCan(context, 'workouts:restore'),
      );

  List<String> _tabNames(WorkoutPlan p) => [
        'Overview',
        'Schedule',
        if (teamCan(context, 'workouts:assign') && p.isActive && !p.isDeleted)
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
        title: Text(hero ? 'Workout plan' : 'Workout Plans'),
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

  Widget _overflow(WorkoutPlan p) {
    final canUpdate = teamCan(context, 'workouts:update');
    final actions = _actions(p);
    if (!canUpdate && actions.isEmpty) return const SizedBox.shrink();
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert_rounded),
      color: AppColors.surface2,
      enabled: !_busy,
      onSelected: (v) {
        if (v == 'edit') {
          _edit(p);
        } else if (v == 'schedule') {
          _editSchedule(p);
        } else {
          _run(WorkoutAction.values.firstWhere((a) => a.name == v));
        }
      },
      itemBuilder: (_) => [
        if (canUpdate)
          const PopupMenuItem(value: 'edit', child: Text('Edit plan')),
        if (canUpdate)
          const PopupMenuItem(
            value: 'schedule',
            child: Text('Edit weekly schedule'),
          ),
        for (final a in actions)
          PopupMenuItem(
            value: a.name,
            child: Text(
              a.label,
              style: a == WorkoutAction.delete
                  ? const TextStyle(color: AppColors.danger)
                  : null,
            ),
          ),
      ],
    );
  }

  Widget _content(WorkoutPlan p) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final canUpdate = teamCan(context, 'workouts:update');
    final canCreate = teamCan(context, 'workouts:create');
    final tone = workoutTone(deleted: p.isDeleted, active: p.isActive);
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
                              Icons.fitness_center_rounded,
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
                        workoutStatus(deleted: p.isDeleted, active: p.isActive),
                        dot: tone,
                      ),
                      TeamHeroPill(
                        '${p.level.label} · ${p.durationWeeks}w',
                        icon: levelIcon(p.level),
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
                if (canUpdate || canCreate) ...[
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
                            onTap: _busy
                                ? null
                                : () => _run(WorkoutAction.duplicate),
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
                                          ? WorkoutAction.deactivate
                                          : WorkoutAction.activate,
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
                  icon: levelIcon(p.level),
                  color: levelColor(p.level),
                  label: 'Level',
                  text: p.level.label,
                  hint: weeksLabel(p.durationWeeks),
                ),
                TeamSummaryTile(
                  index: 1,
                  icon: Icons.timelapse_rounded,
                  color: TeamColors.teal,
                  label: 'Duration',
                  text: weeksLabel(p.durationWeeks),
                  hint: 'Repeats weekly',
                ),
                TeamSummaryTile(
                  index: 2,
                  icon: Icons.sports_gymnastics_rounded,
                  color: TeamColors.violet,
                  label: 'Trainer',
                  text: p.trainer?.name ?? '—',
                  hint: 'Assigned trainer',
                ),
                TeamSummaryTile(
                  index: 3,
                  icon: Icons.groups_rounded,
                  color: TeamColors.amber,
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
                  'Schedule' => _schedule(p, canUpdate),
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

  /// Lays [cards] in one column, or two independent columns on a wide screen.
  List<Widget> _grid(List<Widget> cards) => [
        LayoutBuilder(
          builder: (context, c) {
            Widget stack(List<Widget> items) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < items.length; i++) ...[
                      if (i > 0) const SizedBox(height: 14),
                      items[i],
                    ],
                  ],
                );
            final animated = [
              for (var i = 0; i < cards.length; i++)
                FadeUp(index: i, child: cards[i]),
            ];
            if (c.maxWidth < 720) return stack(animated);
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: stack([
                    for (var i = 0; i < animated.length; i += 2) animated[i],
                  ]),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: stack([
                    for (var i = 1; i < animated.length; i += 2) animated[i],
                  ]),
                ),
              ],
            );
          },
        ),
      ];

  // ── Overview ──────────────────────────────────────────────────────────────

  List<Widget> _overview(WorkoutPlan p, bool canUpdate) {
    return _grid([
      TeamSectionCard(
        icon: Icons.notes_rounded,
        color: TeamColors.indigo,
        title: 'Plan information',
        subtitle: 'Name, goal, level, duration, trainer and notes',
        onEdit: canUpdate ? () => _edit(p) : null,
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
                  label: 'Trainer',
                  value: p.trainer?.name,
                  color: TeamColors.violet,
                ),
                TeamFieldTile(
                  icon: Icons.timelapse_rounded,
                  label: 'Duration',
                  value: weeksLabel(p.durationWeeks),
                  color: TeamColors.teal,
                ),
                TeamFieldTile(
                  icon: Icons.sticky_note_2_rounded,
                  label: 'Notes',
                  value: (p.notes ?? '').isEmpty ? null : p.notes,
                  color: TeamColors.rose,
                  maxLines: 4,
                ),
              ],
            ),
          ],
        ),
      ),
    ]);
  }

  // ── Schedule ──────────────────────────────────────────────────────────────

  List<Widget> _schedule(WorkoutPlan p, bool canUpdate) {
    final by = p.exercisesByDay;
    final day = _day ?? WeekDay.monday;
    final list = by[day] ?? const <PlanExercise>[];
    final color = dayColor(day);
    return [
      FadeUp(
        index: 0,
        child: TeamSectionCard(
          icon: Icons.calendar_view_week_rounded,
          color: TeamColors.violet,
          title: 'Weekly schedule',
          subtitle: 'Repeats every week',
          onEdit: canUpdate ? () => _editSchedule(p) : null,
          editLabel: 'Edit',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              WeekStrip(
                counts: {for (final e in by.entries) e.key: e.value.length},
                selected: day,
                onTap: (d) => setState(() => _day = d),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration:
                        BoxDecoration(color: color, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      day.label,
                      style: AppText.display(size: 18, color: color),
                    ),
                  ),
                  Text(
                    list.isEmpty
                        ? 'Rest day'
                        : '${list.length} '
                            '${list.length == 1 ? 'exercise' : 'exercises'}',
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w700,
                      color: AppColors.inkFaint,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (list.isEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.07),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: color.withValues(alpha: 0.25)),
                  ),
                  child: Column(
                    children: [
                      Icon(Icons.hotel_rounded, size: 30, color: color),
                      const SizedBox(height: 6),
                      Text(
                        p.totalExercises == 0
                            ? 'This plan has no exercises yet'
                            : 'Rest day',
                        style: AppText.display(size: 15, color: color),
                      ),
                      if (p.totalExercises == 0 && canUpdate) ...[
                        const SizedBox(height: 12),
                        SizedBox(
                          width: 220,
                          child: TeamGradientButton(
                            label: 'Build the schedule',
                            icon: Icons.add_rounded,
                            onTap: () => _editSchedule(p),
                          ),
                        ),
                      ],
                    ],
                  ),
                )
              else
                for (var i = 0; i < list.length; i++) ...[
                  if (i > 0) const SizedBox(height: 8),
                  ExerciseTile(
                    key: ValueKey('ex-${list[i].id}'),
                    line: ExerciseLine.fromPlan(list[i]),
                    index: i + 1,
                  ),
                ],
            ],
          ),
        ),
      ),
    ];
  }

  // ── Assign ────────────────────────────────────────────────────────────────

  List<Widget> _assign(WorkoutPlan p) {
    return [
      FadeUp(
        index: 0,
        child: TeamSectionCard(
          icon: Icons.person_add_alt_1_rounded,
          color: TeamColors.sky,
          title: 'Assign to a member',
          subtitle: 'Their current plan, if any, moves to history',
          child: AssignWorkoutPanel(
            planId: p.id,
            onAssigned: (_) => _load(),
          ),
        ),
      ),
    ];
  }

  // ── Manage ────────────────────────────────────────────────────────────────

  List<Widget> _manage(WorkoutPlan p) {
    final actions = _actions(p);
    final canUpdate = teamCan(context, 'workouts:update');
    return _grid([
      TeamSectionCard(
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
                      hint: 'Name, goal, level, duration, trainer',
                      onTap: () => _edit(p),
                    ),
                    TeamActionTile(
                      icon: Icons.calendar_view_week_rounded,
                      label: 'Edit weekly schedule',
                      color: TeamColors.violet,
                      hint: 'Days and exercises',
                      onTap: () => _editSchedule(p),
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
    ]);
  }
}
