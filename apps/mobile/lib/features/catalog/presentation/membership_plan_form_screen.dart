import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';

/// Design frame "7a. + Create plan".
class MembershipPlanFormScreen extends StatefulWidget {
  const MembershipPlanFormScreen({super.key});

  @override
  State<MembershipPlanFormScreen> createState() =>
      _MembershipPlanFormScreenState();
}

class _MembershipPlanFormScreenState extends State<MembershipPlanFormScreen> {
  final _nameController = TextEditingController();
  final _priceController = TextEditingController();
  PlanDuration _duration = PlanDuration.quarterly;
  bool _includePt = false;
  bool _includeDiet = false;
  bool _includeGroupClasses = false;
  bool _includeLocker = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    final price = double.tryParse(_priceController.text.trim());
    if (name.isEmpty) {
      setState(() => _error = 'Plan name is required');
      return;
    }
    if (price == null || price <= 0) {
      setState(() => _error = 'Enter a valid price');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await getIt<MembershipPlanRepository>().create(
        MembershipPlanFormInput(
          name: name,
          price: price,
          duration: _duration,
          includePt: _includePt,
          includeDiet: _includeDiet,
          includeGroupClasses: _includeGroupClasses,
          includeLocker: _includeLocker,
        ),
      );
      if (!mounted) return;
      context.pop();
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
        title: const Text('New Plan'),
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
                hintText: 'e.g. Quarterly Pro',
                controller: _nameController,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Price',
                hintText: 'e.g. 4999',
                controller: _priceController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
                ],
              ),
              const SizedBox(height: 14),
              Text('Duration', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              CategoryChipSelector<PlanDuration>(
                options: PlanDuration.values,
                labelOf: (d) => d.label,
                value: _duration,
                onChanged: (d) => setState(() => _duration = d),
              ),
              const SizedBox(height: 14),
              Text('Perks included', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _PerkToggle(
                    label: 'PT sessions',
                    value: _includePt,
                    onChanged: (v) => setState(() => _includePt = v),
                  ),
                  _PerkToggle(
                    label: 'Diet plan',
                    value: _includeDiet,
                    onChanged: (v) => setState(() => _includeDiet = v),
                  ),
                  _PerkToggle(
                    label: 'Group classes',
                    value: _includeGroupClasses,
                    onChanged: (v) => setState(() => _includeGroupClasses = v),
                  ),
                  _PerkToggle(
                    label: 'Locker',
                    value: _includeLocker,
                    onChanged: (v) => setState(() => _includeLocker = v),
                  ),
                ],
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

class _PerkToggle extends StatelessWidget {
  const _PerkToggle({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          gradient: value ? AppColors.staffGrad : null,
          color: value ? null : AppColors.surface3,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          value ? '✓ $label' : label,
          style: AppText.body(
            size: 12,
            weight: FontWeight.w700,
            color: value ? Colors.white : AppColors.inkSoft,
          ),
        ),
      ),
    );
  }
}
