import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/iam_user.dart';
import '../../../models/permission_group.dart' as registry;
import '../../../models/tenant_role.dart';
import '../../../repositories/iam_user_repository.dart';
import '../../../repositories/tenant_role_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

enum _Mode { inherit, grant, deny }

/// `PUT /users/:id/permissions` replaces the whole override set — a per-user
/// GRANT / DENY on top of whatever their roles already grant. "Inherit" (the
/// default) means no override row is sent for that key.
///
/// What each row shows is the *resulting* access: the user's role-derived
/// baseline (the union of their roles' permissions, fetched from
/// `GET /roles`) with the pending overrides applied — so resetting a stored
/// DENY back to Inherit correctly shows the role grant returning. The round
/// tick is a one-tap shortcut (and clears the override when the result would
/// equal the baseline); the segmented control is the explicit
/// Inherit / Grant / Revoke choice.
class UserEditPermissionsScreen extends StatefulWidget {
  const UserEditPermissionsScreen({required this.user, super.key});

  final IamUser user;

  @override
  State<UserEditPermissionsScreen> createState() =>
      _UserEditPermissionsScreenState();
}

class _UserEditPermissionsScreenState extends State<UserEditPermissionsScreen> {
  List<registry.PermissionGroup>? _groups;
  Set<String> _base = {};
  late final Map<String, _Mode> _modes = {
    for (final o in widget.user.permissionOverrides)
      o.key: o.mode == 'GRANT' ? _Mode.grant : _Mode.deny,
  };
  final Set<String> _expanded = {};
  String _query = '';
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
      final repo = getIt<TenantRoleRepository>();
      final results = await Future.wait([repo.listPermissions(), repo.list()]);
      final groups = results[0] as List<registry.PermissionGroup>;
      final roles = results[1] as List<TenantRole>;
      final roleIds = widget.user.roles.map((r) => r.id).toSet();
      final base = <String>{};
      for (final r in roles) {
        if (roleIds.contains(r.id)) base.addAll(r.permissions);
      }
      if (!mounted) return;
      setState(() {
        _groups = groups;
        _base = base;
        for (final g in groups) {
          if (g.permissions.any((p) => _modes.containsKey(p.key))) {
            _expanded.add(g.resource);
          }
        }
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _loadError = e.message);
    } catch (e) {
      if (mounted) setState(() => _loadError = '$e');
    }
  }

  bool _effective(String key) => switch (_modes[key] ?? _Mode.inherit) {
        _Mode.grant => true,
        _Mode.deny => false,
        _Mode.inherit => _base.contains(key),
      };

  void _setMode(String key, _Mode mode) => setState(() {
        if (mode == _Mode.inherit) {
          _modes.remove(key);
        } else {
          _modes[key] = mode;
        }
      });

  void _setWanted(String key, bool want) {
    if (want == _base.contains(key)) {
      _setMode(key, _Mode.inherit);
    } else {
      _setMode(key, want ? _Mode.grant : _Mode.deny);
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final overrides = [
        for (final e in _modes.entries)
          PermissionOverride(
            key: e.key,
            mode: e.value == _Mode.grant ? 'GRANT' : 'DENY',
          ),
      ];
      await getIt<IamUserRepository>()
          .setPermissionOverrides(widget.user.id, overrides);
      if (!mounted) return;
      teamSnack(context, 'Permission overrides updated.');
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
    final groups = _groups;
    final grants = _modes.values.where((m) => m == _Mode.grant).length;
    final revokes = _modes.values.where((m) => m == _Mode.deny).length;
    final total = groups?.fold<int>(0, (a, g) => a + g.permissions.length) ?? 0;
    final effectiveCount = groups == null
        ? 0
        : groups.fold<int>(
            0,
            (a, g) => a + g.permissions.where((p) => _effective(p.key)).length,
          );
    final q = _query.toLowerCase();

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Permission overrides', style: AppText.display(size: 17)),
            Text(widget.user.name, style: AppText.eyebrow()),
          ],
        ),
      ),
      bottomNavigationBar: groups == null
          ? null
          : TeamBottomBar(
              child: TeamGradientButton(
                label: 'Save overrides',
                icon: Icons.check_rounded,
                loading: _saving,
                onTap: _save,
              ),
            ),
      body: groups == null
          ? (_loadError != null
              ? AppErrorView(message: _loadError!, onRetry: _load)
              : const AppLoadingView())
          : ListView(
              padding: EdgeInsets.fromLTRB(
                16 + teamSideInset(context),
                4,
                16 + teamSideInset(context),
                24,
              ),
              children: [
                if (_error != null) ...[
                  FormAlert(message: _error!),
                  const SizedBox(height: 12),
                ],
                FadeUp(
                  index: 0,
                  child: TeamSectionCard(
                    icon: Icons.key_rounded,
                    color: TeamColors.green,
                    title: 'Resulting access',
                    subtitle: 'Roles + grants − revokes. This is exactly what '
                        'the API enforces.',
                    child: Row(
                      children: [
                        AnimatedRing(
                          value: total == 0 ? 0 : effectiveCount / total,
                          size: 76,
                          stroke: 9,
                          colors: const [TeamColors.green, TeamColors.teal],
                          track: TeamColors.green.withValues(alpha: 0.16),
                          child: Text(
                            '$effectiveCount',
                            style: AppText.display(size: 17),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              TeamTag(
                                label: '$grants grant${grants == 1 ? '' : 's'}',
                                color: TeamColors.green,
                                icon: Icons.add_circle_outline_rounded,
                              ),
                              TeamTag(
                                label:
                                    '$revokes revoke${revokes == 1 ? '' : 's'}',
                                color: TeamColors.rose,
                                icon: Icons.remove_circle_outline_rounded,
                              ),
                              TeamTag(
                                label: '$effectiveCount of $total effective',
                                color: TeamColors.indigo,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Everything else inherits from their roles. Use the round '
                  'tick for a one-tap grant / revoke, or the · ✓ ✕ control to '
                  'set Inherit / Grant / Revoke explicitly.',
                  style: AppText.body(
                    size: 11.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                TeamSearchField(
                  hint: 'Search permissions…',
                  onSearch: (v) => setState(() => _query = v),
                ),
                const SizedBox(height: 12),
                for (var gi = 0; gi < groups.length; gi++)
                  _groupCard(groups[gi], gi, q),
              ],
            ),
    );
  }

  Widget _groupCard(registry.PermissionGroup g, int gi, String q) {
    final color = TeamColors.rotation[gi % TeamColors.rotation.length];
    final items = q.isEmpty
        ? g.permissions
        : g.permissions
            .where(
              (p) =>
                  p.key.toLowerCase().contains(q) ||
                  (p.description ?? '').toLowerCase().contains(q),
            )
            .toList();
    if (items.isEmpty) return const SizedBox.shrink();
    final open = q.isNotEmpty || _expanded.contains(g.resource);
    final on = g.permissions.where((p) => _effective(p.key)).length;
    final overridden =
        g.permissions.where((p) => _modes.containsKey(p.key)).length;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: q.isNotEmpty
                    ? null
                    : () => setState(() {
                          if (!_expanded.add(g.resource)) {
                            _expanded.remove(g.resource);
                          }
                        }),
                child: Container(
                  padding: const EdgeInsets.fromLTRB(14, 11, 10, 11),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        color.withValues(alpha: 0.18),
                        color.withValues(alpha: 0.02),
                      ],
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(Icons.key_rounded, size: 15, color: color),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          g.resource.replaceAll('-', ' '),
                          style: AppText.body(
                            size: 13.5,
                            weight: FontWeight.w800,
                          ),
                        ),
                      ),
                      if (overridden > 0) ...[
                        TeamTag(
                          label: '$overridden changed',
                          color: TeamColors.amber,
                        ),
                        const SizedBox(width: 6),
                      ],
                      TeamTag(
                        label: '$on/${g.permissions.length}',
                        color: color,
                      ),
                      Icon(
                        open
                            ? Icons.expand_less_rounded
                            : Icons.expand_more_rounded,
                        color: AppColors.inkFaint,
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (open)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 6, 10, 10),
                child: Column(
                  children: [
                    for (final p in items) _row(p, color),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _row(registry.PermissionItem p, Color color) {
    final mode = _modes[p.key] ?? _Mode.inherit;
    final granted = _effective(p.key);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          InkWell(
            customBorder: const CircleBorder(),
            onTap: () => _setWanted(p.key, !granted),
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 160),
                child: Icon(
                  granted ? Icons.check_circle_rounded : Icons.circle_outlined,
                  key: ValueKey(granted),
                  size: 22,
                  color: granted
                      ? TeamColors.green
                      : AppColors.inkFaint.withValues(alpha: 0.4),
                ),
              ),
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  p.key,
                  style: AppText.body(
                    size: 12.5,
                    weight: FontWeight.w800,
                    color: mode == _Mode.inherit ? AppColors.ink : color,
                  ),
                ),
                if (p.description != null && p.description!.isNotEmpty)
                  Text(
                    p.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 10.5,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          _ModeToggle(mode: mode, onChanged: (m) => _setMode(p.key, m)),
        ],
      ),
    );
  }
}

class _ModeToggle extends StatelessWidget {
  const _ModeToggle({required this.mode, required this.onChanged});

  final _Mode mode;
  final ValueChanged<_Mode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: AppColors.surface3,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: _Mode.values.map((m) {
          final selected = m == mode;
          final color = switch (m) {
            _Mode.inherit => AppColors.inkFaint,
            _Mode.grant => TeamColors.green,
            _Mode.deny => TeamColors.rose,
          };
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 1),
            child: Material(
              color:
                  selected ? color.withValues(alpha: 0.22) : Colors.transparent,
              borderRadius: BorderRadius.circular(99),
              child: InkWell(
                onTap: () => onChanged(m),
                borderRadius: BorderRadius.circular(99),
                child: Container(
                  width: 28,
                  height: 26,
                  alignment: Alignment.center,
                  child: Text(
                    switch (m) {
                      _Mode.inherit => '·',
                      _Mode.grant => '✓',
                      _Mode.deny => '✕',
                    },
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w800,
                      color: selected ? color : AppColors.inkFaint,
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
