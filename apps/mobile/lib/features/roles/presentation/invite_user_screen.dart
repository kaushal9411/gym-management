import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/invitation_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// `POST /invitations` — emails a tokenized accept link (valid 48 hours); the
/// invitee sets their own name and password on the accept page. Distinct from
/// [UserFormScreen], which creates the account directly. One role per invite;
/// optionally limit it to specific branches.
class InviteUserScreen extends StatefulWidget {
  const InviteUserScreen({required this.roles, super.key});

  final List<TenantRole> roles;

  @override
  State<InviteUserScreen> createState() => _InviteUserScreenState();
}

class _InviteUserScreenState extends State<InviteUserScreen> {
  /// `SUPER_ADMIN` can't be assigned by invitation (the endpoint rejects it);
  /// inactive roles are hidden.
  List<TenantRole> get _assignableRoles =>
      widget.roles.where((r) => r.name != 'SUPER_ADMIN' && r.isActive).toList();

  final _email = TextEditingController();
  String? _roleId;
  List<BranchOption>? _branches;
  final Set<String> _branchIds = {};
  bool _saving = false;
  String? _error;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _email.addListener(() {
      if (mounted) setState(() {});
    });
    _loadBranches();
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
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    if (!RegExp(r'^\S+@\S+\.\S+$').hasMatch(email)) {
      setState(() => _error = 'Enter a valid email address');
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
        branchIds: _branchIds.isEmpty ? null : _branchIds.toList(),
      );
      if (!mounted) return;
      teamSnack(context, 'Invitation sent to $email.');
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not send the invitation ($e)');
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
          title: const Text('Invite'),
        ),
        body: _loadError != null
            ? AppErrorView(message: _loadError!, onRetry: _loadBranches)
            : const AppLoadingView(),
      );
    }
    final roles = _assignableRoles;
    return TeamEditScaffold(
      name: _email.text.trim().isEmpty ? 'Invite someone' : _email.text.trim(),
      subtitle: 'They get an email link, valid for 48 hours',
      title: 'Invite by email',
      icon: Icons.forward_to_inbox_rounded,
      color: TeamColors.fuchsia,
      saving: _saving,
      onSave: _submit,
      saveLabel: 'Send invitation',
      error: _error,
      sections: [
        TeamFormSection(
          icon: Icons.mail_rounded,
          color: TeamColors.sky,
          title: 'Who to invite',
          children: [
            AppLabeledField(
              label: 'Email',
              hintText: 'staff@gym.com',
              icon: Icons.mail_rounded,
              iconColor: TeamColors.sky,
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.done,
            ),
          ],
        ),
        TeamFormSection(
          icon: Icons.shield_rounded,
          color: TeamColors.violet,
          title: 'Role',
          subtitle: 'Pick one',
          children: [
            if (roles.isEmpty)
              Text(
                'No roles available to assign. You may not have access to '
                'the roles list.',
                style: AppText.body(size: 13, color: AppColors.inkFaint),
              ),
            for (final r in roles)
              TeamChoiceCard(
                title: displayRoleName(r.name),
                description: roleBlurb(r),
                icon: iamRoleIcon(r.name),
                color: iamRoleColor(r.name),
                badge: r.isSystem ? 'System' : 'Custom',
                selected: _roleId == r.id,
                onTap: () => setState(() => _roleId = r.id),
              ),
          ],
        ),
        TeamFormSection(
          icon: Icons.account_tree_rounded,
          color: TeamColors.amber,
          title: 'Branches (optional)',
          subtitle: 'Leave empty for the default branch access',
          children: [
            if (branches.isEmpty)
              Text(
                'No branches found.',
                style: AppText.body(size: 13, color: AppColors.inkFaint),
              )
            else
              TeamChipGroup(
                label: 'Limit to',
                icon: Icons.place_rounded,
                color: TeamColors.amber,
                options: [for (final b in branches) (b.id, b.name)],
                selected: _branchIds,
                onToggle: (id) => setState(() {
                  if (!_branchIds.add(id)) _branchIds.remove(id);
                }),
              ),
          ],
        ),
      ],
    );
  }
}
