import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/exercise.dart';
import '../../../repositories/exercise_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/status_action_menu.dart';

/// Design frame "5a. Exercise detail" — Sets/Reps steppers + Notes, "Save
/// to plan" relabeled "Save" here since this screen (reached from the
/// library, not a plan-building context) just edits the exercise's
/// defaults, matching `ExerciseRepository.update`'s field set.
class ExerciseDetailScreen extends StatefulWidget {
  const ExerciseDetailScreen({required this.exercise, super.key});

  final Exercise exercise;

  @override
  State<ExerciseDetailScreen> createState() => _ExerciseDetailScreenState();
}

class _ExerciseDetailScreenState extends State<ExerciseDetailScreen> {
  late int _sets = widget.exercise.defaultSets ?? 3;
  late int _reps = widget.exercise.defaultReps ?? 10;
  late final _notesController =
      TextEditingController(text: widget.exercise.instructions ?? '');
  bool _loading = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await getIt<ExerciseRepository>().update(
        widget.exercise.id,
        defaultSets: _sets,
        defaultReps: _reps,
        instructions: _notesController.text.trim(),
      );
      if (!mounted) return;
      context.pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _delete() async {
    setState(() => _busy = true);
    try {
      await getIt<ExerciseRepository>().delete(widget.exercise.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Exercise deleted.')));
      context.pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _restore() async {
    setState(() => _busy = true);
    try {
      await getIt<ExerciseRepository>().restore(widget.exercise.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Exercise restored.')));
      context.pop(true);
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
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.exercise.name, style: AppText.display(size: 18)),
            Text(
              [
                if (widget.exercise.muscleGroup != null)
                  widget.exercise.muscleGroup!,
                if (widget.exercise.equipment != null)
                  widget.exercise.equipment!,
              ].join(' · '),
              style: AppText.eyebrow(),
            ),
          ],
        ),
        actions: [
          if (_busy)
            const Padding(
              padding: EdgeInsets.only(right: 16),
              child: Center(
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            )
          else
            StatusActionMenu(
              subjectName: widget.exercise.name,
              isDeleted: widget.exercise.deletedAt != null,
              isActive: widget.exercise.isActive,
              canDuplicate: false,
              showActivateDeactivate: false,
              onDelete: _delete,
              onRestore: _restore,
              deleteDescription: 'This soft-deletes the exercise — plans '
                  'that already use it are unaffected, but it can no '
                  'longer be added to new plans until restored.',
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
              if (_error != null) ...[
                FormAlert(message: _error!),
                const SizedBox(height: 14),
              ],
              Align(
                alignment: Alignment.centerLeft,
                child: AppPill(
                  label: widget.exercise.deletedAt != null
                      ? 'Deleted'
                      : (widget.exercise.isActive ? 'Active' : 'Inactive'),
                  tone: widget.exercise.deletedAt != null
                      ? AppPillTone.neutral
                      : (widget.exercise.isActive
                          ? AppPillTone.success
                          : AppPillTone.danger),
                ),
              ),
              const SizedBox(height: 10),
              Container(
                height: 120,
                decoration: BoxDecoration(
                  color: AppColors.surface2,
                  borderRadius: BorderRadius.circular(AppRadii.card),
                  border: Border.all(color: AppColors.line),
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.fitness_center_outlined,
                  size: 28,
                  color: AppColors.inkFaint,
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _Stepper(
                      label: 'Sets',
                      value: _sets,
                      onDecrement:
                          _sets > 1 ? () => setState(() => _sets--) : null,
                      onIncrement: () => setState(() => _sets++),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _Stepper(
                      label: 'Reps',
                      value: _reps,
                      onDecrement:
                          _reps > 1 ? () => setState(() => _reps--) : null,
                      onIncrement: () => setState(() => _reps++),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Notes',
                hintText: 'Form cues, tips (optional)',
                controller: _notesController,
              ),
              const SizedBox(height: 24),
              AppButton(label: 'Save', loading: _loading, onPressed: _save),
            ],
          ),
        ),
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({
    required this.label,
    required this.value,
    required this.onDecrement,
    required this.onIncrement,
  });

  final String label;
  final int value;
  final VoidCallback? onDecrement;
  final VoidCallback onIncrement;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          Text(label, style: AppText.eyebrow()),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _StepButton(
                icon: Icons.remove_rounded,
                onTap: onDecrement,
                filled: false,
              ),
              SizedBox(
                width: 32,
                child: Text(
                  '$value',
                  textAlign: TextAlign.center,
                  style: AppText.display(size: 18),
                ),
              ),
              _StepButton(
                icon: Icons.add_rounded,
                onTap: onIncrement,
                filled: true,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({
    required this.icon,
    required this.onTap,
    required this.filled,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onTap == null ? 0.4 : 1,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(9),
          onTap: onTap,
          child: Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              gradient: filled ? AppColors.staffGrad : null,
              color: filled ? null : AppColors.surface3,
              borderRadius: BorderRadius.circular(9),
            ),
            alignment: Alignment.center,
            child: Icon(
              icon,
              size: 16,
              color: filled ? Colors.white : AppColors.ink,
            ),
          ),
        ),
      ),
    );
  }
}
