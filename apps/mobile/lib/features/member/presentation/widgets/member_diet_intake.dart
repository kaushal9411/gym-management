import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/diet_plan.dart';
import '../../../../models/member_diet_nutrition.dart';
import '../../../../models/member_workout_progress.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../manager/presentation/widgets/member_detail_anim.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../member_diet_logic.dart';
import 'member_profile_blocks.dart';

/// The last 7 days as tappable chips (oldest first). A dot marks days with
/// anything logged (green = every meal done). Tapping selects the day to log
/// or review — the API accepts the last 7 days.
class DietDayStrip extends StatelessWidget {
  const DietDayStrip({
    required this.days,
    required this.today,
    required this.selected,
    required this.onSelect,
    super.key,
  });

  final List<NutritionDay> days;
  final DateTime today;
  final DateTime selected;
  final ValueChanged<DateTime> onSelect;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < days.length; i++) ...[
          if (i > 0) const SizedBox(width: 6),
          Expanded(child: _chip(days[i], i)),
        ],
      ],
    );
  }

  Widget _chip(NutritionDay d, int i) {
    final on = sameDay(d.date, selected);
    final isToday = sameDay(d.date, today);
    final fg = on ? AppColors.memberOnGrad : AppColors.inkFaint;
    return PopIn(
      index: i,
      child: PressBounce(
        onTap: () => onSelect(d.date),
        child: Semantics(
          button: true,
          selected: on,
          label: isToday ? 'Today' : apiDay(d.date),
          child: AnimatedContainer(
            key: ValueKey('diet-day-${apiDay(d.date)}'),
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
            height: 68,
            decoration: BoxDecoration(
              gradient: on ? AppColors.memberGrad : null,
              color: on ? null : AppColors.surface2,
              borderRadius: BorderRadius.circular(18),
              border:
                  Border.all(color: on ? Colors.transparent : AppColors.line),
              boxShadow: on
                  ? [
                      BoxShadow(
                        color: AppColors.memberB.withValues(alpha: 0.35),
                        blurRadius: 14,
                        offset: const Offset(0, 6),
                      ),
                    ]
                  : null,
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  isToday ? 'Today' : weekdayShort(d.date),
                  maxLines: 1,
                  overflow: TextOverflow.clip,
                  style: AppText.body(
                    size: 9.5,
                    weight: FontWeight.w800,
                    color: fg,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${d.date.day}',
                  style:
                      AppText.display(size: 17, color: on ? fg : AppColors.ink),
                ),
                const SizedBox(height: 4),
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: d.allDone
                        ? (on ? AppColors.memberOnGrad : TeamColors.green)
                        : d.logged
                            ? (on
                                ? AppColors.memberOnGrad.withValues(alpha: 0.6)
                                : TeamColors.amber)
                            : Colors.transparent,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Calorie ring + macro bars + secondary nutrient chips for ONE day: what the
/// member ate (their completed meals) against the plan. All figures come from
/// the API; foods without nutrition data are called out, never guessed.
class DietNutritionCard extends StatelessWidget {
  const DietNutritionCard({
    required this.nutrition,
    required this.day,
    required this.isToday,
    super.key,
  });

  final MemberDietNutrition nutrition;
  final NutritionDay day;
  final bool isToday;

  @override
  Widget build(BuildContext context) {
    final planned = nutrition.planned;
    final denom = calorieDenominator(nutrition);
    final eaten = day.eaten;
    final left = (denom - eaten.calories).clamp(0, double.infinity).toDouble();
    final extras = [
      for (final e in DietExtra.values)
        if (e.of(planned) > 0) e,
    ];
    final macros = [
      for (final m in DietMacro.values)
        if (m.of(planned) > 0) m,
    ];

    return FadeUp(
      index: 1,
      child: TeamSectionCard(
        icon: Icons.local_fire_department_rounded,
        color: TeamColors.amber,
        title: isToday ? "Today's nutrition" : 'Nutrition that day',
        subtitle: 'Counted from the meals you marked done',
        child: !planHasNutrition(nutrition)
            ? Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  "The foods in your plan don't have calories or macros filled "
                  "in, so intake can't be calculated. Your trainer can add them.",
                  key: const ValueKey('diet-no-nutrition'),
                  style: AppText.body(
                    size: 12.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LayoutBuilder(
                    builder: (context, c) {
                      final ring = _ring(eaten.calories, denom);
                      final bars = _bars(macros, eaten, planned, denom, left);
                      if (c.maxWidth >= 480) {
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            ring,
                            const SizedBox(width: 24),
                            Expanded(child: bars),
                          ],
                        );
                      }
                      return Column(
                        children: [
                          ring,
                          const SizedBox(height: 16),
                          bars,
                        ],
                      );
                    },
                  ),
                  if (extras.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (var i = 0; i < extras.length; i++)
                          PopIn(
                            index: i,
                            child: _ExtraChip(
                              extra: extras[i],
                              eaten: extras[i].of(eaten),
                              planned: extras[i].of(planned),
                            ),
                          ),
                      ],
                    ),
                  ],
                  if (nutrition.itemsWithoutData > 0) ...[
                    const SizedBox(height: 14),
                    Container(
                      key: const ValueKey('diet-data-gap'),
                      padding: const EdgeInsets.all(11),
                      decoration: BoxDecoration(
                        color: AppColors.surface2,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.info_outline_rounded,
                            size: 16,
                            color: AppColors.inkFaint,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Some foods have no nutrition data '
                              '(${nutrition.itemsWithoutData} of '
                              '${nutrition.itemsTotal} in your plan), so '
                              'totals can read lower than what you really ate.',
                              style: AppText.body(
                                size: 11.5,
                                color: AppColors.inkFaint,
                                weight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
      ),
    );
  }

  Widget _ring(double eaten, double denom) {
    return AnimatedRing(
      key: const ValueKey('diet-calorie-ring'),
      value: denom > 0 ? eaten / denom : 0,
      size: 168,
      stroke: 16,
      colors: const [
        TeamColors.amber,
        TeamColors.rose,
        TeamColors.fuchsia,
      ],
      track: AppColors.line,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CountUp(
            key: const ValueKey('diet-eaten-kcal'),
            value: eaten,
            style: AppText.display(size: 32),
          ),
          Text(
            denom > 0 ? 'of ${groupInt(denom)} kcal' : 'kcal eaten',
            style: AppText.body(
              size: 11.5,
              weight: FontWeight.w700,
              color: AppColors.inkFaint,
            ),
          ),
        ],
      ),
    );
  }

  Widget _bars(
    List<DietMacro> macros,
    Nutrients eaten,
    Nutrients planned,
    double denom,
    double left,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (denom > 0)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: '${groupInt(left)} kcal ',
                    style: AppText.body(size: 14, weight: FontWeight.w800),
                  ),
                  TextSpan(
                    text: isToday ? 'still to eat today' : 'not eaten that day',
                    style: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w600,
                      color: AppColors.inkFaint,
                    ),
                  ),
                ],
              ),
              key: const ValueKey('diet-kcal-left'),
            ),
          ),
        for (var i = 0; i < macros.length; i++) ...[
          if (i > 0) const SizedBox(height: 12),
          _MacroBar(
            macro: macros[i],
            eaten: macros[i].of(eaten),
            planned: macros[i].of(planned),
          ),
        ],
      ],
    );
  }
}

class _MacroBar extends StatelessWidget {
  const _MacroBar({
    required this.macro,
    required this.eaten,
    required this.planned,
  });

  final DietMacro macro;
  final double eaten;
  final double planned;

  @override
  Widget build(BuildContext context) {
    final color = macro.color;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                macro.label,
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w800,
                  color: color,
                ),
              ),
            ),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: oneDecimal(eaten),
                    style: AppText.tabular(size: 12.5),
                  ),
                  TextSpan(
                    text: ' / ${oneDecimal(planned)} g',
                    style: AppText.tabular(
                      size: 12,
                      weight: FontWeight.w600,
                      color: AppColors.inkFaint,
                    ),
                  ),
                ],
              ),
              key: ValueKey('diet-macro-${macro.name}'),
            ),
          ],
        ),
        const SizedBox(height: 5),
        GrowBar(
          ratio: planned > 0 ? eaten / planned : 0,
          colors: [color, Color.lerp(color, Colors.white, 0.35)!],
          height: 10,
          track: AppColors.line,
        ),
      ],
    );
  }
}

class _ExtraChip extends StatelessWidget {
  const _ExtraChip({
    required this.extra,
    required this.eaten,
    required this.planned,
  });

  final DietExtra extra;
  final double eaten;
  final double planned;

  @override
  Widget build(BuildContext context) {
    final color = extra.color;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: '${extra.label}  ',
              style: AppText.body(
                size: 11.5,
                weight: FontWeight.w800,
                color: color,
              ),
            ),
            TextSpan(
              text:
                  '${oneDecimal(eaten)} / ${oneDecimal(planned)} ${extra.unit}',
              style: AppText.tabular(size: 11.5),
            ),
          ],
        ),
        key: ValueKey('diet-extra-${extra.name}'),
      ),
    );
  }
}

/// Big tappable meal cards for the selected day: the foods, kcal / protein,
/// Done / Skip and Undo. Tapping the header expands the food list.
class DietMealCards extends StatefulWidget {
  const DietMealCards({
    required this.meals,
    required this.day,
    required this.busyMeal,
    required this.disabled,
    required this.onSet,
    required this.subtitle,
    super.key,
  });

  final List<NutritionPlanMeal> meals;
  final NutritionDay day;

  /// Meal being saved right now (its buttons are disabled).
  final MealType? busyMeal;
  final bool disabled;
  final void Function(MealType meal, ExerciseProgressStatus status) onSet;
  final String subtitle;

  @override
  State<DietMealCards> createState() => _DietMealCardsState();
}

class _DietMealCardsState extends State<DietMealCards> {
  MealType? _open;

  @override
  Widget build(BuildContext context) {
    return FadeUp(
      index: 2,
      child: TeamSectionCard(
        icon: Icons.restaurant_rounded,
        color: TeamColors.green,
        title: 'Meals',
        subtitle: widget.subtitle,
        child: widget.meals.isEmpty
            ? Text(
                'No meals in your plan yet.',
                style: AppText.body(
                  size: 12.5,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              )
            : Column(
                children: [
                  for (var i = 0; i < widget.meals.length; i++) ...[
                    if (i > 0) const SizedBox(height: 10),
                    BounceIn(index: i, child: _card(widget.meals[i])),
                  ],
                ],
              ),
      ),
    );
  }

  Widget _card(NutritionPlanMeal meal) {
    final status = widget.day.statusOf(meal.mealType);
    final style = mealStyle(meal.mealType);
    final open = _open == meal.mealType;
    final busy = widget.busyMeal == meal.mealType;
    final pending = status == ExerciseProgressStatus.pending;
    final done = status == ExerciseProgressStatus.completed;
    final skipped = status == ExerciseProgressStatus.skipped;
    final accent = done
        ? TeamColors.green
        : skipped
            ? TeamColors.slate
            : style.color;
    final hasMacros = meal.nutrients.calories > 0 || meal.nutrients.protein > 0;
    final reduce = reduceMotion(context);

    return Container(
      key: ValueKey('diet-meal-${meal.mealType.apiValue}'),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            accent.withValues(alpha: pending ? 0.12 : 0.2),
            accent.withValues(alpha: 0.02),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: accent.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PressBounce(
            onTap: () => setState(() => _open = open ? null : meal.mealType),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
              child: Row(
                children: [
                  AnimatedSwitcher(
                    duration: Duration(milliseconds: reduce ? 0 : 450),
                    switchInCurve: Curves.elasticOut,
                    transitionBuilder: (child, anim) =>
                        ScaleTransition(scale: anim, child: child),
                    child: Container(
                      key: ValueKey('${meal.mealType.name}-${status.name}'),
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(15),
                        gradient: LinearGradient(
                          colors: [
                            accent,
                            Color.lerp(accent, Colors.white, 0.35)!,
                          ],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: accent.withValues(alpha: 0.4),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Icon(
                        done
                            ? Icons.check_rounded
                            : skipped
                                ? Icons.skip_next_rounded
                                : style.icon,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          meal.mealType.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.display(size: 16),
                        ),
                        Text(
                          hasMacros
                              ? '${groupInt(meal.nutrients.calories)} kcal · '
                                  '${oneDecimal(meal.nutrients.protein)} g protein'
                              : '${meal.items.length} '
                                  'item${meal.items.length == 1 ? '' : 's'}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 11.5,
                            weight: FontWeight.w600,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (done || skipped) ...[
                    const SizedBox(width: 8),
                    TeamTag(
                      label: done ? 'Done' : 'Skipped',
                      color: accent,
                    ),
                  ],
                  const SizedBox(width: 4),
                  AnimatedRotation(
                    turns: open ? 0.5 : 0,
                    duration: Duration(milliseconds: reduce ? 0 : 220),
                    child: Icon(
                      Icons.expand_more_rounded,
                      color: AppColors.inkFaint,
                    ),
                  ),
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: Duration(milliseconds: reduce ? 0 : 240),
            curve: Curves.easeOutCubic,
            alignment: Alignment.topCenter,
            child: open
                ? Padding(
                    padding: const EdgeInsets.fromLTRB(14, 0, 14, 6),
                    child: Column(
                      children: [
                        for (final it in meal.items)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 5),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Text(
                                    '${it.name} · ${it.quantity == 1 ? '' : '${oneDecimal(it.quantity)} × '}'
                                    '${it.servingSize ?? 'serving'}',
                                    style: AppText.body(
                                      size: 12,
                                      weight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  it.hasData
                                      ? '${groupInt(it.nutrients.calories)} kcal'
                                      : 'no data',
                                  style: AppText.tabular(
                                    size: 11.5,
                                    weight: FontWeight.w600,
                                    color: AppColors.inkFaint,
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  )
                : const SizedBox(width: double.infinity),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: status == ExerciseProgressStatus.pending
                ? Row(
                    children: [
                      Expanded(
                        child: _MealButton(
                          key: ValueKey('meal-done-${meal.mealType.apiValue}'),
                          label: 'Done',
                          icon: Icons.check_rounded,
                          filled: true,
                          enabled: !widget.disabled && !busy,
                          onTap: () => widget.onSet(
                            meal.mealType,
                            ExerciseProgressStatus.completed,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _MealButton(
                          key: ValueKey('meal-skip-${meal.mealType.apiValue}'),
                          label: 'Skip',
                          icon: Icons.skip_next_rounded,
                          filled: false,
                          enabled: !widget.disabled && !busy,
                          onTap: () => widget.onSet(
                            meal.mealType,
                            ExerciseProgressStatus.skipped,
                          ),
                        ),
                      ),
                    ],
                  )
                : _MealButton(
                    key: ValueKey('meal-undo-${meal.mealType.apiValue}'),
                    label: 'Undo',
                    icon: Icons.undo_rounded,
                    filled: false,
                    enabled: !widget.disabled && !busy,
                    onTap: () => widget.onSet(
                      meal.mealType,
                      ExerciseProgressStatus.pending,
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _MealButton extends StatelessWidget {
  const _MealButton({
    required this.label,
    required this.icon,
    required this.filled,
    required this.enabled,
    required this.onTap,
    super.key,
  });

  final String label;
  final IconData icon;
  final bool filled;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = filled ? Colors.white : AppColors.inkFaint;
    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: PressBounce(
        onTap: enabled ? onTap : null,
        child: Container(
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: filled
                ? const LinearGradient(
                    colors: [Color(0xFF059669), Color(0xFF14B8A6)],
                  )
                : null,
            color: filled ? null : AppColors.surface2,
            borderRadius: BorderRadius.circular(15),
            border: filled ? null : Border.all(color: AppColors.line),
            boxShadow: filled
                ? [
                    BoxShadow(
                      color: const Color(0xFF059669).withValues(alpha: 0.35),
                      blurRadius: 12,
                      offset: const Offset(0, 5),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: fg),
              const SizedBox(width: 6),
              Text(
                label,
                style: AppText.body(
                  size: 13.5,
                  weight: FontWeight.w800,
                  color: fg,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
