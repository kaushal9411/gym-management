import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/iam_user_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// `POST /users` — direct account creation (sets a real password
/// immediately), distinct from the Invitations flow which emails a
/// tokenized accept link instead. No design frame; built to match
/// `StaffFormScreen`'s create pattern.
class UserFormScreen extends StatefulWidget {
  const UserFormScreen({required this.roles, super.key});

  final List<TenantRole> roles;

  @override
  State<UserFormScreen> createState() => _UserFormScreenState();
}

class _UserFormScreenState extends State<UserFormScreen> {
  /// `SUPER_ADMIN` is a real system role `GET /roles` returns, but
  /// `POST /users`/`POST /invitations` both reject assigning it ("The
  /// SUPER_ADMIN role cannot be assigned here.") — verified live — so it's
  /// filtered out of the picker rather than offered and then rejected.
  List<TenantRole> get _assignableRoles =>
      widget.roles.where((r) => r.name != 'SUPER_ADMIN').toList();

  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final Set<String> _selectedRoleIds = {};
  List<Branch>? _branches;
  bool _allBranches = false;
  final Set<String> _selectedBranchIds = {};
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadBranches();
  }

  Future<void> _loadBranches() async {
    try {
      final result = await getIt<BranchRepository>().list(limit: 100);
      if (!mounted) return;
      setState(() => _branches = result.items);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (name.isEmpty || email.isEmpty || password.isEmpty) {
      setState(() => _error = 'Name, email and password are required');
      return;
    }
    if (_selectedRoleIds.isEmpty) {
      setState(() => _error = 'Assign at least one role');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final branchIds = _selectedBranchIds.toList();
      await getIt<IamUserRepository>().create(
        name: name,
        email: email,
        password: password,
        phone: _phoneController.text.trim(),
        roleIds: _selectedRoleIds.toList(),
        allBranches: _allBranches,
        branches: _allBranches
            ? const []
            : [
                for (var i = 0; i < branchIds.length; i++)
                  BranchAssignmentDraft(
                    branchId: branchIds[i],
                    isPrimary: i == 0,
                  ),
              ],
      );
      if (!mounted) return;
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('New user'),
      ),
      body: SafeArea(
        top: false,
        child: _branches == null
            ? _error != null
                ? AppErrorView(message: _error!, onRetry: _loadBranches)
                : const AppLoadingView()
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
                      label: 'Name',
                      hintText: 'e.g. Priya Sharma',
                      controller: _nameController,
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
                    AppLabeledField(
                      label: 'Phone',
                      hintText: 'e.g. 9876543210',
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    AppLabeledField(
                      label: 'Password',
                      hintText: 'At least 8 characters',
                      controller: _passwordController,
                      obscureText: true,
                      textInputAction: TextInputAction.done,
                    ),
                    const SizedBox(height: 18),
                    Text('Roles', style: AppText.eyebrow()),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _assignableRoles.map((role) {
                        final selected = _selectedRoleIds.contains(role.id);
                        return GestureDetector(
                          onTap: () => setState(() {
                            selected
                                ? _selectedRoleIds.remove(role.id)
                                : _selectedRoleIds.add(role.id);
                          }),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              gradient: selected ? AppColors.staffGrad : null,
                              color: selected ? null : AppColors.surface3,
                              borderRadius:
                                  BorderRadius.circular(AppRadii.pill),
                            ),
                            child: Text(
                              role.name,
                              style: AppText.body(
                                size: 12,
                                weight: FontWeight.w700,
                                color: selected
                                    ? Colors.white
                                    : AppColors.inkSoft,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 18),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.surface2,
                        borderRadius: BorderRadius.circular(AppRadii.card),
                        border: Border.all(color: AppColors.line),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              'All branches',
                              style: AppText.body(
                                size: 14,
                                weight: FontWeight.w700,
                              ),
                            ),
                          ),
                          Switch(
                            value: _allBranches,
                            activeThumbColor: AppColors.staffPillFg,
                            onChanged: (v) =>
                                setState(() => _allBranches = v),
                          ),
                        ],
                      ),
                    ),
                    if (!_allBranches) ...[
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _branches!.map((branch) {
                          final selected =
                              _selectedBranchIds.contains(branch.id);
                          return GestureDetector(
                            onTap: () => setState(() {
                              selected
                                  ? _selectedBranchIds.remove(branch.id)
                                  : _selectedBranchIds.add(branch.id);
                            }),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                              decoration: BoxDecoration(
                                gradient:
                                    selected ? AppColors.staffGrad : null,
                                color: selected ? null : AppColors.surface3,
                                borderRadius:
                                    BorderRadius.circular(AppRadii.pill),
                              ),
                              child: Text(
                                branch.name,
                                style: AppText.body(
                                  size: 12,
                                  weight: FontWeight.w700,
                                  color: selected
                                      ? Colors.white
                                      : AppColors.inkSoft,
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                    const SizedBox(height: 24),
                    AppButton(
                      label: 'Create user',
                      loading: _saving,
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
