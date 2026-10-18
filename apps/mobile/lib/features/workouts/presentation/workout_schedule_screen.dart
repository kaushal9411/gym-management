import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'schedule_draft.dart';
import 'widgets/weekly_schedule_editor.dart';

/// The whole-week schedule editor for the Owner / Manager catalog - web's
/// "Weekly schedule" card (`PATCH /workout-plans/:id/exercises`). Pick a day on
/// the strip, add exercises from the library, drag to reorder within the day,
/// remove, then **Save weekly schedule** (enabled once something changed). The
/// API replaces the whole array, so every save sends every day - including each
/// exercise's rest and notes, which are kept as they are.
///
/// Pushed from the plan page's Schedule / Manage tabs, which only offer it
/// with `workouts:update`; without it this screen is a read-only view. Pops
/// `true` after a successful save.
class WorkoutScheduleScreen extends StatefulWidget {
  const WorkoutScheduleScreen({super.key, required this.planId});

  final String planId;

  @override
  State<WorkoutScheduleScreen> createState() => _WorkoutScheduleScreenState();
}

class _WorkoutScheduleScreenState extends State<WorkoutScheduleScreen> {
  WorkoutPlan? _plan;
  ScheduleDraft? _draft;
  ScheduleDraft? _saved;
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
      final plan = await getIt<WorkoutPlanRepository>().getById(widget.planId);
      if (!mounted) return;
      setState(() {
        _plan = plan;
        _draft = ScheduleDraft.fromPlan(plan);
        _saved = ScheduleDraft.fromPlan(plan);
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
      final updated = await getIt<WorkoutPlanRepository>().setExercises(
        widget.planId,
        _draft!.toDrafts(),
      );
      if (!mounted) return;
      teamSnack(context, 'Weekly schedule saved.');
      setState(() {
        _plan = updated;
        _draft = ScheduleDraft.fromPlan(updated);
        _saved = ScheduleDraft.fromPlan(updated);
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

  @override
  Widget build(BuildContext context) {
    final plan = _plan;
    final draft = _draft;
    final canUpdate = teamCan(context, 'workouts:update');
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Weekly schedule', style: AppText.display(size: 18)),
            if (plan != null) Text(plan.name, style: AppText.eyebrow()),
          ],
        ),
      ),
      bottomNavigationBar: plan == null || !canUpdate
          ? null
          : TeamBottomBar(
              child: TeamGradientButton(
                label: 'Save weekly schedule',
                icon: Icons.check_rounded,
                loading: _saving,
                gradient: TeamColors.ctaGreen,
                onTap: () {
                  if (_dirty && !_saving) _save();
                },
              ),
            ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : draft == null
                ? const AppLoadingView()
                : SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(
                      16 + teamSideInset(context, maxWidth: 840),
                      8,
                      16 + teamSideInset(context, maxWidth: 840),
                      28,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_saveError != null) ...[
                          FormAlert(message: _saveError!),
                          const SizedBox(height: 12),
                        ],
                        Text(
                          'Repeats every week for '
                          '${plan!.durationWeeks} '
                          '${plan.durationWeeks == 1 ? 'week' : 'weeks'}.',
                          style: AppText.body(
                            size: 12.5,
                            weight: FontWeight.w600,
                            color: AppColors.inkFaint,
                          ),
                        ),
                        const SizedBox(height: 14),
                        WeeklyScheduleEditor(
                          draft: draft,
                          readOnly: !canUpdate,
                          initialDay: _firstDay(draft),
                          onChanged: () => setState(() {}),
                        ),
                      ],
                    ),
                  ),
      ),
    );
  }

  WeekDay _firstDay(ScheduleDraft d) {
    for (final day in WeekDay.values) {
      if (d.countOn(day) > 0) return day;
    }
    return WeekDay.monday;
  }
}
