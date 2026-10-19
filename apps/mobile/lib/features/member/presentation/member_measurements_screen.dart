import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/body_measurement.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../measurements/presentation/measurement_charts.dart';
import '../../measurements/presentation/measurement_ui.dart';
import '../../measurements/presentation/member_progress.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'member_measurement_logic.dart';
import 'member_measurement_sheets.dart';

const _ranges = [
  (label: '1M', days: 30),
  (label: '3M', days: 90),
  (label: '6M', days: 180),
  (label: 'All', days: null),
];

const _weekdayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/// The member's own Body Measurements page: hero (latest weight, check-in
/// count, change vs the previous / first check-in, BMI · body fat · waist)
/// with the **Log weight** and **Full check-in** actions, a daily-tracking
/// card (last 7 days, streak, this-week vs last-week average, progress toward
/// the target weight), four stat tiles, Trends (1M / 3M / 6M / All; the
/// weight chart plots each day plus a 7-day moving average), First vs latest,
/// and a tap-to-expand History.
///
/// **Self-tracking (member-initiated, beyond web's read-only portal)**: a
/// member logs / edits / deletes their OWN entries (`POST` / `PATCH` /
/// `DELETE /portal/measurements`). One member entry per day — logging again
/// the same day updates it. Only entries with `source == MEMBER` show Edit /
/// Delete (and a "Logged by you" tag); staff-recorded entries are read-only
/// and tagged "Recorded by (staff name)". The API enforces the same rules
/// (ownership, no future dates, 365-day back-dating), so the client checks
/// are convenience only.
///
/// The target weight comes from `GET /portal/me` (`membershipHistory[]
/// .targetWeight`, set by staff at membership assignment); without one the
/// goal card is simply absent. BMI is computed here from the real weight and
/// the most recent recorded height. Entered from the member Menu tile ("Body
/// Measurements" -> `AppRoutes.memberMeasurements`), unchanged.
///
/// Member palette (lime -> teal), per the "member screens pass
/// `AppRole.member`" rule; the per-value tones are the same content colours
/// the staff screens use.
class MemberMeasurementsScreen extends StatefulWidget {
  const MemberMeasurementsScreen({super.key});

  @override
  State<MemberMeasurementsScreen> createState() =>
      _MemberMeasurementsScreenState();
}

class _MemberMeasurementsScreenState extends State<MemberMeasurementsScreen> {
  List<BodyMeasurement>? _entries;
  double? _targetKg;
  bool _targetLoaded = false;
  bool _loading = true;
  String? _error;
  int? _rangeDays;
  String? _openId;
  String? _deletingId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final entries = await getIt<MemberPortalRepository>().measurements();
      if (!mounted) return;
      setState(() {
        _entries = entries;
        _loading = false;
        _error = null;
      });
      _loadTarget();
    } on ApiException catch (e) {
      _fail(e.message);
    } catch (e) {
      _fail('Could not load your measurements.');
    }
  }

  /// Best-effort: the goal card is optional, so a failure here is silent and
  /// retried on the next refresh.
  Future<void> _loadTarget() async {
    if (_targetLoaded) return;
    try {
      final profile = await getIt<MemberPortalRepository>().me();
      if (!mounted) return;
      setState(() {
        _targetKg = profile.targetWeightKg;
        _targetLoaded = true;
      });
    } catch (e) {
      // No goal card without a target.
    }
  }

  void _fail(String message) {
    if (!mounted) return;
    if (_entries != null) {
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      setState(() {
        _loading = false;
        _error = message;
      });
    }
  }

  // ── actions ───────────────────────────────────────────────────────────────

  Map<int, BodyMeasurement> _ownByDay(List<BodyMeasurement> entries) => {
        for (final e in entries)
          if (e.isMemberLogged) dayOrdinal(entryDay(e.recordedAt)): e,
      };

  Future<void> _afterSave(String? message) async {
    if (message == null || !mounted) return;
    teamSnack(context, message);
    await _load(silent: true);
  }

  Future<void> _logWeight() async {
    final entries = _entries ?? const <BodyMeasurement>[];
    final stats = MemberWeightStats(entries, targetKg: _targetKg);
    final message = await showMemberWeightSheet(
      context,
      lastWeight: stats.currentKg,
      ownByDay: _ownByDay(entries),
      onSave: (input) async {
        final r = await getIt<MemberPortalRepository>().logMeasurement(input);
        return r.created ? 'Weight saved.' : 'Weight updated for that day.';
      },
    );
    await _afterSave(message);
  }

  Future<void> _checkIn() async {
    final entries = _entries ?? const <BodyMeasurement>[];
    // Today's own entry (if any) is prefilled: saving updates it.
    final todayOwn = _ownByDay(entries)[dayOrdinal(entryDay(DateTime.now()))];
    final message = await showMemberCheckInSheet(
      context,
      initial: todayOwn,
      onSave: (input) async {
        final r = await getIt<MemberPortalRepository>().logMeasurement(input);
        return r.created ? 'Check-in saved.' : 'Check-in updated for that day.';
      },
    );
    await _afterSave(message);
  }

  Future<void> _edit(BodyMeasurement entry) async {
    final message = await showMemberCheckInSheet(
      context,
      initial: entry,
      editing: true,
      onSave: (input) async {
        await getIt<MemberPortalRepository>()
            .updateMeasurement(entry.id, input);
        return 'Entry updated.';
      },
    );
    await _afterSave(message);
  }

  Future<void> _delete(BodyMeasurement entry) async {
    final ok = await confirmTeam(
      context,
      title: 'Delete this entry?',
      message: 'Your ${longDay(entry.recordedAt)} check-in will be removed '
          'from your history and charts.',
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _deletingId = entry.id);
    try {
      await getIt<MemberPortalRepository>().deleteMeasurement(entry.id);
      if (!mounted) return;
      setState(() => _openId = null);
      teamSnack(context, 'Entry deleted.');
      await _load(silent: true);
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) {
        teamSnack(
          context,
          'Could not delete the entry. Try again.',
          error: true,
        );
      }
    } finally {
      if (mounted) setState(() => _deletingId = null);
    }
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final entries = _entries;
    final ready = entries != null;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: ready,
      appBar: AppBar(
        backgroundColor: ready ? Colors.transparent : AppColors.bg,
        foregroundColor: ready ? AppRole.member.onGradient : null,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: ready ? null : const Text('Body Measurements'),
      ),
      body: !ready
          ? (_loading
              ? const AppLoadingView(role: AppRole.member)
              : AppErrorView(
                  message: _error ?? 'Something went wrong.',
                  onRetry: _load,
                  role: AppRole.member,
                ))
          : RefreshIndicator(
              color: AppColors.memberB,
              backgroundColor: AppColors.surface2,
              onRefresh: () => _load(silent: true),
              child: _content(
                MemberProgress(entries),
                MemberWeightStats(entries, targetKg: _targetKg),
              ),
            ),
    );
  }

  Widget _actions() => Row(
        children: [
          Expanded(
            child: _HeroButton(
              key: const ValueKey('log-weight'),
              label: 'Log weight',
              icon: Icons.add_rounded,
              filled: true,
              onTap: _logWeight,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _HeroButton(
              key: const ValueKey('full-checkin'),
              label: 'Full check-in',
              icon: Icons.straighten_rounded,
              filled: false,
              onTap: _checkIn,
            ),
          ),
        ],
      );

  Widget _content(MemberProgress p, MemberWeightStats stats) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    if (p.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        children: [
          _Hero(
            topInset: top,
            title: 'No check-ins yet',
            subtitle: 'Log your first weight in a few seconds',
            chips: const [],
            actions: _actions(),
          ),
          const SizedBox(height: 60),
          const AppEmptyState(
            icon: Icons.straighten_outlined,
            title: 'No measurements yet',
            message: 'Log your weight (a quick daily entry works great) or '
                'do a full check-in — your trends and comparisons will '
                'appear here.',
          ),
        ],
      );
    }
    final latest = p.latest!;
    final first = p.first!;
    final prev = p.previous;
    final w = p.valueOf(latest, MeasurementField.weight);
    final bf = p.valueOf(latest, MeasurementField.bodyFat);
    final waist = p.valueOf(latest, MeasurementField.waist);
    final bmi = p.bmiOf(latest);
    final vsPrev = p.diff(latest, prev, MeasurementField.weight);
    final sinceFirst = p.valued.length > 1
        ? p.diff(latest, first, MeasurementField.weight)
        : null;
    String signed(double v, String unit) =>
        '${v > 0 ? '+' : ''}${fmtNum(v)} $unit';
    final by = latest.isMemberLogged
        ? ' · by you'
        : latest.recordedBy != null
            ? ' · by ${latest.recordedBy!.name}'
            : '';

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      children: [
        _Hero(
          topInset: top,
          title: w != null ? '${fmtNum(w)} kg' : 'Latest check-in',
          subtitle: 'Latest check-in ${longDay(latest.recordedAt)}$by',
          chips: [
            '${p.asc.length} check-in${p.asc.length == 1 ? '' : 's'}',
            if (vsPrev != null && vsPrev != 0)
              '${vsPrev > 0 ? '▲' : '▼'} ${fmtNum(vsPrev.abs())} kg vs previous',
            if (sinceFirst != null && sinceFirst != 0)
              '${signed(sinceFirst, 'kg')} since first',
          ],
          stats: [
            if (bmi != null) ('BMI (computed)', bmi.toStringAsFixed(1)),
            if (bf != null) ('Body fat', '${fmtNum(bf)}%'),
            if (waist != null) ('Waist', '${fmtNum(waist)} cm'),
          ],
          actions: _actions(),
        ),
        TeamCenter(
          maxWidth: 1000,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _progress(stats),
                const SizedBox(height: 14),
                _tiles(p, latest, prev, first, w, bf, bmi, sinceFirst),
                const SizedBox(height: 14),
                _trends(p, stats),
                const SizedBox(height: 14),
                _comparison(p, first, latest, bmi),
                const SizedBox(height: 14),
                _history(p),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ── daily tracking ────────────────────────────────────────────────────────

  Widget _progress(MemberWeightStats s) {
    final goal = s.goal;
    final delta = s.weekDelta;
    final avg = s.thisWeekAvg;
    final lastSeven = s.lastSevenDays;

    Color deltaTone(double d) {
      if (goal == null || d == 0) return TeamColors.sky;
      return (goal.isLoss ? d < 0 : d > 0)
          ? TeamColors.green
          : TeamColors.amber;
    }

    final week = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            for (var i = 0; i < 7; i++)
              _DayDot(
                index: i,
                letter: _weekdayLetters[
                    DateTime(s.today.year, s.today.month, s.today.day - (6 - i))
                            .weekday -
                        1],
                logged: lastSeven[i],
                isToday: i == 6,
              ),
          ],
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: _MiniStat(
                label: 'Streak',
                icon: Icons.local_fire_department_rounded,
                color: TeamColors.amber,
                child: CountUp(
                  key: const ValueKey('stat-streak'),
                  value: s.streak,
                  suffix: s.streak == 1 ? ' day' : ' days',
                  style: AppText.display(size: 17, color: TeamColors.amber),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _MiniStat(
                label: 'This week',
                icon: Icons.event_available_rounded,
                color: TeamColors.sky,
                child: Text(
                  '${s.daysLoggedThisWeek}/7 days',
                  key: const ValueKey('stat-days'),
                  style: AppText.display(size: 17, color: TeamColors.sky),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _MiniStat(
                label: 'Weekly avg',
                icon: Icons.show_chart_rounded,
                color: TeamColors.indigo,
                child: Text(
                  avg == null ? '—' : '${fmtNum(r1(avg))} kg',
                  key: const ValueKey('stat-avg'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.display(size: 17, color: TeamColors.indigo),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (delta != null)
          TeamTag(
            key: const ValueKey('week-delta'),
            label: delta == 0
                ? 'Same average as last week'
                : '${delta > 0 ? '▲' : '▼'} ${fmtNum(delta.abs())} kg vs last week',
            color: deltaTone(delta),
          )
        else
          Text(
            avg == null
                ? 'Log your weight this week to see how it compares.'
                : 'Weigh in again next week to compare your averages.',
            key: const ValueKey('week-delta-empty'),
            style: AppText.body(
              size: 12,
              weight: FontWeight.w600,
              color: AppColors.inkFaint,
            ),
          ),
      ],
    );

    return FadeUp(
      index: 0,
      child: TeamSectionCard(
        icon: Icons.local_fire_department_rounded,
        color: AppColors.memberB,
        title: 'Daily tracking',
        subtitle: s.loggedToday
            ? 'Logged today — nice work'
            : 'A quick weigh-in each day keeps the trend honest',
        child: LayoutBuilder(
          builder: (context, c) {
            if (goal == null) return week;
            final goalCard = _GoalCard(goal: goal);
            if (c.maxWidth >= 560) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: week),
                  const SizedBox(width: 24),
                  SizedBox(width: 250, child: goalCard),
                ],
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                week,
                const SizedBox(height: 16),
                Divider(height: 1, color: AppColors.line),
                const SizedBox(height: 16),
                goalCard,
              ],
            );
          },
        ),
      ),
    );
  }

  // ── stat tiles ────────────────────────────────────────────────────────────

  Widget _tiles(
    MemberProgress p,
    BodyMeasurement latest,
    BodyMeasurement? prev,
    BodyMeasurement first,
    double? w,
    double? bf,
    double? bmi,
    double? sinceFirst,
  ) {
    String vs(MeasurementField f, String unit) {
      final d = p.diff(latest, prev, f);
      if (prev == null || d == null) return 'Latest';
      return '${d > 0 ? '+' : ''}${fmtNum(d)}$unit vs previous';
    }

    final tiles = <_Tile>[
      if (w != null)
        _Tile(
          'Weight',
          '${fmtNum(w)} kg',
          vs(MeasurementField.weight, ' kg'),
          Icons.monitor_weight_rounded,
          TeamColors.indigo,
        ),
      if (bmi != null)
        _Tile(
          'BMI (computed)',
          bmi.toStringAsFixed(1),
          '${MemberProgress.bmiBand(bmi)} · from weight & height',
          Icons.monitor_heart_rounded,
          bmi < 18.5
              ? TeamColors.sky
              : bmi < 25
                  ? TeamColors.green
                  : bmi < 30
                      ? TeamColors.amber
                      : TeamColors.rose,
        ),
      if (bf != null)
        _Tile(
          'Body fat',
          '${fmtNum(bf)}%',
          vs(MeasurementField.bodyFat, '%'),
          Icons.percent_rounded,
          TeamColors.amber,
        ),
      if (p.valued.length > 1 && sinceFirst != null)
        _Tile(
          'Since first',
          '${sinceFirst > 0 ? '+' : ''}${fmtNum(sinceFirst)} kg',
          'Since ${longDay(first.recordedAt)}',
          Icons.trending_up_rounded,
          TeamColors.violet,
        )
      else
        _Tile(
          'Check-ins',
          '${p.valued.length}',
          'First ${longDay(first.recordedAt)}',
          Icons.straighten_rounded,
          TeamColors.violet,
        ),
    ];
    return LayoutBuilder(
      builder: (context, c) {
        final cols = c.maxWidth >= 560 ? 4 : 2;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          itemCount: tiles.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: cols,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            mainAxisExtent: 124,
          ),
          itemBuilder: (context, i) => FadeUp(index: i, child: tiles[i]),
        );
      },
    );
  }

  // ── trends ────────────────────────────────────────────────────────────────

  Widget _trends(MemberProgress p, MemberWeightStats stats) {
    final rows = p.inRange(_rangeDays);
    List<double?> col(MeasurementField f) => [for (final e in rows) f.of(e)];
    final labels = [for (final e in rows) shortDay(e.recordedAt)];

    Widget chart({
      required String title,
      required MeasurementField f,
      required String empty,
      required IconData icon,
    }) {
      final values = col(f);
      final n = values.where((v) => v != null).length;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppText.body(size: 13, weight: FontWeight.w800)),
          const SizedBox(height: 6),
          if (n >= 2)
            MeasurementLineChart(
              key: ValueKey('chart-${f.name}-$_rangeDays'),
              labels: labels,
              series: [
                ChartSeries(
                  label: f.label,
                  color: f.color,
                  values: values,
                  unit: f.unit,
                  fill: true,
                ),
              ],
              height: 150,
            )
          else
            _EmptyChart(icon: icon, text: empty),
        ],
      );
    }

    final girths = [
      for (final f in MeasurementField.values)
        if (f.isGirth && col(f).any((v) => v != null)) f,
    ];
    return TeamSectionCard(
      icon: Icons.trending_up_rounded,
      color: AppColors.memberB,
      title: 'Trends',
      subtitle: 'Plotted from each check-in',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            children: [
              for (final r in _ranges)
                TeamFilterChip(
                  label: r.label,
                  selected: _rangeDays == r.days,
                  onTap: () => setState(() => _rangeDays = r.days),
                ),
            ],
          ),
          const SizedBox(height: 16),
          _weightChart(stats),
          const SizedBox(height: 18),
          chart(
            title: 'Body fat (%)',
            f: MeasurementField.bodyFat,
            empty: 'Not enough body-fat check-ins in this range',
            icon: Icons.percent_rounded,
          ),
          const SizedBox(height: 18),
          Text(
            'Girths (cm)',
            style: AppText.body(size: 13, weight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          if (girths.isNotEmpty && rows.length >= 2)
            MeasurementLineChart(
              key: ValueKey('chart-girths-$_rangeDays'),
              labels: labels,
              series: [
                for (final f in girths)
                  ChartSeries(
                    label: f.label,
                    color: f.color,
                    values: col(f),
                    unit: f.unit,
                  ),
              ],
              height: 170,
            )
          else
            const _EmptyChart(
              icon: Icons.straighten_rounded,
              text: 'Not enough girth check-ins in this range',
            ),
        ],
      ),
    );
  }

  /// Daily weight points plus the 7-day moving average (computed over the
  /// whole history so the start of a range is not artificially noisy, then
  /// cut to the selected range).
  Widget _weightChart(MemberWeightStats stats) {
    final today = dayOrdinal(stats.today);
    final keep = [
      for (var i = 0; i < stats.days.length; i++)
        if (_rangeDays == null ||
            today - dayOrdinal(stats.days[i].day) <= _rangeDays!)
          i,
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Weight (kg)',
          style: AppText.body(size: 13, weight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        if (keep.length >= 2)
          MeasurementLineChart(
            key: ValueKey('chart-weight-$_rangeDays'),
            labels: [for (final i in keep) shortDay(stats.days[i].day)],
            series: [
              ChartSeries(
                label: 'Daily weight',
                color: TeamColors.indigo,
                values: [for (final i in keep) stats.days[i].kg],
                unit: 'kg',
                strokeWidth: 1.8,
              ),
              ChartSeries(
                label: '7-day average',
                color: AppColors.memberB,
                values: [for (final i in keep) stats.movingAverage[i]],
                unit: 'kg',
                dots: false,
                strokeWidth: 3.4,
              ),
            ],
            height: 170,
          )
        else
          const _EmptyChart(
            icon: Icons.monitor_weight_rounded,
            text: 'Not enough weight check-ins in this range',
          ),
      ],
    );
  }

  // ── first vs latest ───────────────────────────────────────────────────────

  Widget _comparison(
    MemberProgress p,
    BodyMeasurement first,
    BodyMeasurement latest,
    double? bmi,
  ) {
    final two = p.valued.length >= 2;
    final fields = [
      for (final f in MeasurementField.values)
        if (f.of(first) != null || f.of(latest) != null) f,
    ];
    final bmiFirst = p.bmiOf(first);
    return TeamSectionCard(
      icon: Icons.compare_arrows_rounded,
      color: TeamColors.violet,
      title: 'First vs latest',
      subtitle: two
          ? '${longDay(first.recordedAt)} → ${longDay(latest.recordedAt)}'
          : 'Needs two check-ins to compare',
      child: !two
          ? Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Text(
                "Only one check-in so far. Once you have a second one, you'll "
                'see what changed.',
                style: AppText.body(size: 13, color: AppColors.inkFaint),
              ),
            )
          : Column(
              children: [
                for (final f in fields)
                  _CompareRow(
                    label: f.label,
                    color: f.color,
                    from: f.of(first),
                    to: f.of(latest),
                    unit: f.unit,
                    diff: p.diff(latest, first, f),
                    lowerIsBetter: lowerIsBetter(f),
                  ),
                if (bmiFirst != null && bmi != null)
                  _CompareRow(
                    label: 'BMI (computed)',
                    color: TeamColors.green,
                    from: bmiFirst,
                    to: bmi,
                    unit: '',
                    diff: r1(bmi - bmiFirst),
                    lowerIsBetter: null,
                  ),
              ],
            ),
    );
  }

  // ── history ───────────────────────────────────────────────────────────────

  Widget _history(MemberProgress p) {
    final rows = p.history;
    return TeamSectionCard(
      icon: Icons.history_rounded,
      color: TeamColors.sky,
      title: 'History',
      subtitle: 'Tap a check-in for every value',
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const SizedBox(height: 10),
            _HistoryRow(
              entry: rows[i],
              latest: i == 0,
              open: _openId == rows[i].id,
              deleting: _deletingId == rows[i].id,
              busy: _deletingId != null,
              onTap: () => setState(
                () => _openId = _openId == rows[i].id ? null : rows[i].id,
              ),
              onEdit: () => _edit(rows[i]),
              onDelete: () => _delete(rows[i]),
            ),
          ],
        ],
      ),
    );
  }
}

// ── pieces ──────────────────────────────────────────────────────────────────

class _Hero extends StatelessWidget {
  const _Hero({
    required this.topInset,
    required this.title,
    required this.subtitle,
    required this.chips,
    this.stats = const [],
    this.actions,
  });

  final double topInset;
  final String title;
  final String subtitle;
  final List<String> chips;
  final List<(String, String)> stats;

  /// The Log weight / Full check-in buttons.
  final Widget? actions;

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
          padding: EdgeInsets.fromLTRB(20, topInset + 4, 20, 22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'BODY MEASUREMENTS',
                style: AppText.eyebrow(color: on.withValues(alpha: 0.7)),
              ),
              const SizedBox(height: 4),
              Text(title, style: AppText.display(size: 34, color: on)),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w700,
                  color: on.withValues(alpha: 0.75),
                ),
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
                          border: Border.all(
                            color: on.withValues(alpha: 0.22),
                          ),
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
                              Text(
                                stats[i].$2,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.display(size: 18, color: on),
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
                    ],
                  ],
                ),
              ],
              if (actions != null) ...[
                const SizedBox(height: 16),
                actions!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// One of the two hero actions: [filled] = the primary "Log weight".
class _HeroButton extends StatelessWidget {
  const _HeroButton({
    super.key,
    required this.label,
    required this.icon,
    required this.filled,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool filled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final on = AppRole.member.onGradient;
    final fg = filled ? AppColors.memberA : on;
    return Material(
      color: filled ? on : on.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          height: 46,
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border:
                filled ? null : Border.all(color: on.withValues(alpha: 0.28)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: fg),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 13.5,
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

/// One of the last-seven-days dots: filled with a tick when that day has a
/// check-in, a ring around today.
class _DayDot extends StatelessWidget {
  const _DayDot({
    required this.index,
    required this.letter,
    required this.logged,
    required this.isToday,
  });

  final int index;
  final String letter;
  final bool logged;
  final bool isToday;

  @override
  Widget build(BuildContext context) {
    return PopIn(
      index: index,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            letter,
            style: AppText.body(
              size: 10.5,
              weight: FontWeight.w800,
              color: isToday ? AppColors.memberB : AppColors.inkFaint,
            ),
          ),
          const SizedBox(height: 5),
          Container(
            key: ValueKey('day-dot-$index-${logged ? 'on' : 'off'}'),
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: logged ? AppColors.memberGrad : null,
              color: logged ? null : AppColors.surface2,
              border: Border.all(
                color: isToday
                    ? AppColors.memberB
                    : logged
                        ? Colors.transparent
                        : AppColors.line,
                width: isToday ? 2 : 1,
              ),
            ),
            alignment: Alignment.center,
            child: logged
                ? Icon(
                    Icons.check_rounded,
                    size: 16,
                    color: AppRole.member.onGradient,
                  )
                : null,
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({
    required this.label,
    required this.icon,
    required this.color,
    required this.child,
  });

  final String label;
  final IconData icon;
  final Color color;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 9, 8, 9),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 12, color: color),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 10.5,
                    weight: FontWeight.w700,
                    color: AppColors.inkFaint,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
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

/// Progress toward the target weight: a ring that fills in, the target, what
/// is left, and where the member started.
class _GoalCard extends StatelessWidget {
  const _GoalCard({required this.goal});

  final GoalProgress goal;

  @override
  Widget build(BuildContext context) {
    final pct = (goal.ratio * 100).round();
    return Row(
      key: const ValueKey('goal-card'),
      children: [
        AnimatedRing(
          value: goal.ratio,
          size: 78,
          stroke: 9,
          colors: const [AppColors.memberA, AppColors.memberB],
          track: AppColors.line,
          child: CountUp(
            value: pct,
            suffix: '%',
            style: AppText.display(size: 17),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Goal ${fmtNum(goal.target)} kg',
                style: AppText.body(size: 14, weight: FontWeight.w800),
              ),
              const SizedBox(height: 2),
              Text(
                goal.reached
                    ? 'Goal reached — great work!'
                    : '${fmtNum(goal.remaining)} kg to go',
                key: const ValueKey('goal-remaining'),
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w700,
                  color: goal.reached ? TeamColors.green : AppColors.inkSoft,
                ),
              ),
              Text(
                'Started at ${fmtNum(goal.start)} kg',
                style: AppText.body(
                  size: 11.5,
                  weight: FontWeight.w600,
                  color: AppColors.inkFaint,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile(this.label, this.value, this.hint, this.icon, this.color);

  final String label;
  final String value;
  final String hint;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [color.withValues(alpha: 0.16), Colors.transparent],
        ),
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.24)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Icon(icon, size: 14, color: color),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 11,
                    weight: FontWeight.w700,
                    color: AppColors.inkFaint,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.display(size: 22, color: color),
          ),
          const Spacer(),
          Text(
            hint,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppText.body(
              size: 10.5,
              weight: FontWeight.w600,
              color: AppColors.inkFaint,
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyChart extends StatelessWidget {
  const _EmptyChart({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 16, color: AppColors.inkFaint),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              text,
              textAlign: TextAlign.center,
              style: AppText.body(
                size: 12,
                weight: FontWeight.w600,
                color: AppColors.inkFaint,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CompareRow extends StatelessWidget {
  const _CompareRow({
    required this.label,
    required this.color,
    required this.from,
    required this.to,
    required this.unit,
    required this.diff,
    required this.lowerIsBetter,
  });

  final String label;
  final Color color;
  final double? from;
  final double? to;
  final String unit;
  final double? diff;
  final bool? lowerIsBetter;

  @override
  Widget build(BuildContext context) {
    Widget delta() {
      final d = diff;
      if (d == null) {
        return Text(
          '—',
          style: AppText.body(size: 12, color: AppColors.inkFaint),
        );
      }
      if (d == 0) {
        return const TeamTag(label: 'No change', color: TeamColors.slate);
      }
      final good =
          lowerIsBetter == null ? null : (lowerIsBetter! ? d < 0 : d > 0);
      final tone = good == null
          ? TeamColors.sky
          : good
              ? TeamColors.green
              : TeamColors.rose;
      return TeamTag(
        label: '${fmtNum(d.abs())}${unit.isEmpty ? '' : ' $unit'}',
        color: tone,
        icon: d > 0 ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
                Text.rich(
                  TextSpan(
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: AppColors.inkFaint,
                    ),
                    children: [
                      TextSpan(
                        text: '${from == null ? '—' : fmtNum(from!)} → ',
                      ),
                      TextSpan(
                        text: to == null ? '—' : fmtNum(to!),
                        style: AppText.body(
                          size: 12,
                          weight: FontWeight.w800,
                        ),
                      ),
                      if (unit.isNotEmpty) TextSpan(text: ' $unit'),
                    ],
                  ),
                ),
              ],
            ),
          ),
          delta(),
        ],
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({
    required this.entry,
    required this.latest,
    required this.open,
    required this.deleting,
    required this.busy,
    required this.onTap,
    required this.onEdit,
    required this.onDelete,
  });

  final BodyMeasurement entry;
  final bool latest;
  final bool open;

  /// This row's delete request is in flight.
  final bool deleting;

  /// Any delete is in flight (disables the other rows' buttons).
  final bool busy;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  /// "Logged by you" for the member's own entries, "Recorded by (staff name)"
  /// otherwise.
  Widget _sourceTag() {
    if (entry.isMemberLogged) {
      return const TeamTag(
        label: 'Logged by you',
        color: TeamColors.teal,
        icon: Icons.person_rounded,
      );
    }
    final name = entry.recordedBy?.name;
    return TeamTag(
      label: name == null ? 'Recorded by staff' : 'Recorded by $name',
      color: TeamColors.slate,
      icon: Icons.badge_outlined,
    );
  }

  @override
  Widget build(BuildContext context) {
    final fields = recordedFields(entry);
    final headline = fields.take(3).toList();
    return Container(
      key: ValueKey('history-${entry.id}'),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            longDay(entry.recordedAt),
                            style: AppText.body(
                              size: 14,
                              weight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              // A long staff name shrinks the tag instead
                              // of overflowing the row.
                              Flexible(
                                child: FittedBox(
                                  fit: BoxFit.scaleDown,
                                  alignment: Alignment.centerLeft,
                                  child: _sourceTag(),
                                ),
                              ),
                              if (latest) ...[
                                const SizedBox(width: 6),
                                const TeamTag(
                                  label: 'Latest',
                                  color: TeamColors.green,
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            headline.isEmpty
                                ? 'No values recorded'
                                : headline
                                    .map(
                                      (f) =>
                                          '${f.label} ${f.show(f.of(entry)!)}',
                                    )
                                    .join(' · '),
                            maxLines: 2,
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
                    Icon(
                      open
                          ? Icons.expand_less_rounded
                          : Icons.expand_more_rounded,
                      color: AppColors.inkFaint,
                    ),
                  ],
                ),
              ),
            ),
            if (open)
              Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: AppColors.line)),
                ),
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final f in fields)
                          MeasurementValueChip(field: f, value: f.of(entry)!),
                      ],
                    ),
                    if (entry.notes != null && entry.notes!.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Text(
                        entry.notes!,
                        style: AppText.body(
                          size: 12.5,
                          color: AppColors.inkSoft,
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    if (entry.isMemberLogged)
                      Row(
                        children: [
                          AppButton(
                            key: ValueKey('edit-${entry.id}'),
                            label: 'Edit',
                            icon: Icons.edit_outlined,
                            role: AppRole.member,
                            variant: AppButtonVariant.ghost,
                            size: AppButtonSize.small,
                            fullWidth: false,
                            onPressed: busy ? null : onEdit,
                          ),
                          const SizedBox(width: 8),
                          AppButton(
                            key: ValueKey('delete-${entry.id}'),
                            label: 'Delete',
                            icon: Icons.delete_outline_rounded,
                            role: AppRole.member,
                            variant: AppButtonVariant.ghost,
                            size: AppButtonSize.small,
                            fullWidth: false,
                            loading: deleting,
                            foregroundColor: AppColors.danger,
                            onPressed: busy ? null : onDelete,
                          ),
                        ],
                      )
                    else
                      Text(
                        'Recorded by your gym — only they can change it.',
                        style: AppText.body(
                          size: 11,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
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
}
