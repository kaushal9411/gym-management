import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../bloc/maintenance/maintenance_cubit.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/brand_mark.dart';
import '../../../shared/widgets/motion.dart';
import 'maintenance_painters.dart';

/// Full-screen "we're servicing the gym" page, shown by [MaintenanceHost] on
/// top of the live app whenever the server answers 503 `MAINTENANCE` (the
/// gym's own switch or the platform-wide one). Reads [MaintenanceCubit]; the
/// session, tokens and Navigator underneath are never touched.
///
/// Motion (all Flutter core, one shared looping ticker + a 30 s ring):
/// the slowly swaying amber-coral-magenta-violet gradient, a rocking barbell with meshing gears, a heartbeat
/// line, a pulse riding Paused → Upgrading → Back online, and the countdown
/// ring to the next automatic check. Under `MediaQuery.disableAnimations` the
/// decorative loops stand still (a calm still frame) and the entrance jumps to
/// its end; only the functional countdown keeps ticking.
///
/// Polling rule: while on screen and in the foreground it re-checks every
/// [checkInterval] (and on "Check now"): the gym resolve endpoint when a gym is
/// known, `/public/platform-config` before login. Backgrounding the app stops
/// the timer and resuming re-checks at once.
///
/// Data: gym name + custom message come from the branding resolve / platform
/// config only; when
/// the admin set no message the default copy is shown and no callout.
class MaintenanceScreen extends StatefulWidget {
  const MaintenanceScreen({
    super.key,
    this.role = AppRole.staff,
    this.fallbackGymName,
    this.supportEmail,
    this.checkInterval = const Duration(seconds: 30),
    this.celebrationDuration = const Duration(milliseconds: 1900),
  });

  final AppRole role;

  /// Shown when the cubit hasn't learned the gym name yet (e.g. the session's
  /// own tenant name).
  final String? fallbackGymName;

  /// The platform's support address (from `/public/platform-config`); the
  /// "Need help?" line is omitted when null.
  final String? supportEmail;
  final Duration checkInterval;
  final Duration celebrationDuration;

  @override
  State<MaintenanceScreen> createState() => _MaintenanceScreenState();
}

class _MaintenanceScreenState extends State<MaintenanceScreen>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  late final AnimationController _loop;
  late final AnimationController _ring;
  late final AnimationController _celebrate;
  Timer? _dismissTimer;
  bool _foreground = true;
  bool _reduced = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loop = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 6),
    );
    _ring = AnimationController(
      vsync: this,
      duration: widget.checkInterval,
      // The countdown is functional timing, not decoration — keep it honest
      // even when the OS asks for reduced animation.
      animationBehavior: AnimationBehavior.preserve,
    )..addStatusListener((s) {
        if (s == AnimationStatus.completed) unawaited(_runCheck());
      });
    _celebrate = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );
    _ring.forward();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduced = reduceMotion(context);
    if (reduced != _reduced || !_loop.isAnimating && !reduced) {
      _reduced = reduced;
      if (reduced) {
        _loop
          ..stop()
          ..value = 0.18;
      } else if (_foreground) {
        _loop.repeat();
      }
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final fg = state == AppLifecycleState.resumed;
    if (fg == _foreground) return;
    _foreground = fg;
    if (!fg) {
      // Backgrounded: stop the countdown and the decorative loop — no polling.
      _ring.stop();
      _loop.stop();
    } else {
      if (!_reduced) _loop.repeat();
      // Back in the foreground: don't make the user wait out the timer.
      unawaited(_runCheck());
    }
  }

  /// One automatic or manual check, then restart the countdown.
  Future<void> _runCheck({bool manual = false}) async {
    if (!mounted) return;
    final cubit = context.read<MaintenanceCubit>();
    _ring.stop();
    if (manual) {
      await cubit.retry();
    } else {
      await cubit.check();
    }
    if (!mounted || !_foreground) return;
    final s = cubit.state;
    if (s.active && !s.backOnline) _ring.forward(from: 0);
  }

  void _onState(BuildContext context, MaintenanceState s) {
    if (s.backOnline && !_celebrate.isAnimating && _celebrate.value == 0) {
      _ring.stop();
      if (_reduced) {
        _celebrate.value = 1;
      } else {
        _celebrate.forward();
      }
      _dismissTimer?.cancel();
      _dismissTimer = Timer(widget.celebrationDuration, () {
        if (mounted) context.read<MaintenanceCubit>().dismiss();
      });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _dismissTimer?.cancel();
    _loop.dispose();
    _ring.dispose();
    _celebrate.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<MaintenanceCubit, MaintenanceState>(
      listener: _onState,
      builder: (context, s) {
        final role = widget.role;
        final gym = s.gymName ?? widget.fallbackGymName;
        final done = s.backOnline;
        return Scaffold(
          backgroundColor: MaintenancePalette.violet,
          body: Stack(
            fit: StackFit.expand,
            children: [
              RepaintBoundary(
                child: AnimatedBuilder(
                  animation: _loop,
                  builder: (_, __) => CustomPaint(
                    painter: MaintenanceBackdropPainter(t: _loop.value),
                  ),
                ),
              ),
              SafeArea(
                child: LayoutBuilder(
                  builder: (context, c) => SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.screenH,
                      vertical: AppSpacing.xxl,
                    ),
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        minHeight: c.maxHeight - AppSpacing.xxl * 2,
                      ),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 460),
                          child: _content(context, s, role, gym, done),
                        ),
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

  Widget _content(
    BuildContext context,
    MaintenanceState s,
    AppRole role,
    String? gym,
    bool done,
  ) {
    final message = s.message?.trim();
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        StaggeredReveal(index: 0, child: _header(role, gym, done)),
        const SizedBox(height: AppSpacing.md),
        StaggeredReveal(
          index: 1,
          child: SizedBox(
            height: 190,
            child: RepaintBoundary(
              child: AnimatedBuilder(
                animation: Listenable.merge([_loop, _celebrate]),
                builder: (_, __) => CustomPaint(
                  painter: MaintenanceHeroPainter(
                    t: _loop.value,
                    celebrate: _celebrate.value,
                    colorA: MaintenancePalette.ink,
                    colorB: MaintenancePalette.inkSoft,
                    bar: MaintenancePalette.inkSoft,
                    faint: MaintenancePalette.inkFaint,
                    success: AppColors.success,
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        StaggeredReveal(
          index: 2,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 350),
            child: Column(
              key: ValueKey(done),
              children: [
                Text(
                  done ? 'Back online' : "We're servicing the gym",
                  textAlign: TextAlign.center,
                  style:
                      AppText.display(size: 28, color: MaintenancePalette.ink),
                ),
                const SizedBox(height: 8),
                Text(
                  done
                      ? 'All set — taking you right back.'
                      : 'Everything is paused while we upgrade things behind '
                          'the scenes. Your account and data are safe, and '
                          'this page checks automatically.',
                  textAlign: TextAlign.center,
                  style:
                      AppText.body(size: 14, color: MaintenancePalette.inkSoft),
                ),
              ],
            ),
          ),
        ),
        if (message != null && message.isNotEmpty && !done) ...[
          const SizedBox(height: AppSpacing.xl),
          StaggeredReveal(index: 3, child: _callout(role, gym, message)),
        ],
        const SizedBox(height: AppSpacing.xl),
        StaggeredReveal(index: 4, child: _steps(role, done)),
        if (!done) ...[
          const SizedBox(height: AppSpacing.xl),
          StaggeredReveal(index: 5, child: _statusCard(context, s, role)),
          if (widget.supportEmail != null) ...[
            const SizedBox(height: AppSpacing.md),
            StaggeredReveal(
              index: 6,
              child: _SupportLine(email: widget.supportEmail!),
            ),
          ],
        ],
      ],
    );
  }

  Widget _header(AppRole role, String? gym, bool done) {
    final name = gym?.trim();
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (name != null && name.isNotEmpty) ...[
          BrandMark.initials(
            initials: _initials(name),
            role: role,
            size: 36,
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.display(size: 17, color: MaintenancePalette.ink),
            ),
          ),
          const SizedBox(width: 10),
        ],
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: MaintenancePalette.glass,
            borderRadius: BorderRadius.circular(AppRadii.pill),
          ),
          child: Text(
            done ? 'ONLINE' : 'MAINTENANCE',
            style: AppText.eyebrow(color: MaintenancePalette.ink),
          ),
        ),
      ],
    );
  }

  Widget _callout(AppRole role, String? gym, String message) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 16, 14),
      decoration: BoxDecoration(
        color: MaintenancePalette.glass,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: MaintenancePalette.glassBorder),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              width: 4,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [MaintenancePalette.ink, MaintenancePalette.inkFaint],
                ),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    gym == null || gym.trim().isEmpty
                        ? 'NOTE FROM THE TEAM'
                        : 'NOTE FROM ${gym.trim().toUpperCase()}',
                    style: AppText.eyebrow(color: MaintenancePalette.inkSoft),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    message,
                    style: AppText.body(
                      size: 14,
                      weight: FontWeight.w600,
                      color: MaintenancePalette.ink,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _steps(AppRole role, bool done) {
    const labels = ['Paused', 'Upgrading', 'Back online'];
    const icons = [
      Icons.pause_rounded,
      Icons.build_rounded,
      Icons.check_rounded,
    ];
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _loop,
        builder: (_, __) {
          // Triangle wave 0 -> 2 -> 0: the pulse rides out and back smoothly.
          final pos = 2 * (1 - (2 * _loop.value - 1).abs());
          return SizedBox(
            height: 88,
            child: Stack(
              children: [
                Positioned.fill(
                  top: 0,
                  bottom: 40,
                  child: CustomPaint(
                    painter: MaintenanceTrackPainter(
                      pos: pos,
                      rail: MaintenancePalette.rail,
                      colorA: MaintenancePalette.ink,
                      colorB: MaintenancePalette.ink,
                      done: done,
                      success: AppColors.success,
                    ),
                  ),
                ),
                Row(
                  children: [
                    for (var i = 0; i < 3; i++)
                      Expanded(
                        child: _StepNode(
                          label: labels[i],
                          icon: icons[i],
                          role: role,
                          emphasis:
                              done ? 1 : (1 - (pos - i).abs()).clamp(0.0, 1.0),
                          done: done,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _statusCard(BuildContext context, MaintenanceState s, AppRole role) {
    final String headline;
    final String? sub;
    if (s.checking) {
      headline = 'Checking…';
      sub = null;
    } else if (s.offline) {
      headline = "Couldn't reach the server";
      sub = "We'll keep trying.";
    } else {
      headline = 'Next check in';
      sub = null;
    }
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: MaintenancePalette.glass,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: MaintenancePalette.glassBorder),
      ),
      child: Row(
        children: [
          _CountdownRing(
            controller: _ring,
            role: role,
            interval: widget.checkInterval,
            busy: s.checking,
            offline: s.offline,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (s.offline && !s.checking) ...[
                      const Icon(
                        Icons.wifi_off_rounded,
                        size: 14,
                        color: MaintenancePalette.ink,
                      ),
                      const SizedBox(width: 6),
                    ],
                    Flexible(
                      child: Text(
                        headline,
                        style: AppText.body(
                          size: 13,
                          weight: FontWeight.w700,
                          color: MaintenancePalette.ink,
                        ),
                      ),
                    ),
                  ],
                ),
                if (sub != null)
                  Text(
                    sub,
                    style: AppText.body(
                        size: 12,
                      color: MaintenancePalette.inkSoft,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          _CheckButton(
            label: 'Check now',
            loading: s.checking,
            onPressed: () => unawaited(_runCheck(manual: true)),
          ),
        ],
      ),
    );
  }

  static String _initials(String name) {
    final words =
        name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return '?';
    if (words.length == 1) {
      final w = words.first;
      return w.substring(0, w.length < 2 ? w.length : 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }
}

class _StepNode extends StatelessWidget {
  const _StepNode({
    required this.label,
    required this.icon,
    required this.role,
    required this.emphasis,
    required this.done,
  });

  final String label;
  final IconData icon;
  final AppRole role;

  /// 0..1 — how close the travelling pulse is to this node.
  final double emphasis;
  final bool done;

  @override
  Widget build(BuildContext context) {
    final lit = emphasis;
    final fill = done
        ? AppColors.success
        : Color.lerp(MaintenancePalette.glass, MaintenancePalette.ink, lit)!;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 48,
          child: Center(
            child: Container(
              width: 34 + 6 * lit,
              height: 34 + 6 * lit,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: fill,
                border: Border.all(
                  color:
                      done ? AppColors.success : MaintenancePalette.glassBorder,
                ),
                boxShadow: lit > 0.05 || done
                    ? [
                        BoxShadow(
                          color: (done
                                  ? AppColors.success
                                  : MaintenancePalette.ink)
                              .withValues(alpha: 0.35 * (done ? 1 : lit)),
                          blurRadius: 16,
                        ),
                      ]
                    : null,
              ),
              child: Icon(
                icon,
                size: 17,
                color: done
                    ? MaintenancePalette.ink
                    : (lit > 0.5
                        ? MaintenancePalette.violet
                        : MaintenancePalette.inkSoft),
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: AppText.body(
            size: 12,
            weight: FontWeight.w700,
            color: lit > 0.5 || done
                ? MaintenancePalette.ink
                : MaintenancePalette.inkSoft,
          ),
        ),
      ],
    );
  }
}

class _CountdownRing extends StatelessWidget {
  const _CountdownRing({
    required this.controller,
    required this.role,
    required this.interval,
    required this.busy,
    required this.offline,
  });

  final AnimationController controller;
  final AppRole role;
  final Duration interval;
  final bool busy;
  final bool offline;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 46,
      height: 46,
      child: AnimatedBuilder(
        animation: controller,
        builder: (_, __) {
          final left = (interval.inSeconds * (1 - controller.value))
              .ceil()
              .clamp(0, 999);
          return Stack(
            alignment: Alignment.center,
            children: [
              CustomPaint(
                size: const Size.square(46),
                painter: MaintenanceRingPainter(
                  progress: busy ? 1 : controller.value,
                  track: MaintenancePalette.rail,
                  colorA: MaintenancePalette.ink,
                  colorB: MaintenancePalette.ink,
                ),
              ),
              Text(
                busy ? '…' : '$left',
                style: AppText.tabular(size: 13, color: MaintenancePalette.ink),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// White pill on the gradient — the role-gradient `AppButton` would vanish
/// into the warm background.
class _CheckButton extends StatelessWidget {
  const _CheckButton({
    required this.label,
    required this.loading,
    required this.onPressed,
  });

  final String label;
  final bool loading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: MaintenancePalette.ink,
      borderRadius: BorderRadius.circular(AppRadii.buttonSm),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.buttonSm),
        onTap: loading ? null : onPressed,
        child: Container(
          height: 34,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          alignment: Alignment.center,
          child: loading
              ? const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: MaintenancePalette.violet,
                  ),
                )
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.refresh_rounded,
                      size: 14,
                      color: MaintenancePalette.violet,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      label,
                      style: AppText.body(
                        size: 12,
                        weight: FontWeight.w800,
                        color: MaintenancePalette.violet,
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

/// "Need help? support\@example.com" — tap opens the mail app.
class _SupportLine extends StatelessWidget {
  const _SupportLine({required this.email});

  final String email;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.buttonSm),
        onTap: () => unawaited(
          launchUrl(Uri(scheme: 'mailto', path: email))
              .catchError((_) => false),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Text.rich(
            TextSpan(
              style: AppText.body(size: 13, color: MaintenancePalette.inkSoft),
              children: [
                const TextSpan(text: 'Need help? '),
                TextSpan(
                  text: email,
                  style: AppText.body(
                    size: 13,
                    weight: FontWeight.w800,
                    color: MaintenancePalette.ink,
                  ).copyWith(decoration: TextDecoration.underline),
                ),
              ],
            ),
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
