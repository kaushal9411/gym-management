import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';
import '../../../shared/widgets/status_action_menu.dart';
import '../../../shared/widgets/trainer_picker_field.dart';
import 'widgets/assign_to_member_card.dart';
import 'widgets/weekly_exercise_editor.dart';

/// Design frame "7b. Create/edit workout plan" — mirrors
/// `membership_plan_form_screen.dart`'s merge pattern exactly:
/// `widget.plan == null` → create (`POST /workout-plans`); otherwise →
/// edit (`PATCH /workout-plans/:id`), same field set both ways, matching
/// web's `WorkoutPlanFormFields`. Edit mode adds the status header + ⋯
/// menu, the weekly exercise schedule, and an assign-to-member card — none
/// of which make sense before the plan exists.
///
/// This is a *second* entry point into workout plans, alongside the
/// Trainer's own "My Clients → client → Assign Plan → create" flow
/// (`features/trainer/presentation/workout_plan_form_screen.dart`), which
/// stays as-is — both call the same `WorkoutPlanRepository`, so there's
/// one create/update implementation, just two UI paths, matching how web
/// itself lets you assign a plan from either the plan's own page or the
/// member's page.
class WorkoutPlanCatalogFormScreen extends StatefulWidget {
  const WorkoutPlanCatalogFormScreen({super.key, this.planId});

  /// Null → create. The list screen only ever has the thin
  /// `WorkoutPlanSummary` shape, so edit mode fetches the full `WorkoutPlan`
  /// itself by id rather than requiring the caller to already have it.
  final String? planId;

  bool get isEdit => planId != null;

  @override
  State<WorkoutPlanCatalogFormScreen> createState() =>
      _WorkoutPlanCatalogFormScreenState();
}

class _WorkoutPlanCatalogFormScreenState
    extends State<WorkoutPlanCatalogFormScreen> {
  final _name = TextEditingController();
  final _goal = TextEditingController();
  final _description = TextEditingController();
  final _durationWeeks = TextEditingController(text: '8');
  final _notes = TextEditingController();

  WorkoutLevel _level = WorkoutLevel.intermediate;
  TrainerOption? _trainer;
  bool _isActive = true;

  WorkoutPlan? _currentPlan;
  bool _saving = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _trainer = _selfTrainerOption();
    if (widget.planId != null) _load();
  }

  /// A Trainer creating/editing a plan is always the trainer on it — no
  /// picker needed (see `TrainerPickerField`'s doc comment). Returns null
  /// for every other role, leaving their picker exactly as before.
  TrainerOption? _selfTrainerOption() {
    final session = context.read<SessionCubit>().state;
    if (session is SessionAuthenticatedStaff && session.user.isTrainer) {
      return TrainerOption(id: session.user.id, name: session.user.name);
    }
    return null;
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final plan = await getIt<WorkoutPlanRepository>().getById(widget.planId!);
      if (!mounted) return;
      setState(() {
        _currentPlan = plan;
        _name.text = plan.name;
        _goal.text = plan.goal ?? '';
        _description.text = plan.description ?? '';
        _level = plan.level;
        _durationWeeks.text = '${plan.durationWeeks}';
        _notes.text = plan.notes ?? '';
        _isActive = plan.isActive;
        final trainer = plan.trainer;
        _trainer = trainer == null
            ? _selfTrainerOption()
            : TrainerOption(id: trainer.id, name: trainer.name);
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _goal.dispose();
    _description.dispose();
    _durationWeeks.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    final duration = int.tryParse(_durationWeeks.text.trim());
    if (name.isEmpty) {
      setState(() => _error = 'Plan name is required');
      return;
    }
    if (duration == null || duration <= 0) {
      setState(() => _error = 'Enter a valid duration in weeks');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final input = WorkoutPlanFormInput(
      name: name,
      level: _level,
      durationWeeks: duration,
      goal: _goal.text.trim().isEmpty ? null : _goal.text.trim(),
      description:
          _description.text.trim().isEmpty ? null : _description.text.trim(),
      trainerId: _trainer?.id,
      notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      isActive: _isActive,
    );
    try {
      final repo = getIt<WorkoutPlanRepository>();
      if (widget.isEdit) {
        final updated = await repo.update(_currentPlan!.id, input);
        if (!mounted) return;
        setState(() => _currentPlan = updated);
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Plan updated')));
      } else {
        final created = await repo.create(input);
        if (!mounted) return;
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('${created.name} created')));
        context.pop();
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _runAction(
    Future<void> Function() action,
    String pastTenseLabel,
  ) async {
    setState(() => _busy = true);
    try {
      await action();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Plan $pastTenseLabel.')),
      );
      final refreshed =
          await getIt<WorkoutPlanRepository>().getById(_currentPlan!.id);
      if (!mounted) return;
      setState(() => _currentPlan = refreshed);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    setState(() => _busy = true);
    try {
      await getIt<WorkoutPlanRepository>().delete(_currentPlan!.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Plan deleted.')));
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _duplicate() async {
    setState(() => _busy = true);
    try {
      final created =
          await getIt<WorkoutPlanRepository>().duplicate(_currentPlan!.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Duplicated as "${created.name}" (inactive draft).'),
        ),
      );
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final plan = _currentPlan;
    final deleted = plan?.deletedAt != null;

    if (widget.isEdit && plan == null) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(backgroundColor: AppColors.bg, elevation: 0),
        body: SafeArea(
          top: false,
          child: _error != null
              ? AppErrorView(message: _error!, onRetry: _load)
              : const AppLoadingView(),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text(widget.isEdit ? 'Edit Workout Plan' : 'New Workout Plan'),
        actions: [
          if (widget.isEdit && plan != null)
            _busy
                ? const Padding(
                    padding: EdgeInsets.only(right: 16),
                    child: Center(
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                  )
                : StatusActionMenu(
                    subjectName: plan.name,
                    isDeleted: deleted,
                    isActive: plan.isActive,
                    onDuplicate: _duplicate,
                    onActivate: () => _runAction(
                      () => getIt<WorkoutPlanRepository>()
                          .activate(_currentPlan!.id),
                      'activated',
                    ),
                    onDeactivate: () => _runAction(
                      () => getIt<WorkoutPlanRepository>()
                          .deactivate(_currentPlan!.id),
                      'deactivated',
                    ),
                    onDelete: _delete,
                    onRestore: () => _runAction(
                      () => getIt<WorkoutPlanRepository>()
                          .restore(_currentPlan!.id),
                      'restored',
                    ),
                    iconColor: AppColors.ink,
                  ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (widget.isEdit && plan != null) ...[
                _PlanHeader(plan: plan),
                const SizedBox(height: 16),
              ],
              if (_error != null) ...[
                FormAlert(message: _error!),
                const SizedBox(height: 12),
              ],
              AppLabeledField(
                label: 'Plan name *',
                hintText: 'e.g. Strength Foundations',
                controller: _name,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              AppLabeledField(
                label: 'Goal',
                hintText: 'e.g. Build muscle',
                controller: _goal,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              AppLabeledField(
                label: 'Description',
                controller: _description,
                minLines: 3,
                maxLines: 6,
                textInputAction: TextInputAction.newline,
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Level', style: AppText.eyebrow()),
                        const SizedBox(height: 6),
                        CategoryChipSelector<WorkoutLevel>(
                          options: WorkoutLevel.values,
                          labelOf: (l) => l.label,
                          value: _level,
                          onChanged: (l) => setState(() => _level = l),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              AppLabeledField(
                label: 'Duration (weeks) *',
                controller: _durationWeeks,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              ),
              const SizedBox(height: 12),
              TrainerPickerField(
                selectedTrainer: _trainer,
                onChanged: (t) => setState(() => _trainer = t),
              ),
              const SizedBox(height: 12),
              AppLabeledField(
                label: 'Notes',
                controller: _notes,
                minLines: 2,
                maxLines: 4,
                textInputAction: TextInputAction.newline,
              ),
              const SizedBox(height: 4),
              _CheckboxRow(
                label: 'Active (visible for assignment)',
                value: _isActive,
                onChanged: (v) => setState(() => _isActive = v),
              ),
              const SizedBox(height: 20),
              AppButton(
                label: widget.isEdit ? 'Save changes' : 'Create plan',
                loading: _saving,
                onPressed: _saving ? null : _submit,
              ),
              if (widget.isEdit && plan != null && !deleted) ...[
                const SizedBox(height: 20),
                WeeklyExerciseEditor(
                  plan: plan,
                  onSaved: (updated) => setState(() => _currentPlan = updated),
                ),
                const SizedBox(height: 16),
                if (plan.isActive)
                  AssignToMemberCard(
                    onAssign: (memberId, startDate) =>
                        getIt<WorkoutPlanRepository>().assign(
                      planId: plan.id,
                      memberId: memberId,
                      startDate: startDate,
                    ),
                  ),
              ],
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlanHeader extends StatelessWidget {
  const _PlanHeader({required this.plan});

  final WorkoutPlan plan;

  @override
  Widget build(BuildContext context) {
    final deleted = plan.deletedAt != null;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  plan.name,
                  style: AppText.body(size: 14, weight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(
                  '${plan.activeMemberCount} member'
                  '${plan.activeMemberCount == 1 ? '' : 's'} on this plan',
                  style: AppText.body(size: 11, color: AppColors.inkFaint),
                ),
              ],
            ),
          ),
          AppPill(
            label:
                deleted ? 'Deleted' : (plan.isActive ? 'Active' : 'Inactive'),
            tone: deleted
                ? AppPillTone.neutral
                : (plan.isActive ? AppPillTone.success : AppPillTone.danger),
          ),
        ],
      ),
    );
  }
}

class _CheckboxRow extends StatelessWidget {
  const _CheckboxRow({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.field),
        onTap: () => onChanged(!value),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  gradient: value ? AppColors.staffGrad : null,
                  color: value ? null : AppColors.surface3,
                  borderRadius: BorderRadius.circular(5),
                  border: Border.all(
                    color: value ? Colors.transparent : AppColors.line,
                  ),
                ),
                child: value
                    ? const Icon(
                        Icons.check_rounded,
                        size: 14,
                        color: Colors.white,
                      )
                    : null,
              ),
              const SizedBox(width: 10),
              Text(
                label,
                style: AppText.body(size: 13, weight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
