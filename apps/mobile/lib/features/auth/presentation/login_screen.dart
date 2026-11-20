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
import 'find_gym_screen.dart';
import 'forgot_password_screen.dart';
import 'phone_login_screen.dart';
import 'staff_mfa_setup_screen.dart';
import 'staff_otp_screen.dart';

class LoginScreenArgs {
  const LoginScreenArgs({this.role});

  /// Initial tab selection only — the [RoleToggle] on this screen lets the
  /// user change it freely either way. `null` defaults to Staff. Set from
  /// the role this device last signed in as (`SessionCubit`), so a returning
  /// member lands on the Member tab.
  final AppRole? role;
}

/// The first screen of the signed-out flow — staff (work email + password)
/// and member (Member ID + password) variants. There is no gym picker before
/// it: on submit, [PublicTenantRepository.discoverGyms] finds which gym(s)
/// those credentials belong to. Exactly one gym → it is resolved (branding +
/// plan) and the real login proceeds straight away; more than one → the
/// gym picker ([FindGymScreen]) is shown with just those gyms.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.args = const LoginScreenArgs()});

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
      final tenant = await _resolveGym(identifier, password);
      if (tenant == null || !mounted) return;
      if (isStaff) {
        await _submitStaff(tenant, identifier, password);
      } else {
        await _submitMember(tenant, identifier, password);
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
  Future<void> _rememberRole(
    TenantBranding tenant,
    ActorType actorType,
  ) async {
    try {
      await getIt<PublicTenantRepository>()
          .rememberGymForRole(tenant, actorType);
    } catch (_) {
      // Best-effort only — see doc comment above.
    }
  }

  /// Works out which gym this login is for. One match → resolved silently
  /// (this is also what loads the gym's branding/plan the session needs);
  /// several → the user chooses on [FindGymScreen]. Returns null if they
  /// back out of that choice.
  Future<TenantBranding?> _resolveGym(
    String identifier,
    String password,
  ) async {
    final repo = getIt<PublicTenantRepository>();
    final gyms = await repo.discoverGyms(
      actorType: _isStaff ? ActorType.staff : ActorType.member,
      identifier: identifier,
      password: password,
    );
    if (gyms.length == 1) return repo.resolve(gyms.first.slug);
    if (!mounted) return null;
    return context.push<TenantBranding>(
      AppRoutes.findGym,
      extra: FindGymScreenArgs(gyms: gyms),
    );
  }

  /// "Forgot password" and "Log in with phone number" need a gym before any
  /// credentials exist to discover one from, so they still ask — every active
  /// gym, via [FindGymScreen]. Null if the user backs out.
  Future<TenantBranding?> _pickAnyGym() =>
      context.push<TenantBranding>(AppRoutes.findGym);

  Future<void> _submitStaff(
    TenantBranding tenant,
    String email,
    String password,
  ) async {
    final result =
        await getIt<AuthRepository>().login(email: email, password: password);
    if (!mounted) return;
    switch (result) {
      case StaffLoginSuccess(:final user):
        await _rememberRole(tenant, ActorType.staff);
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

  Future<void> _submitMember(
    TenantBranding tenant,
    String memberId,
    String password,
  ) async {
    final result = await getIt<MemberAuthRepository>()
        .login(memberId: memberId, password: password);
    if (!mounted) return;
    await _rememberRole(tenant, ActorType.member);
    if (!mounted) return;
    context.read<SessionCubit>().memberSignedIn(result.member, tenant);
  }

  Future<void> _forgotPassword() async {
    final tenant = await _pickAnyGym();
    if (tenant == null || !mounted) return;
    context.push(
      AppRoutes.forgotPassword,
      extra: ForgotPasswordScreenArgs(
        role: _role,
        tenant: tenant,
        prefill: _identifierController.text.trim(),
      ),
    );
  }

  Future<void> _loginWithPhone() async {
    final tenant = await _pickAnyGym();
    if (tenant == null || !mounted) return;
    context.push(
      AppRoutes.phoneLogin,
      extra: PhoneLoginScreenArgs(role: _role, tenant: tenant),
    );
  }

  @override
  Widget build(BuildContext context) {
    final role = _role;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            children: [
              RoleToggle(value: _role, onChanged: _changeRole),
              const SizedBox(height: 20),
              BrandMark.glyph(role: role, size: 68),
              const SizedBox(height: 12),
              Text(
                'Welcome back',
                style: AppText.display(size: 22),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                _isStaff
                    ? 'Sign in with your work email'
                    : 'Sign in with your Member ID',
                style: AppText.body(color: AppColors.inkSoft),
                textAlign: TextAlign.center,
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
                    const SizedBox(height: 10),
                    AppButton(
                      label: 'Log in with phone number instead',
                      role: role,
                      variant: AppButtonVariant.ghost,
                      onPressed: _loginWithPhone,
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
