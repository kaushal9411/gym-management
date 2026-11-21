import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import 'forgot_password_screen.dart';
import 'gym_picker_sheet.dart';
import 'phone_login_screen.dart';
import 'staff_mfa_setup_screen.dart';
import 'staff_otp_screen.dart';

/// Who the typed identifier belongs to — the one field everyone uses. An
/// email is staff, anything else (a Member ID like `MEM-0007`) is a member;
/// same "@" rule the web app's unified login uses.
enum _Who { unknown, staff, member }

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
  static const _base = Color(0xFF0B0813);

  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  final _identifierFocus = FocusNode();
  final _passwordFocus = FocusNode();

  /// Slow loop that drives the aurora.
  late final AnimationController _aurora =
      AnimationController(vsync: this, duration: const Duration(seconds: 26));

  /// One-shot staggered entrance.
  late final AnimationController _intro = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  /// Brief horizontal shake when a sign-in fails.
  late final AnimationController _shake = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 460),
  );

  /// Shimmer sweeping across the sign-in button while it's idle.
  late final AnimationController _shimmer = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2600),
  );

  bool _loading = false;
  bool _obscure = true;
  String? _formError;
  String? _identifierError;
  String? _passwordError;
  bool _motionStarted = false;

  _Who get _who {
    final t = _identifierController.text.trim();
    if (t.isEmpty) return _Who.unknown;
    return t.contains('@') ? _Who.staff : _Who.member;
  }

  bool get _isStaff => _who != _Who.member;

  @override
  void initState() {
    super.initState();
    _intro.forward();
    _identifierController.addListener(() => setState(() {}));
    _identifierFocus.addListener(() => setState(() {}));
    _passwordFocus.addListener(() => setState(() {}));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Respect the OS "reduce motion" setting: no looping background, no shimmer.
    final reduce = MediaQuery.of(context).disableAnimations;
    if (reduce) {
      _aurora.stop();
      _shimmer.stop();
      _intro.value = 1;
      _motionStarted = false;
    } else if (!_motionStarted) {
      _aurora.repeat();
      _shimmer.repeat();
      _motionStarted = true;
    }
  }

  @override
  void dispose() {
    _aurora.dispose();
    _intro.dispose();
    _shake.dispose();
    _shimmer.dispose();
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
      _failFeedback();
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
      _failFeedback();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Shake + a short haptic tick so a failed sign-in is felt, not just read.
  void _failFeedback() {
    HapticFeedback.mediumImpact();
    if (!MediaQuery.of(context).disableAnimations) _shake.forward(from: 0);
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
        role: _isStaff ? AppRole.staff : AppRole.member,
        prefill: _identifierController.text.trim(),
      ),
    );
  }

  /// No gym is asked for here either — it is learnt when the code is verified.
  void _loginWithPhone() {
    context.push(
      AppRoutes.phoneLogin,
      extra: PhoneLoginScreenArgs(
        role: _isStaff ? AppRole.staff : AppRole.member,
      ),
    );
  }

  // ── staggered entrance helpers ────────────────────────────────────────
  Animation<double> _step(double from, double to) => CurvedAnimation(
        parent: _intro,
        curve: Interval(from, to, curve: Curves.easeOutCubic),
      );

  Widget _reveal(Animation<double> a, Widget child, {double dy = 26}) =>
      AnimatedBuilder(
        animation: a,
        child: child,
        builder: (context, child) => Opacity(
          opacity: a.value,
          child: Transform.translate(
            offset: Offset(0, (1 - a.value) * dy),
            child: child,
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final who = _who;
    return Scaffold(
      backgroundColor: _base,
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          Positioned.fill(
            child: RepaintBoundary(
              child: AnimatedBuilder(
                animation: _aurora,
                builder: (context, _) =>
                    CustomPaint(painter: _AuroraPainter(_aurora.value)),
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 22, vertical: 28),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _reveal(_step(0.0, 0.5), _Hero(pulse: _aurora), dy: 18),
                      const SizedBox(height: 26),
                      _reveal(
                        _step(0.2, 0.75),
                        AnimatedBuilder(
                          animation: _shake,
                          builder: (context, child) {
                            final t = _shake.value;
                            final dx = math.sin(t * math.pi * 5) * 11 * (1 - t);
                            return Transform.translate(
                              offset: Offset(dx, 0),
                              child: child,
                            );
                          },
                          child: _glassCard(who),
                        ),
                      ),
                      const SizedBox(height: 18),
                      _reveal(_step(0.55, 1.0), _footer(), dy: 12),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _glassCard(_Who who) {
    final accent = _accentFor(who);
    return ClipRRect(
      borderRadius: BorderRadius.circular(30),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 26, sigmaY: 26),
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.white.withValues(alpha: 0.13),
                Colors.white.withValues(alpha: 0.03),
              ],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AnimatedSize(
                duration: const Duration(milliseconds: 260),
                curve: Curves.easeOutCubic,
                alignment: Alignment.topCenter,
                child: _formError == null
                    ? const SizedBox(width: double.infinity)
                    : Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: _ErrorBanner(message: _formError!),
                      ),
              ),
              _GlassField(
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
                    who == _Who.staff
                        ? Icons.alternate_email_rounded
                        : who == _Who.member
                            ? Icons.badge_outlined
                            : Icons.person_outline_rounded,
                    key: ValueKey(who),
                    size: 20,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              _WhoChip(who: who),
              const SizedBox(height: 14),
              _GlassField(
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
              _SignInButton(
                who: who,
                loading: _loading,
                shimmer: _shimmer,
                onPressed: _loading ? null : _submit,
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: _LinkButton(
                      label: 'Forgot password?',
                      onTap: _forgotPassword,
                    ),
                  ),
                  Flexible(
                    child: _LinkButton(
                      label: 'Use phone number',
                      icon: Icons.sms_outlined,
                      onTap: _loginWithPhone,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _footer() => Column(
        children: [
          Text(
            'Gym staff sign in with their work email.\n'
            'Members sign in with their Member ID — ask the front desk.',
            textAlign: TextAlign.center,
            style: AppText.body(
              size: 12.5,
              color: Colors.white.withValues(alpha: 0.55),
              weight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'POWERED BY FITCLOUD',
            style: AppText.body(
              size: 10.5,
              color: Colors.white.withValues(alpha: 0.32),
              weight: FontWeight.w800,
            ),
          ),
        ],
      );

  static Color _accentFor(_Who who) => switch (who) {
        _Who.staff => AppColors.staffA,
        _Who.member => AppColors.memberA,
        _Who.unknown => const Color(0xFFB7A6FF),
      };
}

// ─────────────────────────────────────────────────────────────────────────────
// Background
// ─────────────────────────────────────────────────────────────────────────────

typedef _Blob = ({
  Color color,
  double fx,
  double fy,
  double px,
  double py,
  double r,
});

/// Four slow-moving colour blooms — coral, violet, lime, teal — drifting on
/// out-of-phase Lissajous paths over a near-black base. Both role palettes
/// live in the same sky because both roles share this screen.
class _AuroraPainter extends CustomPainter {
  _AuroraPainter(this.t);

  final double t;

  static const List<_Blob> _blobs = [
    (color: AppColors.staffA, fx: 1, fy: 2, px: 0.0, py: 0.4, r: 0.78),
    (color: AppColors.staffB, fx: 2, fy: 1, px: 1.7, py: 0.0, r: 0.9),
    (color: AppColors.memberB, fx: 1, fy: 3, px: 3.1, py: 2.2, r: 0.8),
    (color: AppColors.memberA, fx: 3, fy: 2, px: 4.6, py: 1.1, r: 0.55),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(
      Offset.zero & size,
      Paint()..color = const Color(0xFF0B0813),
    );
    final a = t * math.pi * 2;
    for (final b in _blobs) {
      final cx = size.width * (0.5 + 0.42 * math.sin(a * b.fx + b.px));
      final cy = size.height * (0.5 + 0.40 * math.cos(a * b.fy + b.py));
      final radius = size.longestSide * b.r * 0.55;
      final paint = Paint()
        ..shader = RadialGradient(
          colors: [
            b.color.withValues(alpha: 0.42),
            b.color.withValues(alpha: 0.12),
            b.color.withValues(alpha: 0),
          ],
          stops: const [0, 0.5, 1],
        ).createShader(Rect.fromCircle(center: Offset(cx, cy), radius: radius));
      canvas.drawCircle(Offset(cx, cy), radius, paint);
    }
    // Vignette so the card and text stay readable on every frame.
    canvas.drawRect(
      Offset.zero & size,
      Paint()
        ..shader = RadialGradient(
          radius: 1.1,
          colors: [
            Colors.transparent,
            const Color(0xFF0B0813).withValues(alpha: 0.72),
          ],
          stops: const [0.35, 1],
        ).createShader(Offset.zero & size),
    );
  }

  @override
  bool shouldRepaint(_AuroraPainter old) => old.t != t;
}

/// Logo with a breathing glow + wordmark and the two-audience tagline.
class _Hero extends StatelessWidget {
  const _Hero({required this.pulse});

  final Animation<double> pulse;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AnimatedBuilder(
          animation: pulse,
          builder: (context, _) {
            final breathe = 0.5 + 0.5 * math.sin(pulse.value * math.pi * 2 * 6);
            return Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(26),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    AppColors.staffA,
                    AppColors.staffB,
                    AppColors.memberB,
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.staffB
                        .withValues(alpha: 0.35 + 0.25 * breathe),
                    blurRadius: 30 + 22 * breathe,
                    spreadRadius: 1 + 3 * breathe,
                  ),
                ],
              ),
              alignment: Alignment.center,
              child: const Icon(
                Icons.fitness_center_rounded,
                color: Colors.white,
                size: 40,
              ),
            );
          },
        ),
        const SizedBox(height: 18),
        Text(
          'Welcome back',
          style: AppText.display(size: 32, color: Colors.white),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 6),
        Text(
          'One sign-in for staff and members',
          style: AppText.body(
            size: 14.5,
            color: Colors.white.withValues(alpha: 0.68),
            weight: FontWeight.w600,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────────────────────

/// A glass text field whose focus ring and icon tint follow the detected role.
class _GlassField extends StatelessWidget {
  const _GlassField({
    required this.controller,
    required this.focusNode,
    required this.label,
    required this.hint,
    required this.accent,
    required this.leading,
    this.trailing,
    this.errorText,
    this.obscure = false,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final String label;
  final String hint;
  final Color accent;
  final Widget leading;
  final Widget? trailing;
  final String? errorText;
  final bool obscure;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    final focused = focusNode.hasFocus;
    final error = errorText;
    final hasError = error != null;
    final ring = hasError
        ? AppColors.danger
        : focused
            ? accent
            : Colors.white.withValues(alpha: 0.16);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 7),
          child: Text(
            label.toUpperCase(),
            style: AppText.body(
              size: 10.5,
              color: Colors.white.withValues(alpha: 0.62),
              weight: FontWeight.w800,
            ),
          ),
        ),
        AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            color: Colors.black.withValues(alpha: focused ? 0.34 : 0.24),
            border:
                Border.all(color: ring, width: focused || hasError ? 1.6 : 1),
            boxShadow: focused
                ? [
                    BoxShadow(
                      color: ring.withValues(alpha: 0.28),
                      blurRadius: 18,
                    ),
                  ]
                : const [],
          ),
          child: Row(
            children: [
              Padding(
                padding: const EdgeInsets.only(left: 14, right: 6),
                child: IconTheme(
                  data: IconThemeData(
                    color:
                        focused ? accent : Colors.white.withValues(alpha: 0.55),
                  ),
                  child: leading,
                ),
              ),
              Expanded(
                child: TextField(
                  controller: controller,
                  focusNode: focusNode,
                  obscureText: obscure,
                  keyboardType: keyboardType,
                  textInputAction: textInputAction,
                  autofillHints: autofillHints,
                  onSubmitted: onSubmitted,
                  autocorrect: false,
                  enableSuggestions: !obscure,
                  cursorColor: accent,
                  style: AppText.body(
                    size: 15.5,
                    color: Colors.white,
                    weight: FontWeight.w600,
                  ),
                  decoration: InputDecoration(
                    isDense: true,
                    filled: false,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    hintText: hint,
                    hintStyle: AppText.body(
                      size: 14.5,
                      color: Colors.white.withValues(alpha: 0.32),
                      weight: FontWeight.w500,
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 17),
                  ),
                ),
              ),
              trailing ?? const SizedBox(width: 14),
            ],
          ),
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          alignment: Alignment.topLeft,
          child: error == null
              ? const SizedBox(width: double.infinity)
              : Padding(
                  padding: const EdgeInsets.only(left: 6, top: 6),
                  child: Text(
                    error,
                    style: AppText.body(
                      size: 12,
                      color: const Color(0xFFFF8CA2),
                      weight: FontWeight.w700,
                    ),
                  ),
                ),
        ),
      ],
    );
  }
}

/// Live feedback under the identifier: tells people which sign-in they are
/// on, in that role's colours. Cross-fades as they type.
class _WhoChip extends StatelessWidget {
  const _WhoChip({required this.who});

  final _Who who;

  @override
  Widget build(BuildContext context) {
    final (label, grad, fg, icon) = switch (who) {
      _Who.staff => (
          'Staff sign-in · work email',
          AppColors.staffGrad,
          Colors.white,
          Icons.badge_rounded,
        ),
      _Who.member => (
          'Member sign-in · Member ID',
          AppColors.memberGrad,
          AppColors.memberOnGrad,
          Icons.card_membership_rounded,
        ),
      _Who.unknown => (
          'Staff use email · Members use Member ID',
          null,
          Colors.white.withValues(alpha: 0.6),
          Icons.swap_horiz_rounded,
        ),
    };
    return Align(
      alignment: Alignment.centerLeft,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 320),
        switchInCurve: Curves.easeOutBack,
        transitionBuilder: (child, anim) => FadeTransition(
          opacity: anim,
          child: SlideTransition(
            position: Tween(begin: const Offset(0, 0.4), end: Offset.zero)
                .animate(anim),
            child: child,
          ),
        ),
        child: Container(
          key: ValueKey(who),
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
          decoration: BoxDecoration(
            gradient: grad,
            color: grad == null ? Colors.white.withValues(alpha: 0.07) : null,
            borderRadius: BorderRadius.circular(99),
            border: grad == null
                ? Border.all(color: Colors.white.withValues(alpha: 0.12))
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: fg),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 11.5,
                    color: fg,
                    weight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The primary button: colour glides between role gradients, a light sweep
/// crosses it while idle, and it swaps its label for a spinner while busy.
class _SignInButton extends StatelessWidget {
  const _SignInButton({
    required this.who,
    required this.loading,
    required this.shimmer,
    required this.onPressed,
  });

  final _Who who;
  final bool loading;
  final Animation<double> shimmer;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final member = who == _Who.member;
    final gradient = member ? AppColors.memberGrad : AppColors.staffGrad;
    final fg = member ? AppColors.memberOnGrad : Colors.white;
    return GestureDetector(
      onTap: onPressed,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeOutCubic,
        height: 56,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: gradient,
          boxShadow: [
            BoxShadow(
              color: (member ? AppColors.memberB : AppColors.staffB)
                  .withValues(alpha: 0.45),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (!loading)
                Positioned.fill(
                  child: AnimatedBuilder(
                    animation: shimmer,
                    builder: (context, _) => FractionallySizedBox(
                      alignment: Alignment(-1.6 + shimmer.value * 3.6, 0),
                      widthFactor: 0.32,
                      child: Transform(
                        transform: Matrix4.skewX(-0.35),
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Colors.white.withValues(alpha: 0),
                                Colors.white.withValues(alpha: 0.28),
                                Colors.white.withValues(alpha: 0),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 240),
                transitionBuilder: (child, anim) => ScaleTransition(
                  scale: anim,
                  child: FadeTransition(opacity: anim, child: child),
                ),
                child: loading
                    ? SizedBox(
                        key: const ValueKey('busy'),
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.6,
                          color: fg,
                        ),
                      )
                    : Row(
                        key: const ValueKey('idle'),
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Sign in',
                            style: AppText.body(
                              size: 16.5,
                              color: fg,
                              weight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Icon(
                            Icons.arrow_forward_rounded,
                            color: fg,
                            size: 20,
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

class _LinkButton extends StatelessWidget {
  const _LinkButton({required this.label, required this.onTap, this.icon});

  final String label;
  final VoidCallback onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onTap,
      style: TextButton.styleFrom(
        foregroundColor: Colors.white.withValues(alpha: 0.74),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 15), const SizedBox(width: 5)],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 12.5,
                weight: FontWeight.w700,
                color: Colors.white.withValues(alpha: 0.78),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: AppColors.danger.withValues(alpha: 0.16),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.error_outline_rounded,
            size: 18,
            color: Color(0xFFFF8CA2),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              message,
              style: AppText.body(
                size: 13,
                color: const Color(0xFFFFB3C1),
                weight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
