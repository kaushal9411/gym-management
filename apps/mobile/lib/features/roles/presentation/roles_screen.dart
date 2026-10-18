import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/tenant_role_repository.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'invitations_tab.dart';
import '../../../shared/widgets/list_hero.dart';
import 'permission_matrix_tab.dart';
import 'permissions_registry_tab.dart';
import 'roles_tab.dart';
import 'users_tab.dart';

enum _IamTab { users, roles, matrix, permissions, invitations }

extension on _IamTab {
  String get label => switch (this) {
        _IamTab.users => 'Users',
        _IamTab.roles => 'Roles',
        _IamTab.matrix => 'Matrix',
        _IamTab.permissions => 'Permissions',
        _IamTab.invitations => 'Invites',
      };

  IconData get icon => switch (this) {
        _IamTab.users => Icons.people_alt_rounded,
        _IamTab.roles => Icons.shield_rounded,
        _IamTab.matrix => Icons.grid_view_rounded,
        _IamTab.permissions => Icons.key_rounded,
        _IamTab.invitations => Icons.forward_to_inbox_rounded,
      };

  /// The permission web's nav / API needs for this view.
  String get permission => switch (this) {
        _IamTab.users => 'users:read',
        _IamTab.roles => 'roles:read',
        _IamTab.matrix => 'permissions:read',
        _IamTab.permissions => 'permissions:read',
        _IamTab.invitations => 'users:invite',
      };
}

/// "Team & Access" hub — web's `IamNav` group (Users / Roles / Permissions
/// registry + matrix / Invitations) as one tabbed screen under an animated
/// gradient header. Each tab is only offered when the viewer holds the
/// permission web's page needs, tabs are built lazily and kept alive so filters
/// and scroll positions survive switching, and the HR **Staff directory**
/// (`/staff`) is reachable from the Users tab for anyone with `staff:view`
/// (Owners have no Team tab in their shell).
class RolesScreen extends StatefulWidget {
  const RolesScreen({super.key});

  @override
  State<RolesScreen> createState() => _RolesScreenState();
}

class _RolesScreenState extends State<RolesScreen> {
  final _usersKey = GlobalKey<UsersTabState>();
  final _invitesKey = GlobalKey<InvitationsTabState>();

  List<TenantRole>? _roles;
  String? _rolesError;
  _IamTab? _tab;
  final Set<_IamTab> _visited = {};

  @override
  void initState() {
    super.initState();
    _loadRoles();
  }

  Future<void> _loadRoles() async {
    if (!teamCan(context, 'roles:read')) {
      setState(() => _roles = const []);
      return;
    }
    setState(() => _rolesError = null);
    try {
      final roles = await getIt<TenantRoleRepository>().list();
      if (!mounted) return;
      setState(() => _roles = roles);
    } on ApiException catch (e) {
      if (mounted) setState(() => _rolesError = e.message);
    } catch (e) {
      if (mounted) setState(() => _rolesError = '$e');
    }
  }

  List<_IamTab> _visible() =>
      _IamTab.values.where((t) => teamCan(context, t.permission)).toList();

  Future<void> _newUser() async {
    await context.push(
      AppRoutes.userForm,
      extra: _roles ?? const <TenantRole>[],
    );
    await _usersKey.currentState?.reload();
    _loadRoles();
  }

  Future<void> _invite() async {
    await context.push(
      AppRoutes.inviteUser,
      extra: _roles ?? const <TenantRole>[],
    );
    _invitesKey.currentState?.reload();
    await _usersKey.currentState?.reload();
  }

  Future<void> _newRole() async {
    await context.push(AppRoutes.roleForm);
    await _loadRoles();
  }

  Future<void> _onAdd(_IamTab tab) async {
    switch (tab) {
      case _IamTab.users:
        final canNew = teamCan(context, 'users:manage');
        final canInvite = teamCan(context, 'users:invite');
        if (canNew && canInvite) {
          final pick = await showTeamSheet<String>(
            context,
            (ctx) => TeamSheetScaffold(
              icon: Icons.person_add_alt_1_rounded,
              title: 'Add someone',
              color: TeamColors.indigo,
              child: Column(
                children: [
                  TeamActionTile(
                    icon: Icons.person_add_rounded,
                    label: 'New user',
                    hint: 'Create the account now and set a password '
                        'yourself',
                    color: TeamColors.indigo,
                    onTap: () => Navigator.of(ctx).pop('new'),
                  ),
                  TeamActionTile(
                    icon: Icons.forward_to_inbox_rounded,
                    label: 'Invite by email',
                    hint: 'They set their own password from an email link',
                    color: TeamColors.fuchsia,
                    onTap: () => Navigator.of(ctx).pop('invite'),
                  ),
                ],
              ),
            ),
          );
          if (pick == 'new') await _newUser();
          if (pick == 'invite') await _invite();
        } else if (canNew) {
          await _newUser();
        } else if (canInvite) {
          await _invite();
        }
      case _IamTab.roles:
        await _newRole();
      case _IamTab.invitations:
        await _invite();
      case _IamTab.matrix:
      case _IamTab.permissions:
        return;
    }
  }

  bool _canAdd(_IamTab tab) => switch (tab) {
        _IamTab.users =>
          teamCan(context, 'users:manage') || teamCan(context, 'users:invite'),
        _IamTab.roles => teamCan(context, 'roles:manage-custom'),
        _IamTab.invitations => teamCan(context, 'users:invite'),
        _ => false,
      };

  @override
  Widget build(BuildContext context) {
    final tabs = _visible();
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    if (tabs.isEmpty) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: const Text('Team & Access'),
        ),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(28),
            child: Text("You don't have access to any Team & Access views."),
          ),
        ),
      );
    }
    final tab = (_tab != null && tabs.contains(_tab)) ? _tab! : tabs.first;
    _visited.add(tab);

    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Team & Access'),
        actions: [
          if (_canAdd(tab))
            Padding(
              padding: const EdgeInsets.only(right: 10),
              child: GestureDetector(
                onTap: () => _onAdd(tab),
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.4),
                    ),
                  ),
                  child: const Icon(
                    Icons.add_rounded,
                    color: Colors.white,
                    size: 22,
                  ),
                ),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          MeshHeroBackground(
            radius: const BorderRadius.vertical(bottom: Radius.circular(30)),
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                18 + teamSideInset(context),
                top + 2,
                18 + teamSideInset(context),
                18,
              ),
              child: SizedBox(
                width: double.infinity,
                height: kListHeroBelowAppBar,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    FadeUp(
                      index: 0,
                      child: Text(
                        'Staff & access',
                        style: AppText.display(size: 25, color: Colors.white),
                      ),
                    ),
                    const SizedBox(height: 2),
                    FadeUp(
                      index: 1,
                      child: Text(
                        'Manage your team, their roles, and what they can do.',
                        style: AppText.body(
                          size: 12.5,
                          weight: FontWeight.w600,
                          color: Colors.white.withValues(alpha: 0.88),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          for (final t in tabs) ...[
                            GestureDetector(
                              onTap: () => setState(() => _tab = t),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: t == tab
                                      ? Colors.white
                                      : Colors.white.withValues(alpha: 0.16),
                                  borderRadius: BorderRadius.circular(99),
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.35),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      t.icon,
                                      size: 15,
                                      color: t == tab
                                          ? const Color(0xFF6D28D9)
                                          : Colors.white,
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      t.label,
                                      style: AppText.body(
                                        size: 12.5,
                                        weight: FontWeight.w800,
                                        color: t == tab
                                            ? const Color(0xFF6D28D9)
                                            : Colors.white,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Expanded(
            child: IndexedStack(
              index: tabs.indexOf(tab),
              children: [
                for (final t in tabs)
                  _visited.contains(t) ? _tabBody(t) : const SizedBox.shrink(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _tabBody(_IamTab t) {
    switch (t) {
      case _IamTab.users:
        return UsersTab(
          key: _usersKey,
          roles: _roles ?? const [],
          onOpenInvites: teamCan(context, 'users:invite')
              ? () => setState(() => _tab = _IamTab.invitations)
              : null,
          onOpenStaff: teamCan(context, 'staff:view')
              ? () => context.push(AppRoutes.staffRoster)
              : null,
        );
      case _IamTab.roles:
        return RolesTab(
          roles: _roles,
          error: _rolesError,
          onReload: _loadRoles,
        );
      case _IamTab.matrix:
        return const PermissionMatrixTab();
      case _IamTab.permissions:
        return const PermissionsRegistryTab();
      case _IamTab.invitations:
        return InvitationsTab(key: _invitesKey);
    }
  }
}
