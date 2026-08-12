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
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';
import 'trainer_workout_plans_screen.dart';

/// Create step ahead of design frame "6. Workout builder" — the builder
/// frame opens an already-named plan, so this minimal name/level/duration
/// form is what creates it first.
class WorkoutPlanFormScreen extends StatefulWidget {
  const WorkoutPlanFormScreen({required this.member, super.key});

  final GymMember member;

  @override
  State<WorkoutPlanFormScreen> createState() => _WorkoutPlanFormScreenState();
}

class _WorkoutPlanFormScreenState extends State<WorkoutPlanFormScreen> {
  final _nameController = TextEditingController();
  final _durationController = TextEditingController(text: '8');
  WorkoutLevel _level = WorkoutLevel.intermediate;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _durationController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    final duration = int.tryParse(_durationController.text.trim());
    if (name.isEmpty) {
      setState(() => _error = 'Enter a plan name');
      return;
    }
    if (duration == null || duration <= 0) {
      setState(() => _error = 'Enter a valid duration in weeks');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final plan = await getIt<WorkoutPlanRepository>().create(
        name: name,
        level: _level,
        durationWeeks: duration,
      );
      if (!mounted) return;
      context.pushReplacement(
        AppRoutes.trainerWorkoutPlanDetail,
        extra: WorkoutPlanDetailArgs(planId: plan.id, member: widget.member),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('New workout plan'),
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_error != null) ...[
                const SizedBox(height: 8),
                FormAlert(message: _error!),
              ],
              const SizedBox(height: 16),
              AppLabeledField(
                label: 'Plan name',
                controller: _nameController,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              Text('Level', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              CategoryChipSelector<WorkoutLevel>(
                options: WorkoutLevel.values,
                labelOf: (l) => l.label,
                value: _level,
                onChanged: (l) => setState(() => _level = l),
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Duration (weeks)',
                controller: _durationController,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Create plan',
                loading: _loading,
                onPressed: _submit,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
