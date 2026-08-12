import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';

class DayEditorArgs {
  const DayEditorArgs({required this.plan, required this.day});

  final WorkoutPlan plan;
  final WeekDay day;
}

/// Design frame "6. Workout builder" — 7-day grid + "Assign to client"
/// glass card. The design's search field is pre-filled with a single
/// client name; here the client is already fixed by the flow that got us
/// here (My Clients → Assign), so it's shown read-only instead of a live
/// search.
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
  bool _assigning = false;
  String? _error;
  String? _assignError;

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
      final plan = await getIt<WorkoutPlanRepository>().getById(
        widget.planId,
      );
      if (!mounted) return;
      setState(() => _plan = plan);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _assign() async {
    setState(() {
      _assigning = true;
      _assignError = null;
    });
    try {
      await getIt<WorkoutPlanRepository>().assign(
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
      setState(() => _assignError = e.message);
    } finally {
      if (mounted) setState(() => _assigning = false);
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
                    '${plan.durationWeeks} weeks · ${plan.level.label}',
                    style: AppText.eyebrow(),
                  ),
                ],
              ),
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const AppLoadingView()
            : _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : plan == null
                    ? const SizedBox.shrink()
                    : SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _DayGrid(plan: plan, onDayTap: _openDay),
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: AppColors.surface2,
                                borderRadius:
                                    BorderRadius.circular(AppRadii.card),
                                border: Border.all(color: AppColors.line),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Assign to client',
                                    style: AppText.eyebrow(),
                                  ),
                                  const SizedBox(height: 10),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 14,
                                      vertical: 12,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.surface3,
                                      borderRadius: BorderRadius.circular(
                                        AppRadii.field,
                                      ),
                                      border: Border.all(
                                        color: AppColors.line,
                                      ),
                                    ),
                                    child: Text(
                                      widget.member.name,
                                      style: AppText.body(
                                        size: 14,
                                        weight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                  if (_assignError != null) ...[
                                    const SizedBox(height: 10),
                                    FormAlert(message: _assignError!),
                                  ],
                                  const SizedBox(height: 10),
                                  AppButton(
                                    label: 'Assign plan',
                                    loading: _assigning,
                                    onPressed: _assign,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
      ),
    );
  }
}

class _DayGrid extends StatelessWidget {
  const _DayGrid({required this.plan, required this.onDayTap});

  final WorkoutPlan plan;
  final ValueChanged<WeekDay> onDayTap;

  @override
  Widget build(BuildContext context) {
    final byDay = plan.exercisesByDay;
    return Row(
      children: WeekDay.values.map((day) {
        final exercises = byDay[day] ?? const [];
        final label = exercises.isEmpty ? 'Rest' : exercises.first.exercise.name;
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: () => onDayTap(day),
                child: Column(
                  children: [
                    Text(day.shortLabel, style: AppText.eyebrow()),
                    const SizedBox(height: 4),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        vertical: 8,
                        horizontal: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.staffSoft,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        label,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 9,
                          weight: FontWeight.w800,
                          color: AppColors.staffPillFg,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
