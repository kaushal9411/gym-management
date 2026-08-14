import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/permission_group.dart';
import '../../../repositories/tenant_role_repository.dart';
import '../../../shared/widgets/app_state_views.dart';

/// The web app's `/permissions` page (the full 114-key catalog, grouped by
/// resource) — a different thing from the "Matrix" tab, which compares
/// roles against a hand-picked subset. This is read-only: creating or
/// editing permissions has no endpoint anywhere, web included, since the
/// registry itself is fixed and only role/user *grants* against it are
/// editable (that's what Roles/Users are for). Reuses
/// `TenantRoleRepository.listPermissions()` — same `GET /permissions` the
/// role form's picker already calls.
class PermissionsRegistryTab extends StatefulWidget {
  const PermissionsRegistryTab({super.key});

  @override
  State<PermissionsRegistryTab> createState() =>
      _PermissionsRegistryTabState();
}

class _PermissionsRegistryTabState extends State<PermissionsRegistryTab> {
  List<PermissionGroup>? _groups;
  String _search = '';
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final groups = await getIt<TenantRoleRepository>().listPermissions();
      if (!mounted) return;
      setState(() => _groups = groups);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_groups == null) {
      return _error != null
          ? AppErrorView(message: _error!, onRetry: _load)
          : const AppLoadingView();
    }

    final query = _search.trim().toLowerCase();
    final filtered = query.isEmpty
        ? _groups!
        : _groups!
            .map(
              (g) => PermissionGroup(
                resource: g.resource,
                permissions: g.permissions
                    .where(
                      (p) =>
                          p.key.toLowerCase().contains(query) ||
                          (p.description?.toLowerCase().contains(query) ??
                              false),
                    )
                    .toList(),
              ),
            )
            .where((g) => g.permissions.isNotEmpty)
            .toList();
    final total = _groups!.fold<int>(0, (sum, g) => sum + g.permissions.length);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
          child: TextField(
            onChanged: (v) => setState(() => _search = v),
            style: AppText.body(size: 14, weight: FontWeight.w600),
            decoration: InputDecoration(
              hintText: 'Search $total permissions…',
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
          child: filtered.isEmpty
              ? const AppEmptyState(
                  icon: Icons.search_off_rounded,
                  title: 'No matching permissions',
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
                  itemCount: filtered.length,
                  itemBuilder: (context, i) =>
                      _ResourceGroupCard(group: filtered[i]),
                ),
        ),
      ],
    );
  }
}

class _ResourceGroupCard extends StatelessWidget {
  const _ResourceGroupCard({required this.group});

  final PermissionGroup group;

  @override
  Widget build(BuildContext context) {
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
                child: Text(
                  group.resource,
                  style: AppText.body(size: 13, weight: FontWeight.w800),
                ),
              ),
              Text(
                '${group.permissions.length}',
                style: AppText.body(size: 11, color: AppColors.inkFaint),
              ),
            ],
          ),
          const SizedBox(height: 8),
          for (final permission in group.permissions)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 2,
                    child: Text(
                      permission.key,
                      style: AppText.body(
                        size: 11.5,
                        weight: FontWeight.w700,
                        color: AppColors.staffPillFg,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 3,
                    child: Text(
                      permission.description ?? '—',
                      style: AppText.body(
                        size: 11.5,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
