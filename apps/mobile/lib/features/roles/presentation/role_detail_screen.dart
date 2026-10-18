import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/permission_group.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/tenant_role_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Role profile (`GET /roles/:id`): animated gradient header with a coverage
/// ring, summary tiles and the role's permissions grouped by resource as
/// expandable ✓/✗ checklists against the full registry (when the viewer can
/// read it). Custom roles can be edited or deleted and any role cloned
/// (`roles:manage-custom`); system roles are shared and immutable.
class RoleDetailScreen extends StatefulWidget {
  const RoleDetailScreen({super.key, required this.roleId});

  final String roleId;

  @override
  State<RoleDetailScreen> createState() => _RoleDetailScreenState();
}

class _RoleDetailScreenState extends State<RoleDetailScreen> {
  TenantRole? _role;
  List<PermissionGroup>? _registry;
  String? _error;
  bool _busy = false;
  final Set<String> _open = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final repo = getIt<TenantRoleRepository>();
      final role = await repo.getById(widget.roleId);
      if (!mounted) return;
      setState(() => _role = role);
      if (_registry == null && teamCan(context, 'permissions:read')) {
        try {
          final groups = await repo.listPermissions();
          if (mounted) setState(() => _registry = groups);
        } catch (_) {
          // The checklist just falls back to granted-only.
        }
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load this role ($e)');
    }
  }

  Future<void> _clone() async {
    setState(() => _busy = true);
    try {
      final created = await getIt<TenantRoleRepository>().clone(widget.roleId);
      if (!mounted) return;
      teamSnack(context, 'Cloned as "${created.name}"');
      context.pushReplacement(AppRoutes.roleDetail, extra: created.id);
    } catch (e) {
      if (mounted) {
        teamSnack(
          context,
          e is ApiException ? e.detailedMessage : '$e',
          error: true,
        );
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _delete() async {
    final r = _role!;
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
    setState(() => _busy = true);
    try {
      await getIt<TenantRoleRepository>().delete(r.id);
      if (!mounted) return;
      teamSnack(context, 'Role deleted');
      context.pop();
    } catch (e) {
      if (mounted) {
        teamSnack(
          context,
          e is ApiException ? e.detailedMessage : '$e',
          error: true,
        );
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = _role;
    final hero = role != null && _error == null;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: hero,
      appBar: AppBar(
        backgroundColor: hero ? Colors.transparent : AppColors.bg,
        foregroundColor: hero ? Colors.white : null,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(hero ? 'Role' : 'Role'),
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : role == null
                ? const AppLoadingView()
                : _content(role),
      ),
    );
  }

  Widget _content(TenantRole role) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final color = iamRoleColor(role.name);
    final registry = _registry;
    final total = registry?.fold<int>(0, (a, g) => a + g.permissions.length) ??
        role.permissions.length;
    final grouped = role.permissionsByResource;
    final canManage = teamCan(context, 'roles:manage-custom');
    final resources = registry != null
        ? [for (final g in registry) g.resource]
        : (grouped.keys.toList()..sort());
    final pct =
        total == 0 ? 0.0 : (role.permissions.length / total).clamp(0.0, 1.0);

    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          MeshHeroBackground(
            radius: const BorderRadius.vertical(bottom: Radius.circular(34)),
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                18 + teamSideInset(context),
                top + 4,
                18 + teamSideInset(context),
                22,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        FadeUp(
                          index: 0,
                          child: Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.4),
                              ),
                            ),
                            child: Icon(
                              iamRoleIcon(role.name),
                              color: Colors.white,
                              size: 24,
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        FadeUp(
                          index: 1,
                          child: Text(
                            displayRoleName(role.name),
                            style:
                                AppText.display(size: 26, color: Colors.white),
                          ),
                        ),
                        const SizedBox(height: 4),
                        FadeUp(
                          index: 2,
                          child: Text(
                            roleBlurb(role),
                            style: AppText.body(
                              size: 12.5,
                              weight: FontWeight.w600,
                              color: Colors.white.withValues(alpha: 0.9),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        FadeUp(
                          index: 3,
                          child: Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              TeamHeroPill(
                                role.isSystem ? 'System role' : 'Custom role',
                                icon: role.isSystem
                                    ? Icons.lock_rounded
                                    : Icons.tune_rounded,
                              ),
                              TeamHeroPill(
                                role.isActive ? 'Active' : 'Inactive',
                                dot: role.isActive
                                    ? const Color(0xFF6EE7B7)
                                    : const Color(0xFFFDA4AF),
                              ),
                              if (role.isDefault)
                                const TeamHeroPill(
                                  'Default for new users',
                                  icon: Icons.star_rounded,
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Floating(
                    child: AnimatedRing(
                      value: pct,
                      size: 96,
                      stroke: 11,
                      colors: const [
                        Color(0xFFFDE68A),
                        Color(0xFFF9A8D4),
                        Color(0xFF6EE7B7),
                      ],
                      track: Colors.white.withValues(alpha: 0.2),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CountUp(
                            value: (pct * 100).round(),
                            suffix: '%',
                            style:
                                AppText.display(size: 20, color: Colors.white),
                          ),
                          Text(
                            'access',
                            style: AppText.body(
                              size: 10,
                              weight: FontWeight.w700,
                              color: Colors.white.withValues(alpha: 0.85),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              16 + teamSideInset(context),
              14,
              16 + teamSideInset(context),
              0,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TeamSummaryGrid(
                  tiles: [
                    TeamSummaryTile(
                      index: 0,
                      icon: Icons.groups_rounded,
                      color: TeamColors.teal,
                      label: 'People',
                      number: role.userCount,
                      hint: 'assigned to this role',
                    ),
                    TeamSummaryTile(
                      index: 1,
                      icon: Icons.key_rounded,
                      color: color,
                      label: 'Permissions',
                      number: role.permissions.length,
                      hint: 'of $total in the registry',
                    ),
                    TeamSummaryTile(
                      index: 2,
                      icon: Icons.category_rounded,
                      color: TeamColors.indigo,
                      label: 'Resources',
                      number: grouped.length,
                      hint: 'areas it can touch',
                    ),
                    TeamSummaryTile(
                      index: 3,
                      icon: Icons.low_priority_rounded,
                      color: TeamColors.amber,
                      label: 'Priority',
                      number: role.priority,
                      hint: role.isDefault ? 'default role' : 'higher wins',
                    ),
                  ],
                ),
                if (canManage) ...[
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: TeamOutlineButton(
                          label: 'Clone',
                          icon: Icons.copy_rounded,
                          onTap: _busy ? null : _clone,
                        ),
                      ),
                      if (!role.isSystem) ...[
                        const SizedBox(width: 10),
                        Expanded(
                          child: TeamGradientButton(
                            label: 'Edit role',
                            icon: Icons.edit_rounded,
                            loading: _busy,
                            onTap: () => context
                                .push(AppRoutes.roleForm, extra: role)
                                .then((_) => _load()),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
                const SizedBox(height: 18),
                Text('PERMISSIONS BY RESOURCE', style: AppText.eyebrow()),
                const SizedBox(height: 8),
                if (role.permissions.isEmpty)
                  const AppEmptyState(
                    icon: Icons.key_off_rounded,
                    title: 'No permissions',
                    message: 'This role does not grant anything yet.',
                  ),
                for (var i = 0; i < resources.length; i++)
                  if ((grouped[resources[i]] ?? const []).isNotEmpty)
                    _resourceCard(
                      i,
                      resources[i],
                      grouped[resources[i]]!,
                      registry
                          ?.firstWhere((g) => g.resource == resources[i])
                          .permissions,
                      TeamColors.rotation[i % TeamColors.rotation.length],
                    ),
                if (canManage && !role.isSystem) ...[
                  const SizedBox(height: 18),
                  TeamSectionCard(
                    icon: Icons.warning_amber_rounded,
                    color: TeamColors.rose,
                    title: 'Danger zone',
                    subtitle: 'Roles in use by people cannot be deleted',
                    child: TeamActionTile(
                      icon: Icons.delete_outline_rounded,
                      label: 'Delete role',
                      hint: 'Permanently removes this custom role',
                      color: TeamColors.rose,
                      busy: _busy,
                      onTap: _delete,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _resourceCard(
    int index,
    String resource,
    List<String> granted,
    List<PermissionItem>? all,
    Color color,
  ) {
    final open = _open.contains(resource);
    final totalHere = all?.length ?? granted.length;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: FadeUp(
        index: index.clamp(0, 8),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: color.withValues(alpha: 0.25)),
          ),
          clipBehavior: Clip.antiAlias,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: all == null
                  ? null
                  : () => setState(() {
                        if (!_open.add(resource)) _open.remove(resource);
                      }),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            resource.replaceAll('-', ' '),
                            style: AppText.body(
                              size: 13.5,
                              weight: FontWeight.w800,
                            ),
                          ),
                        ),
                        Text(
                          '${granted.length} / $totalHere',
                          style: AppText.body(
                            size: 12,
                            weight: FontWeight.w800,
                            color: color,
                          ),
                        ),
                        if (all != null)
                          Icon(
                            open
                                ? Icons.expand_less_rounded
                                : Icons.expand_more_rounded,
                            color: AppColors.inkFaint,
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    GrowBar(
                      ratio: totalHere == 0 ? 0 : granted.length / totalHere,
                      height: 6,
                      track: AppColors.surface3,
                      colors: [color, color.withValues(alpha: 0.55)],
                    ),
                    const SizedBox(height: 10),
                    if (open && all != null)
                      for (final p in all)
                        TeamCheckRow(
                          label: p.key,
                          ok: granted.contains(p.key),
                          color: color,
                          detail: null,
                        )
                    else
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          for (final k in granted)
                            TeamTag(label: k.split(':').last, color: color),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
