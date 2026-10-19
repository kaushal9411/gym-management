import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/member_diet_nutrition.dart';
import '../../../manager/presentation/widgets/member_detail_anim.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../member_diet_logic.dart';
import 'member_profile_blocks.dart';

/// "What to do next": the rule-based advice the API computed from the
/// member's real logs (identical on web and mobile). Max ~4 cards.
class DietInsightsCard extends StatelessWidget {
  const DietInsightsCard({required this.insights, super.key});

  final List<DietInsight> insights;

  @override
  Widget build(BuildContext context) {
    return FadeUp(
      index: 3,
      child: TeamSectionCard(
        icon: Icons.track_changes_rounded,
        color: TeamColors.violet,
        title: 'What to do next',
        subtitle: "Based on what you've logged",
        child: insights.isEmpty
            ? Text(
                'Nothing to flag. Keep logging — tips show up here as your '
                'week fills in.',
                style: AppText.body(
                  size: 12.5,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              )
            : Column(
                children: [
                  for (var i = 0; i < insights.length; i++) ...[
                    if (i > 0) const SizedBox(height: 10),
                    BounceIn(
                      index: i,
                      child: _InsightTile(insight: insights[i]),
                    ),
                  ],
                ],
              ),
      ),
    );
  }
}

class _InsightTile extends StatelessWidget {
  const _InsightTile({required this.insight});

  final DietInsight insight;

  @override
  Widget build(BuildContext context) {
    final color = insightColor(insight.tone);
    return Container(
      key: ValueKey('diet-insight-${insight.id}'),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            color.withValues(alpha: 0.16),
            color.withValues(alpha: 0.02),
          ],
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(insightIcon(insight.tone), color: color, size: 21),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  insight.title,
                  style: AppText.body(size: 13.5, weight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  insight.body,
                  style: AppText.body(
                    size: 12,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Water for the selected day: progress vs the (stated-as-default) target,
/// +250 / +500 ml quick adds, an exact amount, and a -250 undo.
class DietWaterCard extends StatefulWidget {
  const DietWaterCard({
    required this.waterMl,
    required this.targetMl,
    required this.targetIsDefault,
    required this.disabled,
    required this.onSet,
    super.key,
  });

  final int waterMl;
  final int targetMl;
  final bool targetIsDefault;
  final bool disabled;

  /// Absolute total for the day, in ml.
  final ValueChanged<int> onSet;

  @override
  State<DietWaterCard> createState() => _DietWaterCardState();
}

class _DietWaterCardState extends State<DietWaterCard> {
  final _custom = TextEditingController();

  @override
  void dispose() {
    _custom.dispose();
    super.dispose();
  }

  void _addCustom() {
    final ml = int.tryParse(_custom.text.trim());
    if (ml == null || ml <= 0) return;
    widget.onSet(waterAfter(widget.waterMl, ml));
    _custom.clear();
    FocusScope.of(context).unfocus();
  }

  @override
  Widget build(BuildContext context) {
    final w = widget;
    final done = w.waterMl >= w.targetMl;
    const sky = TeamColors.sky;
    return FadeUp(
      index: 4,
      child: TeamSectionCard(
        icon: Icons.water_drop_rounded,
        color: sky,
        title: 'Water',
        subtitle:
            '${groupInt(w.waterMl)} of ${groupInt(w.targetMl)} ml${w.targetIsDefault ? ' (general default)' : ''}',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GrowBar(
              key: const ValueKey('diet-water-bar'),
              ratio: w.targetMl > 0 ? w.waterMl / w.targetMl : 0,
              colors: done
                  ? const [TeamColors.green, TeamColors.teal]
                  : const [sky, TeamColors.indigo],
              height: 14,
              track: AppColors.line,
            ),
            const SizedBox(height: 8),
            Text(
              '${done ? 'Target reached - nice work.' : '${groupInt(w.targetMl - w.waterMl)} ml to go.'}'
              '${w.targetIsDefault ? ' Your plan has no water target, so this uses a general ${groupInt(w.targetMl)} ml a day.' : ''}',
              style: AppText.body(
                size: 11.5,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                for (final n in const [250, 500]) ...[
                  Expanded(
                    child: _WaterButton(
                      key: ValueKey('water-add-$n'),
                      label: '+$n ml',
                      enabled: !w.disabled,
                      onTap: () => w.onSet(waterAfter(w.waterMl, n)),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: _WaterButton(
                    key: const ValueKey('water-undo'),
                    label: '- 250',
                    muted: true,
                    enabled: !w.disabled && w.waterMl > 0,
                    onTap: () => w.onSet(waterAfter(w.waterMl, -250)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    key: const ValueKey('water-custom'),
                    controller: _custom,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    style: AppText.body(size: 14, weight: FontWeight.w700),
                    cursorColor: AppColors.memberB,
                    onSubmitted: (_) => _addCustom(),
                    decoration: InputDecoration(
                      isDense: true,
                      filled: true,
                      fillColor: AppColors.surface2,
                      hintText: 'Other amount (ml)',
                      hintStyle: AppText.body(color: AppColors.inkFaint),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 14,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: AppColors.line),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: AppColors.line),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 92,
                  child: _WaterButton(
                    key: const ValueKey('water-add-custom'),
                    label: 'Add',
                    enabled: !w.disabled,
                    onTap: _addCustom,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _WaterButton extends StatelessWidget {
  const _WaterButton({
    required this.label,
    required this.enabled,
    required this.onTap,
    this.muted = false,
    super.key,
  });

  final String label;
  final bool enabled;
  final bool muted;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    const sky = TeamColors.sky;
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: PressBounce(
        onTap: enabled ? onTap : null,
        child: Container(
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: muted
                ? null
                : LinearGradient(
                    colors: [
                      sky.withValues(alpha: 0.28),
                      TeamColors.indigo.withValues(alpha: 0.2),
                    ],
                  ),
            color: muted ? AppColors.surface2 : null,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: muted ? AppColors.line : sky.withValues(alpha: 0.4),
            ),
          ),
          child: Text(
            label,
            maxLines: 1,
            style: AppText.body(
              size: 13,
              weight: FontWeight.w800,
              color: muted ? AppColors.inkFaint : sky,
            ),
          ),
        ),
      ),
    );
  }
}

/// Optional weight + note for the selected day (one save). Give it a
/// `ValueKey(day)` so the fields follow the selected day.
class DietWeightNotesCard extends StatefulWidget {
  const DietWeightNotesCard({
    required this.weightKg,
    required this.notes,
    required this.disabled,
    required this.onSave,
    super.key,
  });

  final double? weightKg;
  final String? notes;
  final bool disabled;
  final void Function({double? weightKg, String? notes}) onSave;

  @override
  State<DietWeightNotesCard> createState() => _DietWeightNotesCardState();
}

class _DietWeightNotesCardState extends State<DietWeightNotesCard> {
  late final TextEditingController _weight = TextEditingController(
    text: widget.weightKg == null ? '' : oneDecimal(widget.weightKg!),
  );
  late final TextEditingController _note =
      TextEditingController(text: widget.notes ?? '');
  String? _error;

  @override
  void dispose() {
    _weight.dispose();
    _note.dispose();
    super.dispose();
  }

  void _save() {
    final raw = _weight.text.trim();
    double? w;
    if (raw.isNotEmpty) {
      w = double.tryParse(raw);
      if (w == null || w <= 0 || w > 500) {
        setState(() => _error = 'Enter a weight between 0 and 500 kg');
        return;
      }
    }
    setState(() => _error = null);
    final weightChanged =
        w != null && (widget.weightKg == null || w != widget.weightKg);
    final noteChanged = _note.text.trim() != (widget.notes ?? '');
    if (!weightChanged && !noteChanged) return;
    widget.onSave(
      weightKg: weightChanged ? w : null,
      notes: noteChanged ? _note.text.trim() : null,
    );
    FocusScope.of(context).unfocus();
  }

  InputDecoration _decoration(String hint, IconData icon) => InputDecoration(
        isDense: true,
        filled: true,
        fillColor: AppColors.surface2,
        hintText: hint,
        hintStyle: AppText.body(color: AppColors.inkFaint),
        prefixIcon: Icon(icon, size: 18, color: TeamColors.violet),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppColors.line),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return FadeUp(
      index: 5,
      child: TeamSectionCard(
        icon: Icons.monitor_weight_rounded,
        color: TeamColors.violet,
        title: 'Weight and notes',
        subtitle: 'Optional',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              key: const ValueKey('diet-weight'),
              controller: _weight,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
              ],
              style: AppText.body(size: 15, weight: FontWeight.w700),
              cursorColor: AppColors.memberB,
              decoration: _decoration('Weight (kg)', Icons.scale_rounded),
            ),
            const SizedBox(height: 10),
            TextField(
              key: const ValueKey('diet-notes'),
              controller: _note,
              maxLength: 500,
              minLines: 2,
              maxLines: 3,
              style: AppText.body(size: 13.5, weight: FontWeight.w600),
              cursorColor: AppColors.memberB,
              decoration: _decoration(
                'How did eating go today?',
                Icons.edit_note_rounded,
              ).copyWith(counterText: ''),
            ),
            if (_error != null) ...[
              const SizedBox(height: 6),
              Text(
                _error!,
                style: AppText.body(
                  size: 11.5,
                  color: AppColors.danger,
                  weight: FontWeight.w700,
                ),
              ),
            ],
            const SizedBox(height: 12),
            Opacity(
              opacity: widget.disabled ? 0.55 : 1,
              child: PressBounce(
                onTap: widget.disabled ? null : _save,
                child: Container(
                  key: const ValueKey('diet-weight-save'),
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    gradient: AppColors.memberGrad,
                    borderRadius: BorderRadius.circular(15),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.memberB.withValues(alpha: 0.35),
                        blurRadius: 12,
                        offset: const Offset(0, 5),
                      ),
                    ],
                  ),
                  child: Text(
                    'Save',
                    style: AppText.body(
                      size: 14,
                      weight: FontWeight.w800,
                      color: AppColors.memberOnGrad,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Weekly summary tiles: meals completed, average calories / protein / water
/// and the streak. Every number comes from days the member logged.
class DietWeekTiles extends StatelessWidget {
  const DietWeekTiles({required this.nutrition, super.key});

  final MemberDietNutrition nutrition;

  @override
  Widget build(BuildContext context) {
    final w = nutrition.week;
    final avg = w.avgEaten;
    final tiles = <Widget>[
      ProfileColorTile(
        key: const ValueKey('diet-tile-adherence'),
        label: 'Meals completed',
        value: w.adherencePct == null ? '—' : '${w.adherencePct}%',
        hint: w.countedDays > 0
            ? '${w.mealsCompleted} of ${w.mealsPlanned} · ${w.countedDays} d'
            : 'No days to count yet',
        icon: Icons.task_alt_rounded,
        colors: const [Color(0xFF059669), Color(0xFF14B8A6)],
        index: 0,
      ),
      ProfileColorTile(
        key: const ValueKey('diet-tile-kcal'),
        label: 'Avg calories',
        value: avg == null ? '—' : '${groupInt(avg.calories)} kcal',
        hint: avg == null ? 'Log a meal' : 'per logged day (${w.avgDays})',
        icon: Icons.local_fire_department_rounded,
        colors: const [Color(0xFFF59E0B), Color(0xFFFF5C7A)],
        index: 1,
      ),
      ProfileColorTile(
        key: const ValueKey('diet-tile-protein'),
        label: 'Avg protein',
        value: avg == null ? '—' : '${oneDecimal(avg.protein)} g',
        hint: nutrition.planned.protein > 0
            ? 'plan ${oneDecimal(nutrition.planned.protein)} g / day'
            : 'per logged day',
        icon: Icons.egg_alt_rounded,
        colors: const [Color(0xFF0EA5E9), Color(0xFF6366F1)],
        index: 2,
      ),
      ProfileColorTile(
        key: const ValueKey('diet-tile-water'),
        label: 'Avg water',
        value: w.avgWaterMl == null ? '—' : '${groupInt(w.avgWaterMl!)} ml',
        hint: w.avgWaterMl == null
            ? 'Not saved yet'
            : '${w.waterDays} day${w.waterDays == 1 ? '' : 's'} saved',
        icon: Icons.water_drop_rounded,
        colors: const [Color(0xFF14B8A6), Color(0xFF0EA5E9)],
        index: 3,
      ),
      ProfileColorTile(
        key: const ValueKey('diet-tile-streak'),
        label: 'Streak',
        value:
            '${nutrition.streakDays} day${nutrition.streakDays == 1 ? '' : 's'}',
        hint: 'every meal completed',
        icon: Icons.bolt_rounded,
        colors: const [Color(0xFF8B5CF6), Color(0xFFC026D3)],
        index: 4,
      ),
    ];
    return LayoutBuilder(
      builder: (context, c) {
        final cols = c.maxWidth >= 720 ? 5 : (c.maxWidth >= 480 ? 3 : 2);
        const gap = 10.0;
        final width = (c.maxWidth - gap * (cols - 1)) / cols;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final t in tiles) SizedBox(width: width, child: t),
          ],
        );
      },
    );
  }
}

/// Meals-completed bars for the last 7 / 14 days. Tapping a loggable day
/// selects it.
class DietAdherenceChart extends StatefulWidget {
  const DietAdherenceChart({
    required this.days,
    required this.today,
    required this.selected,
    required this.loggableFrom,
    required this.onPick,
    super.key,
  });

  final List<NutritionDay> days;
  final DateTime today;
  final DateTime selected;
  final DateTime loggableFrom;
  final ValueChanged<DateTime> onPick;

  @override
  State<DietAdherenceChart> createState() => _DietAdherenceChartState();
}

class _DietAdherenceChartState extends State<DietAdherenceChart> {
  int _range = 7;

  @override
  Widget build(BuildContext context) {
    final shown = widget.days.length <= _range
        ? widget.days
        : widget.days.sublist(widget.days.length - _range);
    return FadeUp(
      index: 6,
      child: TeamSectionCard(
        icon: Icons.bar_chart_rounded,
        color: TeamColors.green,
        title: 'Daily adherence',
        subtitle: 'Meals completed per day',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                for (final r in const [7, 14]) ...[
                  TeamFilterChip(
                    label: '$r days',
                    selected: _range == r,
                    onTap: () => setState(() => _range = r),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
            const SizedBox(height: 14),
            if (shown.isEmpty)
              Text(
                'No days yet.',
                style: AppText.body(size: 12.5, color: AppColors.inkFaint),
              )
            else
              SizedBox(
                height: 150,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < shown.length; i++) ...[
                      if (i > 0) const SizedBox(width: 5),
                      Expanded(child: _bar(shown[i], i)),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _bar(NutritionDay d, int i) {
    final loggable = !d.date.isBefore(widget.loggableFrom);
    final frac = d.completion;
    final color = d.allDone
        ? TeamColors.green
        : frac > 0
            ? TeamColors.amber
            : AppColors.line;
    final isSel = sameDay(d.date, widget.selected);
    final letter = _range == 7 ? weekdayShort(d.date) : weekdayShort(d.date)[0];
    return GestureDetector(
      key: ValueKey('diet-bar-${apiDay(d.date)}'),
      behavior: HitTestBehavior.opaque,
      onTap: loggable ? () => widget.onPick(d.date) : null,
      child: Semantics(
        label:
            '${shortDate(d.date)}: ${d.mealsCompleted} of ${d.mealsPlanned} meals completed',
        child: Column(
          children: [
            Text(
              '${d.mealsCompleted}/${d.mealsPlanned}',
              maxLines: 1,
              style: AppText.tabular(
                size: 9.5,
                weight: FontWeight.w700,
                color: AppColors.inkFaint,
              ),
            ),
            const SizedBox(height: 4),
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.surface2,
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.bottomCenter,
                child: TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: frac),
                  duration: Duration(
                    milliseconds: reduceMotionOf(context) ? 0 : 900 + i * 40,
                  ),
                  curve: Curves.elasticOut,
                  builder: (context, v, _) => FractionallySizedBox(
                    heightFactor: v <= 0 ? 0.0 : v.clamp(0.06, 1.0),
                    widthFactor: 1,
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        gradient: LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [
                            color,
                            Color.lerp(color, Colors.white, 0.4)!,
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
              decoration: BoxDecoration(
                color: isSel ? TeamColors.green : Colors.transparent,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                letter,
                maxLines: 1,
                style: AppText.body(
                  size: 10,
                  weight: FontWeight.w800,
                  color: isSel
                      ? Colors.white
                      : sameDay(d.date, widget.today)
                          ? TeamColors.green
                          : AppColors.inkFaint,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  bool reduceMotionOf(BuildContext c) =>
      MediaQuery.maybeOf(c)?.disableAnimations ?? false;
}

/// Calories eaten (days with meals marked) and weight trend, drawn in.
class DietTrendsCard extends StatelessWidget {
  const DietTrendsCard({required this.nutrition, super.key});

  final MemberDietNutrition nutrition;

  @override
  Widget build(BuildContext context) {
    final cal = [
      for (final d in nutrition.days)
        if (d.mealsCompleted + d.mealsSkipped > 0) d.eaten.calories,
    ];
    final weights = [
      for (final d in nutrition.days)
        if (d.weightKg != null) d.weightKg!,
    ];
    return FadeUp(
      index: 7,
      child: TeamSectionCard(
        icon: Icons.show_chart_rounded,
        color: TeamColors.indigo,
        title: 'Trends',
        subtitle: 'Last 14 days',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Calories eaten',
              style: AppText.body(size: 12.5, weight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            cal.length >= 2
                ? DrawnSparkline(
                    key: const ValueKey('diet-spark-kcal'),
                    values: cal,
                    colors: const [TeamColors.amber, TeamColors.rose],
                  )
                : _empty('Mark meals on 2+ days to see a trend'),
            const SizedBox(height: 16),
            Text(
              'Weight',
              style: AppText.body(size: 12.5, weight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            weights.length >= 2
                ? DrawnSparkline(
                    key: const ValueKey('diet-spark-weight'),
                    values: weights,
                    colors: const [TeamColors.violet, TeamColors.fuchsia],
                  )
                : _empty('Log weight on 2+ days to see a trend'),
          ],
        ),
      ),
    );
  }

  Widget _empty(String message) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Text(
          message,
          style: AppText.body(
            size: 12,
            color: AppColors.inkFaint,
            weight: FontWeight.w600,
          ),
        ),
      );
}
