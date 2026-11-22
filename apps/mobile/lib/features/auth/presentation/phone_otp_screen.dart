import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart' show AppRole;
import '../../../models/phone_login_result.dart';
import '../../../models/staff_login_result.dart';
import '../../../models/tenant_branding.dart';
import '../../../repositories/public_tenant_repository.dart';
import 'auth_widgets.dart';
import 'staff_mfa_setup_screen.dart';
import 'staff_otp_screen.dart';

class PhoneOtpScreenArgs {
  const PhoneOtpScreenArgs({required this.phone});

  /// The 10 digits exactly as sent to `request-otp` (no country code).
  final String phone;
}

/// Step 2 of "Use phone number": the 6-digit code that was emailed. Same
/// visual system as [LoginScreen] (`auth_widgets.dart`) — glass digit boxes,
/// shimmering verify button, shake + haptic on a wrong code, resend countdown,
/// "Change number", and a drawn check-mark before the session starts.
///
/// Neither the gym nor the role is known up front: verify goes to the public
/// endpoint, which answers with the plane that matched (`staff` | `member`)
/// and the `tenantSlug` (already saved by the repository, so `X-Tenant-Slug`
/// is sent from then on). The gym's branding is then resolved and the flow
/// continues exactly as a normal login would — a staff result is the same
/// `StaffLoginResult` cascade [LoginScreen] handles (signed in / 2FA
/// challenge / mandatory MFA setup), a member result signs straight in.
class PhoneOtpScreen extends StatefulWidget {
  const PhoneOtpScreen({super.key, required this.args});

  final PhoneOtpScreenArgs args;

  @override
  State<PhoneOtpScreen> createState() => _PhoneOtpScreenState();
}

class _PhoneOtpScreenState extends State<PhoneOtpScreen>
    with TickerProviderStateMixin {
  static const _cooldownSeconds = 30;

  /// How long the "Verified" check is shown before the session starts.
  static const _successHold = Duration(milliseconds: 750);

  final _otpKey = GlobalKey<GlassOtpInputState>();

  late final AuthMotion _motion = AuthMotion(this);

  bool _verifying = false;
  bool _resending = false;
  bool _success = false;
  String? _error;
  Timer? _cooldownTimer;
  int _cooldown = 0;

  @override
  void initState() {
    super.initState();
    // The code was requested a moment ago on the previous screen.
    _startCooldown(notify: false);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _motion.syncReducedMotion(context);
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    _motion.dispose();
    super.dispose();
  }

  void _startCooldown({bool notify = true}) {
    _cooldownTimer?.cancel();
    if (notify) {
      setState(() => _cooldown = _cooldownSeconds);
    } else {
      _cooldown = _cooldownSeconds;
    }
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_cooldown <= 1) {
        t.cancel();
        setState(() => _cooldown = 0);
      } else {
        setState(() => _cooldown -= 1);
      }
    });
  }

  String get _prettyPhone {
    final p = widget.args.phone;
    return p.length == 10 ? '+91 ${p.substring(0, 5)} ${p.substring(5)}' : p;
  }

  Future<void> _verify(String code) async {
    if (_verifying || _success) return;
    setState(() {
      _verifying = true;
      _error = null;
    });
    try {
      final verified = await getIt<PublicTenantRepository>()
          .verifyPhoneOtp(phone: widget.args.phone, code: code);
      final tenant =
          await getIt<PublicTenantRepository>().resolve(verified.tenantSlug);
      if (!mounted) return;
      switch (verified) {
        case PhoneLoginStaff(:final result):
          await _continueStaff(result, tenant);
        case PhoneLoginMember(:final result):
          await _celebrate();
          if (!mounted) return;
          context.read<SessionCubit>().memberSignedIn(result.member, tenant);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      // Maintenance is not a form error — the app-wide Maintenance screen
      // takes over; show nothing here.
      if (e.isMaintenance) return;
      _otpKey.currentState?.clear();
      setState(() => _error = e.message);
      _motion.failFeedback(context);
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  Future<void> _continueStaff(
    StaffLoginResult result,
    TenantBranding tenant,
  ) async {
    switch (result) {
      case StaffLoginSuccess(:final user):
        await _celebrate();
        if (!mounted) return;
        context.read<SessionCubit>().staffSignedIn(user, tenant);
      case StaffOtpRequired(:final email, :final purpose):
        context.push(
          AppRoutes.otp,
          extra: StaffOtpScreenArgs(
            email: email,
            purpose: purpose,
            role: AppRole.staff,
            tenant: tenant,
          ),
        );
      case StaffMfaSetupRequired(:final email, :final setupToken):
        context.push(
          AppRoutes.mfaSetup,
          extra: StaffMfaSetupScreenArgs(
            setupToken: setupToken,
            email: email,
            role: AppRole.staff,
            tenant: tenant,
          ),
        );
    }
  }

  /// Shows the animated check for a beat before the session replaces this page.
  Future<void> _celebrate() async {
    if (!mounted) return;
    setState(() => _success = true);
    if (MediaQuery.of(context).disableAnimations) return;
    await Future<void>.delayed(_successHold);
  }

  /// The button for people who prefer it to the auto-submit on the 6th digit.
  void _submitButton() {
    final otp = _otpKey.currentState;
    if (otp != null && otp.isComplete) {
      _verify(otp.code);
      return;
    }
    setState(() => _error = 'Enter the 6-digit code from your email');
    _motion.failFeedback(context);
  }

  Future<void> _resend() async {
    setState(() {
      _resending = true;
      _error = null;
    });
    try {
      await getIt<PublicTenantRepository>()
          .requestPhoneOtp(phone: widget.args.phone);
      if (!mounted) return;
      _otpKey.currentState?.clear();
      _startCooldown();
    } on ApiException catch (e) {
      if (!mounted) return;
      // Maintenance is not a form error — the app-wide Maintenance screen
      // takes over; show nothing here.
      if (e.isMaintenance) return;
      setState(() => _error = e.message);
      _motion.failFeedback(context);
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  void _changeNumber() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.phoneLogin);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScene(
      motion: _motion,
      hero: AuthHero(
        pulse: _motion.aurora,
        title: _success ? 'Verified' : 'Enter your code',
        subtitle: _success
            ? 'Signing you in…'
            : 'We emailed a 6-digit code for $_prettyPhone',
        icon: _success
            ? Icons.verified_rounded
            : Icons.mark_email_unread_rounded,
      ),
      card: AuthGlassCard(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 320),
          switchInCurve: Curves.easeOutCubic,
          transitionBuilder: (child, anim) => FadeTransition(
            opacity: anim,
            child: ScaleTransition(
              scale: Tween(begin: 0.96, end: 1.0).animate(anim),
              child: child,
            ),
          ),
          child: _success ? _successBody() : _formBody(),
        ),
      ),
      footer: const AuthFooter(
        note: 'The code is emailed to the address on your account.\n'
            'It expires after a few minutes.',
      ),
    );
  }

  Widget _successBody() => const Padding(
        key: ValueKey('success'),
        padding: EdgeInsets.symmetric(vertical: 8),
        child: Center(child: AuthSuccessBadge(drawCheck: true)),
      );

  Widget _formBody() {
    return Column(
      key: const ValueKey('form'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthErrorSlot(message: _error),
        const AuthFieldLabel('6-digit code'),
        GlassOtpInput(
          key: _otpKey,
          hasError: _error != null,
          enabled: !_verifying,
          onCompleted: _verify,
        ),
        const SizedBox(height: 20),
        AuthButton(
          label: 'Verify & sign in',
          who: AuthWho.unknown,
          loading: _verifying,
          shimmer: _motion.shimmer,
          icon: Icons.check_rounded,
          onPressed: _verifying ? null : _submitButton,
        ),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(
              child: AuthLinkButton(
                label: _resending
                    ? 'Sending…'
                    : _cooldown > 0
                        ? 'Resend code in ${_cooldown}s'
                        : 'Resend code',
                icon: Icons.refresh_rounded,
                onTap: (_cooldown > 0 || _resending || _verifying)
                    ? null
                    : _resend,
              ),
            ),
            Flexible(
              child: AuthLinkButton(
                label: 'Change number',
                icon: Icons.edit_outlined,
                onTap: _verifying ? null : _changeNumber,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
