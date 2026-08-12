import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';

/// Design frame "6a. + Add member". `POST /members` (profile only) has no
/// `planId` field — assigning a plan is the separate `PUT /:id/membership`
/// call, chained here after create so the design's single-form UX still
/// results in two real requests rather than one fabricated combined one.
class MemberFormScreen extends StatefulWidget {
  const MemberFormScreen({super.key});

  @override
  State<MemberFormScreen> createState() => _MemberFormScreenState();
}

class _MemberFormScreenState extends State<MemberFormScreen> {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  List<BranchOption> _branchOptions = [];
  List<MembershipPlan> _plans = [];
  String? _branchId;
  String? _planId;
  bool _loading = false;
  bool _loadingOptions = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadOptions();
  }

  Future<void> _loadOptions() async {
    try {
      final branchesFuture = getIt<BranchRepository>().assignable();
      final plansFuture = getIt<MembershipPlanRepository>().list(limit: 50);
      final branches = await branchesFuture;
      final plans = await plansFuture;
      if (!mounted) return;
      setState(() {
        _branchOptions = branches;
        _branchId = branches.isNotEmpty ? branches.first.id : null;
        _plans = plans.items.where((p) => p.isActive).toList();
        _loadingOptions = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loadingOptions = false;
      });
    }
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    if (firstName.isEmpty || lastName.isEmpty) {
      setState(() => _error = 'Enter first and last name');
      return;
    }
    if (_branchId == null) {
      setState(() => _error = 'Select a branch');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final member = await getIt<MemberRepository>().create(
        firstName: firstName,
        lastName: lastName,
        phone: _phoneController.text.trim(),
        email: _emailController.text.trim(),
        branchId: _branchId!,
      );
      if (_planId != null) {
        await getIt<MemberRepository>().assignMembership(member.id, _planId!);
      }
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
        title: const Text('New Member'),
      ),
      body: SafeArea(
        top: false,
        child: _loadingOptions
            ? const AppLoadingView()
            : SingleChildScrollView(
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
                      label: 'First name',
                      controller: _firstNameController,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    AppLabeledField(
                      label: 'Last name',
                      controller: _lastNameController,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    AppLabeledField(
                      label: 'Phone',
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    AppLabeledField(
                      label: 'Email',
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                    ),
                    if (_plans.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Text('Plan (optional)', style: AppText.eyebrow()),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _PlanChip(
                            label: 'None',
                            selected: _planId == null,
                            onTap: () => setState(() => _planId = null),
                          ),
                          for (final p in _plans)
                            _PlanChip(
                              label: p.name,
                              selected: _planId == p.id,
                              onTap: () => setState(() => _planId = p.id),
                            ),
                        ],
                      ),
                    ],
                    if (_branchOptions.length > 1) ...[
                      const SizedBox(height: 14),
                      Text('Branch', style: AppText.eyebrow()),
                      const SizedBox(height: 8),
                      CategoryChipSelector<String>(
                        options: _branchOptions.map((b) => b.id).toList(),
                        labelOf: (id) =>
                            _branchOptions.firstWhere((b) => b.id == id).name,
                        value: _branchId!,
                        onChanged: (id) => setState(() => _branchId = id),
                      ),
                    ],
                    const SizedBox(height: 24),
                    AppButton(
                      label: 'Create member',
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

class _PlanChip extends StatelessWidget {
  const _PlanChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          gradient: selected ? AppColors.staffGrad : null,
          color: selected ? null : AppColors.surface3,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: AppText.body(
            size: 12,
            weight: FontWeight.w700,
            color: selected ? Colors.white : AppColors.inkSoft,
          ),
        ),
      ),
    );
  }
}
