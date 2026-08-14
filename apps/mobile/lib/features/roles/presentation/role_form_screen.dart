import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/permission_group.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/tenant_role_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "13a. + Create role" — also doubles as Edit when [existing]
/// is passed. `POST /roles` / `PATCH /roles/:roleId` both take the same
/// shape (name/description/priority/isDefault/permissions), so one form
/// covers both, matching `BranchFormScreen`'s create+edit pattern.
class RoleFormScreen extends StatefulWidget {
  const RoleFormScreen({super.key, this.existing});

  final TenantRole? existing;

  @override
  State<RoleFormScreen> createState() => _RoleFormScreenState();
}

class _RoleFormScreenState extends State<RoleFormScreen> {
  late final _nameController =
      TextEditingController(text: widget.existing?.name ?? '');
  late final _descriptionController =
      TextEditingController(text: widget.existing?.description ?? '');
  late final _priorityController = TextEditingController();

  List<PermissionGroup>? _groups;
  late Set<String> _selected = {...?widget.existing?.permissions};
  bool _isDefault = false;
  late bool _isActive = widget.existing?.isActive ?? true;
  bool _loadingGroups = true;
  bool _saving = false;
  String? _error;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    _loadPermissions();
  }

  Future<void> _loadPermissions() async {
    try {
      final groups = await getIt<TenantRoleRepository>().listPermissions();
      if (!mounted) return;
      setState(() {
        _groups = groups;
        _loadingGroups = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loadingGroups = false;
      });
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    _priorityController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Role name is required');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final repo = getIt<TenantRoleRepository>();
      final priority = int.tryParse(_priorityController.text.trim());
      if (_isEdit) {
        await repo.update(
          widget.existing!.id,
          name: name,
          description: _descriptionController.text.trim(),
          priority: priority,
          isDefault: _isDefault,
          isActive: _isActive,
          permissions: _selected.toList(),
        );
      } else {
        await repo.create(
          name: name,
          description: _descriptionController.text.trim(),
          priority: priority,
          isDefault: _isDefault,
          permissions: _selected.toList(),
        );
      }
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
    final totalPermissions =
        _groups?.fold<int>(0, (sum, g) => sum + g.permissions.length) ?? 0;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text(_isEdit ? 'Edit Role' : 'New Role'),
      ),
      body: SafeArea(
        top: false,
        child: _loadingGroups
            ? const AppLoadingView()
            : _groups == null
                ? AppErrorView(message: _error!, onRetry: _loadPermissions)
                : SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_error != null) ...[
                          const SizedBox(height: 8),
                          FormAlert(message: _error!),
                        ],
                        const SizedBox(height: 16),
                        AppLabeledField(
                          label: 'Role name',
                          hintText: 'e.g. Shift Supervisor',
                          controller: _nameController,
                          textInputAction: TextInputAction.next,
                        ),
                        const SizedBox(height: 14),
                        AppLabeledField(
                          label: 'Description',
                          hintText: 'What this role is for (optional)',
                          controller: _descriptionController,
                          textInputAction: TextInputAction.next,
                        ),
                        const SizedBox(height: 14),
                        AppLabeledField(
                          label: 'Priority',
                          hintText: 'e.g. 10',
                          controller: _priorityController,
                          keyboardType: TextInputType.number,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                          ],
                          textInputAction: TextInputAction.done,
                        ),
                        const SizedBox(height: 14),
                        _ToggleRow(
                          title: 'Default role for new users',
                          value: _isDefault,
                          onChanged: (v) => setState(() => _isDefault = v),
                        ),
                        if (_isEdit) ...[
                          const SizedBox(height: 4),
                          _ToggleRow(
                            title: 'Active (assignable)',
                            value: _isActive,
                            onChanged: (v) => setState(() => _isActive = v),
                          ),
                        ],
                        const SizedBox(height: 18),
                        Text('Permissions', style: AppText.eyebrow()),
                        const SizedBox(height: 10),
                        for (final group in _groups!) ...[
                          _PermissionGroupCard(
                            group: group,
                            selected: _selected,
                            onChanged: (next) =>
                                setState(() => _selected = next),
                          ),
                          const SizedBox(height: 10),
                        ],
                        Center(
                          child: Text(
                            '${_selected.length} of $totalPermissions permissions selected',
                            style: AppText.eyebrow(),
                          ),
                        ),
                        const SizedBox(height: 20),
                        AppButton(
                          label: _isEdit ? 'Save changes' : 'Create role',
                          loading: _saving,
                          onPressed: _submit,
                        ),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
      ),
    );
  }
}

class _PermissionGroupCard extends StatelessWidget {
  const _PermissionGroupCard({
    required this.group,
    required this.selected,
    required this.onChanged,
  });

  final PermissionGroup group;
  final Set<String> selected;
  final ValueChanged<Set<String>> onChanged;

  bool get _allSelected =>
      group.permissions.every((p) => selected.contains(p.key));

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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                group.resource,
                style: AppText.body(size: 13, weight: FontWeight.w700),
              ),
              GestureDetector(
                onTap: () {
                  final next = {...selected};
                  final keys = group.permissions.map((p) => p.key);
                  if (_allSelected) {
                    next.removeAll(keys);
                  } else {
                    next.addAll(keys);
                  }
                  onChanged(next);
                },
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    gradient: _allSelected ? AppColors.staffGrad : null,
                    color: _allSelected ? null : AppColors.surface3,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                  child: Text(
                    'Select all',
                    style: AppText.body(
                      size: 10,
                      weight: FontWeight.w800,
                      color: _allSelected ? Colors.white : AppColors.inkSoft,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: group.permissions.map((permission) {
              final on = selected.contains(permission.key);
              return GestureDetector(
                onTap: () {
                  final next = {...selected};
                  on ? next.remove(permission.key) : next.add(permission.key);
                  onChanged(next);
                },
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    gradient: on ? AppColors.staffGrad : null,
                    color: on ? null : AppColors.surface3,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                  child: Text(
                    permission.key,
                    style: AppText.body(
                      size: 11,
                      weight: FontWeight.w700,
                      color: on ? Colors.white : AppColors.inkSoft,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

/// Matches `SecurityPolicyScreen`'s `_RoleToggleRow` visual exactly — same
/// gradient track, same 26px height, same white knob.
class _ToggleRow extends StatelessWidget {
  const _ToggleRow({
    required this.title,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: AppText.body(size: 13, weight: FontWeight.w700),
          ),
        ),
        GestureDetector(
          onTap: () => onChanged(!value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            width: 44,
            height: 26,
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              gradient: value ? AppColors.staffGrad : null,
              color: value ? null : AppColors.surface3,
              borderRadius: BorderRadius.circular(99),
            ),
            alignment: value ? Alignment.centerRight : Alignment.centerLeft,
            child: Container(
              width: 20,
              height: 20,
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
