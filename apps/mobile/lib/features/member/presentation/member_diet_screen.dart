import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/diet_plan.dart';
import '../../../models/member_diet_assignment.dart';
import '../../../models/member_diet_nutrition.dart';
import '../../../models/member_workout_progress.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/menu_button.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'member_diet_logic.dart';
import 'widgets/member_diet_intake.dart';
import 'widgets/member_diet_progress.dart';

/// The member's Diet tab: log meals / water / weight per day (today and the
/// last 6 days — the API accepts a 7-day window), see what they ate
/// (calories, protein, carbs, fat, fibre, sugar, sodium) against their plan,
/// a 7 / 14-day adherence chart, weekly summary tiles and rule-based advice
/// ("What to do next").
///
/// **Data**: `GET /portal/diet` and `POST /portal/diet/:id/log` (the log call
/// merges into the day's row; its response is the full diet payload, so the
/// screen simply swaps it in). Every number — what was eaten, the weekly
/// averages, the streak and the advice text — is derived by the API from real
/// logs and the plan's foods (`nutrition` block), so web and mobile always
/// agree. "Today" is the member's branch-local date from that block, not the
/// device clock.
///
/// **Honest data**: eaten = the sum of COMPLETED meals; foods with no
/// nutrition data add nothing and the card says so. The plan has no water
/// target, so the progress bar uses a general 2,000 ml default and states it.
/// Fibre / sugar / sodium chips only appear when the plan has real values.
///
/// **Dropped vs the design**: the "6a. Log meal" food picker (the portal has no
/// food endpoints; a meal is one status per meal type) and the old 8-glass row
/// (replaced by the ml bar + quick adds, which is what the API stores).
///
/// It is an `IndexedStack` tab: it loads once and refreshes on pull-to-refresh
/// and when the app returns to the foreground (so a day rollover is picked
/// up). Member palette (lime -> teal); content colours from [TeamColors].
class MemberDietScreen extends StatefulWidget {
  const MemberDietScreen({super.key});

  @override
  State<MemberDietScreen> createState() => _MemberDietScreenState();
}

class _MemberDietScreenState extends State<MemberDietScreen>
    with WidgetsBindingObserver {
  MemberDietAssignment? _assignment;
  bool _loading = true;
  String? _error;
  DateTime? _picked;
  bool _busy = false;
  MealType? _busyMeal;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _assignment != null && !_busy) {
      _load(silent: true);
    }
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final assignment = await getIt<MemberPortalRepository>().diet();
      if (!mounted) return;
      setState(() {
        _assignment = assignment;
        _error = null;
      });
    } on ApiException catch (e) {
      _fail(e.message);
    } catch (e) {
      _fail('Could not load your diet plan.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _fail(String message) {
    if (!mounted) return;
    if (_assignment != null) {
      teamSnack(context, message, error: true);
    } else {
      setState(() => _error = message);
    }
  }

  /// One log call. Controls are disabled while it runs so quick taps can't
  /// race each other (the API merges, but water is an absolute total).
  Future<void> _log(
    DateTime day, {
    int? waterIntakeMl,
    double? weightKg,
    String? notes,
    MealType? meal,
    ExerciseProgressStatus? status,
    String? okMessage,
  }) async {
    final assignment = _assignment;
    if (assignment == null || _busy) return;
    setState(() {
      _busy = true;
      _busyMeal = meal;
    });
    try {
      final updated = await getIt<MemberPortalRepository>().logDiet(
        assignmentId: assignment.id,
        date: day,
        waterIntakeMl: waterIntakeMl,
        weightKg: weightKg,
        notes: notes,
        mealsStatus: meal == null || status == null ? null : {meal: status},
      );
      if (!mounted) return;
      setState(() => _assignment = updated);
      if (okMessage != null) teamSnack(context, okMessage);
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) {
        teamSnack(context, 'Could not save. Please try again.', error: true);
      }
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _busyMeal = null;
        });
      }
    }
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_loading) return const AppLoadingView(role: AppRole.member);
    final assignment = _assignment;
    if (_error != null && assignment == null) {
      return _withMenu(
        AppErrorView(
          message: _error!,
          onRetry: _load,
          role: AppRole.member,
        ),
      );
    }
    if (assignment == null) {
      return _withMenu(
        const AppEmptyState(
          icon: Icons.restaurant_outlined,
          title: 'No diet plan yet',
          message: 'Your trainer will assign one soon.',
        ),
      );
    }
    final n = assignment.nutrition;
    if (n == null) {
      return _withMenu(
        const AppEmptyState(
          icon: Icons.restaurant_outlined,
          title: 'Diet tracker is updating',
          message: 'Pull down to refresh in a moment.',
        ),
      );
    }

    final selected = resolveSelectedDay(n, _picked);
    final day = n.dayFor(selected);

    return RefreshIndicator(
      color: AppColors.memberB,
      backgroundColor: AppColors.surface2,
      onRefresh: () => _load(silent: true),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 96),
        children: [
          _DietHero(assignment: assignment, nutrition: n),
          TeamCenter(
            maxWidth: 1000,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (assignment.trainerRemarks != null &&
                      assignment.trainerRemarks!.trim().isNotEmpty) ...[
                    _Remarks(text: assignment.trainerRemarks!),
                    const SizedBox(height: 14),
                  ],
                  if (!n.planStarted || day == null)
                    _NotStarted(start: assignment.startDate)
                  else
                    ..._body(assignment, n, day, selected),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _withMenu(Widget body) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
            child: Row(
              children: [
                const MenuButton(),
                const SizedBox(width: 10),
                Text('Diet', style: AppText.display(size: 22)),
              ],
            ),
          ),
          Expanded(child: body),
        ],
      );

  List<Widget> _body(
    MemberDietAssignment a,
    MemberDietNutrition n,
    NutritionDay day,
    DateTime selected,
  ) {
    final isToday = sameDay(selected, n.today);
    final log = a.logFor(selected);
    final loggable = n.loggableDays;
    return [
      DietDayStrip(
        days: loggable,
        today: n.today,
        selected: selected,
        onSelect: (d) => setState(() => _picked = d),
      ),
      SizedBox(
        height: 14,
        child: _busy
            ? Padding(
                padding: const EdgeInsets.only(top: 8),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(9),
                  child: LinearProgressIndicator(
                    minHeight: 3,
                    color: AppColors.memberB,
                    backgroundColor: AppColors.line,
                  ),
                ),
              )
            : null,
      ),
      DietNutritionCard(nutrition: n, day: day, isToday: isToday),
      const SizedBox(height: 14),
      DietMealCards(
        meals: n.meals,
        day: day,
        busyMeal: _busyMeal,
        disabled: _busy,
        subtitle:
            '${day.mealsCompleted} of ${day.mealsPlanned} done${isToday ? '' : ' · ${shortDate(day.date)}'}',
        onSet: (meal, status) => _log(
          selected,
          meal: meal,
          status: status,
          okMessage: status == ExerciseProgressStatus.completed
              ? '${meal.label} done'
              : null,
        ),
      ),
      const SizedBox(height: 14),
      TeamAdaptive(
        children: [
          DietInsightsCard(insights: n.insights),
          DietWaterCard(
            waterMl: day.waterMl ?? 0,
            targetMl: n.waterTargetMl,
            targetIsDefault: n.waterTargetIsDefault,
            disabled: _busy,
            onSet: (total) => _log(selected, waterIntakeMl: total),
          ),
        ],
      ),
      const SizedBox(height: 14),
      DietWeightNotesCard(
        key: ValueKey('diet-wn-${apiDay(selected)}'),
        weightKg: log?.weightKg,
        notes: log?.notes,
        disabled: _busy,
        onSave: ({weightKg, notes}) => _log(
          selected,
          weightKg: weightKg,
          notes: notes,
          okMessage: 'Saved',
        ),
      ),
      const SizedBox(height: 18),
      DietWeekTiles(nutrition: n),
      const SizedBox(height: 14),
      TeamAdaptive(
        children: [
          DietAdherenceChart(
            days: n.days,
            today: n.today,
            selected: selected,
            loggableFrom: loggable.first.date,
            onPick: (d) => setState(() => _picked = d),
          ),
          DietTrendsCard(nutrition: n),
        ],
      ),
    ];
  }
}

// ── hero & small blocks ─────────────────────────────────────────────────────

class _DietHero extends StatelessWidget {
  const _DietHero({required this.assignment, required this.nutrition});

  final MemberDietAssignment assignment;
  final MemberDietNutrition nutrition;

  @override
  Widget build(BuildContext context) {
    final on = AppRole.member.onGradient;
    final n = nutrition;
    final today = n.todayEntry;
    final mealsDone = today?.mealsCompleted ?? 0;
    final mealsTotal = today?.mealsPlanned ?? n.meals.length;
    final chips = [
      today?.logged == true ? '✓ Logged today' : 'Not logged today',
      if (n.calorieTarget != null) '${groupInt(n.calorieTarget!)} kcal target',
      '${assignment.durationDays > 0 ? '${assignment.durationDays} days · ' : ''}${n.meals.length} meals a day',
    ];

    // Full-width gradient header, same shape as the Workout / Measurements heroes.
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const MenuButton(),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'DIET PLAN',
                          style: AppText.eyebrow(
                            color: on.withValues(alpha: 0.7),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          assignment.planName,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.display(size: 22, color: on),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  AnimatedRing(
                    key: const ValueKey('diet-hero-ring'),
                    value: mealsTotal > 0 ? mealsDone / mealsTotal : 0,
                    size: 68,
                    stroke: 8,
                    colors: [on, on],
                    track: on.withValues(alpha: 0.2),
                    child: Text(
                      '$mealsDone/$mealsTotal',
                      style: AppText.tabular(
                        size: 13,
                        weight: FontWeight.w800,
                        color: on,
                      ),
                    ),
                  ),
                ],
              ),
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
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _HeroStat(
                      label: 'Streak',
                      child: CountUp(
                        key: const ValueKey('diet-hero-streak'),
                        value: n.streakDays,
                        suffix: 'd',
                        style: AppText.display(size: 20, color: on),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _HeroStat(
                      label: 'Water',
                      child: CountUp(
                        key: const ValueKey('diet-hero-water'),
                        value: today?.waterMl ?? 0,
                        suffix: ' ml',
                        style: AppText.display(size: 20, color: on),
                      ),
                    ),
                  ),
                  if (n.week.adherencePct != null) ...[
                    const SizedBox(width: 8),
                    Expanded(
                      child: _HeroStat(
                        label: 'Week',
                        child: CountUp(
                          key: const ValueKey('diet-hero-week'),
                          value: n.week.adherencePct!,
                          suffix: '%',
                          style: AppText.display(size: 20, color: on),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final on = AppRole.member.onGradient;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: on.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: on.withValues(alpha: 0.16)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            maxLines: 1,
            style: AppText.body(
              size: 10,
              weight: FontWeight.w800,
              color: on.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: 2),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: child,
          ),
        ],
      ),
    );
  }
}

class _Remarks extends StatelessWidget {
  const _Remarks({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => FadeUp(
        index: 1,
        child: TeamSectionCard(
          icon: Icons.format_quote_rounded,
          color: TeamColors.amber,
          title: 'Trainer remarks',
          child: Text(
            text,
            style: AppText.body(size: 13, weight: FontWeight.w600),
          ),
        ),
      );
}

class _NotStarted extends StatelessWidget {
  const _NotStarted({required this.start});

  final DateTime start;

  @override
  Widget build(BuildContext context) => TeamSectionCard(
        icon: Icons.event_rounded,
        color: TeamColors.green,
        title: 'Starts soon',
        child: Text(
          'Your plan starts on ${shortDate(start)}. You can log meals, water '
          'and weight from that day.',
          key: const ValueKey('diet-not-started'),
          style: AppText.body(
            size: 12.5,
            color: AppColors.inkFaint,
            weight: FontWeight.w600,
          ),
        ),
      );
}
