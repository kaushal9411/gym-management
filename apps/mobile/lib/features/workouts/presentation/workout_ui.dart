import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/workout_plan.dart';
import '../../plans/presentation/plan_ui.dart' show PlanGlyph;
import '../../team/presentation/widgets/team_ui.dart';

/// Shared building blocks for the Workout Plans screens (Owner / Manager
/// catalog and the Trainer's per-client flow): level + weekday colours,
/// muscle-group glyphs, the Mon-Sun strip, exercise rows. Same visual language
/// as the Membership Plans / Branches / Team redesigns - it reuses the Team kit
/// (`team_ui.dart`) and only adds what is workout-specific.

// ── enums -> colours / glyphs ───────────────────────────────────────────────

Color levelColor(WorkoutLevel l) => switch (l) {
      WorkoutLevel.beginner => TeamColors.green,
      WorkoutLevel.intermediate => TeamColors.amber,
      WorkoutLevel.advanced => TeamColors.rose,
    };

IconData levelIcon(WorkoutLevel l) => switch (l) {
      WorkoutLevel.beginner => Icons.signal_cellular_alt_1_bar_rounded,
      WorkoutLevel.intermediate => Icons.signal_cellular_alt_2_bar_rounded,
      WorkoutLevel.advanced => Icons.signal_cellular_alt_rounded,
    };

Color dayColor(WeekDay d) => switch (d) {
      WeekDay.monday => TeamColors.indigo,
      WeekDay.tuesday => TeamColors.violet,
      WeekDay.wednesday => TeamColors.teal,
      WeekDay.thursday => TeamColors.amber,
      WeekDay.friday => TeamColors.green,
      WeekDay.saturday => TeamColors.rose,
      WeekDay.sunday => TeamColors.fuchsia,
    };

/// Glyph for a free-text muscle group / category ("Chest", "Upper back" ...).
IconData muscleIcon(String? group) {
  final g = (group ?? '').toLowerCase();
  if (g.contains('chest') || g.contains('pec')) return Icons.shield_rounded;
  if (g.contains('back') || g.contains('lat')) {
    return Icons.accessibility_new_rounded;
  }
  if (g.contains('leg') ||
      g.contains('quad') ||
      g.contains('ham') ||
      g.contains('glute') ||
      g.contains('calf') ||
      g.contains('calves')) {
    return Icons.directions_run_rounded;
  }
  if (g.contains('shoulder') || g.contains('delt')) {
    return Icons.open_with_rounded;
  }
  if (g.contains('arm') ||
      g.contains('bicep') ||
      g.contains('tricep') ||
      g.contains('forearm')) {
    return Icons.sports_gymnastics_rounded;
  }
  if (g.contains('core') || g.contains('abs') || g.contains('abdom')) {
    return Icons.self_improvement_rounded;
  }
  if (g.contains('cardio') || g.contains('hiit')) {
    return Icons.favorite_rounded;
  }
  if (g.contains('full') || g.contains('body')) return Icons.bolt_rounded;
  return Icons.fitness_center_rounded;
}

Color muscleColor(String? group) {
  final g = (group ?? '').toLowerCase();
  if (g.isEmpty) return TeamColors.indigo;
  final h = g.codeUnits.fold<int>(0, (a, c) => (a * 31 + c) & 0x7fffffff);
  return TeamColors.rotation[h % TeamColors.rotation.length];
}

// ── status ──────────────────────────────────────────────────────────────────

Color workoutTone({required bool deleted, required bool active}) => deleted
    ? TeamColors.rose
    : active
        ? TeamColors.green
        : TeamColors.amber;

String workoutStatus({required bool deleted, required bool active}) => deleted
    ? 'Deleted'
    : active
        ? 'Active'
        : 'Inactive';

IconData workoutStatusIcon({required bool deleted, required bool active}) =>
    deleted
        ? Icons.delete_outline_rounded
        : active
            ? Icons.check_circle_rounded
            : Icons.pause_circle_rounded;

// ── formatting ──────────────────────────────────────────────────────────────

String weeksLabel(int w) => '$w ${w == 1 ? 'week' : 'weeks'}';

String fmtSetsReps(int? sets, int? reps) {
  if (sets != null && reps != null) return '$sets × $reps';
  if (sets != null) return '$sets sets';
  if (reps != null) return '$reps reps';
  return '';
}

// ── week strip ──────────────────────────────────────────────────────────────

/// Mon-Sun strip: one tile per day with its exercise count (a dash for a rest
/// day). Tapping selects a day when [onTap] is given. Today's label is
/// highlighted.
class WeekStrip extends StatelessWidget {
  const WeekStrip({
    super.key,
    required this.counts,
    this.selected,
    this.onTap,
    this.dense = false,
  });

  final Map<WeekDay, int> counts;
  final WeekDay? selected;
  final ValueChanged<WeekDay>? onTap;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final today = WeekDayX.fromDate(DateTime.now());
    return Row(
      children: [
        for (final d in WeekDay.values)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: _cell(d, today),
            ),
          ),
      ],
    );
  }

  Widget _cell(WeekDay d, WeekDay today) {
    final count = counts[d] ?? 0;
    final color = dayColor(d);
    final on = selected == d;
    final isToday = d == today;
    final box = AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      height: dense ? 28 : 40,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(dense ? 9 : 13),
        gradient: on
            ? LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [color, Color.lerp(color, TeamColors.fuchsia, 0.5)!],
              )
            : null,
        color: on
            ? null
            : count > 0
                ? color.withValues(alpha: 0.16)
                : AppColors.surface3,
        border: Border.all(
          color: on
              ? Colors.transparent
              : count > 0
                  ? color.withValues(alpha: 0.35)
                  : AppColors.line,
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        count > 0 ? '$count' : '–',
        style: AppText.display(
          size: dense ? 12 : 15,
          color: on
              ? Colors.white
              : count > 0
                  ? color
                  : AppColors.inkFaint,
        ),
      ),
    );
    final cell = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          d.shortLabel,
          maxLines: 1,
          style: AppText.body(
            size: dense ? 9.5 : 10.5,
            weight: isToday ? FontWeight.w900 : FontWeight.w700,
            color: isToday ? color : AppColors.inkFaint,
          ),
        ),
        SizedBox(height: dense ? 3 : 5),
        box,
      ],
    );
    if (onTap == null) {
      return KeyedSubtree(key: ValueKey('day-${d.name}'), child: cell);
    }
    return Material(
      key: ValueKey('day-${d.name}'),
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(13),
        onTap: () => onTap!(d),
        child: cell,
      ),
    );
  }
}

// ── exercise rows ───────────────────────────────────────────────────────────

/// The display fields of one scheduled exercise, whether it comes from a
/// saved plan row or an unsaved draft.
class ExerciseLine {
  const ExerciseLine({
    required this.name,
    this.muscle,
    this.sets,
    this.reps,
  });

  factory ExerciseLine.fromPlan(PlanExercise e) => ExerciseLine(
        name: e.exercise.name,
        muscle: e.exercise.muscleGroup,
        sets: e.sets,
        reps: e.repetitions,
      );

  final String name;
  final String? muscle;
  final int? sets;
  final int? reps;
}

class MiniChip extends StatelessWidget {
  const MiniChip({
    super.key,
    required this.label,
    required this.color,
    this.icon,
  });

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: color),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 10.5,
                weight: FontWeight.w800,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// One exercise of a day: muscle glyph, name, sets x reps and muscle group
/// (what web's schedule shows; rest and notes are kept on save, not displayed).
class ExerciseTile extends StatelessWidget {
  const ExerciseTile({
    super.key,
    required this.line,
    this.index,
    this.trailing,
    this.onTap,
  });

  final ExerciseLine line;

  /// 1-based position shown on the glyph chip when given.
  final int? index;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = muscleColor(line.muscle);
    final reps = fmtSetsReps(line.sets, line.reps);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.fromLTRB(10, 10, 6, 10),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(13),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      color.withValues(alpha: 0.30),
                      color.withValues(alpha: 0.10),
                    ],
                  ),
                ),
                alignment: Alignment.center,
                child: index != null
                    ? Text(
                        '$index',
                        style: AppText.display(size: 16, color: color),
                      )
                    : Icon(muscleIcon(line.muscle), size: 20, color: color),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      line.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 13.5, weight: FontWeight.w800),
                    ),
                    const SizedBox(height: 5),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        if (reps.isNotEmpty)
                          MiniChip(
                            label: reps,
                            color: TeamColors.indigo,
                            icon: Icons.repeat_rounded,
                          ),
                        if (line.muscle != null && line.muscle!.isNotEmpty)
                          MiniChip(label: line.muscle!, color: color),
                      ],
                    ),
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
        ),
      ),
    );
  }
}

// ── banner (edit screens) ───────────────────────────────────────────────────

/// Gradient banner under a transparent AppBar (edit form, trainer create).
class WorkoutBanner extends StatelessWidget {
  const WorkoutBanner({
    super.key,
    required this.top,
    required this.name,
    required this.subtitle,
    required this.chip,
    required this.chipIcon,
  });

  final double top;
  final String name;
  final String subtitle;
  final String chip;
  final IconData chipIcon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(18, top + 4, 18, 22),
      decoration: const BoxDecoration(
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(30)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF312E81), Color(0xFF7C3AED), TeamColors.fuchsia],
        ),
      ),
      child: TeamCenter(
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(3),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white,
              ),
              child: const PlanGlyph(icon: Icons.fitness_center_rounded),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.display(size: 20, color: Colors.white),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.85),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TeamHeroPill(chip, icon: chipIcon),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
