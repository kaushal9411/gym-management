import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/tenant_role_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Web's `/roles`: four summary tiles and a card per role — permission
/// coverage bar, people assigned, and Clone / Edit / Delete (`roles:manage-custom`,
/// custom roles only for edit and delete — system roles are shared and
/// immutable, clone one to customise it).
class RolesTab extends StatefulWidget {
  const RolesTab({
    super.key,
    required this.roles,
    required this.error,
    required this.onReload,
  });

  /// Loaded by the hub (null while loading).
  final List<TenantRole>? roles;
  final String? error;
  final Future<void> Function() onReload;

  @override
  State<RolesTab> createState() => _RolesTabState();
}

class _RolesTabState extends State<RolesTab> {
  int? _registryTotal;
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _loadRegistryTotal();
  }

  Future<void> _loadRegistryTotal() async {
    if (!teamCan(context, 'permissions:read')) return;
    try {
      final groups = await getIt<TenantRoleRepository>().listPermissions();
      if (!mounted) return;
      setState(
        () => _registryTotal =
            groups.fold<int>(0, (a, g) => a + g.permissions.length),
      );
    } catch (_) {
      // Falls back to the largest role's size below.
    }
  }

  Future<void> _clone(TenantRole r) async {
    setState(() => _busyId = r.id);
    try {
      final created = await getIt<TenantRoleRepository>().clone(r.id);
      if (!mounted) return;
      teamSnack(context, 'Cloned as "${created.name}"');
      await widget.onReload();
    } catch (e) {
      if (mounted) {
        teamSnack(
          context,
          e is ApiException ? e.detailedMessage : '$e',
          error: true,
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _delete(TenantRole r) async {
    final ok = await confirmTeam(
      context,
      title: 'Delete ${displayRoleName(r.name)}?',
      message: r.userCount > 0
          ? 'This role is assigned to ${r.userCount} '
              'person${r.userCount == 1 ? '' : 's'} — the server will refuse '
              'until they are moved to another role.'
          : 'This permanently deletes the custom role.',
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _busyId = r.id);
    try {
      await getIt<TenantRoleRepository>().delete(r.id);
      if (!mounted) return;
      teamSnack(context, 'Role deleted');
      await widget.onReload();
    } catch (e) {
      if (mounted) {
        teamSnack(
          context,
          e is ApiException ? e.detailedMessage : '$e',
          error: true,
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final roles = widget.roles;
    if (roles == null) {
      return widget.error != null
          ? AppErrorView(message: widget.error!, onRetry: widget.onReload)
          : const AppLoadingView();
    }
    final canManage = teamCan(context, 'roles:manage-custom');
    final total = _registryTotal ??
        roles.fold<int>(
          1,
          (a, r) => r.permissions.length > a ? r.permissions.length : a,
        );
    final tiles = [
      TeamKpi(
        label: 'Roles',
        value: roles.length,
        color: TeamColors.indigo,
        icon: Icons.shield_rounded,
      ),
      TeamKpi(
        label: 'System roles',
        value: roles.where((r) => r.isSystem).length,
        color: TeamColors.violet,
        icon: Icons.lock_rounded,
      ),
      TeamKpi(
        label: 'Custom roles',
        value: roles.where((r) => !r.isSystem).length,
        color: TeamColors.amber,
        icon: Icons.tune_rounded,
      ),
      TeamKpi(
        label: 'People assigned',
        value: roles.fold(0, (a, r) => a + r.userCount),
        color: TeamColors.teal,
        icon: Icons.groups_rounded,
      ),
    ];

    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: widget.onReload,
      child: ListView(
        padding: EdgeInsets.fromLTRB(
          18 + teamSideInset(context),
          0,
          18 + teamSideInset(context),
          24,
        ),
        children: [
          TeamKpiGrid(tiles: tiles, loading: false),
          const SizedBox(height: 14),
          if (roles.isEmpty)
            const AppEmptyState(
              icon: Icons.shield_outlined,
              title: 'No roles yet',
              message: 'Create a custom role to get started.',
            ),
          TeamAdaptive(
            rowSpacing: 0,
            children: [
              for (var i = 0; i < roles.length; i++)
                _card(roles[i], i, total, canManage),
            ],
          ),
        ],
      ),
    );
  }

  Widget _card(TenantRole r, int i, int total, bool canManage) {
    final color = iamRoleColor(r.name);
    final editable = canManage && !r.isSystem;
    final busy = _busyId == r.id;
    final pct =
        total == 0 ? 0.0 : (r.permissions.length / total).clamp(0.0, 1.0);

    return FadeUp(
      index: i.clamp(0, 8),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => context
                .push(AppRoutes.roleDetail, extra: r.id)
                .then((_) => widget.onReload()),
            child: Stack(
              children: [
                Positioned(
                  right: -30,
                  top: -30,
                  child: Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          color.withValues(alpha: 0.28),
                          color.withValues(alpha: 0),
                        ],
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 46,
                            height: 46,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  color,
                                  Color.lerp(color, TeamColors.fuchsia, 0.5)!,
                                ],
                              ),
                              borderRadius: BorderRadius.circular(15),
                              boxShadow: [
                                BoxShadow(
                                  color: color.withValues(alpha: 0.4),
                                  blurRadius: 12,
                                  offset: const Offset(0, 5),
                                ),
                              ],
                            ),
                            child: Icon(
                              iamRoleIcon(r.name),
                              color: Colors.white,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  displayRoleName(r.name),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppText.display(size: 17),
                                ),
                                const SizedBox(height: 4),
                                Wrap(
                                  spacing: 5,
                                  runSpacing: 4,
                                  children: [
                                    TeamTag(
                                      label: r.isSystem ? 'System' : 'Custom',
                                      color: r.isSystem
                                          ? TeamColors.indigo
                                          : TeamColors.violet,
                                    ),
                                    if (r.isDefault)
                                      const TeamTag(
                                        label: 'Default',
                                        color: TeamColors.green,
                                      ),
                                    if (!r.isActive)
                                      const TeamTag(
                                        label: 'Inactive',
                                        color: TeamColors.rose,
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          Icon(
                            Icons.chevron_right_rounded,
                            color: AppColors.inkFaint,
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        roleBlurb(r),
                        style: AppText.body(
                          size: 12.5,
                          color: AppColors.inkSoft,
                          weight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Text(
                            'Permissions',
                            style: AppText.body(
                              size: 11.5,
                              color: AppColors.inkFaint,
                              weight: FontWeight.w700,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            '${r.permissions.length} of $total',
                            style: AppText.body(
                              size: 11.5,
                              weight: FontWeight.w800,
                              color: color,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      GrowBar(
                        ratio: pct,
                        height: 8,
                        track: AppColors.surface3,
                        colors: [color, color.withValues(alpha: 0.5)],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: _Stat(
                              value: r.userCount,
                              label: 'People',
                              color: color,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _Stat(
                              value: (pct * 100).round(),
                              suffix: '%',
                              label: 'Access',
                              color: color,
                            ),
                          ),
                        ],
                      ),
                      if (canManage) ...[
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: _RoleButton(
                                label: 'Clone',
                                icon: Icons.copy_rounded,
                                color: TeamColors.indigo,
                                busy: busy,
                                onTap: () => _clone(r),
                              ),
                            ),
                            if (editable) ...[
                              const SizedBox(width: 8),
                              Expanded(
                                child: _RoleButton(
                                  label: 'Edit',
                                  icon: Icons.edit_rounded,
                                  color: TeamColors.violet,
                                  busy: busy,
                                  onTap: () => context
                                      .push(AppRoutes.roleForm, extra: r)
                                      .then((_) => widget.onReload()),
                                ),
                              ),
                              const SizedBox(width: 8),
                              _RoleButton(
                                label: '',
                                icon: Icons.delete_outline_rounded,
                                color: TeamColors.rose,
                                busy: busy,
                                onTap: () => _delete(r),
                              ),
                            ] else
                              Expanded(
                                child: Center(
                                  child: Text(
                                    'Read only',
                                    style: AppText.body(
                                      size: 11.5,
                                      color: AppColors.inkFaint,
                                      weight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({
    required this.value,
    required this.label,
    required this.color,
    this.suffix = '',
  });

  final int value;
  final String suffix;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CountUp(
            value: value,
            suffix: suffix,
            style: AppText.display(size: 18),
          ),
          Text(
            label,
            style: AppText.body(
              size: 11,
              color: AppColors.inkFaint,
              weight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _RoleButton extends StatelessWidget {
  const _RoleButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.busy,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color color;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: busy ? null : onTap,
      child: Opacity(
        opacity: busy ? 0.5 : 1,
        child: Container(
          padding: EdgeInsets.symmetric(
            vertical: 9,
            horizontal: label.isEmpty ? 12 : 0,
          ),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: label.isEmpty ? MainAxisSize.min : MainAxisSize.max,
            children: [
              Icon(icon, size: 15, color: color),
              if (label.isNotEmpty) ...[
                const SizedBox(width: 6),
                Text(
                  label,
                  style: AppText.body(
                    size: 12.5,
                    weight: FontWeight.w800,
                    color: color,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
