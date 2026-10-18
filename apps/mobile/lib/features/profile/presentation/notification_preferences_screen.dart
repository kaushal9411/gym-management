import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/staff_profile.dart';
import '../../../repositories/profile_repository.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'profile_logic.dart';
import 'profile_ui.dart';

/// My Profile → Notification preferences — web's panel of the same name. Owns
/// only `notificationPreferences`; each switch saves immediately (a failed
/// save flips it back and shows the error), so there is no Save button.
class NotificationPreferencesScreen extends StatefulWidget {
  const NotificationPreferencesScreen({super.key});

  @override
  State<NotificationPreferencesScreen> createState() =>
      _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState
    extends State<NotificationPreferencesScreen> {
  StaffProfile? _profile;
  Map<String, bool> _prefs = {};
  String? _loadError;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final p = await getIt<ProfileRepository>().getProfile();
      if (!mounted) return;
      setState(() {
        _profile = p;
        _prefs = {...p.notificationPreferences};
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _loadError = e.message);
    } catch (e) {
      if (mounted) setState(() => _loadError = 'Could not load ($e)');
    }
  }

  Future<void> _toggle(String key, bool value) async {
    final previous = {..._prefs};
    setState(() {
      _prefs[key] = value;
      _saving = true;
    });
    try {
      await getIt<ProfileRepository>().updateNotificationPreferences(_prefs);
      if (mounted) teamSnack(context, 'Preferences saved');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _prefs = previous);
      teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _prefs = previous);
      teamSnack(context, 'Could not save ($e)', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _profile;
    return ProfileFormPage(
      title: 'Notifications',
      chip: 'Account · Notification preferences',
      icon: Icons.notifications_outlined,
      color: TeamColors.sky,
      name: p?.name ?? 'My profile',
      subtitle: p?.email ?? '',
      avatarUrl: p?.avatarUrl,
      loading: p == null && _loadError == null,
      loadError: p == null ? _loadError : null,
      onRetry: _load,
      sections: [
        TeamFormSection(
          icon: Icons.notifications_active_outlined,
          color: TeamColors.sky,
          title: 'Choose what you get notified about',
          subtitle: 'Changes save instantly.',
          children: [
            if (_prefs.isEmpty)
              const ProfileNote('No preferences to show.')
            else
              for (final e in _prefs.entries)
                ProfilePrefRow(
                  label: kPreferenceLabels[e.key] ?? e.key,
                  value: e.value,
                  onChanged: _saving ? null : (v) => _toggle(e.key, v),
                ),
          ],
        ),
      ],
    );
  }
}
