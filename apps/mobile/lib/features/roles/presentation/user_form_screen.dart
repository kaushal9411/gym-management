import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/iam_user_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/staff_branch_picker.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// `POST /users` — direct account creation (sets a real password
/// immediately, email lands already verified), distinct from the Invitations
/// flow which emails a tokenized accept link. Mirrors web's `/users/new`:
/// account details with the live password policy, role picker, branch scope
/// (defaults to all branches, like web) and a "ready to create" checklist.
class UserFormScreen extends StatefulWidget {
  const UserFormScreen({required this.roles, super.key});

  final List<TenantRole> roles;

  @override
  State<UserFormScreen> createState() => _UserFormScreenState();
}

class _UserFormScreenState extends State<UserFormScreen> {
  /// `SUPER_ADMIN` is a real system role `GET /roles` returns, but
  /// `POST /users` rejects assigning it ("The SUPER_ADMIN role cannot be
  /// assigned here.") — so it is never offered; inactive roles are hidden.
  List<TenantRole> get _assignableRoles =>
      widget.roles.where((r) => r.name != 'SUPER_ADMIN' && r.isActive).toList();

  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final Set<String> _roleIds = {};
  List<BranchOption>? _branches;
  bool _allBranches = true;
  Set<String> _branchIds = {};
  String? _primary;
  bool _saving = false;
  String? _error;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    for (final c in [_name, _email, _password]) {
      c.addListener(_rebuild);
    }
    _loadBranches();
  }

  void _rebuild() {
    if (mounted) setState(() {});
  }

  Future<void> _loadBranches() async {
    setState(() => _loadError = null);
    try {
      final options = await getIt<BranchRepository>().assignable();
      if (!mounted) return;
      setState(() => _branches = options);
    } on ApiException catch (e) {
      if (mounted) setState(() => _loadError = e.message);
    } catch (e) {
      if (mounted) setState(() => _loadError = '$e');
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  bool get _emailOk => RegExp(r'^\S+@\S+\.\S+$').hasMatch(_email.text.trim());

  Future<void> _submit() async {
    final name = _name.text.trim();
    if (name.length < 2) {
      setState(() => _error = 'Enter a name (at least 2 characters)');
      return;
    }
    if (!_emailOk) {
      setState(() => _error = 'Enter a valid email address');
      return;
    }
    if (!PasswordRules.isValid(_password.text)) {
      setState(() => _error = "The password doesn't meet the policy yet");
      return;
    }
    if (_roleIds.isEmpty) {
      setState(() => _error = 'Assign at least one role.');
      return;
    }
    if (!_allBranches && _branchIds.isEmpty) {
      setState(
        () => _error = 'Pick at least one branch, or choose All '
            'branches',
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<IamUserRepository>().create(
        name: name,
        email: _email.text.trim(),
        password: _password.text,
        phone: _phone.text.trim(),
        roleIds: _roleIds.toList(),
        allBranches: _allBranches,
        branches: _allBranches
            ? const []
            : [
                for (final id in _branchIds)
                  BranchAssignmentDraft(
                    branchId: id,
                    isPrimary: id == (_primary ?? _branchIds.first),
                  ),
              ],
      );
      if (!mounted) return;
      teamSnack(context, '$name created.');
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not create the user ($e)');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final branches = _branches;
    if (branches == null) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: const Text('New user'),
        ),
        body: _loadError != null
            ? AppErrorView(message: _loadError!, onRetry: _loadBranches)
            : const AppLoadingView(),
      );
    }
    final roles = _assignableRoles;
    final checks = [
      ('Name', _name.text.trim().length >= 2),
      ('Valid email', _emailOk),
      ('Password meets policy', PasswordRules.isValid(_password.text)),
      ('At least one role', _roleIds.isNotEmpty),
    ];
    final done = checks.where((c) => c.$2).length;

    return TeamEditScaffold(
      name: _name.text.trim().isEmpty ? 'New user' : _name.text.trim(),
      subtitle: _email.text.trim().isEmpty
          ? 'Creates the account directly'
          : _email.text.trim(),
      title: 'New user',
      icon: Icons.person_add_alt_1_rounded,
      color: TeamColors.indigo,
      saving: _saving,
      onSave: _submit,
      saveLabel: 'Create user',
      error: _error,
      sections: [
        TeamFormSection(
          icon: Icons.person_rounded,
          color: TeamColors.indigo,
          title: 'Account details',
          subtitle: 'For staff standing next to you — the email lands '
              'already verified',
          children: [
            AppLabeledField(
              label: 'Name',
              hintText: 'e.g. Priya Sharma',
              icon: Icons.person_rounded,
              iconColor: TeamColors.indigo,
              controller: _name,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'Email',
              hintText: 'staff@gym.com',
              icon: Icons.mail_rounded,
              iconColor: TeamColors.sky,
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'Phone (optional)',
              hintText: 'e.g. 9876543210',
              icon: Icons.call_rounded,
              iconColor: TeamColors.green,
              controller: _phone,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppLabeledField(
                  label: 'Password',
                  hintText: 'Choose a strong password',
                  icon: Icons.lock_rounded,
                  iconColor: TeamColors.violet,
                  controller: _password,
                  obscureText: true,
                  textInputAction: TextInputAction.done,
                ),
                const SizedBox(height: 8),
                PasswordRules(password: _password.text),
              ],
            ),
          ],
        ),
        TeamFormSection(
          icon: Icons.shield_rounded,
          color: TeamColors.violet,
          title: 'Roles',
          subtitle: _roleIds.isEmpty
              ? 'Assign at least one'
              : '${_roleIds.length} selected',
          children: [
            if (roles.isEmpty)
              Text(
                "No roles available to assign. You may not have access to "
                'the roles list.',
                style: AppText.body(size: 13, color: AppColors.inkFaint),
              ),
            for (final r in roles)
              TeamChoiceCard(
                title: displayRoleName(r.name),
                description: roleBlurb(r),
                icon: iamRoleIcon(r.name),
                color: iamRoleColor(r.name),
                multi: true,
                badge: r.isSystem ? 'System' : 'Custom',
                selected: _roleIds.contains(r.id),
                onTap: () => setState(() {
                  if (!_roleIds.add(r.id)) _roleIds.remove(r.id);
                }),
              ),
          ],
        ),
        TeamFormSection(
          icon: Icons.account_tree_rounded,
          color: TeamColors.amber,
          title: 'Branch access',
          children: [
            TeamToggleRow(
              title: 'All branches',
              subtitle: 'Access to every branch, including future ones',
              icon: Icons.all_inclusive_rounded,
              color: TeamColors.amber,
              value: _allBranches,
              onChanged: (v) => setState(() => _allBranches = v),
            ),
            if (!_allBranches)
              StaffBranchPicker(
                options: branches,
                branchIds: _branchIds,
                primaryId: _primary,
                onChanged: (ids, primary) => setState(() {
                  _branchIds = ids;
                  _primary = primary;
                }),
              ),
          ],
        ),
        TeamFormSection(
          icon: Icons.checklist_rounded,
          color: TeamColors.green,
          title: 'Ready to create',
          subtitle: '$done of ${checks.length} done',
          children: [
            Column(
              children: [
                for (final c in checks) TeamCheckRow(label: c.$1, ok: c.$2),
              ],
            ),
          ],
        ),
      ],
    );
  }
}
