import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';

/// Shared visuals for the signed-out screens — [LoginScreen],
/// [PhoneLoginScreen] / [PhoneOtpScreen], [ForgotPasswordScreen] and
/// [MemberResetPasswordScreen] — so they read as ONE flow: the neutral
/// aurora, the frosted glass card, glass fields, the shimmering gradient
/// button, the staggered entrance, the shake-on-error and the fade/scale
/// route transition. Nothing here knows about any repository or session.

/// Near-black base every signed-out scene sits on.
const Color kAuthBase = Color(0xFF0B0813);

/// Accent used before we know who is signing in (focus ring, caret…).
const Color kAuthNeutralAccent = Color(0xFFB7A6FF);

/// Who the typed identifier belongs to — the one field everyone uses. An
/// email is staff, anything else (a Member ID like `MEM-0007`) is a member;
/// same "@" rule the web app's unified login uses.
enum AuthWho {
  unknown,
  staff,
  member;

  static AuthWho detect(String raw) {
    final t = raw.trim();
    if (t.isEmpty) return AuthWho.unknown;
    return t.contains('@') ? AuthWho.staff : AuthWho.member;
  }

  Color get accent => switch (this) {
        AuthWho.staff => AppColors.staffA,
        AuthWho.member => AppColors.memberA,
        AuthWho.unknown => kAuthNeutralAccent,
      };

  /// The unknown state borrows the staff gradient, exactly as the login
  /// screen always has.
  LinearGradient get gradient =>
      this == AuthWho.member ? AppColors.memberGrad : AppColors.staffGrad;

  Color get onGradient =>
      this == AuthWho.member ? AppColors.memberOnGrad : Colors.white;

  Color get glow =>
      this == AuthWho.member ? AppColors.memberB : AppColors.staffB;
}

// ─────────────────────────────────────────────────────────────────────────────
// Motion
// ─────────────────────────────────────────────────────────────────────────────

/// The four animation controllers every auth scene shares: the slow aurora
/// loop, the one-shot staggered entrance, the shake on a failed submit and
/// the shimmer sweeping the idle button. Create it in a State that mixes in
/// [TickerProviderStateMixin], call [syncReducedMotion] from
/// `didChangeDependencies` and [dispose] from `dispose`.
class AuthMotion {
  AuthMotion(TickerProvider vsync)
      : aurora = AnimationController(
          vsync: vsync,
          duration: const Duration(seconds: 26),
        ),
        intro = AnimationController(
          vsync: vsync,
          duration: const Duration(milliseconds: 1400),
        ),
        shake = AnimationController(
          vsync: vsync,
          duration: const Duration(milliseconds: 460),
        ),
        shimmer = AnimationController(
          vsync: vsync,
          duration: const Duration(milliseconds: 2600),
        ) {
    intro.forward();
  }

  /// Slow loop that drives the aurora (and the logo's breathing glow).
  final AnimationController aurora;

  /// One-shot staggered entrance.
  final AnimationController intro;

  /// Brief horizontal shake when a submit fails.
  final AnimationController shake;

  /// Shimmer sweeping across the primary button while it's idle.
  final AnimationController shimmer;

  bool _motionStarted = false;

  /// Respect the OS "reduce motion" setting: no looping background, no shimmer.
  void syncReducedMotion(BuildContext context) {
    final reduce = MediaQuery.of(context).disableAnimations;
    if (reduce) {
      aurora.stop();
      shimmer.stop();
      intro.value = 1;
      _motionStarted = false;
    } else if (!_motionStarted) {
      aurora.repeat();
      shimmer.repeat();
      _motionStarted = true;
    }
  }

  /// Shake + a short haptic tick so a failed submit is felt, not just read.
  void failFeedback(BuildContext context) {
    HapticFeedback.mediumImpact();
    if (!MediaQuery.of(context).disableAnimations) shake.forward(from: 0);
  }

  /// A slice of the entrance, eased — drives [AuthReveal].
  Animation<double> step(double from, double to) => CurvedAnimation(
        parent: intro,
        curve: Interval(from, to, curve: Curves.easeOutCubic),
      );

  void dispose() {
    aurora.dispose();
    intro.dispose();
    shake.dispose();
    shimmer.dispose();
  }
}

/// Fades a child in while sliding it up — one slice of the staggered entrance.
class AuthReveal extends StatelessWidget {
  const AuthReveal({
    super.key,
    required this.animation,
    required this.child,
    this.dy = 26,
  });

  final Animation<double> animation;
  final Widget child;
  final double dy;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: animation,
        child: child,
        builder: (context, child) => Opacity(
          opacity: animation.value,
          child: Transform.translate(
            offset: Offset(0, (1 - animation.value) * dy),
            child: child,
          ),
        ),
      );
}

/// The route transition every signed-out page uses (login → phone → code →
/// forgot password): a soft fade + 97 % → 100 % scale.
CustomTransitionPage<void> authTransitionPage(
  GoRouterState state,
  Widget child,
) =>
    CustomTransitionPage<void>(
      key: state.pageKey,
      child: child,
      transitionDuration: const Duration(milliseconds: 520),
      reverseTransitionDuration: const Duration(milliseconds: 320),
      transitionsBuilder: (context, animation, secondary, child) {
        final curved = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutCubic,
          reverseCurve: Curves.easeInCubic,
        );
        return FadeTransition(
          opacity: curved,
          child: ScaleTransition(
            scale: Tween(begin: 0.97, end: 1.0).animate(curved),
            child: child,
          ),
        );
      },
    );

// ─────────────────────────────────────────────────────────────────────────────
// Scene
// ─────────────────────────────────────────────────────────────────────────────

/// The whole signed-out page: aurora backdrop, centred scrolling column with
/// [hero] → shaking [card] → [footer], each revealed in turn.
class AuthScene extends StatelessWidget {
  const AuthScene({
    super.key,
    required this.motion,
    required this.hero,
    required this.card,
    required this.footer,
  });

  final AuthMotion motion;
  final Widget hero;

  /// Usually an [AuthGlassCard].
  final Widget card;
  final Widget footer;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kAuthBase,
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          Positioned.fill(
            child: RepaintBoundary(
              child: AnimatedBuilder(
                animation: motion.aurora,
                builder: (context, _) => CustomPaint(
                  painter: _AuroraPainter(motion.aurora.value),
                ),
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
                      AuthReveal(
                        animation: motion.step(0.0, 0.5),
                        dy: 18,
                        child: hero,
                      ),
                      const SizedBox(height: 26),
                      AuthReveal(
                        animation: motion.step(0.2, 0.75),
                        child: AnimatedBuilder(
                          animation: motion.shake,
                          builder: (context, child) {
                            final t = motion.shake.value;
                            final dx =
                                math.sin(t * math.pi * 5) * 11 * (1 - t);
                            return Transform.translate(
                              offset: Offset(dx, 0),
                              child: child,
                            );
                          },
                          child: card,
                        ),
                      ),
                      const SizedBox(height: 18),
                      AuthReveal(
                        animation: motion.step(0.55, 1.0),
                        dy: 12,
                        child: footer,
                      ),
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
}

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
/// live in the same sky because both roles share these screens.
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
    canvas.drawRect(Offset.zero & size, Paint()..color = kAuthBase);
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
            kAuthBase.withValues(alpha: 0.72),
          ],
          stops: const [0.35, 1],
        ).createShader(Offset.zero & size),
    );
  }

  @override
  bool shouldRepaint(_AuroraPainter old) => old.t != t;
}

/// Logo tile with a breathing glow + title and tagline.
class AuthHero extends StatelessWidget {
  const AuthHero({
    super.key,
    required this.pulse,
    this.title = 'Welcome back',
    this.subtitle = 'One sign-in for staff and members',
    this.icon = Icons.fitness_center_rounded,
  });

  final Animation<double> pulse;
  final String title;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AnimatedBuilder(
          animation: pulse,
          builder: (context, _) {
            final breathe =
                0.5 + 0.5 * math.sin(pulse.value * math.pi * 2 * 6);
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
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 260),
                transitionBuilder: (child, anim) => ScaleTransition(
                  scale: anim,
                  child: FadeTransition(opacity: anim, child: child),
                ),
                child: Icon(
                  icon,
                  key: ValueKey(icon),
                  color: Colors.white,
                  size: 40,
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 18),
        Text(
          title,
          style: AppText.display(size: 32, color: Colors.white),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 6),
        Text(
          subtitle,
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

/// Small centred footer: optional note + the "powered by" line.
class AuthFooter extends StatelessWidget {
  const AuthFooter({super.key, this.note});

  final String? note;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          if (note != null) ...[
            Text(
              note!,
              textAlign: TextAlign.center,
              style: AppText.body(
                size: 12.5,
                color: Colors.white.withValues(alpha: 0.55),
                weight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 14),
          ],
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
}

/// The frosted glass panel the form lives in.
class AuthGlassCard extends StatelessWidget {
  const AuthGlassCard({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
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
            children: [child],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────────────────────

/// A glass text field whose focus ring and icon tint follow [accent].
class GlassField extends StatelessWidget {
  const GlassField({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.label,
    required this.hint,
    required this.accent,
    required this.leading,
    this.prefix,
    this.trailing,
    this.errorText,
    this.obscure = false,
    this.keyboardType,
    this.textInputAction,
    this.textCapitalization = TextCapitalization.none,
    this.autofillHints,
    this.inputFormatters,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final String label;
  final String hint;
  final Color accent;
  final Widget leading;

  /// Sits between the [leading] icon and the text (e.g. the "+91" chip).
  final Widget? prefix;
  final Widget? trailing;
  final String? errorText;
  final bool obscure;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final TextCapitalization textCapitalization;
  final Iterable<String>? autofillHints;
  final List<TextInputFormatter>? inputFormatters;
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
        AuthFieldLabel(label),
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
              if (prefix != null) prefix!,
              Expanded(
                child: TextField(
                  controller: controller,
                  focusNode: focusNode,
                  obscureText: obscure,
                  keyboardType: keyboardType,
                  textInputAction: textInputAction,
                  textCapitalization: textCapitalization,
                  autofillHints: autofillHints,
                  inputFormatters: inputFormatters,
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

/// The small caps label above a field / the code boxes.
class AuthFieldLabel extends StatelessWidget {
  const AuthFieldLabel(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(left: 4, bottom: 7),
        child: Text(
          label.toUpperCase(),
          style: AppText.body(
            size: 10.5,
            color: Colors.white.withValues(alpha: 0.62),
            weight: FontWeight.w800,
          ),
        ),
      );
}

/// The "+91" chip shown inside the phone field: India is the only country the
/// app supports, so it is a fixed prefix rather than a picker.
class CountryPrefix extends StatelessWidget {
  const CountryPrefix({super.key, this.code = '+91'});

  final String code;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(right: 10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            color: Colors.white.withValues(alpha: 0.1),
            border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
          ),
          child: Text(
            code,
            style: AppText.body(
              size: 13.5,
              color: Colors.white.withValues(alpha: 0.9),
              weight: FontWeight.w800,
            ),
          ),
        ),
      );
}

/// Pill used for live feedback under a field. [gradient] null = neutral glass.
class AuthChip extends StatelessWidget {
  const AuthChip({
    super.key,
    required this.label,
    required this.icon,
    this.gradient,
    this.foreground,
  });

  final String label;
  final IconData icon;
  final Gradient? gradient;
  final Color? foreground;

  @override
  Widget build(BuildContext context) {
    final fg = foreground ?? Colors.white.withValues(alpha: 0.6);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
      decoration: BoxDecoration(
        gradient: gradient,
        color: gradient == null ? Colors.white.withValues(alpha: 0.07) : null,
        borderRadius: BorderRadius.circular(99),
        border: gradient == null
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
    );
  }
}

/// Live feedback under the identifier: tells people which sign-in they are
/// on, in that role's colours. Cross-fades as they type.
class WhoChip extends StatelessWidget {
  const WhoChip({super.key, required this.who});

  final AuthWho who;

  @override
  Widget build(BuildContext context) {
    final (label, grad, fg, icon) = switch (who) {
      AuthWho.staff => (
          'Staff sign-in · work email',
          AppColors.staffGrad,
          Colors.white,
          Icons.badge_rounded,
        ),
      AuthWho.member => (
          'Member sign-in · Member ID',
          AppColors.memberGrad,
          AppColors.memberOnGrad,
          Icons.card_membership_rounded,
        ),
      AuthWho.unknown => (
          'Staff use email · Members use Member ID',
          null,
          Colors.white.withValues(alpha: 0.6),
          Icons.swap_horiz_rounded,
        ),
    };
    return Align(
      alignment: Alignment.centerLeft,
      child: AuthChipSwitcher(
        childKey: ValueKey(who),
        child: AuthChip(
          label: label,
          icon: icon,
          gradient: grad,
          foreground: fg,
        ),
      ),
    );
  }
}

/// Cross-fade + rise used when a chip's content changes.
class AuthChipSwitcher extends StatelessWidget {
  const AuthChipSwitcher({
    super.key,
    required this.child,
    required this.childKey,
  });

  final Widget child;
  final Key childKey;

  @override
  Widget build(BuildContext context) => AnimatedSwitcher(
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
        child: KeyedSubtree(key: childKey, child: child),
      );
}

/// The primary button: colour glides between role gradients, a light sweep
/// crosses it while idle, and it swaps its label for a spinner while busy.
class AuthButton extends StatelessWidget {
  const AuthButton({
    super.key,
    required this.label,
    required this.who,
    required this.loading,
    required this.shimmer,
    required this.onPressed,
    this.icon = Icons.arrow_forward_rounded,
  });

  final String label;
  final AuthWho who;
  final bool loading;
  final Animation<double> shimmer;
  final VoidCallback? onPressed;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final fg = who.onGradient;
    return GestureDetector(
      onTap: onPressed,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeOutCubic,
        height: 56,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: who.gradient,
          boxShadow: [
            BoxShadow(
              color: who.glow.withValues(alpha: 0.45),
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
                            label,
                            style: AppText.body(
                              size: 16.5,
                              color: fg,
                              weight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Icon(icon, color: fg, size: 20),
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

/// Quiet text link used under the card ("Forgot password?", "Back to sign in").
class AuthLinkButton extends StatelessWidget {
  const AuthLinkButton({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
  });

  final String label;
  final VoidCallback? onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onTap,
      style: TextButton.styleFrom(
        foregroundColor: Colors.white.withValues(alpha: 0.74),
        disabledForegroundColor: Colors.white.withValues(alpha: 0.34),
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
                color: onTap == null
                    ? Colors.white.withValues(alpha: 0.4)
                    : Colors.white.withValues(alpha: 0.78),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Inline banner for a form-level failure (wrong password, network…).
class AuthErrorBanner extends StatelessWidget {
  const AuthErrorBanner({super.key, required this.message});

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

/// Animated slot for an [AuthErrorBanner] at the top of the card: grows in
/// when [message] appears and collapses when it clears.
class AuthErrorSlot extends StatelessWidget {
  const AuthErrorSlot({super.key, required this.message});

  final String? message;

  @override
  Widget build(BuildContext context) => AnimatedSize(
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOutCubic,
        alignment: Alignment.topCenter,
        child: message == null
            ? const SizedBox(width: double.infinity)
            : Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: AuthErrorBanner(message: message!),
              ),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Success + code entry
// ─────────────────────────────────────────────────────────────────────────────

/// A gradient disc that pops in with a soft ripple, then either draws a
/// check mark ([drawCheck]) or reveals [icon]. One-shot (no endless loop), and
/// it jumps straight to the end under reduce-motion.
class AuthSuccessBadge extends StatelessWidget {
  const AuthSuccessBadge({
    super.key,
    this.icon = Icons.mark_email_read_rounded,
    this.drawCheck = false,
    this.size = 92,
  });

  final IconData icon;
  final bool drawCheck;
  final double size;

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.of(context).disableAnimations;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: reduce ? 1 : 0, end: 1),
      duration: reduce ? Duration.zero : const Duration(milliseconds: 900),
      curve: Curves.linear,
      builder: (context, t, _) {
        final pop = Curves.elasticOut.transform(
          const Interval(0, 0.6).transform(t),
        );
        final ring = Curves.easeOut.transform(
          const Interval(0.25, 1).transform(t),
        );
        final mark = Curves.easeOutCubic.transform(
          const Interval(0.45, 1).transform(t),
        );
        return SizedBox(
          width: size * 1.5,
          height: size * 1.5,
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (ring > 0 && ring < 1)
                Container(
                  width: size * (1 + 0.5 * ring),
                  height: size * (1 + 0.5 * ring),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.memberB
                          .withValues(alpha: 0.5 * (1 - ring)),
                      width: 2,
                    ),
                  ),
                ),
              Transform.scale(
                scale: pop.clamp(0.0, 1.2),
                child: Container(
                  width: size,
                  height: size,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: AppColors.memberGrad,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.memberB.withValues(alpha: 0.45),
                        blurRadius: 30,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: drawCheck
                      ? CustomPaint(
                          size: Size(size * 0.46, size * 0.46),
                          painter: _CheckPainter(mark),
                        )
                      : Opacity(
                          opacity: mark,
                          child: Transform.scale(
                            scale: 0.6 + 0.4 * mark,
                            child: Icon(
                              icon,
                              size: size * 0.46,
                              color: AppColors.memberOnGrad,
                            ),
                          ),
                        ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _CheckPainter extends CustomPainter {
  _CheckPainter(this.progress);

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width * 0.04, size.height * 0.54)
      ..lineTo(size.width * 0.38, size.height * 0.88)
      ..lineTo(size.width * 0.96, size.height * 0.14);
    final paint = Paint()
      ..color = AppColors.memberOnGrad
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.14
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    for (final metric in path.computeMetrics()) {
      canvas.drawPath(
        metric.extractPath(0, metric.length * progress),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_CheckPainter old) => old.progress != progress;
}

/// Six glass digit boxes in the aurora's visual language. Auto-advances,
/// handles backspace and a pasted code, and calls [onCompleted] once every
/// box is filled. [GlassOtpInputState.clear] empties it after a wrong code.
class GlassOtpInput extends StatefulWidget {
  const GlassOtpInput({
    super.key,
    required this.onCompleted,
    this.length = 6,
    this.accent = kAuthNeutralAccent,
    this.hasError = false,
    this.enabled = true,
    this.onChanged,
  });

  final int length;
  final Color accent;
  final bool hasError;
  final bool enabled;
  final ValueChanged<String> onCompleted;
  final ValueChanged<String>? onChanged;

  @override
  State<GlassOtpInput> createState() => GlassOtpInputState();
}

class GlassOtpInputState extends State<GlassOtpInput> {
  late final List<TextEditingController> _controllers;
  late final List<FocusNode> _nodes;

  /// Everything typed so far (may be shorter than the box count).
  String get code => _controllers.map((c) => c.text).join();

  bool get isComplete => code.length == widget.length;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(widget.length, (_) => TextEditingController());
    _nodes = List.generate(widget.length, (_) => FocusNode());
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final n in _nodes) {
      n.dispose();
    }
    super.dispose();
  }

  void clear() {
    for (final c in _controllers) {
      c.clear();
    }
    _nodes.first.requestFocus();
    widget.onChanged?.call('');
  }

  void _onChanged(int index, String value) {
    if (value.length > 1) {
      // A pasted (or autofilled) code: spread it over the boxes from here.
      final digits = value.replaceAll(RegExp(r'\D'), '');
      var i = index;
      for (final ch in digits.split('')) {
        if (i >= widget.length) break;
        _controllers[i].text = ch;
        i++;
      }
      if (index < widget.length && digits.isEmpty) _controllers[index].clear();
      _nodes[math.min(i, widget.length - 1)].requestFocus();
    } else if (value.isNotEmpty && index < widget.length - 1) {
      _nodes[index + 1].requestFocus();
    }
    widget.onChanged?.call(code);
    if (isComplete) {
      FocusScope.of(context).unfocus();
      widget.onCompleted(code);
    }
  }

  KeyEventResult _onKey(int index, KeyEvent event) {
    if (event is KeyDownEvent &&
        event.logicalKey == LogicalKeyboardKey.backspace &&
        _controllers[index].text.isEmpty &&
        index > 0) {
      _nodes[index - 1].requestFocus();
      _controllers[index - 1].clear();
      widget.onChanged?.call(code);
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < widget.length; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(child: _box(i)),
        ],
      ],
    );
  }

  Widget _box(int i) {
    return ListenableBuilder(
      listenable: Listenable.merge([_nodes[i], _controllers[i]]),
      builder: (context, _) {
        final focused = _nodes[i].hasFocus;
        final filled = _controllers[i].text.isNotEmpty;
        final ring = widget.hasError
            ? AppColors.danger
            : focused
                ? widget.accent
                : filled
                    ? widget.accent.withValues(alpha: 0.55)
                    : Colors.white.withValues(alpha: 0.16);
        return AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          height: 58,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: Colors.black.withValues(alpha: focused ? 0.34 : 0.24),
            border: Border.all(
              color: ring,
              width: focused || widget.hasError ? 1.6 : 1,
            ),
            boxShadow: focused
                ? [
                    BoxShadow(
                      color: ring.withValues(alpha: 0.28),
                      blurRadius: 16,
                    ),
                  ]
                : const [],
          ),
          alignment: Alignment.center,
          child: Focus(
            onKeyEvent: (_, event) => _onKey(i, event),
            child: TextField(
              controller: _controllers[i],
              focusNode: _nodes[i],
              enabled: widget.enabled,
              autofocus: i == 0,
              textAlign: TextAlign.center,
              keyboardType: TextInputType.number,
              cursorColor: widget.accent,
              autofillHints: i == 0 ? const [AutofillHints.oneTimeCode] : null,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: AppText.display(size: 22, color: Colors.white),
              onChanged: (v) => _onChanged(i, v),
              decoration: const InputDecoration(
                isDense: true,
                filled: false,
                counterText: '',
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                disabledBorder: InputBorder.none,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
        );
      },
    );
  }
}
