import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/mfa_setup.dart';
import '../../../models/staff_profile.dart';
import '../../../repositories/profile_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'profile_ui.dart';

enum _Step { overview, setup, codes, disable, regenerate }

/// My Profile → Two-factor authentication — web's Security tab: status
/// (Enabled / Disabled), **Enable 2FA** (QR + secret, confirm with the 6-digit
/// code, then the one-time backup codes), **Regenerate backup codes** (needs a
/// current code; the old set stops working) and **Disable 2FA** (confirm with
/// the password). Backs `POST /profile/two-factor/*`. Backup codes are shown
/// once; copying puts them on the clipboard.
class TwoFactorScreen extends StatefulWidget {
  const TwoFactorScreen({super.key});

  @override
  State<TwoFactorScreen> createState() => _TwoFactorScreenState();
}

class _TwoFactorScreenState extends State<TwoFactorScreen> {
  final _code = TextEditingController();
  final _password = TextEditingController();
  StaffProfile? _profile;
  String? _loadError;
  _Step _step = _Step.overview;
  MfaSetupChallenge? _challenge;
  List<String> _backupCodes = const [];
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _code.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final p = await getIt<ProfileRepository>().getProfile();
      if (mounted) setState(() => _profile = p);
    } on ApiException catch (e) {
      if (mounted) setState(() => _loadError = e.message);
    } catch (e) {
      if (mounted) setState(() => _loadError = 'Could not load ($e)');
    }
  }

  void _go(_Step s) {
    _code.clear();
    _password.clear();
    setState(() {
      _step = s;
      _error = null;
    });
  }

  /// Runs [action] with the busy flag and error handling shared by all steps.
  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _error = 'Something went wrong ($e)');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _begin() => _run(() async {
        final c = await getIt<ProfileRepository>().beginTwoFactorSetup();
        if (!mounted) return;
        _code.clear();
        setState(() {
          _challenge = c;
          _step = _Step.setup;
        });
      });

  Future<void> _confirmSetup() => _run(() async {
        final codes = await getIt<ProfileRepository>()
            .confirmTwoFactorSetup(_code.text.trim());
        if (!mounted) return;
        setState(() {
          _backupCodes = codes;
          _step = _Step.codes;
        });
        await _load();
      });

  Future<void> _regenerate() => _run(() async {
        final codes = await getIt<ProfileRepository>()
            .regenerateBackupCodes(_code.text.trim());
        if (!mounted) return;
        setState(() {
          _backupCodes = codes;
          _step = _Step.codes;
        });
      });

  Future<void> _disable() => _run(() async {
        await getIt<ProfileRepository>().disableTwoFactor(_password.text);
        if (!mounted) return;
        teamSnack(context, 'Two-factor authentication disabled.');
        _go(_Step.overview);
        await _load();
      });

  bool get _codeOk => RegExp(r'^\d{6}$').hasMatch(_code.text.trim());

  @override
  Widget build(BuildContext context) {
    final p = _profile;
    final on = p?.mfaEnabled ?? false;
    return ProfileFormPage(
      title: 'Two-factor',
      chip: 'Security · Two-factor authentication',
      icon: Icons.shield_outlined,
      color: on ? TeamColors.green : TeamColors.rose,
      name: p?.name ?? 'My profile',
      subtitle: p?.email ?? '',
      avatarUrl: p?.avatarUrl,
      loading: p == null && _loadError == null,
      loadError: p == null ? _loadError : null,
      onRetry: _load,
      error: _error,
      sections: switch (_step) {
        _Step.overview => [_overview(on)],
        _Step.setup => [_setup()],
        _Step.codes => [_codes()],
        _Step.disable => [_disableForm()],
        _Step.regenerate => [_regenerateForm()],
      },
    );
  }

  Widget _overview(bool on) {
    final color = on ? TeamColors.green : TeamColors.rose;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TeamSectionCard(
          icon: Icons.shield_outlined,
          color: TeamColors.green,
          title: 'Two-factor authentication',
          subtitle: 'Require a code from an authenticator app at sign-in.',
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Icon(
                        on
                            ? Icons.verified_user_rounded
                            : Icons.gpp_maybe_outlined,
                        color: color,
                        size: 30,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          TeamTag(
                            label: on ? 'Enabled' : 'Disabled',
                            color: color,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            on
                                ? 'Your account asks for an authenticator '
                                    'code at sign-in.'
                                : 'Your account is protected by a password '
                                    'only.',
                            style: AppText.body(
                              size: 12.5,
                              color: AppColors.inkSoft,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                if (on) ...[
                  TeamOutlineButton(
                    label: 'Regenerate backup codes',
                    icon: Icons.refresh_rounded,
                    onTap: () => _go(_Step.regenerate),
                  ),
                  const SizedBox(height: 8),
                  TeamOutlineButton(
                    label: 'Disable 2FA',
                    icon: Icons.shield_outlined,
                    onTap: () => _go(_Step.disable),
                  ),
                ] else
                  TeamGradientButton(
                    label: 'Enable 2FA',
                    icon: Icons.shield_rounded,
                    loading: _busy,
                    onTap: _busy ? null : _begin,
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        TeamSectionCard(
          icon: Icons.key_rounded,
          color: TeamColors.amber,
          title: 'Backup codes',
          child: const Padding(
            padding: EdgeInsets.all(14),
            child: ProfileNote(
              'Backup codes are shown once when you enable 2FA or regenerate '
              'them. Each works a single time if you lose your authenticator '
              'app. Regenerating invalidates the old set.',
            ),
          ),
        ),
      ],
    );
  }

  Widget _codeField() => AppLabeledField(
        label: '6-digit code',
        hintText: '123456',
        icon: Icons.pin_outlined,
        iconColor: TeamColors.indigo,
        controller: _code,
        keyboardType: TextInputType.number,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(6),
        ],
        onChanged: (_) => setState(() {}),
      );

  Widget _actions(String label, VoidCallback onTap, {required bool enabled}) =>
      Column(
        children: [
          TeamGradientButton(
            label: label,
            loading: _busy,
            onTap: enabled && !_busy ? onTap : null,
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: _busy ? null : () => _go(_Step.overview),
            child: const Text('Cancel'),
          ),
        ],
      );

  Widget _setup() {
    final c = _challenge!;
    final raw = c.qrDataUrl.contains(',') ? c.qrDataUrl.split(',').last : '';
    return TeamSectionCard(
      icon: Icons.qr_code_2_rounded,
      color: TeamColors.indigo,
      title: 'Scan with your authenticator app',
      subtitle: 'Then enter the 6-digit code it shows.',
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (raw.isNotEmpty)
              Center(
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppRadii.card),
                  ),
                  child: Image.memory(
                    base64Decode(raw),
                    width: 170,
                    height: 170,
                    gaplessPlayback: true,
                  ),
                ),
              ),
            const SizedBox(height: 10),
            Text(
              "Can't scan? Enter this key manually:",
              textAlign: TextAlign.center,
              style: AppText.body(
                size: 11.5,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            GestureDetector(
              onTap: () {
                Clipboard.setData(ClipboardData(text: c.secret));
                teamSnack(context, 'Secret copied');
              },
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.surface3,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        c.secret,
                        style: AppText.tabular(size: 12.5),
                      ),
                    ),
                    Icon(
                      Icons.copy_rounded,
                      size: 15,
                      color: AppColors.inkFaint,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            _codeField(),
            const SizedBox(height: 14),
            _actions('Confirm and enable', _confirmSetup, enabled: _codeOk),
          ],
        ),
      ),
    );
  }

  Widget _codes() {
    return TeamSectionCard(
      icon: Icons.key_rounded,
      color: TeamColors.amber,
      title: 'Save your backup codes',
      subtitle: 'Each code works once if you lose your authenticator.',
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final c in _backupCodes)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surface3,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      c,
                      style: AppText.tabular(size: 13, weight: FontWeight.w800),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            TeamOutlineButton(
              label: 'Copy codes',
              icon: Icons.copy_rounded,
              onTap: () {
                Clipboard.setData(ClipboardData(text: _backupCodes.join('\n')));
                teamSnack(context, 'Backup codes copied');
              },
            ),
            const SizedBox(height: 8),
            TeamGradientButton(
              label: "I've saved these codes",
              icon: Icons.check_rounded,
              onTap: () {
                setState(() => _backupCodes = const []);
                _go(_Step.overview);
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _regenerateForm() => TeamSectionCard(
        icon: Icons.refresh_rounded,
        color: TeamColors.amber,
        title: 'Regenerate backup codes',
        subtitle: 'Enter a current authenticator code. The old codes stop '
            'working.',
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _codeField(),
              const SizedBox(height: 14),
              _actions('Regenerate', _regenerate, enabled: _codeOk),
            ],
          ),
        ),
      );

  Widget _disableForm() => TeamSectionCard(
        icon: Icons.shield_outlined,
        color: TeamColors.rose,
        title: 'Disable two-factor authentication',
        subtitle: 'Confirm with your password.',
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AppLabeledField(
                label: 'Password',
                hintText: 'Your account password',
                icon: Icons.lock_outline_rounded,
                iconColor: TeamColors.rose,
                controller: _password,
                obscureText: true,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 14),
              _actions(
                'Disable 2FA',
                _disable,
                enabled: _password.text.isNotEmpty,
              ),
            ],
          ),
        ),
      );
}
