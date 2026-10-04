import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/common/period_stats_cubit.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/member_overview.dart';
import '../../../../shared/widgets/app_pill.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../finance/presentation/widgets/analytics_parts.dart';

/// The member dashboard's animated "Insights" section, driven by
/// `GET /portal/overview` through the generic [PeriodStatsCubit] (the fetcher
/// ignores the date range — no period chips here). Hidden entirely when the
/// overview errors or is forbidden: the rest of the dashboard never depends
/// on it.
///
/// Reuses `AnalyticsBlock/AnalyticsKpi/AnalyticsBar` (neutral surfaces) and
/// the `motion.dart` helpers (all collapse under `disableAnimations`).
///
/// Dropped, and why (nothing here is faked):
///  - member photo — the dashboard header keeps its initials avatar; the
///    overview's `photoUrl` is not rendered (no cached-image package).
///  - calories consumed / weight trend — the overview only carries the plan's
///    `dailyCalories` target and the LATEST weight, never intake or history.
///  - workout "streak by exercise" / per-day workout chart — only aggregate
///    counts exist.
///  - bookable-class actions — upcoming classes are read-only here; booking
///    lives on the Classes tab.
///  - hover tooltips on the heatmap (no hover on a phone) — a long-press
///    tooltip shows "date · N visits" instead.
class MemberInsightsSection extends StatelessWidget {
  const MemberInsightsSection({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<PeriodStatsCubit<MemberOverview>,
        PeriodStatsState<MemberOverview>>(
      builder: (context, state) => switch (state) {
        PeriodStatsLoading() => const Padding(
            padding: EdgeInsets.symmetric(vertical: 28),
            child: Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: AppColors.memberB,
                ),
              ),
            ),
          ),
        PeriodStatsError() || PeriodStatsForbidden() => const SizedBox.shrink(),
        PeriodStatsLoaded(:final data) => MemberInsightsBody(overview: data),
      },
    );
  }
}

/// Pure presentation of a loaded [MemberOverview] (what the widget tests pump).
class MemberInsightsBody extends StatelessWidget {
  const MemberInsightsBody({required this.overview, super.key});

  final MemberOverview overview;

  @override
  Widget build(BuildContext context) {
    final o = overview;
    final blocks = <Widget>[
      if (o.membership != null) MembershipRingCard(overview: o),
      AttendanceInsightsCard(attendance: o.attendance),
      AttendanceHeatmapCard(attendance: o.attendance),
      if (o.workout != null || o.diet != null)
        Column(
          children: [
            if (o.workout != null) _WorkoutCard(workout: o.workout!),
            if (o.workout != null && o.diet != null) const SizedBox(height: 12),
            if (o.diet != null) _DietCard(diet: o.diet!),
          ],
        ),
      _BillingCard(billing: o.billing),
      if (o.upcomingClasses.isNotEmpty)
        _ClassesCard(classes: o.upcomingClasses),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Insights', style: AppText.eyebrow()),
        const SizedBox(height: 10),
        for (var i = 0; i < blocks.length; i++) ...[
          StaggeredReveal(index: i, child: blocks[i]),
          if (i != blocks.length - 1) const SizedBox(height: 12),
        ],
      ],
    );
  }
}

String _inr(double v) => '₹${v.toStringAsFixed(v == v.roundToDouble() ? 0 : 2)}';

// ---------------------------------------------------------------- membership

class MembershipRingCard extends StatelessWidget {
  const MembershipRingCard({required this.overview, super.key});

  final MemberOverview overview;

  @override
  Widget build(BuildContext context) {
    final m = overview.membership!;
    final warn = m.expired || m.daysLeft <= 7;
    final color = m.expired ? AppColors.danger : (warn ? AppColors.warning : AppColors.memberB);
    final who = [
      if (overview.member.branchName != null) overview.member.branchName!,
      if (overview.member.trainerName != null)
        'Trainer ${overview.member.trainerName!}',
    ].join(' · ');
    return AnalyticsBlock(
      title: 'Membership',
      trailing: m.status.isEmpty ? null : prettyEnum(m.status),
      child: Row(
        children: [
          AnimatedFraction(
            fraction: m.remainingFraction,
            builder: (_, v) => SizedBox(
              width: 92,
              height: 92,
              child: CustomPaint(
                painter: RingPainter(fraction: v, color: color),
                child: Center(
                  child: m.expired
                      ? Icon(Icons.warning_amber_rounded, color: color, size: 30)
                      : Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '${m.daysLeft}',
                              style: AppText.display(size: 26, color: color),
                            ),
                            Text(
                              m.daysLeft == 1 ? 'day left' : 'days left',
                              style: AppText.body(
                                size: 10,
                                color: AppColors.inkFaint,
                                weight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  m.planName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.display(size: 16),
                ),
                const SizedBox(height: 2),
                Text(
                  m.expired
                      ? 'Expired ${shortDate(m.endDate)}'
                      : '${shortDate(m.startDate)} → ${shortDate(m.endDate)}',
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w700,
                    color: m.expired ? AppColors.danger : AppColors.inkSoft,
                  ),
                ),
                if (m.price != null || m.amountPaid != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    [
                      if (m.price != null) 'Plan ${_inr(m.price!)}',
                      if (m.amountPaid != null) 'Paid ${_inr(m.amountPaid!)}',
                    ].join(' · '),
                    style: AppText.body(
                      size: 11.5,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
                ],
                if (who.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    who,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 11,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Circular progress ring — a faint track plus a rounded arc from 12 o'clock.
class RingPainter extends CustomPainter {
  RingPainter({required this.fraction, required this.color});

  final double fraction;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 9.0;
    final rect = Offset.zero & size;
    final arc = rect.deflate(stroke / 2);
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = AppColors.surface3;
    canvas.drawArc(arc, 0, math.pi * 2, false, track);
    if (fraction <= 0) return;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = color;
    canvas.drawArc(arc, -math.pi / 2, math.pi * 2 * fraction.clamp(0, 1), false, paint);
  }

  @override
  bool shouldRepaint(covariant RingPainter old) =>
      old.fraction != fraction || old.color != color;
}

// ---------------------------------------------------------------- attendance

class AttendanceInsightsCard extends StatelessWidget {
  const AttendanceInsightsCard({required this.attendance, super.key});

  final OverviewAttendance attendance;

  @override
  Widget build(BuildContext context) {
    final a = attendance;
    final chips = <Widget>[
      _Chip(
        icon: Icons.local_fire_department_rounded,
        label: 'Streak ${a.currentStreakDays}d',
        highlight: a.currentStreakDays > 0,
      ),
      _Chip(icon: Icons.emoji_events_outlined, label: 'Best ${a.bestStreakDays}d'),
      _Chip(icon: Icons.login_rounded, label: '${a.totalVisits} total'),
      if (a.avgVisitMinutes != null)
        _Chip(icon: Icons.timer_outlined, label: 'Avg ${a.avgVisitMinutes} min'),
      if (a.lastVisitAt != null)
        _Chip(
          icon: Icons.history_rounded,
          label: 'Last ${shortDate(a.lastVisitAt!)}',
        ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AnalyticsKpi(
          label: 'Visits this month',
          value: '${a.thisMonthVisits}',
          numeric: a.thisMonthVisits.toDouble(),
          formatNumeric: (v) => v.round().toString(),
          sub: 'vs ${a.previousMonthVisits} last month',
          delta: a.deltaPercent,
        ),
        const SizedBox(height: 10),
        Wrap(spacing: 8, runSpacing: 8, children: chips),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label, this.highlight = false});

  final IconData icon;
  final String label;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: highlight ? AppColors.memberSoft : AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(
          color: highlight ? AppColors.memberB : AppColors.line,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 14,
            color: highlight ? AppColors.memberPillFg : AppColors.inkSoft,
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: AppText.body(
              size: 11.5,
              weight: FontWeight.w700,
              color: highlight ? AppColors.memberPillFg : AppColors.inkSoft,
            ),
          ),
        ],
      ),
    );
  }
}

/// Mon-first week columns of the API's `daily` series (84 days). Each column
/// has 7 slots (Mon..Sun); slots outside the range are null.
List<List<OverviewDay?>> heatmapWeeks(List<OverviewDay> daily) {
  final cols = <List<OverviewDay?>>[];
  List<OverviewDay?>? cur;
  for (final d in daily) {
    final dt = DateTime.tryParse(d.date);
    if (dt == null) continue;
    final row = dt.weekday - 1; // Mon = 0 .. Sun = 6
    if (cur == null || row == 0) {
      cur = List<OverviewDay?>.filled(7, null);
      cols.add(cur);
    }
    cur[row] = d;
  }
  return cols;
}

/// 12-week attendance heatmap + busiest-weekday bars.
class AttendanceHeatmapCard extends StatelessWidget {
  const AttendanceHeatmapCard({required this.attendance, super.key});

  final OverviewAttendance attendance;

  static const _names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // API weekday: 0 = Sunday.
  static const _apiIndex = [1, 2, 3, 4, 5, 6, 0];

  @override
  Widget build(BuildContext context) {
    final a = attendance;
    final weeks = heatmapWeeks(a.daily);
    final maxDay = a.maxDaily;
    final counts = {for (final w in a.weekday) w.weekday: w.count};
    final maxWd = a.maxWeekday;
    final busiest = maxWd == 0
        ? null
        : _names[_apiIndex.indexWhere((i) => (counts[i] ?? 0) == maxWd)];
    return AnalyticsBlock(
      title: 'Last 12 weeks',
      trailing: busiest == null ? null : 'Busiest: $busiest',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (weeks.isEmpty)
            analyticsEmpty('No attendance data yet.')
          else
            LayoutBuilder(
              builder: (context, c) {
                const gap = 3.0;
                final cell = math.min(
                  22.0,
                  (c.maxWidth - gap * (weeks.length - 1)) / weeks.length,
                );
                return Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var w = 0; w < weeks.length; w++)
                      Padding(
                        padding: EdgeInsets.only(
                          right: w == weeks.length - 1 ? 0 : gap,
                        ),
                        child: Column(
                          children: [
                            for (var r = 0; r < 7; r++)
                              Padding(
                                padding: EdgeInsets.only(bottom: r == 6 ? 0 : gap),
                                child: _HeatCell(
                                  day: weeks[w][r],
                                  size: cell,
                                  max: maxDay,
                                  order: w,
                                ),
                              ),
                          ],
                        ),
                      ),
                  ],
                );
              },
            ),
          const SizedBox(height: 14),
          Text('Busiest weekday', style: AppText.eyebrow()),
          const SizedBox(height: 8),
          if (maxWd == 0)
            analyticsEmpty('Your weekday pattern shows up after a few visits.')
          else
            SizedBox(
              height: 78,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  for (var i = 0; i < 7; i++)
                    Expanded(
                      child: _WeekdayBar(
                        label: _names[i].substring(0, 1),
                        semantics: _names[i],
                        count: counts[_apiIndex[i]] ?? 0,
                        fraction: (counts[_apiIndex[i]] ?? 0) / maxWd,
                        top: (counts[_apiIndex[i]] ?? 0) == maxWd,
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

class _HeatCell extends StatelessWidget {
  const _HeatCell({
    required this.day,
    required this.size,
    required this.max,
    required this.order,
  });

  final OverviewDay? day;
  final double size;
  final int max;
  final int order;

  @override
  Widget build(BuildContext context) {
    final d = day;
    if (d == null) return SizedBox(width: size, height: size);
    final color = d.visits <= 0 || max <= 0
        ? AppColors.surface3
        : AppColors.memberB.withValues(alpha: 0.3 + 0.7 * d.visits / max);
    final box = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(4),
      ),
    );
    final label =
        '${shortDate(d.date)} · ${d.visits} visit${d.visits == 1 ? '' : 's'}';
    final animated = reduceMotion(context)
        ? box
        : TweenAnimationBuilder<double>(
            tween: Tween<double>(begin: 0, end: 1),
            duration: Duration(milliseconds: 250 + order * 30),
            curve: Curves.easeOut,
            child: box,
            builder: (_, t, child) => Opacity(opacity: t, child: child),
          );
    return Tooltip(message: label, child: Semantics(label: label, child: animated));
  }
}

class _WeekdayBar extends StatelessWidget {
  const _WeekdayBar({
    required this.label,
    required this.semantics,
    required this.count,
    required this.fraction,
    required this.top,
  });

  final String label;
  final String semantics;
  final int count;
  final double fraction;
  final bool top;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$semantics $count visits',
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Text(
            '$count',
            style: AppText.tabular(
              size: 10.5,
              weight: FontWeight.w800,
              color: top ? AppColors.memberPillFg : AppColors.inkFaint,
            ),
          ),
          const SizedBox(height: 3),
          Expanded(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: AnimatedFraction(
                fraction: fraction,
                builder: (_, v) => Container(
                  width: 16,
                  height: math.max(3, 40 * v),
                  decoration: BoxDecoration(
                    color: top ? AppColors.memberB : AppColors.surface3,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: AppText.body(
              size: 10.5,
              weight: FontWeight.w700,
              color: AppColors.inkFaint,
            ),
          ),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------ workout / diet

class _WorkoutCard extends StatelessWidget {
  const _WorkoutCard({required this.workout});

  final OverviewWorkout workout;

  @override
  Widget build(BuildContext context) {
    final w = workout;
    return AnalyticsBlock(
      title: 'Workout progress',
      trailing: w.planName,
      child: AnalyticsBar(
        label: '${w.completedExercises} of ${w.totalExercises} exercises',
        value: '${w.progressPercent}%',
        fraction: w.progressPercent / 100,
        sub: '${w.completedThisWeek} completed this week',
        color: AppColors.memberB,
        animate: true,
      ),
    );
  }
}

class _DietCard extends StatelessWidget {
  const _DietCard({required this.diet});

  final OverviewDiet diet;

  @override
  Widget build(BuildContext context) {
    final d = diet;
    final facts = <String>[
      if (d.dailyCalories != null) '${d.dailyCalories} kcal target',
      if (d.waterTodayMl != null) '${d.waterTodayMl} ml water today',
      if (d.latestWeightKg != null)
        '${d.latestWeightKg!.toStringAsFixed(1)} kg latest weight',
    ];
    return AnalyticsBlock(
      title: 'Diet',
      trailing: d.planName,
      child: Row(
        children: [
          Expanded(
            child: facts.isEmpty
                ? analyticsEmpty('No targets set on this plan.')
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final f in facts)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: Text(
                            f,
                            style: AppText.body(
                              size: 12.5,
                              weight: FontWeight.w700,
                            ),
                          ),
                        ),
                    ],
                  ),
          ),
          const SizedBox(width: 8),
          AppPill(
            label: d.loggedToday ? 'Logged today' : 'Not logged yet',
            tone: d.loggedToday ? AppPillTone.success : AppPillTone.warning,
            role: AppRole.member,
          ),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------------- billing

class _BillingCard extends StatelessWidget {
  const _BillingCard({required this.billing});

  final OverviewBilling billing;

  @override
  Widget build(BuildContext context) {
    final b = billing;
    final owes = b.outstanding > 0;
    return AnalyticsBlock(
      title: 'Billing',
      trailing: b.nextDueDate == null ? null : 'Next due ${shortDate(b.nextDueDate!)}',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: _Figure(
              label: 'Outstanding',
              value: owes ? _inr(b.outstanding) : 'All paid',
              sub: owes
                  ? '${b.outstandingInvoiceCount} invoice${b.outstandingInvoiceCount == 1 ? '' : 's'}'
                  : 'nothing due',
              color: owes ? AppColors.warning : AppColors.success,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _Figure(
              label: 'Paid, last 90 days',
              value: _inr(b.paidLast90Days),
              sub: '${b.paidLast90DaysCount} payment${b.paidLast90DaysCount == 1 ? '' : 's'}',
              color: AppColors.ink,
            ),
          ),
        ],
      ),
    );
  }
}

class _Figure extends StatelessWidget {
  const _Figure({
    required this.label,
    required this.value,
    required this.sub,
    required this.color,
  });

  final String label;
  final String value;
  final String sub;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppText.body(
            size: 11,
            color: AppColors.inkFaint,
            weight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 2),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(value, style: AppText.display(size: 21, color: color)),
        ),
        Text(
          sub,
          style: AppText.body(
            size: 11,
            color: AppColors.inkFaint,
            weight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

// ------------------------------------------------------------------- classes

class _ClassesCard extends StatelessWidget {
  const _ClassesCard({required this.classes});

  final List<OverviewClass> classes;

  @override
  Widget build(BuildContext context) {
    return AnalyticsBlock(
      title: 'Next booked classes',
      child: Column(
        children: [
          for (final c in classes)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.memberSoft,
                      borderRadius: BorderRadius.circular(AppRadii.tile),
                    ),
                    child: Text(
                      shortDate(c.date),
                      textAlign: TextAlign.center,
                      style: AppText.body(
                        size: 10.5,
                        weight: FontWeight.w800,
                        color: AppColors.memberPillFg,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          c.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(size: 13, weight: FontWeight.w700),
                        ),
                        Text(
                          [
                            '${c.startTime}–${c.endTime}',
                            if (c.trainerName != null) c.trainerName!,
                          ].join(' · '),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 11.5,
                            color: AppColors.inkFaint,
                            weight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (c.bookingStatus.isNotEmpty)
                    AppPill(
                      label: prettyEnum(c.bookingStatus),
                      tone: AppPillTone.roleTint,
                      role: AppRole.member,
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
