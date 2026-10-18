import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/diet_plan_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../diet/presentation/diet_ui.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'trainer_diet_plans_screen.dart';

/// The Trainer's reduced create step ahead of design frame "8. Meal builder":
/// name, duration and daily calorie target, then straight into the plan to
/// build its meals and assign it to [member]. Same `POST /diet-plans` as the
/// catalog form and the same fields it always sent (no goal, trainer or
/// description) - the full form lives in the Owner / Manager catalog.
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
    if (duration == null || duration <= 0 || duration > 730) {
      setState(() => _error = 'Enter a duration from 1 to 730 days');
      return;
    }
    final kcal = int.tryParse(_caloriesController.text.trim());
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final plan = await getIt<DietPlanRepository>().create(
        DietPlanFormInput(
          name: name,
          durationDays: duration,
          // The API wants a positive target; 0 / blank means "none".
          dailyCalories: kcal != null && kcal > 0 ? kcal : null,
        ),
      );
      if (!mounted) return;
      context.pushReplacement(
        AppRoutes.trainerDietPlanDetail,
        extra: MealBuilderArgs(planId: plan.id, member: widget.member),
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
    final days = int.tryParse(_durationController.text.trim());
    final kcal = int.tryParse(_caloriesController.text.trim());
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('New diet plan'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DietBanner(
              top: top,
              name: _nameController.text.trim().isEmpty
                  ? 'New plan'
                  : _nameController.text.trim(),
              subtitle: 'For ${widget.member.name}',
              chip: kcal != null
                  ? '$kcal kcal/day · ${days == null ? '—' : daysLabel(days)}'
                  : (days == null ? 'Diet plan' : daysLabel(days)),
              chipIcon: Icons.local_fire_department_rounded,
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
                      icon: Icons.restaurant_rounded,
                      color: TeamColors.indigo,
                      title: 'Plan information',
                      subtitle: 'You build the meals on the next screen',
                      children: [
                        AppLabeledField(
                          label: 'Plan name',
                          hintText: 'e.g. Cutting Phase',
                          icon: Icons.restaurant_rounded,
                          iconColor: TeamColors.indigo,
                          controller: _nameController,
                          textCapitalization: TextCapitalization.words,
                          textInputAction: TextInputAction.next,
                          onChanged: (_) => setState(() {}),
                          inputFormatters: [
                            LengthLimitingTextInputFormatter(150),
                          ],
                        ),
                        AppLabeledField(
                          label: 'Duration (days)',
                          icon: Icons.timelapse_rounded,
                          iconColor: TeamColors.teal,
                          controller: _durationController,
                          keyboardType: TextInputType.number,
                          onChanged: (_) => setState(() {}),
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(3),
                          ],
                        ),
                        AppLabeledField(
                          label: 'Daily calorie target (kcal)',
                          hintText: 'e.g. 2000',
                          icon: Icons.local_fire_department_rounded,
                          iconColor: TeamColors.rose,
                          controller: _caloriesController,
                          keyboardType: TextInputType.number,
                          onChanged: (_) => setState(() {}),
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(5),
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
