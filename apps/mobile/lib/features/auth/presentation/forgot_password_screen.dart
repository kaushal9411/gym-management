import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../repositories/public_tenant_repository.dart';
import 'auth_widgets.dart';

class ForgotPasswordScreenArgs {
  const ForgotPasswordScreenArgs({this.prefill});

  /// Whatever was already typed on the login screen.
  final String? prefill;
}

/// Same visual system as [LoginScreen] (`auth_widgets.dart`): aurora, glass
/// card, one *Email or Member ID* field with the live role chip, shimmering
/// "Send reset link" button, shake + haptic on a bad submit and an animated
/// "Check your email" success state. No gym is asked for or resolved: the one
/// identifier goes to `POST /public/auth/forgot-password` and the server emails
/// a reset link for every gym that identifier exists in — it always succeeds
/// without revealing whether the account exists, so the UI shows one generic
/// confirmation regardless of the response.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, required this.args});

  final ForgotPasswordScreenArgs args;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen>
    with TickerProviderStateMixin {
  late final _controller =
      TextEditingController(text: widget.args.prefill ?? '');
  final _focus = FocusNode();

  late final AuthMotion _motion = AuthMotion(this);

  bool _loading = false;
  bool _sent = false;

  /// Whether the identifier that was submitted was an email (staff) — decides
  /// which confirmation copy is shown.
  bool _sentToStaff = true;
  String? _formError;
  String? _fieldError;

  /// One field for both: an email is staff, anything else a Member ID.
  AuthWho get _who => AuthWho.detect(_controller.text);

  @override
  void initState() {
    super.initState();
    _controller.addListener(() => setState(() {}));
    _focus.addListener(() => setState(() {}));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _motion.syncReducedMotion(context);
  }

  @override
  void dispose() {
    _motion.dispose();
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final value = _controller.text.trim();
    if (value.isEmpty) {
      setState(() {
        _formError = null;
        _fieldError = 'Enter your email or Member ID';
      });
      _motion.failFeedback(context);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _formError = null;
      _fieldError = null;
    });
    try {
      await getIt<PublicTenantRepository>().forgotPassword(identifier: value);
      if (!mounted) return;
      setState(() {
        _sentToStaff = value.contains('@');
        _sent = true;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      // Maintenance is not a form error — the app-wide Maintenance screen
      // takes over; show nothing here.
      if (e.isMaintenance) return;
      setState(() => _formError = e.message);
      _motion.failFeedback(context);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _backToSignIn() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.login);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScene(
      motion: _motion,
      hero: AuthHero(
        pulse: _motion.aurora,
        title: 'Reset password',
        subtitle: _sent
            ? 'Your reset link is on its way'
            : 'We\'ll email you a link to get back in',
        icon: _sent ? Icons.mark_email_read_rounded : Icons.lock_reset_rounded,
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
            child: _sent ? _sentBody() : _formBody(),
          ),
        ),
      ),
      footer: AuthFooter(
        note: _sent
            ? null
            : 'Staff: your work email · Members: your Member ID.\n'
                'We never say whether an account exists.',
      ),
    );
  }

  Widget _formBody() {
    final who = _who;
    return Column(
      key: const ValueKey('form'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthErrorSlot(message: _formError),
        GlassField(
          controller: _controller,
          focusNode: _focus,
          label: 'Email or Member ID',
          hint: 'you@gym.com  ·  MEM-0001',
          accent: who.accent,
          errorText: _fieldError,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.username],
          onSubmitted: (_) => _submit(),
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
        const SizedBox(height: 20),
        AuthButton(
          label: 'Send reset link',
          who: who,
          loading: _loading,
          shimmer: _motion.shimmer,
          icon: Icons.send_rounded,
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

  Widget _sentBody() {
    return Column(
      key: const ValueKey('sent'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 4),
        const Center(child: AuthSuccessBadge()),
        const SizedBox(height: 4),
        Text(
          'Check your email',
          style: AppText.display(size: 22, color: Colors.white),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          _sentToStaff
              ? 'If an account exists for that email, a reset link is on its way.'
              : 'If a portal account exists for that Member ID, a reset link has been sent.',
          style: AppText.body(
            size: 14,
            color: Colors.white.withValues(alpha: 0.7),
            weight: FontWeight.w600,
          ),
          textAlign: TextAlign.center,
        ),
        if (!_sentToStaff) ...[
          const SizedBox(height: 10),
          Center(
            child: AuthLinkButton(
              label: 'Have a reset code? Enter it here',
              icon: Icons.password_rounded,
              onTap: () => context.push(AppRoutes.memberResetPassword),
            ),
          ),
        ],
        const SizedBox(height: 14),
        AuthButton(
          label: 'Back to sign in',
          who: AuthWho.unknown,
          loading: false,
          shimmer: _motion.shimmer,
          icon: Icons.arrow_back_rounded,
          onPressed: _backToSignIn,
        ),
      ],
    );
  }
}
