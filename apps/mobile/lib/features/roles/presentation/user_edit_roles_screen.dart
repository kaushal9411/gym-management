import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/iam_user.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/iam_user_repository.dart';
import '../../../repositories/tenant_role_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// `PUT /users/:id/roles` replaces the whole role set — this screen always
/// sends the complete selection, never a delta. `SUPER_ADMIN` is never
/// offered (the endpoint rejects it) and inactive roles are hidden, as on web.
/// People can't change their own roles.
class UserEditRolesScreen extends StatefulWidget {
  const UserEditRolesScreen({required this.user, super.key});

  final IamUser user;

  @override
  State<UserEditRolesScreen> createState() => _UserEditRolesScreenState();
}

class _UserEditRolesScreenState extends State<UserEditRolesScreen> {
  List<TenantRole>? _roles;
  late final Set<String> _selected = widget.user.roles.map((r) => r.id).toSet();
  bool _saving = false;
  String? _error;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final roles = await getIt<TenantRoleRepository>().list();
      if (!mounted) return;
      setState(
        () => _roles =
            roles.where((r) => r.name != 'SUPER_ADMIN' && r.isActive).toList(),
      );
    } on ApiException catch (e) {
      if (mounted) setState(() => _loadError = e.message);
    } catch (e) {
      if (mounted) setState(() => _loadError = '$e');
    }
  }

  bool get _isSelf => teamSelfId(context) == widget.user.id;

  Future<void> _save() async {
    if (_selected.isEmpty) {
      setState(() => _error = 'Assign at least one role');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<IamUserRepository>()
          .setRoles(widget.user.id, _selected.toList());
      if (!mounted) return;
      teamSnack(context, 'Roles updated.');
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not save ($e)');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final roles = _roles;
    if (roles == null) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: const Text('Roles'),
        ),
        body: _loadError != null
            ? AppErrorView(message: _loadError!, onRetry: _load)
            : const AppLoadingView(),
      );
    }
    final self = _isSelf;
    return TeamEditScaffold(
      name: widget.user.name,
      subtitle: widget.user.email,
      avatarUrl: widget.user.avatarUrl,
      title: 'Roles',
      icon: Icons.shield_rounded,
      color: TeamColors.violet,
      saving: _saving,
      onSave: self ? () {} : _save,
      error: _error ?? (self ? "You can't change your own roles." : null),
      sections: [
        TeamFormSection(
          icon: Icons.shield_rounded,
          color: TeamColors.violet,
          title: 'Assigned roles',
          subtitle: '${_selected.length} selected · '
              'their access is the union of these roles',
          children: [
            for (final r in roles)
              TeamChoiceCard(
                title: displayRoleName(r.name),
                description: roleBlurb(r),
                icon: iamRoleIcon(r.name),
                color: iamRoleColor(r.name),
                multi: true,
                badge: r.isSystem ? 'System' : 'Custom',
                selected: _selected.contains(r.id),
                onTap: self
                    ? null
                    : () => setState(() {
                          if (!_selected.add(r.id)) _selected.remove(r.id);
                        }),
              ),
          ],
        ),
      ],
    );
  }
}
