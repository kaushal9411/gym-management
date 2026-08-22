import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/exercise.dart';
import '../../../repositories/exercise_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';

const _muscleGroups = ['Chest', 'Back', 'Legs', 'Core', 'Shoulders', 'Arms'];

/// Design frame "5b. + Add exercise".
class ExerciseFormScreen extends StatefulWidget {
  const ExerciseFormScreen({super.key});

  @override
  State<ExerciseFormScreen> createState() => _ExerciseFormScreenState();
}

class _ExerciseFormScreenState extends State<ExerciseFormScreen> {
  final _nameController = TextEditingController();
  final _equipmentController = TextEditingController();
  final _setsController = TextEditingController();
  final _repsController = TextEditingController();
  final _instructionsController = TextEditingController();
  String _muscleGroup = _muscleGroups.first;
  ExerciseDifficulty _difficulty = ExerciseDifficulty.beginner;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _equipmentController.dispose();
    _setsController.dispose();
    _repsController.dispose();
    _instructionsController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Enter an exercise name');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await getIt<ExerciseRepository>().create(
        name: name,
        muscleGroup: _muscleGroup,
        equipment: _equipmentController.text.trim(),
        difficultyLevel: _difficulty,
        instructions: _instructionsController.text.trim().isEmpty
            ? null
            : _instructionsController.text.trim(),
        defaultSets: int.tryParse(_setsController.text.trim()),
        defaultReps: int.tryParse(_repsController.text.trim()),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('Add exercise'),
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
                label: 'Exercise name',
                hintText: 'e.g. Barbell Squat',
                controller: _nameController,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              Text('Muscle group', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              CategoryChipSelector<String>(
                options: _muscleGroups,
                labelOf: (m) => m,
                value: _muscleGroup,
                onChanged: (m) => setState(() => _muscleGroup = m),
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Equipment',
                hintText: 'e.g. Barbell (optional)',
                controller: _equipmentController,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              Text('Difficulty', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              CategoryChipSelector<ExerciseDifficulty>(
                options: ExerciseDifficulty.values,
                labelOf: (d) => d.label,
                value: _difficulty,
                onChanged: (d) => setState(() => _difficulty = d),
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Instructions',
                hintText: 'How to perform this exercise (optional)',
                controller: _instructionsController,
                minLines: 2,
                maxLines: 4,
                textInputAction: TextInputAction.newline,
              ),
              const SizedBox(height: 14),
              Text('Default sets × reps', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'Sets',
                      hintText: 'e.g. 3',
                      controller: _setsController,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Reps',
                      hintText: 'e.g. 10',
                      controller: _repsController,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Add exercise',
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
