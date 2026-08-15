import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/iam_user.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/iam_user_repository.dart';
import '../../../repositories/tenant_role_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';

/// `PUT /users/:id/roles` replaces the whole role set — this screen always
/// sends the complete selection, never a delta.
class UserEditRolesScreen extends StatefulWidget {
  const UserEditRolesScreen({required this.user, super.key});

  final IamUser user;

  @override
  State<UserEditRolesScreen> createState() => _UserEditRolesScreenState();
}

class _UserEditRolesScreenState extends State<UserEditRolesScreen> {
  List<TenantRole>? _roles;
  late final Set<String> _selected = widget.user.roles.map((r) => r.id).toSet();
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final roles = await getIt<TenantRoleRepository>().list();
      if (!mounted) return;
      // `PUT /users/:id/roles` rejects SUPER_ADMIN ("cannot be assigned
      // here") — verified live — so it's filtered out here too, matching
      // UserFormScreen/InviteUserScreen.
      setState(
        () => _roles = roles.where((r) => r.name != 'SUPER_ADMIN').toList(),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _save() async {
    if (_selected.isEmpty) {
      setState(() => _error = 'Assign at least one role');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<IamUserRepository>()
          .setRoles(widget.user.id, _selected.toList());
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
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Edit roles', style: AppText.display(size: 18)),
            Text(widget.user.name, style: AppText.eyebrow()),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: _roles == null
            ? _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : const AppLoadingView()
            : Padding(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_error != null) ...[
                      FormAlert(message: _error!),
                      const SizedBox(height: 12),
                    ],
                    Expanded(
                      child: ListView.separated(
                        itemCount: _roles!.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          final role = _roles![i];
                          final selected = _selected.contains(role.id);
                          return Material(
                            color: Colors.transparent,
                            child: InkWell(
                              borderRadius:
                                  BorderRadius.circular(AppRadii.card),
                              onTap: () => setState(() {
                                selected
                                    ? _selected.remove(role.id)
                                    : _selected.add(role.id);
                              }),
                              child: Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColors.surface2,
                                  borderRadius:
                                      BorderRadius.circular(AppRadii.card),
                                  border: Border.all(
                                    color: selected
                                        ? AppColors.staffPillFg
                                        : AppColors.line,
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      selected
                                          ? Icons.check_box_rounded
                                          : Icons
                                              .check_box_outline_blank_rounded,
                                      size: 20,
                                      color: selected
                                          ? AppColors.staffPillFg
                                          : AppColors.inkFaint,
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            role.name,
                                            style: AppText.body(
                                              size: 14,
                                              weight: FontWeight.w700,
                                            ),
                                          ),
                                          Text(
                                            '${role.permissions.length} permissions',
                                            style: AppText.body(
                                              size: 11,
                                              color: AppColors.inkFaint,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 12),
                    AppButton(
                      label: 'Save roles',
                      loading: _saving,
                      onPressed: _save,
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}
