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
import '../../../repositories/invitation_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// `POST /invitations` — emails a tokenized accept link; the invitee sets
/// their own password on the web accept page. Distinct from
/// [UserFormScreen], which creates the account directly.
class InviteUserScreen extends StatefulWidget {
  const InviteUserScreen({required this.roles, super.key});

  final List<TenantRole> roles;

  @override
  State<InviteUserScreen> createState() => _InviteUserScreenState();
}

class _InviteUserScreenState extends State<InviteUserScreen> {
  /// `SUPER_ADMIN` is a real system role `GET /roles` returns, but
  /// `POST /users`/`POST /invitations` both reject assigning it ("The
  /// SUPER_ADMIN role cannot be assigned here.") — verified live — so it's
  /// filtered out of the picker rather than offered and then rejected.
  List<TenantRole> get _assignableRoles =>
      widget.roles.where((r) => r.name != 'SUPER_ADMIN').toList();

  final _emailController = TextEditingController();
  String? _roleId;
  List<Branch>? _branches;
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
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'Enter an email address');
      return;
    }
    if (_roleId == null) {
      setState(() => _error = 'Choose a role');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<InvitationRepository>().invite(
        email: email,
        roleId: _roleId!,
        branchIds:
            _selectedBranchIds.isEmpty ? null : _selectedBranchIds.toList(),
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
        title: const Text('Invite by email'),
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
                      label: 'Email',
                      hintText: 'staff@gym.com',
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 18),
                    Text('Role', style: AppText.eyebrow()),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _assignableRoles.map((role) {
                        final selected = _roleId == role.id;
                        return GestureDetector(
                          onTap: () => setState(() => _roleId = role.id),
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
                    if (_branches!.isNotEmpty) ...[
                      const SizedBox(height: 18),
                      Text(
                        'Branches (optional)',
                        style: AppText.eyebrow(),
                      ),
                      const SizedBox(height: 8),
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
                      label: 'Send invitation',
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
