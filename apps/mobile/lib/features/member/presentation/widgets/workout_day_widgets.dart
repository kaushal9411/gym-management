import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/member_workout_tracking.dart';
import '../../../../shared/widgets/menu_button.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../manager/presentation/widgets/member_detail_anim.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../member_workout_logic.dart';
import 'member_profile_blocks.dart';

/// Colours of the workout screens: the member palette (lime → teal) for
/// chrome, plus content colours for the day / exercise states.
class WorkoutColors {
  WorkoutColors._();

  static const done = [Color(0xFF10B981), Color(0xFF14B8A6)];
  static const doneSolid = Color(0xFF10B981);
  static const partial = TeamColors.amber;
  static const missed = TeamColors.rose;
  static const skipped = TeamColors.slate;
  static const effort = TeamColors.violet;
  static const info = TeamColors.sky;

  /// Accent colour of a day state (grey for rest / upcoming).
  static Color ofState(DayState s) => switch (s) {
        DayState.done => doneSolid,
        DayState.partial => partial,
        DayState.missed => missed,
        DayState.skipped => skipped,
        DayState.today => AppColors.memberB,
        _ => AppColors.inkFaint,
      };
}

/// A ring that fills in on first build (instantly under reduced motion),
/// drawn in [color] over a faint track.
class WorkoutRing extends StatelessWidget {
  const WorkoutRing({
    super.key,
    required this.value,
    required this.size,
    required this.color,
    required this.track,
    this.stroke = 10,
    this.child,
  });

  final double value;
  final double size;
  final Color color;
  final Color track;
  final double stroke;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final target = value.clamp(0.0, 1.0);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: target),
      duration: reduceMotion(context)
          ? Duration.zero
          : const Duration(milliseconds: 1400),
      curve: Curves.easeOutBack,
      builder: (context, v, _) => SizedBox(
        width: size,
        height: size,
        child: CustomPaint(
          painter: _RingPainter(v.clamp(0.0, 1.0), color, track, stroke),
          child: Center(child: child),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.value, this.color, this.track, this.stroke);

  final double value;
  final Color color;
  final Color track;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset(stroke / 2, stroke / 2) &
        Size(size.width - stroke, size.height - stroke);
    canvas.drawArc(
      rect,
      0,
      math.pi * 2,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = track,
    );
    if (value <= 0) return;
    canvas.drawArc(
      rect,
      -math.pi / 2,
      math.pi * 2 * value,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.value != value || old.color != color || old.track != track;
}

// ── hero ────────────────────────────────────────────────────────────────────

/// Gradient hero of the Workout tab: menu button, plan name, today's focus,
/// the weekly completion ring, three stat chips and the primary action.
class WorkoutHero extends StatelessWidget {
  const WorkoutHero({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    required this.weekPercent,
    this.stats = const [],
    this.chips = const [],
    this.action,
  });

  final String eyebrow;
  final String title;
  final String subtitle;

  /// Weekly completion, 0–100.
  final int weekPercent;
  final List<(String, int, String Function(int))> stats;
  final List<String> chips;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final on = AppRole.member.onGradient;
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: AppColors.memberGrad,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(30)),
      ),
      child: TeamCenter(
        maxWidth: 1000,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const MenuButton(),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      eyebrow.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.eyebrow(color: on.withValues(alpha: 0.7)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          key: const ValueKey('workout-hero-title'),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.display(size: 30, color: on),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          subtitle,
                          style: AppText.body(
                            size: 12.5,
                            weight: FontWeight.w700,
                            color: on.withValues(alpha: 0.75),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Floating(
                    child: WorkoutRing(
                      key: const ValueKey('hero-ring'),
                      value: weekPercent / 100,
                      size: 86,
                      stroke: 10,
                      color: on,
                      track: on.withValues(alpha: 0.16),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CountUp(
                            value: weekPercent,
                            suffix: '%',
                            style: AppText.display(size: 19, color: on),
                          ),
                          Text(
                            'week',
                            style: AppText.body(
                              size: 9.5,
                              weight: FontWeight.w800,
                              color: on.withValues(alpha: 0.65),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              if (chips.isNotEmpty) ...[
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    for (final c in chips)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 11,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: on.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(99),
                          border: Border.all(color: on.withValues(alpha: 0.22)),
                        ),
                        child: Text(
                          c,
                          style: AppText.body(
                            size: 11.5,
                            weight: FontWeight.w800,
                            color: on,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
              if (stats.isNotEmpty) ...[
                const SizedBox(height: 14),
                Row(
                  children: [
                    for (var i = 0; i < stats.length; i++) ...[
                      if (i > 0) const SizedBox(width: 8),
                      Expanded(
                        child: BounceIn(
                          index: i,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: on.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                FittedBox(
                                  fit: BoxFit.scaleDown,
                                  alignment: Alignment.centerLeft,
                                  child: _HeroStatValue(
                                    value: stats[i].$2,
                                    format: stats[i].$3,
                                    color: on,
                                  ),
                                ),
                                Text(
                                  stats[i].$1,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppText.body(
                                    size: 10.5,
                                    weight: FontWeight.w700,
                                    color: on.withValues(alpha: 0.7),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
              if (action != null) ...[const SizedBox(height: 16), action!],
            ],
          ),
        ),
      ),
    );
  }
}

class _HeroStatValue extends StatelessWidget {
  const _HeroStatValue({
    required this.value,
    required this.format,
    required this.color,
  });

  final int value;
  final String Function(int) format;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.toDouble()),
      duration: reduceMotion(context)
          ? Duration.zero
          : const Duration(milliseconds: 1100),
      curve: Curves.easeOutCubic,
      builder: (context, v, _) => Text(
        format(v.round()),
        maxLines: 1,
        style: AppText.display(size: 18, color: color),
      ),
    );
  }
}

/// Dark rounded button used on the hero (the primary action).
class WorkoutHeroButton extends StatelessWidget {
  const WorkoutHeroButton({
    super.key,
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final on = AppRole.member.onGradient;
    return PressBounce(
      onTap: onTap,
      child: Container(
        height: 48,
        width: double.infinity,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: on,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: on.withValues(alpha: 0.35),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: AppColors.memberA),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(
                  size: 14,
                  weight: FontWeight.w800,
                  color: AppColors.memberA,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── week strip ──────────────────────────────────────────────────────────────

/// One week of the schedule. Tap a day to see and log it; the chevrons page
/// through the weeks the API sent (the back-date window).
class WorkoutWeekStrip extends StatelessWidget {
  const WorkoutWeekStrip({
    super.key,
    required this.tracking,
    required this.weekStart,
    required this.selected,
    required this.onSelect,
    required this.onWeek,
  });

  final WorkoutTracking tracking;
  final String weekStart;
  final String selected;
  final ValueChanged<TrackingDay> onSelect;
  final ValueChanged<String> onWeek;

  @override
  Widget build(BuildContext context) {
    final days = tracking.weekOf(weekStart);
    final earliest =
        tracking.days.isEmpty ? weekStart : tracking.days.first.date;
    final current = weekStartOf(tracking.today);
    final canPrev = addDaysKey(weekStart, -7).compareTo(earliest) >= 0;
    final canNext = weekStart.compareTo(current) < 0;
    return Column(
      children: [
        Row(
          children: [
            _Chevron(
              key: const ValueKey('week-prev'),
              icon: Icons.chevron_left_rounded,
              onTap: canPrev ? () => onWeek(addDaysKey(weekStart, -7)) : null,
            ),
            Expanded(
              child: Text(
                weekStart == current
                    ? 'This week'
                    : '${shortDay(weekStart)} - ${shortDay(addDaysKey(weekStart, 6))}',
                textAlign: TextAlign.center,
                style: AppText.body(size: 13, weight: FontWeight.w800),
              ),
            ),
            _Chevron(
              key: const ValueKey('week-next'),
              icon: Icons.chevron_right_rounded,
              onTap: canNext ? () => onWeek(addDaysKey(weekStart, 7)) : null,
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            for (var i = 0; i < days.length; i++) ...[
              if (i > 0) const SizedBox(width: 5),
              Expanded(
                child: PopIn(
                  index: i,
                  child: _DayCell(
                    day: days[i],
                    selected: days[i].date == selected,
                    onTap: () => onSelect(days[i]),
                  ),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class _Chevron extends StatelessWidget {
  const _Chevron({super.key, required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(
            icon,
            color: onTap == null
                ? AppColors.inkFaint.withValues(alpha: 0.35)
                : AppColors.ink,
          ),
        ),
      );
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.day,
    required this.selected,
    required this.onTap,
  });

  final TrackingDay day;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final on = AppRole.member.onGradient;
    final fg = selected ? on : AppColors.inkSoft;
    return Semantics(
      button: true,
      selected: selected,
      label:
          '${day.label} ${shortDay(day.date)}${day.isToday ? ', today' : ''}, '
          '${day.isRest ? 'rest day' : '${day.completedCount} of ${day.plannedCount} done'}',
      child: PressBounce(
        onTap: onTap,
        child: AnimatedContainer(
          key: ValueKey('day-${day.date}'),
          duration: reduceMotion(context)
              ? Duration.zero
              : const Duration(milliseconds: 260),
          curve: Curves.easeOutBack,
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            gradient: selected ? AppColors.memberGrad : null,
            color: selected ? null : AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected
                  ? Colors.transparent
                  : day.isToday
                      ? AppColors.memberB
                      : AppColors.line,
            ),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: AppColors.memberB.withValues(alpha: 0.35),
                      blurRadius: 12,
                      offset: const Offset(0, 5),
                    ),
                  ]
                : null,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                day.label.substring(0, 3).toUpperCase(),
                maxLines: 1,
                style: AppText.body(
                  size: 9.5,
                  weight: FontWeight.w800,
                  color: fg.withValues(alpha: 0.8),
                ),
              ),
              const SizedBox(height: 3),
              Text(
                '${day.day.day}',
                maxLines: 1,
                style: AppText.display(size: 17, color: fg),
              ),
              const SizedBox(height: 5),
              _DayMark(day: day, selected: selected),
            ],
          ),
        ),
      ),
    );
  }
}

class _DayMark extends StatelessWidget {
  const _DayMark({required this.day, required this.selected});

  final TrackingDay day;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final on = AppRole.member.onGradient;
    const size = 16.0;
    switch (day.state) {
      case DayState.done:
        return Container(
          key: const ValueKey('mark-done'),
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: selected ? on : WorkoutColors.doneSolid,
          ),
          child: Icon(
            Icons.check_rounded,
            size: 11,
            color: selected ? AppColors.memberA : Colors.white,
          ),
        );
      case DayState.partial:
        return _ringMark(selected ? on : WorkoutColors.partial, half: true);
      case DayState.missed:
        return _ringMark(selected ? on : WorkoutColors.missed);
      case DayState.skipped:
        return Icon(
          Icons.skip_next_rounded,
          size: size,
          color: selected ? on : WorkoutColors.skipped,
        );
      case DayState.today:
        return _ringMark(selected ? on : AppColors.memberB);
      case DayState.upcoming:
        return _ringMark(
          (selected ? on : AppColors.inkFaint).withValues(alpha: 0.6),
        );
      case DayState.rest:
      case DayState.outside:
        return Icon(
          Icons.remove_rounded,
          size: size,
          color: (selected ? on : AppColors.inkFaint).withValues(alpha: 0.6),
        );
    }
  }

  Widget _ringMark(Color c, {bool half = false}) => Container(
        width: 16,
        height: 16,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: c, width: 2),
          gradient: half
              ? LinearGradient(
                  stops: const [0.5, 0.5],
                  colors: [c, Colors.transparent],
                )
              : null,
        ),
      );
}

// ── day header + exercise cards ─────────────────────────────────────────────

/// "Monday · Today", "Legs · 3 exercises" and the state pill.
class WorkoutDayHeader extends StatelessWidget {
  const WorkoutDayHeader({super.key, required this.day});

  final TrackingDay day;

  @override
  Widget build(BuildContext context) {
    final title = day.isToday
        ? 'Today · ${day.label}'
        : '${day.label} · ${shortDay(day.date)}';
    final sub = day.isRest
        ? 'Rest day'
        : '${day.focus != null ? '${day.focus} · ' : ''}'
            '${day.plannedCount} ${day.plannedCount == 1 ? 'exercise' : 'exercises'}';
    final (label, color) = switch (day.state) {
      DayState.done => ('Done', WorkoutColors.doneSolid),
      DayState.missed => ('Missed', WorkoutColors.missed),
      DayState.partial => (
          '${day.loggedCount}/${day.plannedCount} logged',
          WorkoutColors.partial,
        ),
      DayState.skipped => ('Skipped', WorkoutColors.skipped),
      DayState.rest || DayState.outside => ('Rest', AppColors.inkFaint),
      _ => (
          day.loggedCount > 0
              ? '${day.loggedCount}/${day.plannedCount} logged'
              : '${day.plannedCount} to do',
          AppColors.memberB,
        ),
    };
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.display(size: 18),
              ),
              Text(
                sub,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w600,
                  color: AppColors.inkFaint,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(99),
          ),
          child: Text(
            label,
            maxLines: 1,
            style: AppText.body(
              size: 11,
              weight: FontWeight.w800,
              color: color,
            ),
          ),
        ),
      ],
    );
  }
}

/// What a card's busy spinner is for.
enum WorkoutAction { done, skip, undo }

/// One exercise of the selected day as a big card: Done / Skip while pending;
/// once logged it shows what was logged with Edit details / Undo.
class WorkoutExerciseCard extends StatelessWidget {
  const WorkoutExerciseCard({
    super.key,
    required this.exercise,
    required this.index,
    required this.canLog,
    required this.lockedReason,
    required this.busyAction,
    required this.anyBusy,
    required this.onDone,
    required this.onSkip,
    required this.onUndo,
    required this.onDetails,
  });

  final TrackingExercise exercise;
  final int index;
  final bool canLog;
  final String? lockedReason;

  /// The action running on THIS card (spinner), null when none.
  final WorkoutAction? busyAction;

  /// Any request in flight on the screen: every button is disabled.
  final bool anyBusy;
  final VoidCallback onDone;
  final VoidCallback onSkip;
  final VoidCallback onUndo;
  final VoidCallback onDetails;

  @override
  Widget build(BuildContext context) {
    final done = exercise.isDone;
    final skipped = exercise.isSkipped;
    final accent = done
        ? WorkoutColors.doneSolid
        : skipped
            ? WorkoutColors.skipped
            : AppColors.memberB;
    final target = exercise.targetLabel;
    final logged = done ? exercise.loggedLabel : null;
    return BounceIn(
      index: index,
      child: AnimatedContainer(
        key: ValueKey('ex-${exercise.exerciseId}'),
        duration: reduceMotion(context)
            ? Duration.zero
            : const Duration(milliseconds: 300),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: exercise.isPending
              ? AppColors.surface2
              : accent.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: exercise.isPending
                ? AppColors.line
                : accent.withValues(alpha: 0.45),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Badge(index: index, exercise: exercise),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        exercise.name,
                        style: AppText.body(
                          size: 15,
                          weight: FontWeight.w800,
                          color: skipped ? AppColors.inkFaint : AppColors.ink,
                        ).copyWith(
                          decoration:
                              skipped ? TextDecoration.lineThrough : null,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          if (exercise.muscleGroup != null)
                            _Tag(exercise.muscleGroup!),
                          if (target != null) _Tag(target, strong: true),
                        ],
                      ),
                      if (exercise.notes != null &&
                          exercise.notes!.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          exercise.notes!,
                          style: AppText.body(
                            size: 11.5,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ],
                      if (logged != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          'Logged: $logged',
                          key: ValueKey('logged-${exercise.exerciseId}'),
                          style: AppText.body(
                            size: 12,
                            weight: FontWeight.w800,
                            color: WorkoutColors.doneSolid,
                          ),
                        ),
                      ],
                      if (done &&
                          exercise.logNotes != null &&
                          exercise.logNotes!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          '“${exercise.logNotes}”',
                          style: AppText.body(
                            size: 11.5,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            AnimatedSwitcher(
              duration: reduceMotion(context)
                  ? Duration.zero
                  : const Duration(milliseconds: 260),
              switchInCurve: Curves.easeOutBack,
              child: _actions(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _actions() {
    if (exercise.isPending) {
      if (!canLog) {
        return Container(
          key: const ValueKey('locked'),
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 11),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Text(
            lockedReason ?? 'Not available',
            textAlign: TextAlign.center,
            style: AppText.body(
              size: 12,
              weight: FontWeight.w700,
              color: AppColors.inkFaint,
            ),
          ),
        );
      }
      return Row(
        key: const ValueKey('pending'),
        children: [
          Expanded(
            flex: 3,
            child: _ActionButton(
              key: ValueKey('done-${exercise.exerciseId}'),
              label: 'Done',
              icon: Icons.check_rounded,
              gradient: WorkoutColors.done,
              busy: busyAction == WorkoutAction.done,
              onTap: anyBusy ? null : onDone,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 2,
            child: _ActionButton(
              key: ValueKey('skip-${exercise.exerciseId}'),
              label: 'Skip',
              icon: Icons.skip_next_rounded,
              busy: busyAction == WorkoutAction.skip,
              onTap: anyBusy ? null : onSkip,
            ),
          ),
          const SizedBox(width: 8),
          _SquareButton(
            key: ValueKey('details-${exercise.exerciseId}'),
            icon: Icons.edit_note_rounded,
            semantics: 'Add sets, reps or weight for ${exercise.name}',
            onTap: anyBusy ? null : onDetails,
          ),
        ],
      );
    }
    return Row(
      key: ValueKey('logged-${exercise.status}'),
      children: [
        if (exercise.isDone)
          Expanded(
            child: _ActionButton(
              key: ValueKey('edit-${exercise.exerciseId}'),
              label: exercise.loggedLabel == null
                  ? 'Add sets, reps, weight'
                  : 'Edit details',
              icon: Icons.edit_rounded,
              compact: true,
              onTap: anyBusy || !canLog ? null : onDetails,
            ),
          ),
        if (exercise.isDone) const SizedBox(width: 8),
        _ActionButton(
          key: ValueKey('undo-${exercise.exerciseId}'),
          label: 'Undo',
          icon: Icons.undo_rounded,
          compact: true,
          busy: busyAction == WorkoutAction.undo,
          onTap: anyBusy || !canLog ? null : onUndo,
        ),
      ],
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.index, required this.exercise});

  final int index;
  final TrackingExercise exercise;

  @override
  Widget build(BuildContext context) {
    final done = exercise.isDone;
    final skipped = exercise.isSkipped;
    return AnimatedContainer(
      duration: reduceMotion(context)
          ? Duration.zero
          : const Duration(milliseconds: 360),
      curve: Curves.elasticOut,
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        gradient: done
            ? const LinearGradient(colors: WorkoutColors.done)
            : skipped
                ? null
                : AppColors.memberGrad,
        color: skipped ? WorkoutColors.skipped : null,
        borderRadius: BorderRadius.circular(15),
        boxShadow: [
          BoxShadow(
            color: (done ? WorkoutColors.doneSolid : AppColors.memberB)
                .withValues(alpha: skipped ? 0 : 0.35),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: done
          ? const Icon(Icons.check_rounded, color: Colors.white, size: 24)
          : skipped
              ? const Icon(Icons.skip_next_rounded, color: Colors.white)
              : Text(
                  '${index + 1}',
                  style: AppText.display(
                    size: 17,
                    color: AppRole.member.onGradient,
                  ),
                ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag(this.label, {this.strong = false});

  final String label;
  final bool strong;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(99),
        ),
        child: Text(
          label,
          style: AppText.body(
            size: 11,
            weight: strong ? FontWeight.w800 : FontWeight.w700,
            color: strong ? AppColors.ink : AppColors.inkFaint,
          ),
        ),
      );
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    super.key,
    required this.label,
    required this.icon,
    required this.onTap,
    this.gradient,
    this.busy = false,
    this.compact = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final List<Color>? gradient;
  final bool busy;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final filled = gradient != null;
    final fg = filled ? Colors.white : AppColors.inkSoft;
    return PressBounce(
      onTap: busy ? null : onTap,
      child: Opacity(
        opacity: onTap == null && !busy ? 0.45 : 1,
        child: Container(
          height: compact ? 44 : 50,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: filled ? LinearGradient(colors: gradient!) : null,
            color: filled ? null : AppColors.surface,
            borderRadius: BorderRadius.circular(15),
            border: filled ? null : Border.all(color: AppColors.line),
            boxShadow: filled
                ? [
                    BoxShadow(
                      color: gradient!.last.withValues(alpha: 0.4),
                      blurRadius: 14,
                      offset: const Offset(0, 6),
                    ),
                  ]
                : null,
          ),
          child: busy
              ? SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2.4, color: fg),
                )
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, size: 17, color: fg),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 13,
                          weight: FontWeight.w800,
                          color: fg,
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

class _SquareButton extends StatelessWidget {
  const _SquareButton({
    super.key,
    required this.icon,
    required this.semantics,
    required this.onTap,
  });

  final IconData icon;
  final String semantics;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: semantics,
        child: PressBounce(
          onTap: onTap,
          child: Opacity(
            opacity: onTap == null ? 0.45 : 1,
            child: Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(15),
                border: Border.all(color: AppColors.line),
              ),
              child: Icon(icon, color: AppColors.inkSoft),
            ),
          ),
        ),
      );
}
