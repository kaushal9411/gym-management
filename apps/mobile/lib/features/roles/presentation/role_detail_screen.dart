import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/tenant_role_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

class RoleDetailScreen extends StatefulWidget {
  const RoleDetailScreen({super.key, required this.roleId});

  final String roleId;

  @override
  State<RoleDetailScreen> createState() => _RoleDetailScreenState();
}

class _RoleDetailScreenState extends State<RoleDetailScreen> {
  TenantRole? _role;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final role = await getIt<TenantRoleRepository>().getById(widget.roleId);
      if (!mounted) return;
      setState(() => _role = role);
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
        title: Text(_role?.name ?? 'Role', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : _role == null
                ? const AppLoadingView()
                : _buildContent(_role!),
      ),
    );
  }

  Widget _buildContent(TenantRole role) {
    final grouped = role.permissionsByResource;
    final resources = grouped.keys.toList()..sort();
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  AppPill(
                    label: role.isSystem ? 'System role' : 'Custom role',
                    tone: role.isSystem
                        ? AppPillTone.neutral
                        : AppPillTone.roleTint,
                  ),
                  const SizedBox(width: 8),
                  AppPill(
                    label: role.isActive ? 'Active' : 'Inactive',
                    tone: role.isActive
                        ? AppPillTone.success
                        : AppPillTone.danger,
                  ),
                ],
              ),
              if (role.description != null && role.description!.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  role.description!,
                  style: AppText.body(size: 13, color: AppColors.inkSoft),
                ),
              ],
              const SizedBox(height: 10),
              Text(
                '${role.userCount} user(s) assigned',
                style: AppText.body(
                  size: 11,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(
          '${role.permissions.length} permissions',
          style: AppText.eyebrow(),
        ),
        const SizedBox(height: 8),
        for (final resource in resources) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 6, top: 6),
            child: Text(
              resource,
              style: AppText.body(
                size: 12,
                weight: FontWeight.w800,
                color: AppColors.staffPillFg,
              ),
            ),
          ),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children:
                grouped[resource]!.map((key) => AppPill(label: key)).toList(),
          ),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}
