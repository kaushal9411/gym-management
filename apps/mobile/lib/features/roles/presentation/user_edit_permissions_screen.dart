import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/iam_user.dart';
import '../../../models/permission_group.dart' as registry;
import '../../../repositories/iam_user_repository.dart';
import '../../../repositories/tenant_role_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';

enum _Mode { inherit, grant, deny }

/// `PUT /users/:id/permissions` replaces the whole override set — a
/// per-user GRANT/DENY on top of whatever their roles already grant.
/// "Inherit" (the default) means no override row is sent for that key.
class UserEditPermissionsScreen extends StatefulWidget {
  const UserEditPermissionsScreen({required this.user, super.key});

  final IamUser user;

  @override
  State<UserEditPermissionsScreen> createState() =>
      _UserEditPermissionsScreenState();
}

class _UserEditPermissionsScreenState extends State<UserEditPermissionsScreen> {
  List<registry.PermissionGroup>? _groups;
  late final Map<String, _Mode> _modes = {
    for (final o in widget.user.permissionOverrides)
      o.key: o.mode == 'GRANT' ? _Mode.grant : _Mode.deny,
  };
  late final Set<String> _effective = widget.user.effectivePermissions.toSet();
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final groups = await getIt<TenantRoleRepository>().listPermissions();
      if (!mounted) return;
      setState(() => _groups = groups);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final overrides = _modes.entries
          .where((e) => e.value != _Mode.inherit)
          .map(
            (e) => PermissionOverride(
              key: e.key,
              mode: e.value == _Mode.grant ? 'GRANT' : 'DENY',
            ),
          )
          .toList();
      await getIt<IamUserRepository>()
          .setPermissionOverrides(widget.user.id, overrides);
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
    final overrideCount = _modes.values.where((m) => m != _Mode.inherit).length;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Permission overrides', style: AppText.display(size: 16)),
            Text(widget.user.name, style: AppText.eyebrow()),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: _groups == null
            ? _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : const AppLoadingView()
            : Column(
                children: [
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(18, 8, 18, 8),
                      children: [
                        if (_error != null) ...[
                          FormAlert(message: _error!),
                          const SizedBox(height: 12),
                        ],
                        Text(
                          '$overrideCount override${overrideCount == 1 ? '' : 's'} · '
                          '${_effective.length} currently granted · '
                          'everything else inherits from their roles',
                          style: AppText.body(
                            size: 11,
                            color: AppColors.inkFaint,
                            weight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 10),
                        for (final group in _groups!) ...[
                          _GroupCard(
                            group: group,
                            modes: _modes,
                            effective: _effective,
                            onChanged: (key, mode) => setState(() {
                              if (mode == _Mode.inherit) {
                                _modes.remove(key);
                              } else {
                                _modes[key] = mode;
                              }
                            }),
                          ),
                          const SizedBox(height: 10),
                        ],
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 0, 18, 20),
                    child: AppButton(
                      label: 'Save overrides',
                      loading: _saving,
                      onPressed: _save,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({
    required this.group,
    required this.modes,
    required this.effective,
    required this.onChanged,
  });

  final registry.PermissionGroup group;
  final Map<String, _Mode> modes;
  final Set<String> effective;
  final void Function(String key, _Mode mode) onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            group.resource,
            style: AppText.body(size: 12, weight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          for (final permission in group.permissions)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  _GrantTick(
                    granted: switch (modes[permission.key] ?? _Mode.inherit) {
                      _Mode.grant => true,
                      _Mode.deny => false,
                      _Mode.inherit => effective.contains(permission.key),
                    },
                    onTap: (granted) => onChanged(
                      permission.key,
                      granted ? _Mode.grant : _Mode.deny,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      permission.key,
                      style: AppText.body(size: 12, weight: FontWeight.w600),
                    ),
                  ),
                  _ModeToggle(
                    mode: modes[permission.key] ?? _Mode.inherit,
                    onChanged: (m) => onChanged(permission.key, m),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// A directly-tappable checkmark showing whether the user currently, in
/// effect, has this permission (role grant + any pending override
/// combined) — tapping it is a one-tap shortcut to add (GRANT) or remove
/// (DENY) the permission, alongside the finer-grained Inherit/Grant/Deny
/// segmented control next to it.
class _GrantTick extends StatelessWidget {
  const _GrantTick({required this.granted, required this.onTap});

  final bool granted;
  final ValueChanged<bool> onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: () => onTap(!granted),
        child: Padding(
          padding: const EdgeInsets.all(4),
          child: Icon(
            granted ? Icons.check_circle_rounded : Icons.circle_outlined,
            size: 16,
            color: granted
                ? AppColors.success
                : AppColors.inkFaint.withValues(alpha: 0.35),
          ),
        ),
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
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: _Mode.values.map((m) {
          final selected = m == mode;
          final color = switch (m) {
            _Mode.inherit => AppColors.inkFaint,
            _Mode.grant => AppColors.success,
            _Mode.deny => AppColors.danger,
          };
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 1),
            child: Material(
              color:
                  selected ? color.withValues(alpha: 0.22) : Colors.transparent,
              borderRadius: BorderRadius.circular(AppRadii.pill),
              child: InkWell(
                onTap: () => onChanged(m),
                borderRadius: BorderRadius.circular(AppRadii.pill),
                child: Container(
                  width: 26,
                  height: 22,
                  alignment: Alignment.center,
                  child: Text(
                    switch (m) {
                      _Mode.inherit => '·',
                      _Mode.grant => '✓',
                      _Mode.deny => '✕',
                    },
                    style: AppText.body(
                      size: 11,
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
