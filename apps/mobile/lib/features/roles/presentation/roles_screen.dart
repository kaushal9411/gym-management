import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/iam_user.dart';
import '../../../models/invitation.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/iam_user_repository.dart';
import '../../../repositories/invitation_repository.dart';
import '../../../repositories/tenant_role_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'permissions_registry_tab.dart';

/// The design's matrix rows. Each maps to the `resource` half of the
/// `resource:action` permission keys `GET /roles` returns, so a role's
/// access level is derived from real grants rather than hard-coded.
const _matrixRows = <String, List<String>>{
  'Members': ['members', 'memberships'],
  'Finance': ['payments', 'invoices', 'expenses', 'income', 'finance'],
  'Classes': ['classes', 'bookings'],
  'Reports': ['reports', 'analytics'],
  'Settings': ['settings', 'branches', 'roles', 'staff'],
};

/// Columns, in the design's order (Own / Mgr / Trn / Rcp).
const _matrixRoles = ['OWNER', 'MANAGER', 'TRAINER', 'RECEPTIONIST'];
const _matrixHeaders = ['Own', 'Mgr', 'Trn', 'Rcp'];

/// Read-only actions — a role holding only these shows as "view", matching
/// the design's third cell state.
const _readActions = {'view', 'read'};

const _userStatusTones = {
  'ACTIVE': AppPillTone.success,
  'PENDING_VERIFICATION': AppPillTone.warning,
  'LOCKED': AppPillTone.danger,
  'SUSPENDED': AppPillTone.danger,
  'DEACTIVATED': AppPillTone.neutral,
};

const _invitationStatusTones = {
  'PENDING': AppPillTone.warning,
  'ACCEPTED': AppPillTone.success,
  'REVOKED': AppPillTone.neutral,
  'EXPIRED': AppPillTone.danger,
};

enum _IamTab { matrix, roles, permissions, users, invitations }

/// Design frame "13. Roles & permissions", extended to match the web app's
/// `IamNav` grouping (Users/Roles/Permissions/Invitations as one "Staff &
/// access" section) rather than staying a Roles-only screen — mobile had no
/// Users or Invitations surface at all before this. Matrix/Roles are the
/// original frame-13 content; Users/Invitations are new, built in the same
/// visual language since no design frame exists for them.
class RolesScreen extends StatefulWidget {
  const RolesScreen({super.key});

  @override
  State<RolesScreen> createState() => _RolesScreenState();
}

class _RolesScreenState extends State<RolesScreen> {
  List<TenantRole>? _roles;
  String? _error;
  _IamTab _tab = _IamTab.matrix;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final roles = await getIt<TenantRoleRepository>().list();
      if (!mounted) return;
      setState(() => _roles = roles);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _onAddPressed() async {
    switch (_tab) {
      case _IamTab.matrix:
      case _IamTab.roles:
        await context.push(AppRoutes.roleForm);
        _load();
      case _IamTab.permissions:
        return;
      case _IamTab.users:
        await context.push(
          AppRoutes.userForm,
          extra: _roles ?? const <TenantRole>[],
        );
        if (mounted) setState(() {});
      case _IamTab.invitations:
        await context.push(
          AppRoutes.inviteUser,
          extra: _roles ?? const <TenantRole>[],
        );
        if (mounted) setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Staff & Access', style: AppText.display(size: 18)),
        actions: [
          if (_tab != _IamTab.permissions)
            IconButton(
              icon: const Icon(Icons.add_rounded),
              tooltip: 'Add',
              onPressed: _onAddPressed,
            ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : _roles == null
                ? const AppLoadingView()
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(18, 4, 18, 12),
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: _IamTab.values.map((tab) {
                              final selected = tab == _tab;
                              return Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: GestureDetector(
                                  onTap: () => setState(() => _tab = tab),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 7,
                                    ),
                                    decoration: BoxDecoration(
                                      gradient: selected
                                          ? AppColors.staffGrad
                                          : null,
                                      color: selected
                                          ? null
                                          : AppColors.surface3,
                                      borderRadius: BorderRadius.circular(
                                        AppRadii.pill,
                                      ),
                                    ),
                                    child: Text(
                                      switch (tab) {
                                        _IamTab.matrix => 'Matrix',
                                        _IamTab.roles => 'Roles',
                                        _IamTab.permissions => 'Permissions',
                                        _IamTab.users => 'Users',
                                        _IamTab.invitations => 'Invitations',
                                      },
                                      style: AppText.body(
                                        size: 12,
                                        weight: FontWeight.w700,
                                        color: selected
                                            ? Colors.white
                                            : AppColors.inkSoft,
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ),
                      Expanded(
                        child: switch (_tab) {
                          _IamTab.matrix => _PermissionMatrix(roles: _roles!),
                          _IamTab.roles => ListView.builder(
                              padding:
                                  const EdgeInsets.fromLTRB(18, 0, 18, 24),
                              itemCount: _roles!.length,
                              itemBuilder: (context, i) =>
                                  _RoleCard(role: _roles![i]),
                            ),
                          _IamTab.permissions =>
                            const PermissionsRegistryTab(),
                          _IamTab.users => const _UsersTab(),
                          _IamTab.invitations => const _InvitationsTab(),
                        },
                      ),
                    ],
                  ),
      ),
    );
  }
}

/// Design frame "13"'s table: one row per resource group, one column per
/// role, each cell resolved from that role's real permission keys.
class _PermissionMatrix extends StatelessWidget {
  const _PermissionMatrix({required this.roles});

  final List<TenantRole> roles;

  /// '✓' when the role can change the resource, 'view' when it can only
  /// look, '—' when it has no grant at all.
  String _cell(TenantRole? role, List<String> resources) {
    if (role == null) return '—';
    final keys = role.permissions
        .where((p) => resources.contains(p.split(':').first))
        .toList();
    if (keys.isEmpty) return '—';
    final hasWrite =
        keys.any((k) => !_readActions.contains(k.split(':').last));
    return hasWrite ? '✓' : 'view';
  }

  @override
  Widget build(BuildContext context) {
    final byName = {for (final r in roles) r.name: r};

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: Text('Resource', style: AppText.eyebrow()),
                  ),
                  for (final header in _matrixHeaders)
                    Expanded(
                      child: Text(
                        header,
                        textAlign: TextAlign.center,
                        style: AppText.eyebrow(),
                      ),
                    ),
                ],
              ),
              for (final row in _matrixRows.entries)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 7),
                  decoration: const BoxDecoration(
                    border: Border(top: BorderSide(color: AppColors.line)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: Text(
                          row.key,
                          style: AppText.body(
                            size: 12,
                            weight: FontWeight.w700,
                          ),
                        ),
                      ),
                      for (final roleName in _matrixRoles)
                        Expanded(
                          child: Builder(
                            builder: (context) {
                              final value =
                                  _cell(byName[roleName], row.value);
                              return Text(
                                value,
                                textAlign: TextAlign.center,
                                style: AppText.body(
                                  size: value == 'view' ? 10 : 12,
                                  weight: FontWeight.w700,
                                  color: value == '✓'
                                      ? AppColors.success
                                      : AppColors.inkFaint,
                                ),
                              );
                            },
                          ),
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({required this.role});

  final TenantRole role;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: () => context.push(AppRoutes.roleDetail, extra: role.id),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          role.name,
                          style:
                              AppText.body(size: 14, weight: FontWeight.w700),
                        ),
                        const SizedBox(width: 8),
                        AppPill(
                          label: role.isSystem ? 'System' : 'Custom',
                          tone: role.isSystem
                              ? AppPillTone.neutral
                              : AppPillTone.roleTint,
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${role.userCount} user(s) · ${role.permissions.length} permissions',
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.inkFaint,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _UsersTab extends StatefulWidget {
  const _UsersTab();

  @override
  State<_UsersTab> createState() => _UsersTabState();
}

class _UsersTabState extends State<_UsersTab> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  late final _cubit = PaginatedListCubit<IamUser>(
    (page) => getIt<IamUserRepository>().list(
      page: page,
      search: _searchController.text.trim(),
    ),
  )..load();

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _cubit.close();
    super.dispose();
  }

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _cubit.load);
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              style: AppText.body(size: 14, weight: FontWeight.w600),
              decoration: InputDecoration(
                hintText: 'Search users…',
                hintStyle: AppText.body(size: 14, color: AppColors.inkFaint),
                filled: true,
                fillColor: AppColors.surface2,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadii.field),
                  borderSide: const BorderSide(color: AppColors.line),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadii.field),
                  borderSide: const BorderSide(color: AppColors.line),
                ),
              ),
            ),
          ),
          Expanded(
            child: BlocBuilder<PaginatedListCubit<IamUser>,
                PaginatedListState<IamUser>>(
              builder: (context, state) {
                return switch (state) {
                  PaginatedListLoading() => const AppLoadingView(),
                  PaginatedListError(:final message) =>
                    AppErrorView(message: message, onRetry: _cubit.load),
                  PaginatedListLoaded(:final items) when items.isEmpty =>
                    const AppEmptyState(
                      icon: Icons.people_outline,
                      title: 'No users found',
                      message: 'Tap + to create a user directly.',
                    ),
                  PaginatedListLoaded(:final items) => RefreshIndicator(
                      color: AppColors.staffB,
                      backgroundColor: AppColors.surface2,
                      onRefresh: () async => _cubit.load(),
                      child: ListView.builder(
                        padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
                        itemCount: items.length,
                        itemBuilder: (context, i) => _UserCard(
                          user: items[i],
                          onTap: () async {
                            await context.push(
                              AppRoutes.userDetail,
                              extra: items[i].id,
                            );
                            _cubit.load();
                          },
                        ),
                      ),
                    ),
                };
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _UserCard extends StatelessWidget {
  const _UserCard({required this.user, required this.onTap});

  final IamUser user;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: const BoxDecoration(
                  gradient: AppColors.staffGrad,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  user.initials,
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.name,
                      style: AppText.body(size: 14, weight: FontWeight.w700),
                    ),
                    Text(
                      user.roles.map((r) => r.name).join(', '),
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              AppPill(
                label: user.status.replaceAll('_', ' '),
                tone: _userStatusTones[user.status] ?? AppPillTone.neutral,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InvitationsTab extends StatefulWidget {
  const _InvitationsTab();

  @override
  State<_InvitationsTab> createState() => _InvitationsTabState();
}

class _InvitationsTabState extends State<_InvitationsTab> {
  late final _cubit = PaginatedListCubit<Invitation>(
    (page) => getIt<InvitationRepository>().list(page: page),
  )..load();
  String? _busyId;

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  Future<void> _resend(Invitation invitation) async {
    setState(() => _busyId = invitation.id);
    try {
      await getIt<InvitationRepository>().resend(invitation.id);
      if (!mounted) return;
      _cubit.load();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Invitation resent to ${invitation.email}')),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _revoke(Invitation invitation) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AppColors.surface2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.card),
        ),
        title: Text('Revoke invitation?', style: AppText.display(size: 18)),
        content: Text(
          '${invitation.email} will no longer be able to accept this invite.',
          style: AppText.body(size: 13, color: AppColors.inkFaint),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(
              'Keep',
              style: AppText.body(size: 13, weight: FontWeight.w700),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(
              'Revoke',
              style: AppText.body(
                size: 13,
                weight: FontWeight.w700,
                color: AppColors.danger,
              ),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busyId = invitation.id);
    try {
      await getIt<InvitationRepository>().revoke(invitation.id);
      if (!mounted) return;
      _cubit.load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: BlocBuilder<PaginatedListCubit<Invitation>,
          PaginatedListState<Invitation>>(
        builder: (context, state) {
          return switch (state) {
            PaginatedListLoading() => const AppLoadingView(),
            PaginatedListError(:final message) =>
              AppErrorView(message: message, onRetry: _cubit.load),
            PaginatedListLoaded(:final items) when items.isEmpty =>
              const AppEmptyState(
                icon: Icons.mail_outline_rounded,
                title: 'No invitations yet',
                message: 'Tap + to invite someone by email.',
              ),
            PaginatedListLoaded(:final items) => RefreshIndicator(
                color: AppColors.staffB,
                backgroundColor: AppColors.surface2,
                onRefresh: () async => _cubit.load(),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
                  itemCount: items.length,
                  itemBuilder: (context, i) => _InvitationCard(
                    invitation: items[i],
                    busy: _busyId == items[i].id,
                    onResend: () => _resend(items[i]),
                    onRevoke: () => _revoke(items[i]),
                  ),
                ),
              ),
          };
        },
      ),
    );
  }
}

class _InvitationCard extends StatelessWidget {
  const _InvitationCard({
    required this.invitation,
    required this.busy,
    required this.onResend,
    required this.onRevoke,
  });

  final Invitation invitation;
  final bool busy;
  final VoidCallback onResend;
  final VoidCallback onRevoke;

  @override
  Widget build(BuildContext context) {
    final pending = invitation.status == 'PENDING' && !invitation.isExpired;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      invitation.email,
                      style: AppText.body(size: 14, weight: FontWeight.w700),
                    ),
                    Text(
                      '${invitation.roleName} · invited by ${invitation.invitedByName}',
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              AppPill(
                label: invitation.isExpired ? 'EXPIRED' : invitation.status,
                tone: invitation.isExpired
                    ? AppPillTone.danger
                    : _invitationStatusTones[invitation.status] ??
                        AppPillTone.neutral,
              ),
            ],
          ),
          if (pending || invitation.isExpired) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: busy ? null : onResend,
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.line),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    child: Text(
                      'Resend',
                      style:
                          AppText.body(size: 12, weight: FontWeight.w700),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: busy ? null : onRevoke,
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.line),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    child: Text(
                      'Revoke',
                      style: AppText.body(
                        size: 12,
                        weight: FontWeight.w700,
                        color: AppColors.danger,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
