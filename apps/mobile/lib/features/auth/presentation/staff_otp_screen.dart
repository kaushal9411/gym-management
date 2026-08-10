import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/tenant_branding.dart';
import '../../../repositories/auth_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/brand_mark.dart';
import '../../../shared/widgets/otp_input.dart';

class StaffOtpScreenArgs {
  const StaffOtpScreenArgs({
    required this.email,
    required this.purpose,
    required this.role,
    required this.tenant,
  });

  final String email;
  final String purpose; // 'login' | '2fa'
  final AppRole role;
  final TenantBranding tenant;
}

/// Not present as a literal frame in the approved design doc (only
/// Splash/Find Gym/Login are) — built with the same component vocabulary
/// (glass card, gradient CTA, [OtpInput]) so it reads as part of the same
/// system rather than inventing a new one. Backs `POST /auth/verify-otp`.
class StaffOtpScreen extends StatefulWidget {
  const StaffOtpScreen({super.key, required this.args});

  final StaffOtpScreenArgs args;

  @override
  State<StaffOtpScreen> createState() => _StaffOtpScreenState();
}

class _StaffOtpScreenState extends State<StaffOtpScreen> {
  final _otpKey = GlobalKey<OtpInputState>();
  bool _verifying = false;
  bool _resending = false;
  String? _error;
  Timer? _cooldownTimer;
  int _cooldown = 0;

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    super.dispose();
  }

  void _startCooldown() {
    setState(() => _cooldown = 30);
    _cooldownTimer?.cancel();
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_cooldown <= 1) {
        t.cancel();
        setState(() => _cooldown = 0);
      } else {
        setState(() => _cooldown -= 1);
      }
    });
  }

  Future<void> _verify(String code) async {
    setState(() {
      _verifying = true;
      _error = null;
    });
    try {
      final result = await getIt<AuthRepository>().verifyOtp(
        email: widget.args.email,
        code: code,
        purpose: widget.args.purpose,
      );
      if (!mounted) return;
      context
          .read<SessionCubit>()
          .staffSignedIn(result.user, widget.args.tenant);
    } on ApiException catch (e) {
      if (!mounted) return;
      _otpKey.currentState?.clear();
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _resend() async {
    setState(() {
      _resending = true;
      _error = null;
    });
    try {
      await getIt<AuthRepository>()
          .resendOtp(email: widget.args.email, purpose: widget.args.purpose);
      _startCooldown();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.args.role;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(backgroundColor: AppColors.bg, elevation: 0),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              BrandMark.initials(
                initials: widget.args.tenant.initials,
                role: role,
                size: 60,
              ),
              const SizedBox(height: 18),
              Text(
                'Enter verification code',
                style: AppText.display(size: 22),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'We sent a 6-digit code to ${widget.args.email}',
                style: AppText.body(color: AppColors.inkSoft),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 26),
              AppCard(
                padding: const EdgeInsets.all(18),
                child: Column(
                  children: [
                    if (_error != null) ...[
                      FormAlert(message: _error!),
                      const SizedBox(height: 14),
                    ],
                    OtpInput(key: _otpKey, role: role, onCompleted: _verify),
                    if (_verifying) ...[
                      const SizedBox(height: 16),
                      CircularProgressIndicator(color: role.b, strokeWidth: 2),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 18),
              AppButton(
                label: _cooldown > 0
                    ? 'Resend code in ${_cooldown}s'
                    : 'Resend code',
                role: role,
                variant: AppButtonVariant.ghost,
                fullWidth: false,
                loading: _resending,
                onPressed: _cooldown > 0 ? null : _resend,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
