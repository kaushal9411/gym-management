import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/iam_user.dart';
import '../../../repositories/iam_user_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

const _statusTones = {
  'ACTIVE': AppPillTone.success,
  'PENDING_VERIFICATION': AppPillTone.warning,
  'LOCKED': AppPillTone.danger,
  'SUSPENDED': AppPillTone.danger,
  'DEACTIVATED': AppPillTone.neutral,
};

/// No design frame — `/users` has none in the Kinetic design at all (mobile
/// had no Users surface until this chunk). Built in the same visual
/// language as `RoleDetailScreen`/`StaffDetailScreen`: identity summary +
/// status actions + three editors (roles/branches/permission-overrides),
/// mirroring the web IAM user-detail page's sections.
class UserDetailScreen extends StatefulWidget {
  const UserDetailScreen({required this.userId, super.key});

  final String userId;

  @override
  State<UserDetailScreen> createState() => _UserDetailScreenState();
}

class _UserDetailScreenState extends State<UserDetailScreen> {
  IamUser? _user;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final user = await getIt<IamUserRepository>().getById(widget.userId);
      if (!mounted) return;
      setState(() => _user = user);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _runAction(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
      if (!mounted) return;
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    final user = _user;
    if (user == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AppColors.surface2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.card),
        ),
        title: Text('Delete ${user.name}?', style: AppText.display(size: 18)),
        content: Text(
          'This soft-deletes the account. It can be restored later.',
          style: AppText.body(size: 13, color: AppColors.inkFaint),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(
              'Cancel',
              style: AppText.body(size: 13, weight: FontWeight.w700),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(
              'Delete',
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
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await getIt<IamUserRepository>().delete(user.id);
      if (!mounted) return;
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = _user;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text(user?.name ?? 'User', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: user == null
            ? _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : const AppLoadingView()
            : ListView(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                children: [
                  if (_error != null) ...[
                    FormAlert(message: _error!),
                    const SizedBox(height: 12),
                  ],
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0x298B5CF6), Color(0x14FF6B5B)],
                      ),
                      borderRadius: BorderRadius.circular(AppRadii.card),
                      border: Border.all(color: AppColors.glassBorder),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: const BoxDecoration(
                            gradient: AppColors.staffGrad,
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            user.initials,
                            style: AppText.body(
                              size: 15,
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
                                style: AppText.body(
                                  size: 15,
                                  weight: FontWeight.w800,
                                ),
                              ),
                              Text(
                                user.email,
                                style: AppText.body(
                                  size: 12,
                                  color: AppColors.inkFaint,
                                ),
                              ),
                            ],
                          ),
                        ),
                        AppPill(
                          label: user.status.replaceAll('_', ' '),
                          tone:
                              _statusTones[user.status] ?? AppPillTone.neutral,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  _SectionCard(
                    title: 'Roles',
                    onEdit: () async {
                      await context.push(
                        AppRoutes.userEditRoles,
                        extra: user,
                      );
                      _load();
                    },
                    child: Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: user.roles.isEmpty
                          ? [
                              Text(
                                'No roles assigned',
                                style: AppText.body(
                                  size: 12,
                                  color: AppColors.inkFaint,
                                ),
                              ),
                            ]
                          : user.roles
                              .map(
                                (r) => AppPill(
                                  label: r.name,
                                  tone: AppPillTone.roleTint,
                                ),
                              )
                              .toList(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  _SectionCard(
                    title: 'Branch access',
                    onEdit: () async {
                      await context.push(
                        AppRoutes.userEditBranches,
                        extra: user,
                      );
                      _load();
                    },
                    child: user.allBranches
                        ? Text(
                            'All branches',
                            style: AppText.body(
                              size: 13,
                              weight: FontWeight.w600,
                            ),
                          )
                        : user.branches.isEmpty
                            ? Text(
                                'No branch access',
                                style: AppText.body(
                                  size: 12,
                                  color: AppColors.inkFaint,
                                ),
                              )
                            : Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: user.branches
                                    .map(
                                      (b) => Padding(
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 3,
                                        ),
                                        child: Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                b.branchName,
                                                style: AppText.body(
                                                  size: 13,
                                                  weight: FontWeight.w600,
                                                ),
                                              ),
                                            ),
                                            if (b.isPrimary)
                                              const AppPill(
                                                label: 'Primary',
                                                tone: AppPillTone.roleTint,
                                              ),
                                          ],
                                        ),
                                      ),
                                    )
                                    .toList(),
                              ),
                  ),
                  const SizedBox(height: 10),
                  _SectionCard(
                    title: 'Permissions',
                    onEdit: () async {
                      await context.push(
                        AppRoutes.userEditPermissions,
                        extra: user,
                      );
                      _load();
                    },
                    child: Text(
                      '${user.effectivePermissions.length} effective '
                      '(${user.permissionOverrides.length} override'
                      '${user.permissionOverrides.length == 1 ? '' : 's'})',
                      style: AppText.body(size: 13, weight: FontWeight.w600),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surface2,
                      borderRadius: BorderRadius.circular(AppRadii.card),
                      border: Border.all(color: AppColors.line),
                    ),
                    child: Column(
                      children: [
                        if (user.phone != null)
                          _Row(label: 'Phone', value: user.phone!),
                        _Row(
                          label: 'Last login',
                          value: user.lastLoginAt == null
                              ? 'Never'
                              : _formatDate(user.lastLoginAt!),
                        ),
                        _Row(
                          label: 'Created',
                          value: _formatDate(user.createdAt),
                        ),
                        if (user.emergencyContactName != null)
                          _Row(
                            label: 'Emergency contact',
                            value: user.emergencyContactName!,
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  _StatusActions(
                    user: user,
                    busy: _busy,
                    onSuspend: () => _runAction(
                      () => getIt<IamUserRepository>().suspend(user.id),
                    ),
                    onDeactivate: () => _runAction(
                      () => getIt<IamUserRepository>().deactivate(user.id),
                    ),
                    onRestore: () => _runAction(
                      () => getIt<IamUserRepository>().restore(user.id),
                    ),
                    onDelete: _delete,
                  ),
                ],
              ),
      ),
    );
  }

  String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.child,
    required this.onEdit,
  });

  final String title;
  final Widget child;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
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
              Expanded(child: Text(title, style: AppText.eyebrow())),
              Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                  onTap: onEdit,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    child: Text(
                      'Edit',
                      style: AppText.body(
                        size: 12,
                        weight: FontWeight.w700,
                        color: AppColors.staffPillFg,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _StatusActions extends StatelessWidget {
  const _StatusActions({
    required this.user,
    required this.busy,
    required this.onSuspend,
    required this.onDeactivate,
    required this.onRestore,
    required this.onDelete,
  });

  final IamUser user;
  final bool busy;
  final VoidCallback onSuspend;
  final VoidCallback onDeactivate;
  final VoidCallback onRestore;
  final VoidCallback onDelete;

  bool get _isDeleted => user.deletedAt != null;
  bool get _needsRestore =>
      _isDeleted || user.status == 'SUSPENDED' || user.status == 'DEACTIVATED';

  @override
  Widget build(BuildContext context) {
    if (_isDeleted) {
      return AppButton(
        label: 'Restore',
        loading: busy,
        onPressed: onRestore,
      );
    }
    return Column(
      children: [
        if (_needsRestore)
          AppButton(label: 'Restore', loading: busy, onPressed: onRestore)
        else
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: 'Suspend',
                  variant: AppButtonVariant.ghost,
                  loading: busy,
                  onPressed: onSuspend,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: AppButton(
                  label: 'Deactivate',
                  variant: AppButtonVariant.ghost,
                  loading: busy,
                  onPressed: onDeactivate,
                ),
              ),
            ],
          ),
        const SizedBox(height: 10),
        AppButton(
          label: 'Delete user',
          variant: AppButtonVariant.ghost,
          foregroundColor: AppColors.danger,
          onPressed: busy ? null : onDelete,
        ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppText.body(
              size: 13,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: AppText.body(size: 13, weight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
