import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/mfa_setup.dart';
import '../../../models/tenant_branding.dart';
import '../../../repositories/auth_repository.dart';
import '../../../repositories/public_tenant_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/otp_input.dart';

class StaffMfaSetupScreenArgs {
  const StaffMfaSetupScreenArgs({
    required this.setupToken,
    required this.email,
    required this.role,
    required this.tenant,
  });

  final String setupToken;
  final String email;
  final AppRole role;
  final TenantBranding tenant;
}

/// Mandatory-2FA grace flow (`this.args.role`'s account requires 2FA and
/// hasn't set it up yet) — `POST /auth/mfa/setup/begin` then `/confirm`.
/// Not a literal design frame; built with the same component vocabulary.
class StaffMfaSetupScreen extends StatefulWidget {
  const StaffMfaSetupScreen({super.key, required this.args});

  final StaffMfaSetupScreenArgs args;

  @override
  State<StaffMfaSetupScreen> createState() => _StaffMfaSetupScreenState();
}

class _StaffMfaSetupScreenState extends State<StaffMfaSetupScreen> {
  final _otpKey = GlobalKey<OtpInputState>();
  MfaSetupChallenge? _challenge;
  String? _loadError;
  String? _confirmError;
  bool _confirming = false;

  @override
  void initState() {
    super.initState();
    _begin();
  }

  Future<void> _begin() async {
    setState(() => _loadError = null);
    try {
      final challenge = await getIt<AuthRepository>()
          .mfaSetupBegin(setupToken: widget.args.setupToken);
      if (!mounted) return;
      setState(() => _challenge = challenge);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _loadError = e.message);
    }
  }

  Future<void> _confirm(String code) async {
    setState(() {
      _confirming = true;
      _confirmError = null;
    });
    try {
      final result = await getIt<AuthRepository>()
          .mfaSetupConfirm(setupToken: widget.args.setupToken, code: code);
      if (!mounted) return;
      await _showBackupCodes(result.backupCodes);
      if (!mounted) return;
      // Find Gym no longer has a role toggle to remember this at — see its
      // doc comment. Idempotent (just re-records the same gym+role) on the
      // already-known-role path, so unconditional here is fine either way.
      try {
        await getIt<PublicTenantRepository>()
            .rememberGymForRole(widget.args.tenant, ActorType.staff);
      } catch (_) {
        // Best-effort — a storage failure shouldn't block a login that already succeeded.
      }
      if (!mounted) return;
      context
          .read<SessionCubit>()
          .staffSignedIn(result.login.user, widget.args.tenant);
    } on ApiException catch (e) {
      if (!mounted) return;
      _otpKey.currentState?.clear();
      setState(() => _confirmError = e.message);
    } finally {
      if (mounted) setState(() => _confirming = false);
    }
  }

  Future<void> _showBackupCodes(List<String> codes) {
    final role = widget.args.role;
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Save your backup codes'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Each code can be used once if you lose access to your authenticator.',
              style: AppText.body(color: AppColors.inkFaint),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 8,
              children: codes
                  .map(
                    (c) => Text(
                      c,
                      style: AppText.tabular(size: 13, weight: FontWeight.w700),
                    ),
                  )
                  .toList(),
            ),
          ],
        ),
        actions: [
          AppButton(
            label: 'I\'ve saved these codes',
            role: role,
            fullWidth: false,
            onPressed: () => Navigator.of(dialogContext).pop(),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.args.role;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(backgroundColor: AppColors.bg, elevation: 0),
      body: SafeArea(
        top: false,
        child: _loadError != null
            ? AppErrorView(message: _loadError!, role: role, onRetry: _begin)
            : _challenge == null
                ? AppLoadingView(role: role)
                : SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Column(
                      children: [
                        Text(
                          'Set up two-factor authentication',
                          style: AppText.display(size: 20),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Your role requires 2FA. Scan this code with an authenticator app.',
                          style: AppText.body(color: AppColors.inkSoft),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 22),
                        _QrCode(dataUrl: _challenge!.qrDataUrl),
                        const SizedBox(height: 14),
                        _SecretChip(secret: _challenge!.secret),
                        const SizedBox(height: 22),
                        AppCard(
                          padding: const EdgeInsets.all(18),
                          child: Column(
                            children: [
                              if (_confirmError != null) ...[
                                FormAlert(message: _confirmError!),
                                const SizedBox(height: 14),
                              ],
                              Text(
                                'Enter the 6-digit code from your app',
                                style: AppText.eyebrow(),
                              ),
                              const SizedBox(height: 12),
                              OtpInput(
                                key: _otpKey,
                                role: role,
                                onCompleted: _confirm,
                              ),
                              if (_confirming) ...[
                                const SizedBox(height: 16),
                                CircularProgressIndicator(
                                  color: role.b,
                                  strokeWidth: 2,
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
      ),
    );
  }
}

class _QrCode extends StatelessWidget {
  const _QrCode({required this.dataUrl});

  final String dataUrl;

  @override
  Widget build(BuildContext context) {
    final base64Part =
        dataUrl.contains(',') ? dataUrl.split(',').last : dataUrl;
    final bytes = base64Decode(base64Part);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      child:
          Image.memory(bytes, width: 180, height: 180, gaplessPlayback: true),
    );
  }
}

class _SecretChip extends StatelessWidget {
  const _SecretChip({required this.secret});

  final String secret;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        Clipboard.setData(ClipboardData(text: secret));
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Secret copied')));
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(secret, style: AppText.tabular(size: 13)),
            const SizedBox(width: 8),
            const Icon(Icons.copy_rounded, size: 14, color: AppColors.inkFaint),
          ],
        ),
      ),
    );
  }
}
