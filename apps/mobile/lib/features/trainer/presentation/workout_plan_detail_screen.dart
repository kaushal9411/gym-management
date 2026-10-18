import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../plans/presentation/plan_ui.dart' show PlanHeroShell;
import '../../team/presentation/widgets/team_ui.dart';
import '../../workouts/presentation/widgets/assign_workout_panel.dart';
import '../../workouts/presentation/workout_ui.dart';

class DayEditorArgs {
  const DayEditorArgs({required this.plan, required this.day});

  final WorkoutPlan plan;
  final WeekDay day;
}

/// Design frame "6. Workout builder", redesigned: the plan's hero, the Mon-Sun
/// strip (tap a day to open its editor), a per-day overview and the "Assign to
/// client" card. The client is already fixed by the flow that got us here (My
/// Clients -> Assign), so the card shows them instead of a search; it adds a
/// start-date calendar, an optional end date, trainer remarks and a preview of
/// the run (the old screen always started today). Assigning pops back to the
/// plan list, as before.
class WorkoutPlanDetailScreen extends StatefulWidget {
  const WorkoutPlanDetailScreen({
    required this.planId,
    required this.member,
    super.key,
  });

  final String planId;
  final GymMember member;

  @override
  State<WorkoutPlanDetailScreen> createState() =>
      _WorkoutPlanDetailScreenState();
}

class _WorkoutPlanDetailScreenState extends State<WorkoutPlanDetailScreen> {
  WorkoutPlan? _plan;
  bool _loading = true;
  String? _error;

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
      final plan = await getIt<WorkoutPlanRepository>().getById(widget.planId);
      if (!mounted) return;
      setState(() => _plan = plan);
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

  Future<void> _openDay(WeekDay day) async {
    final plan = _plan;
    if (plan == null) return;
    final changed = await context.push<bool>(
      AppRoutes.trainerDayEditor,
      extra: DayEditorArgs(plan: plan, day: day),
    );
    if (changed == true) _load();
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
        title: Text(hero ? 'Workout plan' : 'Workout plans'),
      ),
      body: SafeArea(
        top: false,
        child: _loading && plan == null
            ? const AppLoadingView()
            : _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : plan == null
                    ? const SizedBox.shrink()
                    : _content(plan),
      ),
    );
  }

  Widget _content(WorkoutPlan plan) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final tone = workoutTone(deleted: plan.isDeleted, active: plan.isActive);
    final by = plan.exercisesByDay;
    final side = 16 + teamSideInset(context, maxWidth: 840);
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
                          Icons.fitness_center_rounded,
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
                        workoutStatus(
                          deleted: plan.isDeleted,
                          active: plan.isActive,
                        ),
                        dot: tone,
                      ),
                      TeamHeroPill(
                        '${plan.level.label} · ${plan.durationWeeks}w',
                        icon: levelIcon(plan.level),
                      ),
                      TeamHeroPill(
                        '${plan.totalExercises} exercises',
                        icon: Icons.fitness_center_rounded,
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
                    icon: Icons.calendar_view_week_rounded,
                    color: TeamColors.violet,
                    title: 'Weekly schedule',
                    subtitle: 'Tap a day to add or change its exercises',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        WeekStrip(
                          counts: {
                            for (final e in by.entries) e.key: e.value.length,
                          },
                          onTap: _openDay,
                        ),
                        const SizedBox(height: 12),
                        for (final d in WeekDay.values)
                          _DayLine(
                            day: d,
                            exercises: by[d] ?? const [],
                            onTap: () => _openDay(d),
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
                    title: 'Assign to client',
                    subtitle: plan.isActive
                        ? 'Their current plan, if any, moves to history'
                        : 'This plan is inactive and cannot be assigned',
                    child: AssignWorkoutPanel(
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

/// One day of the plan: coloured dot, day, exercise names (or "Rest").
class _DayLine extends StatelessWidget {
  const _DayLine({
    required this.day,
    required this.exercises,
    required this.onTap,
  });

  final WeekDay day;
  final List<PlanExercise> exercises;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = dayColor(day);
    final names = exercises.map((e) => e.exercise.name).join(' · ');
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 2),
          child: Row(
            children: [
              Container(
                width: 9,
                height: 9,
                decoration: BoxDecoration(
                  color: exercises.isEmpty ? AppColors.line : color,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 10),
              SizedBox(
                width: 44,
                child: Text(
                  day.shortLabel,
                  style: AppText.body(size: 12.5, weight: FontWeight.w800),
                ),
              ),
              Expanded(
                child: Text(
                  exercises.isEmpty ? 'Rest' : names,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 12.5,
                    weight: FontWeight.w600,
                    color: exercises.isEmpty
                        ? AppColors.inkFaint
                        : AppColors.inkSoft,
                  ),
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.inkFaint,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
