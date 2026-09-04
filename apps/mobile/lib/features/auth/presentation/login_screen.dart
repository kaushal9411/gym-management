import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

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
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/brand_mark.dart';
import '../../../shared/widgets/role_toggle.dart';
import 'forgot_password_screen.dart';
import 'staff_mfa_setup_screen.dart';
import 'staff_otp_screen.dart';

class LoginScreenArgs {
  const LoginScreenArgs({this.role, required this.tenant});

  /// Initial tab selection only — the [RoleToggle] on this screen lets the
  /// user change it freely either way. `null` (a fresh Find Gym pick, which
  /// no longer has its own toggle — see that screen's doc comment) defaults
  /// to Staff. Non-null for the "send a returning user straight to Login"
  /// remembered-gym path (`SessionCubit`/`AppRouter`), so a returning user
  /// lands on the tab they actually used last time.
  final AppRole? role;
  final TenantBranding tenant;
}

/// Design frame "3. Login" — staff (work email + password) and member
/// (Member ID + password) variants, both against `kaushalgym`'s resolved
/// branding from the previous screen. The [RoleToggle] picking between them
/// lives here (moved from Find Gym, which now just resolves a gym — see
/// that screen's doc comment) so switching roles doesn't need a round trip
/// back through Find Gym.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.args});

  final LoginScreenArgs args;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  late AppRole _role = widget.args.role ?? AppRole.staff;
  bool _loading = false;
  String? _formError;
  String? _identifierError;
  String? _passwordError;

  bool get _isStaff => _role == AppRole.staff;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  /// Switching roles mid-screen is new (the toggle used to live one screen
  /// earlier, before either field existed) — clears both fields/errors so
  /// e.g. a half-typed email doesn't linger under the Member tab.
  void _changeRole(AppRole role) {
    if (role == _role) return;
    setState(() {
      _role = role;
      _identifierController.clear();
      _passwordController.clear();
      _formError = null;
      _identifierError = null;
      _passwordError = null;
    });
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
    final isStaff = _isStaff;
    try {
      if (isStaff) {
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
        _identifierError = e.errorFor(isStaff ? 'email' : 'memberId');
        _passwordError = e.errorFor('password');
        _formError = (_identifierError == null && _passwordError == null)
            ? e.message
            : null;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Records the gym+role for the "send a returning user straight to
  /// Login" memory — Find Gym no longer has a toggle to do this at
  /// resolve-time (see that screen's doc comment), so it's recorded here
  /// instead, once a real login actually succeeds. Always called (even on
  /// the already-remembered path) since it's idempotent — just re-records
  /// the same gym+role — and simpler than tracking whether this was fresh.
  /// Best-effort; a storage failure here shouldn't block a login that
  /// already succeeded.
  Future<void> _rememberRole(ActorType actorType) async {
    try {
      await getIt<PublicTenantRepository>()
          .rememberGymForRole(widget.args.tenant, actorType);
    } catch (_) {
      // Best-effort only — see doc comment above.
    }
  }

  Future<void> _submitStaff(String email, String password) async {
    final result =
        await getIt<AuthRepository>().login(email: email, password: password);
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

  Future<void> _submitMember(String memberId, String password) async {
    final result = await getIt<MemberAuthRepository>()
        .login(memberId: memberId, password: password);
    if (!mounted) return;
    await _rememberRole(ActorType.member);
    if (!mounted) return;
    context
        .read<SessionCubit>()
        .memberSignedIn(result.member, widget.args.tenant);
  }

  /// Explicit gym switch — clears the in-memory remembered gym/role (not
  /// storage; see `SessionCubit.startGymChange`) and navigates rather than
  /// popping, since this screen may have been reached directly via the
  /// remembered-gym redirect with nothing underneath it on the stack.
  void _changeGym() {
    context.read<SessionCubit>().startGymChange();
    context.go(AppRoutes.findGym);
  }

  void _forgotPassword() => context.push(
        AppRoutes.forgotPassword,
        extra: ForgotPasswordScreenArgs(
          role: _role,
          tenant: widget.args.tenant,
          prefill: _identifierController.text.trim(),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final role = _role;
    final tenant = widget.args.tenant;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            children: [
              RoleToggle(value: _role, onChanged: _changeRole),
              const SizedBox(height: 20),
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
                      hintText: _isStaff ? 'you@gym.com' : 'MEM-0001',
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
                      hintText: 'Enter your password',
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
