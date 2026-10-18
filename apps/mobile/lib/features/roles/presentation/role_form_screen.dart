import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/permission_group.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/tenant_role_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Create / edit a custom role (`POST /roles` / `PATCH /roles/:id` — one form
/// for both, as on web). Name, description, priority, "default for new users"
/// and (edit only) active, plus a searchable permission picker: collapsible
/// resource groups with a tri-state group checkbox and a row per
/// `resource:action` key. The sticky bar shows how many are selected.
///
/// Role names must be 2-60 characters of letters, numbers, spaces, hyphens
/// and underscores (the server's rule, checked here first).
class RoleFormScreen extends StatefulWidget {
  const RoleFormScreen({super.key, this.existing});

  final TenantRole? existing;

  @override
  State<RoleFormScreen> createState() => _RoleFormScreenState();
}

class _RoleFormScreenState extends State<RoleFormScreen> {
  late final _name = TextEditingController(text: widget.existing?.name ?? '');
  late final _description =
      TextEditingController(text: widget.existing?.description ?? '');
  late final _priority = TextEditingController(
    text: widget.existing == null ? '' : '${widget.existing!.priority}',
  );

  List<PermissionGroup>? _groups;
  late final Set<String> _selected = {...?widget.existing?.permissions};
  final Set<String> _open = {};
  late bool _isDefault = widget.existing?.isDefault ?? false;
  late bool _isActive = widget.existing?.isActive ?? true;
  String _query = '';
  bool _saving = false;
  String? _error;
  String? _loadError;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    _name.addListener(() {
      if (mounted) setState(() {});
    });
    _loadPermissions();
  }

  Future<void> _loadPermissions() async {
    setState(() => _loadError = null);
    try {
      final groups = await getIt<TenantRoleRepository>().listPermissions();
      if (!mounted) return;
      setState(() {
        _groups = groups;
        for (final g in groups) {
          if (g.permissions.any((p) => _selected.contains(p.key))) {
            _open.add(g.resource);
          }
        }
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _loadError = e.message);
    } catch (e) {
      if (mounted) setState(() => _loadError = '$e');
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    _priority.dispose();
    super.dispose();
  }

  int get _total =>
      _groups?.fold<int>(0, (a, g) => a + g.permissions.length) ?? 0;

  Future<void> _submit() async {
    final name = _name.text.trim();
    if (name.length < 2) {
      setState(() => _error = 'Role name must be at least 2 characters');
      return;
    }
    if (!RegExp(r'^[a-zA-Z0-9][a-zA-Z0-9 _-]*$').hasMatch(name)) {
      setState(
        () => _error = 'Role name: letters, numbers, spaces, hyphens '
            'and underscores only',
      );
      return;
    }
    final priorityText = _priority.text.trim();
    final priority = int.tryParse(priorityText);
    if (priorityText.isNotEmpty && (priority == null || priority > 1000)) {
      setState(() => _error = 'Priority must be a number from 0 to 1000');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final repo = getIt<TenantRoleRepository>();
      if (_isEdit) {
        await repo.update(
          widget.existing!.id,
          name: name,
          description: _description.text.trim(),
          priority: priority,
          isDefault: _isDefault,
          isActive: _isActive,
          permissions: _selected.toList(),
        );
      } else {
        await repo.create(
          name: name,
          description: _description.text.trim(),
          priority: priority,
          isDefault: _isDefault,
          permissions: _selected.toList(),
        );
      }
      if (!mounted) return;
      teamSnack(context, _isEdit ? 'Role saved.' : '$name created.');
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not save the role ($e)');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _toggleGroup(PermissionGroup g) {
    final keys = g.permissions.map((p) => p.key);
    setState(() {
      if (keys.every(_selected.contains)) {
        _selected.removeAll(keys);
      } else {
        _selected.addAll(keys);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final groups = _groups;
    final title = _isEdit ? 'Edit role' : 'New role';

    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(title),
      ),
      bottomNavigationBar: groups == null
          ? null
          : TeamBottomBar(
              child: Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${_selected.length} / $_total',
                          style: AppText.display(size: 17),
                        ),
                        Text(
                          'permissions',
                          style: AppText.body(
                            size: 11,
                            color: AppColors.inkFaint,
                            weight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    flex: 3,
                    child: TeamGradientButton(
                      label: _isEdit ? 'Save changes' : 'Create role',
                      icon: Icons.check_rounded,
                      loading: _saving,
                      onTap: _submit,
                    ),
                  ),
                ],
              ),
            ),
      body: groups == null
          ? (_loadError != null
              ? AppErrorView(message: _loadError!, onRetry: _loadPermissions)
              : const AppLoadingView())
          : ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: [
                Container(
                  padding: EdgeInsets.fromLTRB(
                    18 + teamSideInset(context),
                    top + 4,
                    18 + teamSideInset(context),
                    22,
                  ),
                  decoration: const BoxDecoration(
                    borderRadius:
                        BorderRadius.vertical(bottom: Radius.circular(30)),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Color(0xFF312E81),
                        Color(0xFF7C3AED),
                        Color(0xFFC026D3),
                      ],
                    ),
                  ),
                  child: Row(
                    children: [
                      AnimatedRing(
                        value: _total == 0 ? 0 : _selected.length / _total,
                        size: 66,
                        stroke: 8,
                        colors: const [Color(0xFFFDE68A), Color(0xFF6EE7B7)],
                        track: Colors.white.withValues(alpha: 0.2),
                        child: const Icon(
                          Icons.shield_rounded,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _name.text.trim().isEmpty
                                  ? 'Untitled role'
                                  : _name.text.trim(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.display(
                                size: 22,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${_selected.length} of $_total permissions '
                              'selected',
                              style: AppText.body(
                                size: 12.5,
                                weight: FontWeight.w600,
                                color: Colors.white.withValues(alpha: 0.88),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    16 + teamSideInset(context),
                    16,
                    16 + teamSideInset(context),
                    0,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_error != null) ...[
                        FormAlert(message: _error!),
                        const SizedBox(height: 14),
                      ],
                      TeamFormSection(
                        icon: Icons.badge_rounded,
                        color: TeamColors.indigo,
                        title: 'Role details',
                        children: [
                          AppLabeledField(
                            label: 'Role name',
                            hintText: 'e.g. Shift Supervisor',
                            icon: Icons.shield_rounded,
                            iconColor: TeamColors.indigo,
                            controller: _name,
                            textCapitalization: TextCapitalization.words,
                            textInputAction: TextInputAction.next,
                          ),
                          AppLabeledField(
                            label: 'Description',
                            hintText: 'What this role is for (optional)',
                            icon: Icons.notes_rounded,
                            iconColor: TeamColors.violet,
                            controller: _description,
                            minLines: 2,
                            maxLines: 4,
                            textCapitalization: TextCapitalization.sentences,
                          ),
                          AppLabeledField(
                            label: 'Priority',
                            hintText: '0 - 1000 (optional)',
                            icon: Icons.low_priority_rounded,
                            iconColor: TeamColors.amber,
                            controller: _priority,
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                            ],
                          ),
                          TeamToggleRow(
                            title: 'Default role for new users',
                            subtitle: 'Pre-selected when adding people',
                            icon: Icons.star_rounded,
                            color: TeamColors.amber,
                            value: _isDefault,
                            onChanged: (v) => setState(() => _isDefault = v),
                          ),
                          if (_isEdit)
                            TeamToggleRow(
                              title: 'Active (assignable)',
                              subtitle: 'Inactive roles can’t be given out',
                              icon: Icons.check_circle_rounded,
                              color: TeamColors.green,
                              value: _isActive,
                              onChanged: (v) => setState(() => _isActive = v),
                            ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      Row(
                        children: [
                          Expanded(
                            child:
                                Text('PERMISSIONS', style: AppText.eyebrow()),
                          ),
                          GestureDetector(
                            onTap: () => setState(() {
                              for (final g in groups) {
                                _selected
                                    .addAll(g.permissions.map((p) => p.key));
                              }
                            }),
                            child: Text(
                              'Select all',
                              style: AppText.body(
                                size: 12,
                                weight: FontWeight.w800,
                                color: TeamColors.violet,
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          GestureDetector(
                            onTap: () => setState(_selected.clear),
                            child: Text(
                              'Clear',
                              style: AppText.body(
                                size: 12,
                                weight: FontWeight.w800,
                                color: TeamColors.rose,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      TeamSearchField(
                        hint: 'Search permissions…',
                        onSearch: (v) => setState(() => _query = v),
                      ),
                      const SizedBox(height: 10),
                      for (var gi = 0; gi < groups.length; gi++)
                        _groupCard(groups[gi], gi),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _groupCard(PermissionGroup g, int gi) {
    final color = TeamColors.rotation[gi % TeamColors.rotation.length];
    final q = _query.toLowerCase();
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
    final on = g.permissions.where((p) => _selected.contains(p.key)).length;
    final all = on == g.permissions.length;
    final open = q.isNotEmpty || _open.contains(g.resource);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: color.withValues(alpha: on > 0 ? 0.45 : 0.2),
          ),
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
                          if (!_open.add(g.resource)) _open.remove(g.resource);
                        }),
                child: Container(
                  padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
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
                      _Check(
                        state: all ? 2 : (on > 0 ? 1 : 0),
                        color: color,
                        onTap: () => _toggleGroup(g),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          g.resource.replaceAll('-', ' '),
                          style: AppText.body(
                            size: 13.5,
                            weight: FontWeight.w800,
                          ),
                        ),
                      ),
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
                padding: const EdgeInsets.fromLTRB(10, 4, 10, 8),
                child: Column(
                  children: [
                    for (final p in items)
                      InkWell(
                        borderRadius: BorderRadius.circular(10),
                        onTap: () => setState(() {
                          if (!_selected.add(p.key)) _selected.remove(p.key);
                        }),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            vertical: 7,
                            horizontal: 2,
                          ),
                          child: Row(
                            children: [
                              _Check(
                                state: _selected.contains(p.key) ? 2 : 0,
                                color: color,
                                onTap: () => setState(() {
                                  if (!_selected.add(p.key)) {
                                    _selected.remove(p.key);
                                  }
                                }),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      p.key,
                                      style: AppText.body(
                                        size: 12.5,
                                        weight: FontWeight.w800,
                                        color: _selected.contains(p.key)
                                            ? color
                                            : AppColors.ink,
                                      ),
                                    ),
                                    if (p.description != null &&
                                        p.description!.isNotEmpty)
                                      Text(
                                        p.description!,
                                        style: AppText.body(
                                          size: 10.5,
                                          color: AppColors.inkFaint,
                                          weight: FontWeight.w600,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Tri-state checkbox: 0 none, 1 some, 2 all.
class _Check extends StatelessWidget {
  const _Check({required this.state, required this.color, required this.onTap});

  final int state;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          width: 22,
          height: 22,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(7),
            color: state == 0 ? Colors.transparent : color,
            border: Border.all(
              color: state == 0 ? AppColors.inkFaint : color,
              width: 1.6,
            ),
          ),
          child: state == 0
              ? null
              : Icon(
                  state == 2 ? Icons.check_rounded : Icons.remove_rounded,
                  size: 15,
                  color: Colors.white,
                ),
        ),
      ),
    );
  }
}
