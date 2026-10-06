import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/staff_login_result.dart';
import '../../../models/tenant_branding.dart';
import '../../../repositories/auth_repository.dart';
import '../../../repositories/member_auth_repository.dart';
import '../../../repositories/public_tenant_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/brand_mark.dart';
import '../../../shared/widgets/otp_input.dart';
import 'staff_mfa_setup_screen.dart';
import 'staff_otp_screen.dart';

class PhoneOtpScreenArgs {
  const PhoneOtpScreenArgs({
    required this.phone,
    required this.role,
    required this.tenant,
  });

  final String phone;
  final AppRole role;
  final TenantBranding tenant;
}

/// Same component vocabulary as [StaffOtpScreen] (glass card, [OtpInput]),
/// but branches on role to two entirely different backends/sessions —
/// staff verification inherits the exact same `StaffLoginResult` cascade
/// [LoginScreen]'s `_submitStaff` pattern-matches (success / 2FA challenge /
/// mandatory-setup challenge), member verification always resolves to a
/// session directly (that plane has no OTP/2FA challenge of its own).
class PhoneOtpScreen extends StatefulWidget {
  const PhoneOtpScreen({super.key, required this.args});

  final PhoneOtpScreenArgs args;

  @override
  State<PhoneOtpScreen> createState() => _PhoneOtpScreenState();
}

class _PhoneOtpScreenState extends State<PhoneOtpScreen> {
  final _otpKey = GlobalKey<OtpInputState>();
  bool _verifying = false;
  bool _resending = false;
  String? _error;
  Timer? _cooldownTimer;
  int _cooldown = 0;

  bool get _isStaff => widget.args.role == AppRole.staff;

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

  Future<void> _rememberRole(ActorType actorType) async {
    try {
      await getIt<PublicTenantRepository>()
          .rememberGymForRole(widget.args.tenant, actorType);
    } catch (_) {
      // Best-effort — a storage failure shouldn't block a login that already succeeded.
    }
  }

  Future<void> _verify(String code) async {
    setState(() {
      _verifying = true;
      _error = null;
    });
    try {
      if (_isStaff) {
        await _verifyStaff(code);
      } else {
        await _verifyMember(code);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      _otpKey.currentState?.clear();
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _verifyStaff(String code) async {
    final result = await getIt<AuthRepository>()
        .verifyPhoneOtp(phone: widget.args.phone, code: code);
    if (!mounted) return;
    switch (result) {
      case StaffLoginSuccess(:final user):
        await _rememberRole(ActorType.staff);
        if (!mounted) return;
        context.read<SessionCubit>().staffSignedIn(user, widget.args.tenant);
      case StaffOtpRequired(:final email, :final purpose):
        context.push(
          AppRoutes.otp,
          extra: StaffOtpScreenArgs(
            email: email,
            purpose: purpose,
            role: AppRole.staff,
            tenant: widget.args.tenant,
          ),
        );
      case StaffMfaSetupRequired(:final email, :final setupToken):
        context.push(
          AppRoutes.mfaSetup,
          extra: StaffMfaSetupScreenArgs(
            setupToken: setupToken,
            email: email,
            role: AppRole.staff,
            tenant: widget.args.tenant,
          ),
        );
    }
  }

  Future<void> _verifyMember(String code) async {
    final result = await getIt<MemberAuthRepository>()
        .verifyPhoneOtp(phone: widget.args.phone, code: code);
    if (!mounted) return;
    await _rememberRole(ActorType.member);
    if (!mounted) return;
    context
        .read<SessionCubit>()
        .memberSignedIn(result.member, widget.args.tenant);
  }

  Future<void> _resend() async {
    setState(() {
      _resending = true;
      _error = null;
    });
    try {
      if (_isStaff) {
        await getIt<AuthRepository>()
            .resendPhoneOtp(phone: widget.args.phone);
      } else {
        await getIt<MemberAuthRepository>()
            .resendPhoneOtp(phone: widget.args.phone);
      }
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
                'We sent a 6-digit code to the email on file for ${widget.args.phone}',
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
