import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/member_workout_tracking.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../member_workout_logic.dart';
import 'member_profile_blocks.dart';
import 'workout_day_widgets.dart';

Color _rateColor(double rate) => rate >= 0.75
    ? WorkoutColors.doneSolid
    : rate >= 0.4
        ? WorkoutColors.partial
        : WorkoutColors.missed;

/// "This week": the animated completion ring plus the last seven days as dots
/// (filled = completed session, half = unfinished, red ring = missed).
class WorkoutWeekCard extends StatelessWidget {
  const WorkoutWeekCard({super.key, required this.tracking});

  final WorkoutTracking tracking;

  @override
  Widget build(BuildContext context) {
    final w = tracking.week;
    return TeamSectionCard(
      icon: Icons.donut_large_rounded,
      color: WorkoutColors.doneSolid,
      title: 'This week',
      subtitle: '${shortDay(w.start)} - ${shortDay(w.end)}',
      child: Column(
        children: [
          WorkoutRing(
            key: const ValueKey('week-ring'),
            value: w.completionPercent / 100,
            size: 132,
            stroke: 13,
            color: WorkoutColors.doneSolid,
            track: AppColors.line,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _Count(
                  value: w.completionPercent,
                  suffix: '%',
                  style: AppText.display(size: 30),
                ),
                Text(
                  '${w.completedExercises}/${w.plannedExercises} exercises',
                  style: AppText.body(
                    size: 10.5,
                    weight: FontWeight.w700,
                    color: AppColors.inkFaint,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'LAST 7 DAYS',
              style: AppText.eyebrow(color: AppColors.inkFaint),
            ),
          ),
          const SizedBox(height: 8),
          WorkoutStreakDots(days: tracking.lastSeven),
        ],
      ),
    );
  }
}

/// Count-up number that shows its final value immediately under reduced
/// motion.
class _Count extends StatelessWidget {
  const _Count({required this.value, required this.style, this.suffix = ''});

  final num value;
  final TextStyle style;
  final String suffix;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: value.toDouble()),
        duration: reduceMotion(context)
            ? Duration.zero
            : const Duration(milliseconds: 1200),
        curve: Curves.easeOutCubic,
        builder: (context, v, _) => Text(
          '${v.round()}$suffix',
          maxLines: 1,
          style: style,
        ),
      );
}

class WorkoutStreakDots extends StatelessWidget {
  const WorkoutStreakDots({super.key, required this.days});

  final List<TrackingDay> days;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          for (var i = 0; i < days.length; i++)
            BounceIn(
              index: i,
              child: _Dot(day: days[i]),
            ),
        ],
      );
}

class _Dot extends StatelessWidget {
  const _Dot({required this.day});

  final TrackingDay day;

  @override
  Widget build(BuildContext context) {
    final color = WorkoutColors.ofState(day.state);
    final rest = day.state == DayState.rest || day.state == DayState.outside;
    final done = day.state == DayState.done;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          day.label.substring(0, 1),
          style: AppText.body(
            size: 10.5,
            weight: FontWeight.w800,
            color: day.isToday ? AppColors.memberB : AppColors.inkFaint,
          ),
        ),
        const SizedBox(height: 5),
        Container(
          key: ValueKey('streak-${day.date}-${day.state.name}'),
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: done
                ? const LinearGradient(colors: WorkoutColors.done)
                : day.state == DayState.partial
                    ? LinearGradient(
                        stops: const [0.5, 0.5],
                        colors: [color, Colors.transparent],
                      )
                    : null,
            border: Border.all(
              color: rest ? AppColors.line : color,
              width: 2,
            ),
          ),
          child: done
              ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
              : null,
        ),
      ],
    );
  }
}

/// A saturated gradient stat tile with a counting number.
class WorkoutStatTile extends StatelessWidget {
  const WorkoutStatTile({
    super.key,
    required this.label,
    required this.value,
    required this.hint,
    required this.icon,
    required this.colors,
    required this.index,
    this.format,
  });

  final String label;
  final num value;
  final String hint;
  final IconData icon;
  final List<Color> colors;
  final int index;
  final String Function(int)? format;

  @override
  Widget build(BuildContext context) => BounceIn(
        index: index,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: colors,
            ),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: colors.last.withValues(alpha: 0.35),
                blurRadius: 14,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(icon, size: 18, color: Colors.white),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 11.5,
                        weight: FontWeight.w800,
                        color: Colors.white.withValues(alpha: 0.9),
                      ),
                    ),
                  ),
                ],
              ),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: format == null
                    ? _Count(
                        value: value,
                        style: AppText.display(size: 22, color: Colors.white),
                      )
                    : TweenAnimationBuilder<double>(
                        tween: Tween(begin: 0, end: value.toDouble()),
                        duration: reduceMotion(context)
                            ? Duration.zero
                            : const Duration(milliseconds: 1200),
                        curve: Curves.easeOutCubic,
                        builder: (context, v, _) => Text(
                          format!(v.round()),
                          maxLines: 1,
                          style: AppText.display(size: 22, color: Colors.white),
                        ),
                      ),
              ),
              Text(
                hint,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(
                  size: 10.5,
                  weight: FontWeight.w700,
                  color: Colors.white.withValues(alpha: 0.82),
                ),
              ),
            ],
          ),
        ),
      );
}

/// The tiles of the progress section — only ones backed by real data.
List<Widget> workoutStatTiles(WorkoutTracking t) {
  final w = t.week;
  final l = t.last30;
  final tiles =
      <(String, num, String, IconData, List<Color>, String Function(int)?)>[
    (
      'Sessions',
      w.completedSessions,
      w.plannedSessions == 0
          ? 'No training days'
          : 'of ${w.plannedSessions} this week',
      Icons.emoji_events_rounded,
      const [Color(0xFF059669), Color(0xFF14B8A6)],
      (v) => '$v/${w.plannedSessions}',
    ),
    (
      'Streak',
      t.streak,
      t.streak == 1 ? 'session in a row' : 'sessions in a row',
      Icons.local_fire_department_rounded,
      const [Color(0xFFF59E0B), Color(0xFFFF5C7A)],
      null,
    ),
    (
      'Done · 30 days',
      l.exercisesCompleted,
      '${l.sessionsDone} full ${l.sessionsDone == 1 ? 'session' : 'sessions'}',
      Icons.fitness_center_rounded,
      const [Color(0xFF0EA5E9), Color(0xFF6366F1)],
      null,
    ),
    if (l.minutes != null)
      (
        'Minutes · 30 days',
        l.minutes!,
        'From durations you logged',
        Icons.timer_rounded,
        const [Color(0xFF8B5CF6), Color(0xFFC026D3)],
        null,
      )
    else if (l.avgEffort != null)
      (
        'Avg effort',
        l.avgEffort! * 10,
        'From your session ratings',
        Icons.speed_rounded,
        const [Color(0xFF8B5CF6), Color(0xFFC026D3)],
        (v) => '${(v / 10).toStringAsFixed(1)}/5',
      )
    else
      (
        'Skipped · week',
        w.skippedExercises,
        'Exercises skipped',
        Icons.skip_next_rounded,
        const [Color(0xFF64748B), Color(0xFF475569)],
        null,
      ),
    if (l.volumeKg != null)
      (
        'Volume · 30 days',
        l.volumeKg!,
        'Sets x reps x kg you logged',
        Icons.scale_rounded,
        const [Color(0xFFC026D3), Color(0xFFFF5C7A)],
        (v) => '$v kg',
      ),
  ];
  return [
    for (var i = 0; i < tiles.length; i++)
      WorkoutStatTile(
        key: ValueKey('stat-${tiles[i].$1}'),
        label: tiles[i].$1,
        value: tiles[i].$2,
        hint: tiles[i].$3,
        icon: tiles[i].$4,
        colors: tiles[i].$5,
        format: tiles[i].$6,
        index: i,
      ),
  ];
}

/// Eight weeks of "planned sessions completed"; bars spring up. The current
/// week is marked.
class WorkoutConsistencyChart extends StatelessWidget {
  const WorkoutConsistencyChart({super.key, required this.weeks});

  final List<ConsistencyWeek> weeks;

  @override
  Widget build(BuildContext context) {
    final reduce = reduceMotion(context);
    return Column(
      children: [
        SizedBox(
          height: 132,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (var i = 0; i < weeks.length; i++) ...[
                if (i > 0) const SizedBox(width: 6),
                Expanded(child: _Bar(week: weeks[i], index: i, reduce: reduce)),
              ],
            ],
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            for (var i = 0; i < weeks.length; i++) ...[
              if (i > 0) const SizedBox(width: 6),
              Expanded(
                child: Text(
                  weeks[i].isCurrent
                      ? 'Now'
                      : '${parseDayKey(weeks[i].weekStart).day}',
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  style: AppText.body(
                    size: 10,
                    weight:
                        weeks[i].isCurrent ? FontWeight.w800 : FontWeight.w600,
                    color: weeks[i].isCurrent
                        ? AppColors.memberB
                        : AppColors.inkFaint,
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

class _Bar extends StatelessWidget {
  const _Bar({required this.week, required this.index, required this.reduce});

  final ConsistencyWeek week;
  final int index;
  final bool reduce;

  @override
  Widget build(BuildContext context) {
    final pct = week.percent;
    final color = pct == null ? AppColors.inkFaint : _rateColor(pct / 100);
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Text(
          pct == null ? '' : '$pct%',
          style: AppText.body(
            size: 9.5,
            weight: FontWeight.w800,
            color: AppColors.inkFaint,
          ),
        ),
        const SizedBox(height: 3),
        if (pct == null)
          Container(
            key: ValueKey('bar-${week.weekStart}-none'),
            height: 3,
            decoration: BoxDecoration(
              color: AppColors.line,
              borderRadius: BorderRadius.circular(3),
            ),
          )
        else
          TweenAnimationBuilder<double>(
            key: ValueKey('bar-${week.weekStart}-$pct'),
            tween: Tween(begin: 0, end: (pct.clamp(6, 100)) / 100),
            duration: reduce
                ? Duration.zero
                : Duration(milliseconds: 700 + index * 70),
            curve: Curves.elasticOut,
            builder: (context, v, _) => Container(
              height: (100 * v).clamp(0, 108).toDouble(),
              decoration: BoxDecoration(
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(10)),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color.lerp(color, Colors.white, 0.35)!, color],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// One chip per exercise: done / due over the last four weeks, skips called
/// out.
class WorkoutExerciseChips extends StatelessWidget {
  const WorkoutExerciseChips({super.key, required this.stats});

  final List<ExerciseStat> stats;

  @override
  Widget build(BuildContext context) => Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (var i = 0; i < stats.length; i++)
            BounceIn(index: i, child: _Chip(stat: stats[i])),
        ],
      );
}

class _Chip extends StatelessWidget {
  const _Chip({required this.stat});

  final ExerciseStat stat;

  @override
  Widget build(BuildContext context) {
    final color =
        stat.planned == 0 ? AppColors.inkFaint : _rateColor(stat.rate);
    return Container(
      key: ValueKey('chip-${stat.exerciseId}'),
      constraints: const BoxConstraints(maxWidth: 260),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: Text(
              stat.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(size: 12, weight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            stat.planned == 0 ? '-' : '${stat.completed}/${stat.planned}',
            style: AppText.body(
              size: 12,
              weight: FontWeight.w800,
              color: color,
            ),
          ),
          if (stat.skipped > 0) ...[
            const SizedBox(width: 6),
            Text(
              '${stat.skipped} skipped',
              style: AppText.body(
                size: 10,
                weight: FontWeight.w800,
                color: AppColors.inkFaint,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Completion bar per muscle group (only groups that were due).
class WorkoutMuscleBars extends StatelessWidget {
  const WorkoutMuscleBars({super.key, required this.groups});

  final List<MuscleGroupStat> groups;

  @override
  Widget build(BuildContext context) {
    final shown = [
      for (final g in groups)
        if (g.planned > 0) g,
    ];
    final reduce = reduceMotion(context);
    return Column(
      children: [
        for (var i = 0; i < shown.length; i++) ...[
          if (i > 0) const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Text(
                  shown[i].name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 12, weight: FontWeight.w700),
                ),
              ),
              Text(
                '${shown[i].completed}/${shown[i].planned} · ${(shown[i].rate * 100).round()}%',
                style: AppText.body(
                  size: 11.5,
                  weight: FontWeight.w700,
                  color: AppColors.inkFaint,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(9),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: shown[i].rate.clamp(0.02, 1.0)),
              duration:
                  reduce ? Duration.zero : Duration(milliseconds: 800 + i * 80),
              curve: Curves.easeOutBack,
              builder: (context, v, _) => Container(
                height: 9,
                color: AppColors.line,
                alignment: Alignment.centerLeft,
                child: FractionallySizedBox(
                  widthFactor: v.clamp(0.0, 1.0),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(9),
                      gradient: LinearGradient(
                        colors: [
                          _rateColor(shown[i].rate),
                          Color.lerp(
                            _rateColor(shown[i].rate),
                            Colors.white,
                            0.35,
                          )!,
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Heaviest logged weight per exercise (only exists when weights were logged).
class WorkoutPersonalBests extends StatelessWidget {
  const WorkoutPersonalBests({super.key, required this.bests});

  final List<PersonalBest> bests;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          for (final p in bests)
            Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.surface2,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.line),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.emoji_events_rounded,
                    size: 18,
                    color: TeamColors.amber,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Row(
                      children: [
                        Flexible(
                          child: Text(
                            p.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 13,
                              weight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (p.isNew) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: WorkoutColors.doneSolid,
                              borderRadius: BorderRadius.circular(99),
                            ),
                            child: Text(
                              'NEW',
                              style: AppText.body(
                                size: 9,
                                weight: FontWeight.w900,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${fmtKg(p.weightKg)} kg'
                    '${p.repsDone != null ? ' x ${p.repsDone}' : ''}',
                    style: AppText.body(size: 13, weight: FontWeight.w800),
                  ),
                ],
              ),
            ),
        ],
      );
}

/// "How to get better results": the server's rule-based advice (max 4).
class WorkoutInsightsCard extends StatelessWidget {
  const WorkoutInsightsCard({super.key, required this.insights});

  final List<WorkoutInsight> insights;

  @override
  Widget build(BuildContext context) {
    if (insights.isEmpty) return const SizedBox.shrink();
    return TeamSectionCard(
      icon: Icons.auto_awesome_rounded,
      color: TeamColors.violet,
      title: 'How to get better results',
      subtitle: "Based on what you've logged",
      child: Column(
        children: [
          for (var i = 0; i < insights.length; i++)
            BounceIn(
              index: i,
              child: _InsightRow(insight: insights[i], index: i),
            ),
        ],
      ),
    );
  }
}

class _InsightRow extends StatelessWidget {
  const _InsightRow({required this.insight, required this.index});

  final WorkoutInsight insight;
  final int index;

  @override
  Widget build(BuildContext context) {
    final (color, icon) = switch (insight.tone) {
      InsightTone.good => (WorkoutColors.doneSolid, Icons.check_circle_rounded),
      InsightTone.warn => (WorkoutColors.partial, Icons.warning_amber_rounded),
      InsightTone.tip => (WorkoutColors.info, Icons.lightbulb_rounded),
    };
    return Container(
      key: ValueKey('insight-$index'),
      margin: EdgeInsets.only(top: index == 0 ? 0 : 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(icon, size: 18, color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  insight.title,
                  style: AppText.body(
                    size: 13.5,
                    weight: FontWeight.w800,
                    color: color,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  insight.body,
                  style: AppText.body(size: 12.5, color: AppColors.inkSoft),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
