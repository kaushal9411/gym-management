import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../repositories/public_tenant_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/role_toggle.dart';
import 'phone_otp_screen.dart';

class PhoneLoginScreenArgs {
  const PhoneLoginScreenArgs({required this.role});

  /// Inherited from whichever tab was active on [LoginScreen] — phone
  /// numbers can't self-disambiguate staff vs. member the way email/Member
  /// ID can, so there's no toggle here; the role is already decided.
  final AppRole role;
}

/// Not a literal design frame — a second front door onto the same
/// `completeLoginAfterPrimaryFactor` cascade [LoginScreen] uses, reached via
/// "Log in with phone number instead". No gym is asked for: the
/// [RoleToggle] picks `actorType` and
/// `POST /public/auth/phone-login/request-otp` always returns 200 without
/// revealing whether the phone number has a matching account (same
/// no-enumeration contract as [ForgotPasswordScreen]). The gym is only learnt
/// at verify time (see [PhoneOtpScreen]).
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

  late AppRole _role = widget.args.role;

  bool get _isStaff => _role == AppRole.staff;

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
      await getIt<PublicTenantRepository>().requestPhoneOtp(
        actorType: _isStaff ? ActorType.staff : ActorType.member,
        phone: phone,
      );
      if (!mounted) return;
      context.push(
        AppRoutes.phoneOtp,
        extra: PhoneOtpScreenArgs(phone: phone, role: _role),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      // Maintenance is not a form error — the app-wide Maintenance screen
      // takes over; show nothing here.
      if (e.isMaintenance) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = _role;
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
              RoleToggle(
                value: _role,
                onChanged: (r) => setState(() => _role = r),
              ),
              const SizedBox(height: 16),
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
