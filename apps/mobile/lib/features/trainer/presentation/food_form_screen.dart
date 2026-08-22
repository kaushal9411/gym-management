import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../repositories/food_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "7b. + Add food".
class FoodFormScreen extends StatefulWidget {
  const FoodFormScreen({super.key});

  @override
  State<FoodFormScreen> createState() => _FoodFormScreenState();
}

class _FoodFormScreenState extends State<FoodFormScreen> {
  final _nameController = TextEditingController();
  final _categoryController = TextEditingController();
  final _servingController = TextEditingController();
  final _kcalController = TextEditingController();
  final _proteinController = TextEditingController();
  final _carbsController = TextEditingController();
  final _fatController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _categoryController.dispose();
    _servingController.dispose();
    _kcalController.dispose();
    _proteinController.dispose();
    _carbsController.dispose();
    _fatController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Enter a food name');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await getIt<FoodRepository>().create(
        name: name,
        category: _categoryController.text.trim(),
        servingSize: _servingController.text.trim(),
        calories: int.tryParse(_kcalController.text.trim()),
        protein: double.tryParse(_proteinController.text.trim()),
        carbohydrates: double.tryParse(_carbsController.text.trim()),
        fat: double.tryParse(_fatController.text.trim()),
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
        title: const Text('Add food'),
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
                label: 'Food name',
                hintText: 'e.g. Grilled Chicken Breast',
                controller: _nameController,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Category',
                hintText: 'e.g. Protein, Dairy',
                controller: _categoryController,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Serving size',
                hintText: 'e.g. 100g, 1 cup',
                controller: _servingController,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'Calories (kcal)',
                      hintText: 'e.g. 165',
                      controller: _kcalController,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Protein (g)',
                      hintText: 'e.g. 31',
                      controller: _proteinController,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(
                          RegExp(r'^\d*\.?\d{0,2}'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'Carbs (g)',
                      hintText: 'e.g. 0',
                      controller: _carbsController,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(
                          RegExp(r'^\d*\.?\d{0,2}'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Fat (g)',
                      hintText: 'e.g. 4',
                      controller: _fatController,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(
                          RegExp(r'^\d*\.?\d{0,2}'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Add food',
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
