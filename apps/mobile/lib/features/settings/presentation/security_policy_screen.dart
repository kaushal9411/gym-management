import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../repositories/gym_settings_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';

const _roles = <String, String>{
  'OWNER': 'Mandatory for tenant admins',
  'MANAGER': 'Mandatory for branch managers',
  'TRAINER': 'Optional today',
  'RECEPTIONIST': 'Optional today',
};

/// Design frame "11d. Security policy" — one 2FA toggle per role, writing
/// the whole `mfaRequiredRoles` array back on save. The frame's "Session
/// timeout" field is not built: `/settings/security` stores only the role
/// array, there is no timeout setting to write to.
class SecurityPolicyScreen extends StatefulWidget {
  const SecurityPolicyScreen({super.key});

  @override
  State<SecurityPolicyScreen> createState() => _SecurityPolicyScreenState();
}

class _SecurityPolicyScreenState extends State<SecurityPolicyScreen> {
  Set<String>? _required;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final settings =
          await getIt<GymSettingsRepository>().getSecuritySettings();
      if (!mounted) return;
      setState(() => _required = settings.mfaRequiredRoles.toSet());
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _save() async {
    final required = _required;
    if (required == null) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<GymSettingsRepository>()
          .updateSecuritySettings(required.toList());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Security policy saved')),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final required = _required;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Security Policy', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: required == null
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
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(
                      color: AppColors.surface2,
                      borderRadius: BorderRadius.circular(AppRadii.card),
                      border: Border.all(color: AppColors.line),
                    ),
                    child: Column(
                      children: [
                        for (final entry in _roles.entries)
                          _RoleToggleRow(
                            title: 'Require 2FA — '
                                '${entry.key[0]}${entry.key.substring(1).toLowerCase()}',
                            subtitle: entry.value,
                            value: required.contains(entry.key),
                            isLast: entry.key == _roles.keys.last,
                            onChanged: (on) => setState(() {
                              on
                                  ? required.add(entry.key)
                                  : required.remove(entry.key);
                            }),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  AppButton(
                    label: 'Save changes',
                    loading: _saving,
                    onPressed: _save,
                  ),
                ],
              ),
      ),
    );
  }
}

class _RoleToggleRow extends StatelessWidget {
  const _RoleToggleRow({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.isLast,
    required this.onChanged,
  });

  final String title;
  final String subtitle;
  final bool value;
  final bool isLast;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(bottom: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
                Text(
                  subtitle,
                  style: AppText.body(size: 11, color: AppColors.inkFaint),
                ),
              ],
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
              alignment:
                  value ? Alignment.centerRight : Alignment.centerLeft,
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
      ),
    );
  }
}
