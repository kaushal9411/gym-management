import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/food.dart';
import '../../../repositories/food_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/status_action_menu.dart';

/// Design frame "7a. Food detail".
class FoodDetailScreen extends StatefulWidget {
  const FoodDetailScreen({required this.food, super.key});

  final Food food;

  @override
  State<FoodDetailScreen> createState() => _FoodDetailScreenState();
}

class _FoodDetailScreenState extends State<FoodDetailScreen> {
  late final _servingController =
      TextEditingController(text: widget.food.servingSize ?? '');
  late final _proteinController = TextEditingController(
    text: widget.food.protein?.toStringAsFixed(1) ?? '',
  );
  late final _carbsController = TextEditingController(
    text: widget.food.carbohydrates?.toStringAsFixed(1) ?? '',
  );
  late final _fatController = TextEditingController(
    text: widget.food.fat?.toStringAsFixed(1) ?? '',
  );
  bool _loading = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _servingController.dispose();
    _proteinController.dispose();
    _carbsController.dispose();
    _fatController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await getIt<FoodRepository>().update(
        widget.food.id,
        servingSize: _servingController.text.trim(),
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

  Future<void> _delete() async {
    setState(() => _busy = true);
    try {
      await getIt<FoodRepository>().delete(widget.food.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Food deleted.')));
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
      await getIt<FoodRepository>().restore(widget.food.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Food restored.')));
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
            Text(widget.food.name, style: AppText.display(size: 18)),
            Text(widget.food.servingSize ?? '—', style: AppText.eyebrow()),
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
              subjectName: widget.food.name,
              isDeleted: widget.food.deletedAt != null,
              isActive: widget.food.isActive,
              canDuplicate: false,
              showActivateDeactivate: false,
              onDelete: _delete,
              onRestore: _restore,
              deleteDescription: 'This soft-deletes the food — meals that '
                  'already use it are unaffected, but it can no longer be '
                  'added to new meals until restored.',
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
                  label: widget.food.deletedAt != null
                      ? 'Deleted'
                      : (widget.food.isActive ? 'Active' : 'Inactive'),
                  tone: widget.food.deletedAt != null
                      ? AppPillTone.neutral
                      : (widget.food.isActive
                          ? AppPillTone.success
                          : AppPillTone.danger),
                ),
              ),
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.surface2,
                  borderRadius: BorderRadius.circular(AppRadii.card),
                  border: Border.all(color: AppColors.line),
                ),
                alignment: Alignment.center,
                child: Column(
                  children: [
                    Text(
                      '${widget.food.calories ?? 0} kcal',
                      style: AppText.display(size: 26),
                    ),
                    Text('per serving', style: AppText.eyebrow()),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _MacroCard(
                      label: 'Protein',
                      value: widget.food.protein,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _MacroCard(
                      label: 'Carbs',
                      value: widget.food.carbohydrates,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _MacroCard(label: 'Fat', value: widget.food.fat),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Serving size',
                hintText: 'e.g. 100g, 1 cup',
                controller: _servingController,
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'Protein (g)',
                      hintText: 'e.g. 20',
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
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Carbs (g)',
                      hintText: 'e.g. 40',
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
                      hintText: 'e.g. 10',
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
              AppButton(label: 'Save', loading: _loading, onPressed: _save),
            ],
          ),
        ),
      ),
    );
  }
}

class _MacroCard extends StatelessWidget {
  const _MacroCard({required this.label, required this.value});

  final String label;
  final double? value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      alignment: Alignment.center,
      child: Column(
        children: [
          Text(
            value != null ? '${value!.toStringAsFixed(0)}g' : '—',
            style: AppText.body(size: 15, weight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(label, style: AppText.eyebrow()),
        ],
      ),
    );
  }
}
