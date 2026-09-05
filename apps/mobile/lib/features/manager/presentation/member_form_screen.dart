import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/membership_plan.dart';
import '../../../models/staff_member.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';

/// Design frame "6a. + Add member" — field set and order now match web's
/// `/members/new` exactly (First/Last name, Email, Phone, Member ID,
/// Branch, Trainer, Fitness goals; Prompt 62), plus one mobile-only
/// addition: a Plan chip picker. `POST /members` (profile only) has no
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
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _memberIdController = TextEditingController();
  final _fitnessGoalsController = TextEditingController();
  List<BranchOption> _branchOptions = [];
  List<MembershipPlan> _plans = [];
  List<StaffMember> _trainers = [];
  String? _branchId;
  String? _planId;
  DateTime _planStartDate = DateTime.now();
  String? _trainerId;
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
      final trainersFuture = getIt<StaffRepository>().list(
        limit: 100,
        role: StaffRole.trainer,
        status: 'ACTIVE',
      );
      final branches = await branchesFuture;
      final plans = await plansFuture;
      final trainers = await trainersFuture;
      if (!mounted) return;
      setState(() {
        _branchOptions = branches;
        _branchId = branches.isNotEmpty ? branches.first.id : null;
        _plans = plans.items.where((p) => p.isActive).toList();
        _trainers = trainers.items;
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

  /// India-common flow: the member pays/joins today but tells the owner to
  /// start on a later date (e.g. once their old gym's plan runs out). A
  /// future date here makes the backend store the membership `PENDING`
  /// instead of `ACTIVE` — no check-in access until that date arrives.
  Future<void> _pickPlanStartDate() async {
    final picked = await showDatePicker(
      context: context,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      initialDate: _planStartDate,
    );
    if (picked == null) return;
    setState(() => _planStartDate = picked);
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _memberIdController.dispose();
    _fitnessGoalsController.dispose();
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
        email: _emailController.text.trim(),
        phone: _phoneController.text.trim(),
        memberId: _memberIdController.text.trim(),
        branchId: _branchId!,
        trainerId: _trainerId,
        fitnessGoals: _fitnessGoalsController.text.trim(),
      );
      if (_planId != null) {
        await getIt<MemberRepository>().assignMembership(
          member.id,
          _planId!,
          startDate: _planStartDate,
        );
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
                      hintText: 'e.g. Karan',
                      controller: _firstNameController,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    AppLabeledField(
                      label: 'Last name',
                      hintText: 'e.g. Reddy',
                      controller: _lastNameController,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    AppLabeledField(
                      label: 'Email',
                      hintText: 'member@example.com',
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    AppLabeledField(
                      label: 'Phone',
                      hintText: 'e.g. 9876543210',
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    AppLabeledField(
                      label: 'Member ID (optional)',
                      hintText: 'Auto-generated if left blank',
                      controller: _memberIdController,
                      textCapitalization: TextCapitalization.characters,
                      textInputAction: TextInputAction.next,
                    ),
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
                    if (_trainers.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Text('Trainer (optional)', style: AppText.eyebrow()),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _PlanChip(
                            label: 'No trainer assigned',
                            selected: _trainerId == null,
                            onTap: () => setState(() => _trainerId = null),
                          ),
                          for (final t in _trainers)
                            _PlanChip(
                              label: t.name,
                              selected: _trainerId == t.id,
                              onTap: () => setState(() => _trainerId = t.id),
                            ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 14),
                    AppLabeledField(
                      label: 'Fitness goals (optional)',
                      hintText: 'e.g. Weight loss, strength training',
                      controller: _fitnessGoalsController,
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
                      if (_planId != null) ...[
                        const SizedBox(height: 10),
                        Material(
                          color: Colors.transparent,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(AppRadii.field),
                            onTap: _pickPlanStartDate,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 12,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.surface3,
                                borderRadius: BorderRadius.circular(AppRadii.field),
                              ),
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.calendar_today_rounded,
                                    size: 15,
                                    color: AppColors.inkFaint,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Starts ${_planStartDate.day.toString().padLeft(2, '0')}/'
                                    '${_planStartDate.month.toString().padLeft(2, '0')}/'
                                    '${_planStartDate.year}',
                                    style: AppText.body(size: 13, weight: FontWeight.w600),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
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
