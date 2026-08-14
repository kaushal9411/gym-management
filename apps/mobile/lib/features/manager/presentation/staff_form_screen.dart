import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/staff_member.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';

/// Design frame "5a. + Invite staff". The design's single "Full name"
/// field is split into first/last name — `createStaffSchema` requires them
/// separately (`User.name` is derived server-side from the two).
class StaffFormScreen extends StatefulWidget {
  const StaffFormScreen({super.key});

  @override
  State<StaffFormScreen> createState() => _StaffFormScreenState();
}

class _StaffFormScreenState extends State<StaffFormScreen> {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  StaffRole _role = StaffRole.trainer;
  List<BranchOption> _branchOptions = [];
  String? _branchId;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadBranches();
  }

  Future<void> _loadBranches() async {
    try {
      final options = await getIt<BranchRepository>().assignable();
      if (!mounted) return;
      setState(() {
        _branchOptions = options;
        _branchId = options.isNotEmpty ? options.first.id : null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    final email = _emailController.text.trim();
    if (firstName.isEmpty || lastName.isEmpty) {
      setState(() => _error = 'Enter first and last name');
      return;
    }
    if (email.isEmpty) {
      setState(() => _error = 'Enter an email address');
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
      await getIt<StaffRepository>().create(
        firstName: firstName,
        lastName: lastName,
        email: email,
        role: _role,
        primaryBranchId: _branchId!,
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
        title: const Text('Invite Staff'),
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
                label: 'First name',
                hintText: 'e.g. Arjun',
                controller: _firstNameController,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Last name',
                hintText: 'e.g. Trainer',
                controller: _lastNameController,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Email',
                hintText: 'staff@gym.com',
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              Text('Role', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              CategoryChipSelector<StaffRole>(
                options: StaffRole.values,
                labelOf: (r) => r.label,
                value: _role,
                onChanged: (r) => setState(() => _role = r),
              ),
              const SizedBox(height: 14),
              Text('Branch', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              if (_branchOptions.isEmpty)
                Text(
                  'No branches available.',
                  style: AppText.body(color: AppColors.inkFaint),
                )
              else
                CategoryChipSelector<String>(
                  options: _branchOptions.map((b) => b.id).toList(),
                  labelOf: (id) =>
                      _branchOptions.firstWhere((b) => b.id == id).name,
                  value: _branchId!,
                  onChanged: (id) => setState(() => _branchId = id),
                ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Send invite',
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
