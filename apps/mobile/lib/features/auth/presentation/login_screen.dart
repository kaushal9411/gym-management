import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/staff_login_result.dart';
import '../../../models/tenant_branding.dart';
import '../../../repositories/auth_repository.dart';
import '../../../repositories/member_auth_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/brand_mark.dart';
import 'forgot_password_screen.dart';
import 'staff_mfa_setup_screen.dart';
import 'staff_otp_screen.dart';

class LoginScreenArgs {
  const LoginScreenArgs({required this.role, required this.tenant});

  final AppRole role;
  final TenantBranding tenant;
}

/// Design frame "3. Login" — staff (work email + password) and member
/// (Member ID + password) variants, both against `kaushalgym`'s resolved
/// branding from the previous screen.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.args});

  final LoginScreenArgs args;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  String? _formError;
  String? _identifierError;
  String? _passwordError;

  bool get _isStaff => widget.args.role == AppRole.staff;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final identifier = _identifierController.text.trim();
    final password = _passwordController.text;
    setState(() {
      _loading = true;
      _formError = null;
      _identifierError = null;
      _passwordError = null;
    });
    try {
      if (_isStaff) {
        await _submitStaff(identifier, password);
      } else {
        await _submitMember(identifier, password);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        // The backend's errors[] isn't always field-scoped — e.g.
        // INVALID_CREDENTIALS carries one entry with `field: null` (it
        // isn't specifically an "email" or "password" problem, it's a
        // general one). Only suppress the banner when we actually found a
        // field-specific message to show inline instead of it.
        _identifierError = e.errorFor(_isStaff ? 'email' : 'memberId');
        _passwordError = e.errorFor('password');
        _formError = (_identifierError == null && _passwordError == null)
            ? e.message
            : null;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitStaff(String email, String password) async {
    final result =
        await getIt<AuthRepository>().login(email: email, password: password);
    if (!mounted) return;
    switch (result) {
      case StaffLoginSuccess(:final user):
        context.read<SessionCubit>().staffSignedIn(user, widget.args.tenant);
      case StaffOtpRequired(:final email, :final purpose):
        context.push(
          AppRoutes.otp,
          extra: StaffOtpScreenArgs(
            email: email,
            purpose: purpose,
            role: widget.args.role,
            tenant: widget.args.tenant,
          ),
        );
      case StaffMfaSetupRequired(:final email, :final setupToken):
        context.push(
          AppRoutes.mfaSetup,
          extra: StaffMfaSetupScreenArgs(
            setupToken: setupToken,
            email: email,
            role: widget.args.role,
            tenant: widget.args.tenant,
          ),
        );
    }
  }

  Future<void> _submitMember(String memberId, String password) async {
    final result = await getIt<MemberAuthRepository>()
        .login(memberId: memberId, password: password);
    if (!mounted) return;
    context
        .read<SessionCubit>()
        .memberSignedIn(result.member, widget.args.tenant);
  }

  void _changeGym() => context.pop();

  void _forgotPassword() => context.push(
        AppRoutes.forgotPassword,
        extra: ForgotPasswordScreenArgs(
          role: widget.args.role,
          tenant: widget.args.tenant,
          prefill: _identifierController.text.trim(),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final role = widget.args.role;
    final tenant = widget.args.tenant;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            children: [
              BrandMark.initials(
                initials: tenant.initials,
                role: role,
                size: 68,
              ),
              const SizedBox(height: 12),
              Text(
                tenant.name,
                style: AppText.display(size: 22),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              GestureDetector(
                onTap: _changeGym,
                child: RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: '${tenant.slug}.fitcloud.app  ·  ',
                        style: AppText.eyebrow(),
                      ),
                      TextSpan(
                        text: 'Change',
                        style: AppText.eyebrow(color: role.pillFg),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              AppCard(
                padding: const EdgeInsets.all(18),
                child: Column(
                  children: [
                    if (_formError != null) ...[
                      FormAlert(message: _formError!),
                      const SizedBox(height: 14),
                    ],
                    AppLabeledField(
                      label: _isStaff ? 'Work email' : 'Member ID',
                      controller: _identifierController,
                      keyboardType: _isStaff
                          ? TextInputType.emailAddress
                          : TextInputType.text,
                      textCapitalization: _isStaff
                          ? TextCapitalization.none
                          : TextCapitalization.characters,
                      autofillHints:
                          _isStaff ? const [AutofillHints.email] : null,
                      errorText: _identifierError,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    AppLabeledField(
                      label: 'Password',
                      controller: _passwordController,
                      obscureText: true,
                      autofillHints: const [AutofillHints.password],
                      errorText: _passwordError,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _submit(),
                    ),
                    const SizedBox(height: 16),
                    AppButton(
                      label: 'Sign in',
                      role: role,
                      loading: _loading,
                      onPressed: _submit,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: _forgotPassword,
                child: Text(
                  'Forgot password?',
                  style: AppText.body(
                    size: 12,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              if (!_isStaff) ...[
                const SizedBox(height: 6),
                Text(
                  'Ask front desk for your Member ID',
                  style: AppText.body(
                    size: 12,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
