import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../repositories/member_auth_repository.dart';
import 'auth_widgets.dart';

/// Consumes a member portal password-reset link. Counterpart to
/// [ForgotPasswordScreen]'s member branch — that screen only sends the
/// email; this is where the emailed token is actually used. Same visual
/// system as the rest of the signed-out flow (`auth_widgets.dart`), in the
/// member palette since only members ever reach it.
///
/// No deep-link handling exists anywhere in this app (no `app_links`/
/// `uni_links`, no platform manifest wiring — confirmed, this app has never
/// needed to receive a link from outside itself before). So a member who
/// taps the emailed `https://.../portal/reset-password?token=...` link
/// today opens it in a browser, not this screen. Reached instead from
/// [ForgotPasswordScreen]'s confirmation view via a "Have a reset code?"
/// link, where the user pastes the code (or the whole link — the token is
/// extracted from a `?token=` query param if a full URL is pasted) by hand.
class MemberResetPasswordScreen extends StatefulWidget {
  const MemberResetPasswordScreen({super.key});

  @override
  State<MemberResetPasswordScreen> createState() =>
      _MemberResetPasswordScreenState();
}

class _MemberResetPasswordScreenState extends State<MemberResetPasswordScreen>
    with TickerProviderStateMixin {
  final _tokenController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  final _tokenFocus = FocusNode();
  final _passwordFocus = FocusNode();
  final _confirmFocus = FocusNode();

  late final AuthMotion _motion = AuthMotion(this);

  bool _loading = false;
  bool _done = false;
  bool _obscure = true;
  String? _tokenError;
  String? _passwordError;
  String? _confirmError;
  String? _error;

  @override
  void initState() {
    super.initState();
    for (final n in [_tokenFocus, _passwordFocus, _confirmFocus]) {
      n.addListener(() => setState(() {}));
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _motion.syncReducedMotion(context);
  }

  @override
  void dispose() {
    _motion.dispose();
    _tokenController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    _tokenFocus.dispose();
    _passwordFocus.dispose();
    _confirmFocus.dispose();
    super.dispose();
  }

  /// A member is likely to paste the whole emailed link rather than just
  /// the code at the end of it — pull the `token` query param out if one
  /// is present, otherwise treat the whole input as the raw token.
  String _extractToken(String raw) {
    final trimmed = raw.trim();
    final uri = Uri.tryParse(trimmed);
    final fromQuery = uri?.queryParameters['token'];
    if (fromQuery != null && fromQuery.isNotEmpty) return fromQuery;
    return trimmed;
  }

  Future<void> _submit() async {
    final token = _extractToken(_tokenController.text);
    final password = _passwordController.text;
    final confirm = _confirmController.text;

    setState(() {
      _tokenError = token.isEmpty ? 'Paste your reset code or link' : null;
      _passwordError = password.length < 8 ? 'At least 8 characters' : null;
      _confirmError = confirm != password ? 'Passwords don\'t match' : null;
      _error = null;
    });
    if (_tokenError != null ||
        _passwordError != null ||
        _confirmError != null) {
      _motion.failFeedback(context);
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _loading = true);
    try {
      await getIt<MemberAuthRepository>().resetPassword(
        token: token,
        password: password,
      );
      if (!mounted) return;
      setState(() => _done = true);
    } on ApiException catch (e) {
      if (!mounted) return;
      // Maintenance is not a form error — the app-wide Maintenance screen
      // takes over; show nothing here.
      if (e.isMaintenance) return;
      setState(() => _error = e.message);
      _motion.failFeedback(context);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// The reset flow is reached over the sign-in → forgot-password stack, so
  /// "back to sign in" unwinds to the login page it started from.
  void _backToSignIn() => context.go(AppRoutes.login);

  @override
  Widget build(BuildContext context) {
    return AuthScene(
      motion: _motion,
      hero: AuthHero(
        pulse: _motion.aurora,
        title: _done ? 'Password reset' : 'New password',
        subtitle: _done
            ? 'You can sign in with it now'
            : 'Paste the code from your email, then choose a new password',
        icon: _done ? Icons.verified_rounded : Icons.password_rounded,
      ),
      card: AuthGlassCard(
        child: AnimatedSize(
          duration: const Duration(milliseconds: 320),
          curve: Curves.easeOutCubic,
          alignment: Alignment.topCenter,
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
            child: _done ? _doneBody() : _formBody(),
          ),
        ),
      ),
      footer: const AuthFooter(),
    );
  }

  Widget _formBody() {
    const accent = AuthWho.member;
    final reveal = IconButton(
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
    );
    return Column(
      key: const ValueKey('form'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthErrorSlot(message: _error),
        GlassField(
          controller: _tokenController,
          focusNode: _tokenFocus,
          label: 'Reset code',
          hint: 'Paste the code or link from your email',
          accent: accent.accent,
          errorText: _tokenError,
          textInputAction: TextInputAction.next,
          leading: const Icon(Icons.key_rounded, size: 20),
        ),
        const SizedBox(height: 14),
        GlassField(
          controller: _passwordController,
          focusNode: _passwordFocus,
          label: 'New password',
          hint: 'At least 8 characters',
          accent: accent.accent,
          errorText: _passwordError,
          obscure: _obscure,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.newPassword],
          leading: const Icon(Icons.lock_outline_rounded, size: 20),
          trailing: reveal,
        ),
        const SizedBox(height: 14),
        GlassField(
          controller: _confirmController,
          focusNode: _confirmFocus,
          label: 'Confirm new password',
          hint: 'Re-enter your new password',
          accent: accent.accent,
          errorText: _confirmError,
          obscure: _obscure,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.newPassword],
          onSubmitted: (_) => _submit(),
          leading: const Icon(Icons.lock_reset_rounded, size: 20),
        ),
        const SizedBox(height: 20),
        AuthButton(
          label: 'Reset password',
          who: accent,
          loading: _loading,
          shimmer: _motion.shimmer,
          icon: Icons.check_rounded,
          onPressed: _loading ? null : _submit,
        ),
        const SizedBox(height: 6),
        Center(
          child: AuthLinkButton(
            label: 'Back to sign in',
            icon: Icons.arrow_back_rounded,
            onTap: _backToSignIn,
          ),
        ),
      ],
    );
  }

  Widget _doneBody() {
    return Column(
      key: const ValueKey('done'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 4),
        const Center(child: AuthSuccessBadge(drawCheck: true)),
        const SizedBox(height: 4),
        Text(
          'Your password has been changed.',
          style: AppText.body(
            size: 14,
            color: Colors.white.withValues(alpha: 0.7),
            weight: FontWeight.w600,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 18),
        AuthButton(
          label: 'Sign in',
          who: AuthWho.member,
          loading: false,
          shimmer: _motion.shimmer,
          onPressed: _backToSignIn,
        ),
      ],
    );
  }
}
