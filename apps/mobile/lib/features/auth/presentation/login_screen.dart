import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../core/theme/app_colors.dart' show AppRole;
import '../../../models/staff_login_result.dart';
import '../../../models/tenant_branding.dart';
import '../../../repositories/auth_repository.dart';
import '../../../repositories/member_auth_repository.dart';
import '../../../repositories/public_tenant_repository.dart';
import 'auth_widgets.dart';
import 'forgot_password_screen.dart';
import 'gym_picker_sheet.dart';
import 'staff_mfa_setup_screen.dart';
import 'staff_otp_screen.dart';

/// The single front door for staff AND members. There is no role toggle and
/// no gym picker before it: type an email or a Member ID, add the password,
/// and on submit [PublicTenantRepository.discoverGyms] finds which gym(s)
/// those credentials belong to. Exactly one gym → it is resolved (branding +
/// plan) and the real login proceeds straight away; more than one → the gym
/// picker sheet ([showGymPicker]) is shown with just those gyms. Staff and members
/// then land in their own shells via [SessionCubit], as before.
///
/// Look: one neutral FitCloud scene — a slow aurora that blends BOTH role
/// palettes (coral/violet for staff, lime/teal for members), because this is
/// the one screen they share. Only the small "who" chip, the focus ring and
/// the button pick up the detected role's colour, as live feedback.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with TickerProviderStateMixin {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  final _identifierFocus = FocusNode();
  final _passwordFocus = FocusNode();

  late final AuthMotion _motion = AuthMotion(this);

  bool _loading = false;
  bool _obscure = true;
  String? _formError;
  String? _identifierError;
  String? _passwordError;

  AuthWho get _who => AuthWho.detect(_identifierController.text);

  bool get _isStaff => _who != AuthWho.member;

  @override
  void initState() {
    super.initState();
    _identifierController.addListener(() => setState(() {}));
    _identifierFocus.addListener(() => setState(() {}));
    _passwordFocus.addListener(() => setState(() {}));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _motion.syncReducedMotion(context);
  }

  @override
  void dispose() {
    _motion.dispose();
    _identifierController.dispose();
    _passwordController.dispose();
    _identifierFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final identifier = _identifierController.text.trim();
    final password = _passwordController.text;
    if (identifier.isEmpty || password.isEmpty) {
      setState(() {
        _formError = null;
        _identifierError =
            identifier.isEmpty ? 'Enter your email or Member ID' : null;
        _passwordError = password.isEmpty ? 'Enter your password' : null;
      });
      _motion.failFeedback(context);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _formError = null;
      _identifierError = null;
      _passwordError = null;
    });
    final isStaff = _isStaff;
    try {
      final tenant = await _resolveGym(identifier, password, isStaff);
      if (tenant == null || !mounted) return;
      if (isStaff) {
        await _submitStaff(tenant, identifier, password);
      } else {
        await _submitMember(tenant, identifier, password);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      // Maintenance is not a form error — the app-wide Maintenance screen
      // takes over; show nothing here.
      if (e.isMaintenance) return;
      setState(() {
        // The backend's errors[] isn't always field-scoped — e.g.
        // INVALID_CREDENTIALS carries one entry with `field: null`. Only
        // suppress the banner when a field-specific message is shown inline.
        _identifierError = e.errorFor(isStaff ? 'email' : 'memberId');
        _passwordError = e.errorFor('password');
        _formError = (_identifierError == null && _passwordError == null)
            ? e.message
            : null;
      });
      _motion.failFeedback(context);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Works out which gym this login is for. One match → resolved silently
  /// (this is also what loads the gym's branding/plan the session needs);
  /// several → the user chooses in the [showGymPicker] sheet. Returns null if they
  /// back out of that choice.
  Future<TenantBranding?> _resolveGym(
    String identifier,
    String password,
    bool isStaff,
  ) async {
    final repo = getIt<PublicTenantRepository>();
    final gyms = await repo.discoverGyms(
      actorType: isStaff ? ActorType.staff : ActorType.member,
      identifier: identifier,
      password: password,
    );
    if (gyms.length == 1) return repo.resolve(gyms.first.slug);
    if (!mounted) return null;
    return showGymPicker(context, gyms: gyms);
  }

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
    context.read<SessionCubit>().memberSignedIn(result.member, tenant);
  }

  /// No gym is asked for here — the public forgot-password endpoint works
  /// from the identifier alone.
  void _forgotPassword() {
    context.push(
      AppRoutes.forgotPassword,
      extra: ForgotPasswordScreenArgs(
        prefill: _identifierController.text.trim(),
      ),
    );
  }

  /// No gym is asked for here either — it is learnt when the code is verified.
  void _loginWithPhone() {
    context.push(AppRoutes.phoneLogin);
  }

  @override
  Widget build(BuildContext context) {
    final who = _who;
    return AuthScene(
      motion: _motion,
      hero: AuthHero(pulse: _motion.aurora),
      card: _glassCard(who),
      footer: const AuthFooter(
        note: 'Gym staff sign in with their work email.\n'
            'Members sign in with their Member ID — ask the front desk.',
      ),
    );
  }

  Widget _glassCard(AuthWho who) {
    final accent = who.accent;
    return AuthGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AuthErrorSlot(message: _formError),
          GlassField(
            controller: _identifierController,
            focusNode: _identifierFocus,
            label: 'Email or Member ID',
            hint: 'you@gym.com  ·  MEM-0001',
            accent: accent,
            errorText: _identifierError,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.username],
            leading: AnimatedSwitcher(
              duration: const Duration(milliseconds: 260),
              transitionBuilder: (child, anim) => ScaleTransition(
                scale: anim,
                child: FadeTransition(opacity: anim, child: child),
              ),
              child: Icon(
                who == AuthWho.staff
                    ? Icons.alternate_email_rounded
                    : who == AuthWho.member
                        ? Icons.badge_outlined
                        : Icons.person_outline_rounded,
                key: ValueKey(who),
                size: 20,
              ),
            ),
          ),
          const SizedBox(height: 10),
          WhoChip(who: who),
          const SizedBox(height: 14),
          GlassField(
            controller: _passwordController,
            focusNode: _passwordFocus,
            label: 'Password',
            hint: 'Your password',
            accent: accent,
            errorText: _passwordError,
            obscure: _obscure,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.password],
            onSubmitted: (_) => _submit(),
            leading: const Icon(Icons.lock_outline_rounded, size: 20),
            trailing: IconButton(
              splashRadius: 18,
              onPressed: () => setState(() => _obscure = !_obscure),
              icon: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: Icon(
                  _obscure
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  key: ValueKey(_obscure),
                  size: 20,
                  color: Colors.white.withValues(alpha: 0.6),
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          AuthButton(
            label: 'Sign in',
            who: who,
            loading: _loading,
            shimmer: _motion.shimmer,
            onPressed: _loading ? null : _submit,
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: AuthLinkButton(
                  label: 'Forgot password?',
                  onTap: _forgotPassword,
                ),
              ),
              Flexible(
                child: AuthLinkButton(
                  label: 'Use phone number',
                  icon: Icons.sms_outlined,
                  onTap: _loginWithPhone,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
