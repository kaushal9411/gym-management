import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../repositories/profile_repository.dart';
import '../../../shared/widgets/app_state_views.dart';

const _preferenceLabels = <String, String>{
  'email_billing': 'Billing & subscription emails',
  'email_announcements': 'Platform announcements',
  'inapp_system': 'In-app system alerts',
};

/// "My Profile" → "Notification preferences". Owns only
/// `notificationPreferences`; each toggle saves immediately (matching
/// `apps/tenant-web`'s `/profile` page), no separate Save button.
class NotificationPreferencesScreen extends StatefulWidget {
  const NotificationPreferencesScreen({super.key});

  @override
  State<NotificationPreferencesScreen> createState() =>
      _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState
    extends State<NotificationPreferencesScreen> {
  Map<String, bool> _prefs = {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final profile = await getIt<ProfileRepository>().getProfile();
      if (!mounted) return;
      setState(() {
        _prefs = {...profile.notificationPreferences};
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  Future<void> _toggle(String key, bool value) async {
    final previous = {..._prefs};
    setState(() => _prefs[key] = value);
    try {
      await getIt<ProfileRepository>().updateNotificationPreferences(_prefs);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _prefs = previous);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Notifications', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const AppLoadingView()
            : _error != null && _prefs.isEmpty
                ? AppErrorView(message: _error!, onRetry: _load)
                : ListView(
                    padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                    children: [
                      for (final entry in _prefs.entries) ...[
                        _PreferenceRow(
                          title: _preferenceLabels[entry.key] ?? entry.key,
                          value: entry.value,
                          onChanged: (v) => _toggle(entry.key, v),
                        ),
                        const SizedBox(height: 4),
                      ],
                    ],
                  ),
      ),
    );
  }
}

/// Same visual as `SecurityPolicyScreen`'s `_RoleToggleRow` / `RoleFormScreen`'s
/// `_ToggleRow` — gradient track, 26px height, white knob.
class _PreferenceRow extends StatelessWidget {
  const _PreferenceRow({
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
            style: AppText.body(size: 13, weight: FontWeight.w600),
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
