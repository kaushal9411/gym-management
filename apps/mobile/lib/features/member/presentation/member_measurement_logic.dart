import '../../../models/body_measurement.dart';
import '../../measurements/presentation/measurement_ui.dart';
import '../../measurements/presentation/member_progress.dart';

/// Whole-day ordinal of a calendar date (DST-proof: computed in UTC).
int dayOrdinal(DateTime d) =>
    DateTime.utc(d.year, d.month, d.day).millisecondsSinceEpoch ~/ 86400000;

/// One calendar day's weight (the mean when several entries share a day —
/// e.g. a staff check-in plus the member's own log).
class WeightDay {
  const WeightDay(this.day, this.kg);

  /// Date-only (local calendar day, see [entryDay]).
  final DateTime day;
  final double kg;
}

/// Progress from the first logged weight toward the target weight.
class GoalProgress {
  const GoalProgress({
    required this.target,
    required this.start,
    required this.current,
  });

  final double target;
  final double start;
  final double current;

  bool get isLoss => target < start;

  /// Goal reached (or passed) in the intended direction.
  bool get reached => isLoss ? current <= target : current >= target;

  /// 0..1 share of the way from [start] to [target]; moving the wrong way
  /// reads as 0, and a start that already equals the target as done.
  double get ratio {
    if (reached) return 1;
    final span = start - target;
    if (span == 0) return 1;
    return ((start - current) / span).clamp(0.0, 1.0);
  }

  /// Distance still to go (kg), never negative.
  double get remaining => reached ? 0 : r1((current - target).abs());
}

/// The daily / weekly numbers behind the member's self-tracking UI — pure
/// Dart so it can be unit-tested with a fixed [now].
///
/// * **Daily points**: one weight per calendar day ([days]).
/// * **7-day moving average** ([movingAverage]): for each day, the mean of
///   every logged day in the trailing seven calendar days (itself included) —
///   smooths daily water-weight noise without needing a log every day.
/// * **Week vs week** ([weekDelta]): average weight over the last 7 days
///   (today and the six before) minus the average of the 7 days before that.
///   Rolling windows (not Mon-Sun) so the number is never empty on Monday.
/// * **Days logged** ([daysLoggedThisWeek]) counts any check-in (staff or
///   member) in the same 7-day window; **streak** ([streak]) is consecutive
///   days logged up to today (or up to yesterday while today is still open).
class MemberWeightStats {
  MemberWeightStats(
    Iterable<BodyMeasurement> entries, {
    DateTime? now,
    this.targetKg,
  }) : today = entryDay(now ?? DateTime.now()) {
    final byDay = <int, List<double>>{};
    final firstOfDay = <int, DateTime>{};
    final logged = <int>{};
    for (final e in entries) {
      final day = entryDay(e.recordedAt);
      final ord = dayOrdinal(day);
      if (MeasurementField.values.any((f) => f.of(e) != null)) logged.add(ord);
      final w = e.weightKg;
      if (w == null) continue;
      (byDay[ord] ??= []).add(w);
      firstOfDay[ord] = day;
    }
    final ords = byDay.keys.toList()..sort();
    days = [
      for (final o in ords)
        WeightDay(
          firstOfDay[o]!,
          byDay[o]!.reduce((a, b) => a + b) / byDay[o]!.length,
        ),
    ];
    _loggedDays = logged;
  }

  final DateTime today;
  final double? targetKg;
  late final List<WeightDay> days;
  late final Set<int> _loggedDays;

  int get _todayOrd => dayOrdinal(today);

  bool get hasWeight => days.isNotEmpty;
  double? get currentKg => days.isEmpty ? null : days.last.kg;
  double? get startKg => days.isEmpty ? null : days.first.kg;

  /// Trailing 7-calendar-day mean for each of [days], same order.
  late final List<double> movingAverage = [
    for (final d in days)
      () {
        final o = dayOrdinal(d.day);
        final window = [
          for (final x in days)
            if (o - dayOrdinal(x.day) >= 0 && o - dayOrdinal(x.day) <= 6) x.kg,
        ];
        return window.reduce((a, b) => a + b) / window.length;
      }(),
  ];

  double? _avgBetween(int fromAgo, int toAgo) {
    final w = [
      for (final d in days)
        if (_todayOrd - dayOrdinal(d.day) >= fromAgo &&
            _todayOrd - dayOrdinal(d.day) <= toAgo)
          d.kg,
    ];
    return w.isEmpty ? null : w.reduce((a, b) => a + b) / w.length;
  }

  /// Average weight, today and the six days before.
  late final double? thisWeekAvg = _avgBetween(0, 6);

  /// Average weight, the seven days before that.
  late final double? lastWeekAvg = _avgBetween(7, 13);

  /// This week minus last week (one decimal); null unless both have data.
  double? get weekDelta => thisWeekAvg == null || lastWeekAvg == null
      ? null
      : r1(thisWeekAvg! - lastWeekAvg!);

  /// Which of the last 7 days (oldest first, today last) have a check-in.
  List<bool> get lastSevenDays => [
        for (var ago = 6; ago >= 0; ago--)
          _loggedDays.contains(_todayOrd - ago),
      ];

  int get daysLoggedThisWeek => lastSevenDays.where((x) => x).length;

  int get streak {
    var ord = _todayOrd;
    if (!_loggedDays.contains(ord)) ord -= 1;
    var n = 0;
    while (_loggedDays.contains(ord)) {
      n++;
      ord--;
    }
    return n;
  }

  /// True when a check-in exists for today (staff or member).
  bool get loggedToday => _loggedDays.contains(_todayOrd);

  GoalProgress? get goal {
    final t = targetKg;
    final s = startKg;
    final c = currentKg;
    if (t == null || t <= 0 || s == null || c == null) return null;
    return GoalProgress(target: t, start: s, current: c);
  }
}
