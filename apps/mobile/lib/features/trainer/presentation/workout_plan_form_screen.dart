import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart';
import '../../workouts/presentation/workout_ui.dart';
import 'trainer_workout_plans_screen.dart';

/// The Trainer's reduced create step ahead of the plan page: name, goal
/// (optional), level and duration, then straight into the plan to build its
/// week and assign it to [member]. Same `POST /workout-plans` as the catalog
/// form and the same fields it always sent (no trainer, no description) - the
/// full form lives in the Owner / Manager catalog.
class WorkoutPlanFormScreen extends StatefulWidget {
  const WorkoutPlanFormScreen({required this.member, super.key});

  final GymMember member;

  @override
  State<WorkoutPlanFormScreen> createState() => _WorkoutPlanFormScreenState();
}

class _WorkoutPlanFormScreenState extends State<WorkoutPlanFormScreen> {
  final _name = TextEditingController();
  final _goal = TextEditingController();
  final _duration = TextEditingController(text: '8');
  WorkoutLevel _level = WorkoutLevel.intermediate;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _goal.dispose();
    _duration.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    final duration = int.tryParse(_duration.text.trim());
    if (name.isEmpty) {
      setState(() => _error = 'Enter a plan name');
      return;
    }
    if (duration == null || duration <= 0 || duration > 104) {
      setState(() => _error = 'Enter a duration from 1 to 104 weeks');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final plan = await getIt<WorkoutPlanRepository>().create(
        WorkoutPlanFormInput(
          name: name,
          level: _level,
          durationWeeks: duration,
          goal: _goal.text.trim().isEmpty ? null : _goal.text.trim(),
        ),
      );
      if (!mounted) return;
      context.pushReplacement(
        AppRoutes.trainerWorkoutPlanDetail,
        extra: WorkoutPlanDetailArgs(planId: plan.id, member: widget.member),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Something went wrong ($e).');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final weeks = int.tryParse(_duration.text.trim());
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('New workout plan'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            WorkoutBanner(
              top: top,
              name: _name.text.trim().isEmpty ? 'New plan' : _name.text.trim(),
              subtitle: 'For ${widget.member.name}',
              chip:
                  '${_level.label} · ${weeks == null ? '—' : weeksLabel(weeks)}',
              chipIcon: levelIcon(_level),
            ),
            TeamCenter(
              maxWidth: 840,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_error != null) ...[
                      FormAlert(message: _error!),
                      const SizedBox(height: 14),
                    ],
                    TeamFormSection(
                      icon: Icons.fitness_center_rounded,
                      color: TeamColors.indigo,
                      title: 'Plan information',
                      subtitle: 'You build the week on the next screen',
                      children: [
                        AppLabeledField(
                          label: 'Plan name',
                          hintText: 'e.g. Strength Foundations',
                          icon: Icons.fitness_center_rounded,
                          iconColor: TeamColors.indigo,
                          controller: _name,
                          textCapitalization: TextCapitalization.words,
                          textInputAction: TextInputAction.next,
                          onChanged: (_) => setState(() {}),
                          inputFormatters: [
                            LengthLimitingTextInputFormatter(150),
                          ],
                        ),
                        AppLabeledField(
                          label: 'Goal (optional)',
                          hintText: 'e.g. Build muscle',
                          icon: Icons.track_changes_rounded,
                          iconColor: TeamColors.amber,
                          controller: _goal,
                          textCapitalization: TextCapitalization.sentences,
                          inputFormatters: [
                            LengthLimitingTextInputFormatter(150),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Text('Level', style: AppText.eyebrow()),
                            ),
                            for (final l in WorkoutLevel.values) ...[
                              TeamChoiceCard(
                                title: l.label,
                                icon: levelIcon(l),
                                color: levelColor(l),
                                selected: _level == l,
                                onTap: () => setState(() => _level = l),
                              ),
                              const SizedBox(height: 8),
                            ],
                          ],
                        ),
                        AppLabeledField(
                          label: 'Duration (weeks)',
                          icon: Icons.timelapse_rounded,
                          iconColor: TeamColors.teal,
                          controller: _duration,
                          keyboardType: TextInputType.number,
                          onChanged: (_) => setState(() {}),
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(3),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    TeamGradientButton(
                      label: 'Create plan',
                      icon: Icons.check_rounded,
                      loading: _loading,
                      onTap: _submit,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
