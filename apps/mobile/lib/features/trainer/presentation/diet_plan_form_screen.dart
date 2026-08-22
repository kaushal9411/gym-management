import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/diet_plan_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'trainer_diet_plans_screen.dart';

/// Create step ahead of design frame "8. Meal builder" — the builder frame
/// opens an already-named plan, so this minimal name/duration/target form
/// is what creates it first.
class DietPlanFormScreen extends StatefulWidget {
  const DietPlanFormScreen({required this.member, super.key});

  final GymMember member;

  @override
  State<DietPlanFormScreen> createState() => _DietPlanFormScreenState();
}

class _DietPlanFormScreenState extends State<DietPlanFormScreen> {
  final _nameController = TextEditingController();
  final _durationController = TextEditingController(text: '30');
  final _caloriesController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _durationController.dispose();
    _caloriesController.dispose();
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
      setState(() => _error = 'Enter a valid duration in days');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final plan = await getIt<DietPlanRepository>().create(
        DietPlanFormInput(
          name: name,
          durationDays: duration,
          dailyCalories: int.tryParse(_caloriesController.text.trim()),
        ),
      );
      if (!mounted) return;
      context.pushReplacement(
        AppRoutes.trainerDietPlanDetail,
        extra: MealBuilderArgs(planId: plan.id, member: widget.member),
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
        title: const Text('New diet plan'),
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
                hintText: 'e.g. Cutting Phase',
                controller: _nameController,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Duration (days)',
                controller: _durationController,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Daily calorie target (kcal)',
                hintText: 'e.g. 2000',
                controller: _caloriesController,
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
