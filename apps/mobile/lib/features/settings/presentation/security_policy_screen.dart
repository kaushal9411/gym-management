import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../repositories/gym_settings_repository.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'settings_ui.dart';

class _RoleOption {
  const _RoleOption(
    this.value,
    this.label,
    this.description,
    this.icon,
    this.color,
  );

  final String value;
  final String label;
  final String description;
  final IconData icon;
  final Color color;
}

/// Web's four staff roles for the 2FA policy.
const _roles = <_RoleOption>[
  _RoleOption(
    'OWNER',
    'Owner',
    'Full control of the gym account and billing.',
    Icons.workspace_premium_rounded,
    TeamColors.green,
  ),
  _RoleOption(
    'MANAGER',
    'Manager',
    'Runs day-to-day operations across branches.',
    Icons.shield_rounded,
    TeamColors.amber,
  ),
  _RoleOption(
    'TRAINER',
    'Trainer',
    'Manages workout/diet plans and member sessions.',
    Icons.fitness_center_rounded,
    TeamColors.fuchsia,
  ),
  _RoleOption(
    'RECEPTIONIST',
    'Receptionist',
    'Front-desk check-ins, payments, and bookings.',
    Icons.support_agent_rounded,
    TeamColors.indigo,
  ),
];

/// Security — web's `/gym-settings/security`: "Mandatory two-factor
/// authentication" — one card per staff role (Owner, Manager, Trainer,
/// Receptionist); a checked role must set up 2FA the next time it logs in.
/// Beside / below it web's static "How 2FA works" steps. `PATCH
/// /settings/security` replaces the whole `mfaRequiredRoles` array (the page
/// sends the complete set, not a delta). Needs `settings:read` /
/// `settings:manage`.
///
/// **Dropped vs web**: nothing (the design's "Session timeout" field was never
/// backed by an API and web has none either).
class SecurityPolicyScreen extends StatefulWidget {
  const SecurityPolicyScreen({super.key});

  @override
  State<SecurityPolicyScreen> createState() => _SecurityPolicyScreenState();
}

class _SecurityPolicyScreenState extends State<SecurityPolicyScreen> {
  late final SettingsAccess _access;
  Set<String> _selected = {};
  Set<String> _baseline = {};
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _access = SettingsAccess.of(context);
    if (_access.canRead) {
      _load();
    } else {
      _loading = false;
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final s = await getIt<GymSettingsRepository>().getSecuritySettings();
      if (!mounted) return;
      setState(() {
        _selected = {...s.mfaRequiredRoles};
        _baseline = {...s.mfaRequiredRoles};
        _loading = false;
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.detailedMessage;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Could not load security settings ($e)';
          _loading = false;
        });
      }
    }
  }

  bool get _dirty =>
      !_loading &&
      _error == null &&
      (_selected.length != _baseline.length ||
          !_selected.every(_baseline.contains));

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      final s = await getIt<GymSettingsRepository>()
          .updateSecuritySettings(_selected.toList());
      invalidateSetupProgress();
      if (!mounted) return;
      setState(() {
        _selected = {...s.mfaRequiredRoles};
        _baseline = {...s.mfaRequiredRoles};
      });
      teamSnack(context, 'Security settings saved');
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, 'Could not save ($e)', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final manage = _access.canManage;
    Widget step(IconData icon, String text) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: TeamColors.fuchsia.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 17, color: TeamColors.fuchsia),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    text,
                    style: AppText.body(size: 13, color: AppColors.inkSoft),
                  ),
                ),
              ),
            ],
          ),
        );
    return SettingsScaffold(
      access: _access,
      page: SettingsPage.security,
      title: 'Security',
      subtitle: 'Require two-factor authentication for specific staff roles '
          'before they can log in.',
      loading: _loading,
      error: _error,
      onRetry: _load,
      onRefresh: _load,
      chips: [
        if (!_loading && _error == null)
          ListHeroChip(
            icon: Icons.shield_rounded,
            label: '${_selected.length} '
                '${_selected.length == 1 ? 'role requires' : 'roles require'} 2FA',
          ),
      ],
      saveBar: (manage && _dirty)
          ? SettingsSaveBar(
              saving: _saving,
              onSave: _save,
              onDiscard: () => setState(() => _selected = {..._baseline}),
            )
          : null,
      main: [
        if (!manage) const ReadOnlyNotice(),
        TeamFormSection(
          icon: Icons.shield_rounded,
          color: TeamColors.rose,
          title: 'Mandatory two-factor authentication',
          subtitle: 'Staff in a checked role must set up 2FA the next time '
              'they log in — no separate invite needed',
          children: [
            for (final r in _roles)
              TeamChoiceCard(
                title: r.label,
                description: r.description,
                icon: r.icon,
                color: r.color,
                multi: true,
                selected: _selected.contains(r.value),
                badge:
                    _selected.contains(r.value) ? '2FA required' : 'Optional',
                onTap: !manage
                    ? null
                    : () => setState(() {
                          _selected.contains(r.value)
                              ? _selected.remove(r.value)
                              : _selected.add(r.value);
                        }),
              ),
          ],
        ),
      ],
      aside: [
        TeamSectionCard(
          icon: Icons.key_rounded,
          color: TeamColors.fuchsia,
          title: 'How 2FA works',
          subtitle: 'Static explanation',
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                step(
                  Icons.shield_rounded,
                  'A staff member in a checked role logs in.',
                ),
                step(
                  Icons.smartphone_rounded,
                  'They are walked through setting up an authenticator app '
                  'and backup codes.',
                ),
                step(
                  Icons.key_rounded,
                  'Every later login asks for a 6-digit code.',
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
