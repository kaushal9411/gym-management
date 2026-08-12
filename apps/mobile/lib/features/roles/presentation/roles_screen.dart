import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/tenant_role_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

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

enum _RolesTab { matrix, roles }

/// Design frame "13. Roles & permissions" — the Matrix/Roles toggle, with
/// the matrix (Resource × role, ✓ / view / —) computed from each role's
/// real permission keys. Still view-only: creating or editing custom roles
/// has no mobile-facing endpoint in this pass.
class RolesScreen extends StatefulWidget {
  const RolesScreen({super.key});

  @override
  State<RolesScreen> createState() => _RolesScreenState();
}

class _RolesScreenState extends State<RolesScreen> {
  List<TenantRole>? _roles;
  String? _error;
  _RolesTab _tab = _RolesTab.matrix;

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Roles & Permissions', style: AppText.display(size: 18)),
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
                        child: Row(
                          children: _RolesTab.values.map((tab) {
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
                                    gradient:
                                        selected ? AppColors.staffGrad : null,
                                    color: selected
                                        ? null
                                        : AppColors.surface3,
                                    borderRadius:
                                        BorderRadius.circular(AppRadii.pill),
                                  ),
                                  child: Text(
                                    tab == _RolesTab.matrix
                                        ? 'Matrix'
                                        : 'Roles',
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
                      Expanded(
                        child: _tab == _RolesTab.matrix
                            ? _PermissionMatrix(roles: _roles!)
                            : ListView.builder(
                                padding:
                                    const EdgeInsets.fromLTRB(18, 0, 18, 24),
                                itemCount: _roles!.length,
                                itemBuilder: (context, i) =>
                                    _RoleCard(role: _roles![i]),
                              ),
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
                  Expanded(flex: 3, child: Text('Resource', style: AppText.eyebrow())),
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
