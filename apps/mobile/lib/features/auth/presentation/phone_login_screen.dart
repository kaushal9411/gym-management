import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/tenant_branding.dart';
import '../../../repositories/auth_repository.dart';
import '../../../repositories/member_auth_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'phone_otp_screen.dart';

class PhoneLoginScreenArgs {
  const PhoneLoginScreenArgs({required this.role, required this.tenant});

  /// Inherited from whichever tab was active on [LoginScreen] — phone
  /// numbers can't self-disambiguate staff vs. member the way email/Member
  /// ID can, so there's no toggle here; the role is already decided.
  final AppRole role;
  final TenantBranding tenant;
}

/// Not a literal design frame — a second front door onto the same
/// `completeLoginAfterPrimaryFactor` cascade [LoginScreen] uses, reached via
/// "Log in with phone number instead". Staff hits
/// `POST /auth/phone-login/request-otp`, member hits
/// `POST /member/auth/phone-login/request-otp` — both always return 200
/// without revealing whether the phone number has a matching account (same
/// no-enumeration contract as [ForgotPasswordScreen]).
class PhoneLoginScreen extends StatefulWidget {
  const PhoneLoginScreen({super.key, required this.args});

  final PhoneLoginScreenArgs args;

  @override
  State<PhoneLoginScreen> createState() => _PhoneLoginScreenState();
}

class _PhoneLoginScreenState extends State<PhoneLoginScreen> {
  final _phoneController = TextEditingController();
  bool _loading = false;
  String? _error;

  bool get _isStaff => widget.args.role == AppRole.staff;

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final phone = _phoneController.text.trim();
    if (phone.isEmpty) {
      setState(() => _error = 'Enter your mobile number');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (_isStaff) {
        await getIt<AuthRepository>().requestPhoneOtp(phone: phone);
      } else {
        await getIt<MemberAuthRepository>().requestPhoneOtp(phone: phone);
      }
      if (!mounted) return;
      context.push(
        AppRoutes.phoneOtp,
        extra: PhoneOtpScreenArgs(
          phone: phone,
          role: widget.args.role,
          tenant: widget.args.tenant,
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = widget.args.role;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('Log in with phone'),
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Text(
                'We\'ll send a one-time code to the email on file for this number.',
                style: AppText.body(color: AppColors.inkSoft),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 22),
              AppCard(
                padding: const EdgeInsets.all(18),
                child: Column(
                  children: [
                    if (_error != null) ...[
                      FormAlert(message: _error!),
                      const SizedBox(height: 14),
                    ],
                    AppLabeledField(
                      label: 'Mobile number',
                      hintText: '9876543210',
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _submit(),
                    ),
                    const SizedBox(height: 16),
                    AppButton(
                      label: 'Send code',
                      role: role,
                      loading: _loading,
                      onPressed: _submit,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
