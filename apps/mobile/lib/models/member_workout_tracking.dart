/// Models for the member's workout self-tracking: the additive `tracking`
/// block on `GET /portal/workout` and the `/portal/workout/log*` endpoints.
/// Every figure is derived server-side from real logs — the app never invents
/// numbers.
library;

int? _intOrNull(Object? v) {
  if (v == null) return null;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString());
}

int _int(Object? v) => _intOrNull(v) ?? 0;

double? _dblOrNull(Object? v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString());
}

/// `2026-10-19` (a plain calendar day) → a local-midnight [DateTime].
DateTime parseDayKey(String s) {
  final p = s.split('-');
  return DateTime(int.parse(p[0]), int.parse(p[1]), int.parse(p[2]));
}

/// A local date → the `YYYY-MM-DD` key the API uses.
String dayKey(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// What a member did for an exercise on a day.
enum LogStatus { completed, skipped }

extension LogStatusX on LogStatus {
  String get apiValue => this == LogStatus.completed ? 'COMPLETED' : 'SKIPPED';

  static LogStatus fromApi(String v) =>
      v == 'SKIPPED' ? LogStatus.skipped : LogStatus.completed;
}

/// The state of one calendar day of the plan.
enum DayState {
  rest,
  outside,
  upcoming,
  today,
  done,
  partial,
  skipped,
  missed,
}

DayState _dayState(String v) => switch (v) {
      'OUTSIDE' => DayState.outside,
      'UPCOMING' => DayState.upcoming,
      'TODAY' => DayState.today,
      'DONE' => DayState.done,
      'PARTIAL' => DayState.partial,
      'SKIPPED' => DayState.skipped,
      'MISSED' => DayState.missed,
      _ => DayState.rest,
    };

enum InsightTone { good, warn, tip }

InsightTone _tone(String v) => switch (v) {
      'good' => InsightTone.good,
      'warn' => InsightTone.warn,
      _ => InsightTone.tip,
    };

/// One exercise of a day: the plan's targets plus what (if anything) was logged.
class TrackingExercise {
  const TrackingExercise({
    required this.exerciseId,
    required this.name,
    this.muscleGroup,
    this.sets,
    this.reps,
    this.restSeconds,
    this.notes,
    this.status,
    this.logId,
    this.setsDone,
    this.repsDone,
    this.weightKg,
    this.durationMin,
    this.logNotes,
  });

  final String exerciseId;
  final String name;
  final String? muscleGroup;

  /// Plan targets (null when the plan sets none).
  final int? sets;
  final int? reps;
  final int? restSeconds;
  final String? notes;

  /// null = not logged yet.
  final LogStatus? status;
  final String? logId;
  final int? setsDone;
  final int? repsDone;
  final double? weightKg;
  final int? durationMin;
  final String? logNotes;

  bool get isDone => status == LogStatus.completed;
  bool get isSkipped => status == LogStatus.skipped;
  bool get isPending => status == null;

  /// `4 x 8 · rest 90s` from the plan; null when the plan sets none.
  String? get targetLabel {
    final parts = <String>[
      if (sets != null && reps != null)
        '$sets x $reps'
      else if (sets != null)
        '$sets sets'
      else if (reps != null)
        '$reps reps',
      if (restSeconds != null) 'rest ${restSeconds}s',
    ];
    return parts.isEmpty ? null : parts.join(' · ');
  }

  /// `4 x 8 @ 60 kg · 12 min` from what was logged; null when nothing was.
  String? get loggedLabel => describeLogged(
        setsDone: setsDone,
        repsDone: repsDone,
        weightKg: weightKg,
        durationMin: durationMin,
      );

  factory TrackingExercise.fromJson(Map<String, dynamic> j) => TrackingExercise(
        exerciseId: j['exerciseId'] as String,
        name: j['name'] as String,
        muscleGroup: j['muscleGroup'] as String?,
        sets: _intOrNull(j['sets']),
        reps: _intOrNull(j['reps']),
        restSeconds: _intOrNull(j['restSeconds']),
        notes: j['notes'] as String?,
        status: j['status'] == 'COMPLETED'
            ? LogStatus.completed
            : j['status'] == 'SKIPPED'
                ? LogStatus.skipped
                : null,
        logId: j['logId'] as String?,
        setsDone: _intOrNull(j['setsDone']),
        repsDone: _intOrNull(j['repsDone']),
        weightKg: _dblOrNull(j['weightKg']),
        durationMin: _intOrNull(j['durationMin']),
        logNotes: j['logNotes'] as String?,
      );
}

/// `4 x 8 @ 60 kg · 12 min` — shared by day cards and history rows.
String? describeLogged({
  int? setsDone,
  int? repsDone,
  double? weightKg,
  int? durationMin,
}) {
  final parts = <String>[
    if (setsDone != null && repsDone != null)
      '$setsDone x $repsDone'
    else if (setsDone != null)
      '$setsDone ${setsDone == 1 ? 'set' : 'sets'}'
    else if (repsDone != null)
      '$repsDone reps',
    if (weightKg != null) '@ ${fmtKg(weightKg)} kg',
    if (durationMin != null) '$durationMin min',
  ];
  return parts.isEmpty ? null : parts.join(' ');
}

/// `60` / `62.5` — drops a trailing `.0`.
String fmtKg(double v) => v == v.roundToDouble()
    ? v.toStringAsFixed(0)
    : v.toStringAsFixed(2).replaceFirst(RegExp(r'0+$'), '');

class SessionMeta {
  const SessionMeta({this.durationMin, this.effort, this.notes});

  final int? durationMin;
  final int? effort;
  final String? notes;

  factory SessionMeta.fromJson(Map<String, dynamic> j) => SessionMeta(
        durationMin: _intOrNull(j['durationMin']),
        effort: _intOrNull(j['effort']),
        notes: j['notes'] as String?,
      );
}

class TrackingDay {
  const TrackingDay({
    required this.date,
    required this.label,
    required this.isToday,
    required this.isFuture,
    required this.canLog,
    required this.state,
    required this.plannedCount,
    required this.completedCount,
    required this.skippedCount,
    required this.percent,
    required this.exercises,
    this.focus,
    this.session,
  });

  /// `YYYY-MM-DD` in the member's branch timezone.
  final String date;
  final String label;
  final bool isToday;
  final bool isFuture;

  /// Planned, not in the future, inside the back-date window.
  final bool canLog;
  final DayState state;
  final String? focus;
  final int plannedCount;
  final int completedCount;
  final int skippedCount;
  final int percent;
  final List<TrackingExercise> exercises;
  final SessionMeta? session;

  DateTime get day => parseDayKey(date);
  bool get isRest => plannedCount == 0;
  int get loggedCount => completedCount + skippedCount;
  int get remaining => plannedCount - loggedCount;

  factory TrackingDay.fromJson(Map<String, dynamic> j) => TrackingDay(
        date: j['date'] as String,
        label: j['label'] as String,
        isToday: j['isToday'] == true,
        isFuture: j['isFuture'] == true,
        canLog: j['canLog'] == true,
        state: _dayState(j['state'] as String? ?? 'REST'),
        focus: j['focus'] as String?,
        plannedCount: _int(j['plannedCount']),
        completedCount: _int(j['completedCount']),
        skippedCount: _int(j['skippedCount']),
        percent: _int(j['percent']),
        exercises: ((j['exercises'] as List?) ?? const [])
            .map((e) => TrackingExercise.fromJson(e as Map<String, dynamic>))
            .toList(),
        session: j['session'] == null
            ? null
            : SessionMeta.fromJson(j['session'] as Map<String, dynamic>),
      );
}

class WeekSummary {
  const WeekSummary({
    required this.start,
    required this.end,
    required this.plannedSessions,
    required this.completedSessions,
    required this.plannedExercises,
    required this.completedExercises,
    required this.skippedExercises,
    required this.completionPercent,
  });

  final String start;
  final String end;
  final int plannedSessions;
  final int completedSessions;
  final int plannedExercises;
  final int completedExercises;
  final int skippedExercises;
  final int completionPercent;

  factory WeekSummary.fromJson(Map<String, dynamic> j) => WeekSummary(
        start: j['start'] as String,
        end: j['end'] as String,
        plannedSessions: _int(j['plannedSessions']),
        completedSessions: _int(j['completedSessions']),
        plannedExercises: _int(j['plannedExercises']),
        completedExercises: _int(j['completedExercises']),
        skippedExercises: _int(j['skippedExercises']),
        completionPercent: _int(j['completionPercent']),
      );
}

class NextDay {
  const NextDay({
    required this.date,
    required this.label,
    required this.isToday,
    required this.plannedCount,
    this.focus,
  });

  final String date;
  final String label;
  final bool isToday;
  final String? focus;
  final int plannedCount;

  factory NextDay.fromJson(Map<String, dynamic> j) => NextDay(
        date: j['date'] as String,
        label: j['label'] as String,
        isToday: j['isToday'] == true,
        focus: j['focus'] as String?,
        plannedCount: _int(j['plannedCount']),
      );
}

class ConsistencyWeek {
  const ConsistencyWeek({
    required this.weekStart,
    required this.isCurrent,
    required this.plannedSessions,
    required this.completedSessions,
    this.percent,
  });

  final String weekStart;
  final bool isCurrent;
  final int plannedSessions;
  final int completedSessions;

  /// done / planned-so-far; null when nothing was planned yet.
  final int? percent;

  factory ConsistencyWeek.fromJson(Map<String, dynamic> j) => ConsistencyWeek(
        weekStart: j['weekStart'] as String,
        isCurrent: j['isCurrent'] == true,
        plannedSessions: _int(j['plannedSessions']),
        completedSessions: _int(j['completedSessions']),
        percent: _intOrNull(j['percent']),
      );
}

class ExerciseStat {
  const ExerciseStat({
    required this.exerciseId,
    required this.name,
    required this.planned,
    required this.completed,
    required this.skipped,
    this.muscleGroup,
  });

  final String exerciseId;
  final String name;
  final String? muscleGroup;
  final int planned;
  final int completed;
  final int skipped;

  double get rate => planned == 0 ? 0 : completed / planned;

  factory ExerciseStat.fromJson(Map<String, dynamic> j) => ExerciseStat(
        exerciseId: j['exerciseId'] as String,
        name: j['name'] as String,
        muscleGroup: j['muscleGroup'] as String?,
        planned: _int(j['planned']),
        completed: _int(j['completed']),
        skipped: _int(j['skipped']),
      );
}

class MuscleGroupStat {
  const MuscleGroupStat({
    required this.name,
    required this.planned,
    required this.completed,
    required this.skipped,
  });

  final String name;
  final int planned;
  final int completed;
  final int skipped;

  double get rate => planned == 0 ? 0 : completed / planned;

  factory MuscleGroupStat.fromJson(Map<String, dynamic> j) => MuscleGroupStat(
        name: j['name'] as String,
        planned: _int(j['planned']),
        completed: _int(j['completed']),
        skipped: _int(j['skipped']),
      );
}

class PersonalBest {
  const PersonalBest({
    required this.exerciseId,
    required this.name,
    required this.weightKg,
    required this.date,
    required this.isNew,
    this.repsDone,
  });

  final String exerciseId;
  final String name;
  final double weightKg;
  final int? repsDone;
  final String date;
  final bool isNew;

  factory PersonalBest.fromJson(Map<String, dynamic> j) => PersonalBest(
        exerciseId: j['exerciseId'] as String,
        name: j['name'] as String,
        weightKg: _dblOrNull(j['weightKg']) ?? 0,
        repsDone: _intOrNull(j['repsDone']),
        date: j['date'] as String,
        isNew: j['isNew'] == true,
      );
}

class WorkoutInsight {
  const WorkoutInsight({
    required this.tone,
    required this.title,
    required this.body,
  });

  final InsightTone tone;
  final String title;
  final String body;

  factory WorkoutInsight.fromJson(Map<String, dynamic> j) => WorkoutInsight(
        tone: _tone(j['tone'] as String? ?? 'tip'),
        title: j['title'] as String,
        body: j['body'] as String,
      );
}

class Last30 {
  const Last30({
    required this.sessionsDone,
    required this.exercisesCompleted,
    this.minutes,
    this.volumeKg,
    this.avgEffort,
  });

  final int sessionsDone;
  final int exercisesCompleted;

  /// Only when durations were logged.
  final int? minutes;

  /// Sum of sets x reps x kg over entries that carry all three.
  final double? volumeKg;
  final double? avgEffort;

  factory Last30.fromJson(Map<String, dynamic> j) => Last30(
        sessionsDone: _int(j['sessionsDone']),
        exercisesCompleted: _int(j['exercisesCompleted']),
        minutes: _intOrNull(j['minutes']),
        volumeKg: _dblOrNull(j['volumeKg']),
        avgEffort: _dblOrNull(j['avgEffort']),
      );
}

/// The `tracking` block of `GET /portal/workout`.
class WorkoutTracking {
  const WorkoutTracking({
    required this.today,
    required this.backdateDays,
    required this.windowStart,
    required this.everLogged,
    required this.days,
    required this.week,
    required this.streak,
    required this.consistency,
    required this.exercises,
    required this.muscleGroups,
    required this.mostSkipped,
    required this.last30,
    required this.personalBests,
    required this.insights,
    this.nextDay,
  });

  final String today;
  final int backdateDays;
  final String windowStart;
  final bool everLogged;
  final List<TrackingDay> days;
  final WeekSummary week;
  final NextDay? nextDay;
  final int streak;
  final List<ConsistencyWeek> consistency;
  final List<ExerciseStat> exercises;
  final List<MuscleGroupStat> muscleGroups;
  final List<ExerciseStat> mostSkipped;
  final Last30 last30;
  final List<PersonalBest> personalBests;
  final List<WorkoutInsight> insights;

  DateTime get todayDate => parseDayKey(today);

  TrackingDay? dayOf(String date) {
    for (final d in days) {
      if (d.date == date) return d;
    }
    return null;
  }

  TrackingDay? get todayDay => dayOf(today);

  /// The days of the week starting at [weekStart] (a Monday key).
  List<TrackingDay> weekOf(String weekStart) {
    final from = parseDayKey(weekStart);
    final to = DateTime(from.year, from.month, from.day + 6);
    return [
      for (final d in days)
        if (!d.day.isBefore(from) && !d.day.isAfter(to)) d,
    ];
  }

  /// The last seven days up to and including today.
  List<TrackingDay> get lastSeven {
    final upToToday = [
      for (final d in days)
        if (d.date.compareTo(today) <= 0) d,
    ];
    return upToToday.length <= 7
        ? upToToday
        : upToToday.sublist(upToToday.length - 7);
  }

  factory WorkoutTracking.fromJson(Map<String, dynamic> j) {
    List<T> list<T>(String key, T Function(Map<String, dynamic>) f) =>
        ((j[key] as List?) ?? const [])
            .map((e) => f(e as Map<String, dynamic>))
            .toList();
    return WorkoutTracking(
      today: j['today'] as String,
      backdateDays: _int(j['backdateDays']),
      windowStart: j['windowStart'] as String,
      everLogged: j['everLogged'] == true,
      days: list('days', TrackingDay.fromJson),
      week: WeekSummary.fromJson(j['week'] as Map<String, dynamic>),
      nextDay: j['nextDay'] == null
          ? null
          : NextDay.fromJson(j['nextDay'] as Map<String, dynamic>),
      streak: _int(j['streak']),
      consistency: list('consistency', ConsistencyWeek.fromJson),
      exercises: list('exercises', ExerciseStat.fromJson),
      muscleGroups: list('muscleGroups', MuscleGroupStat.fromJson),
      mostSkipped: list('mostSkipped', ExerciseStat.fromJson),
      last30: Last30.fromJson(j['last30'] as Map<String, dynamic>),
      personalBests: list('personalBests', PersonalBest.fromJson),
      insights: list('insights', WorkoutInsight.fromJson),
    );
  }
}

/// One saved log entry (`/portal/workout/log` rows).
class WorkoutLogEntry {
  const WorkoutLogEntry({
    required this.id,
    required this.date,
    required this.exerciseId,
    required this.exerciseName,
    required this.status,
    this.muscleGroup,
    this.setsDone,
    this.repsDone,
    this.weightKg,
    this.durationMin,
    this.notes,
  });

  final String id;
  final String date;
  final String exerciseId;
  final String exerciseName;
  final String? muscleGroup;
  final LogStatus status;
  final int? setsDone;
  final int? repsDone;
  final double? weightKg;
  final int? durationMin;
  final String? notes;

  DateTime get day => parseDayKey(date);

  String? get loggedLabel => describeLogged(
        setsDone: setsDone,
        repsDone: repsDone,
        weightKg: weightKg,
        durationMin: durationMin,
      );

  factory WorkoutLogEntry.fromJson(Map<String, dynamic> j) => WorkoutLogEntry(
        id: j['id'] as String,
        date: j['date'] as String,
        exerciseId: j['exerciseId'] as String,
        exerciseName: j['exerciseName'] as String,
        muscleGroup: j['muscleGroup'] as String?,
        status: LogStatusX.fromApi(j['status'] as String? ?? 'COMPLETED'),
        setsDone: _intOrNull(j['setsDone']),
        repsDone: _intOrNull(j['repsDone']),
        weightKg: _dblOrNull(j['weightKg']),
        durationMin: _intOrNull(j['durationMin']),
        notes: j['notes'] as String?,
      );
}

class WorkoutHistory {
  const WorkoutHistory({
    required this.today,
    required this.entries,
    required this.sessions,
  });

  final String today;
  final List<WorkoutLogEntry> entries;

  /// Session metadata keyed by day.
  final Map<String, SessionMeta> sessions;

  /// Entries grouped by day, newest day first.
  List<(String, List<WorkoutLogEntry>)> get byDay {
    final map = <String, List<WorkoutLogEntry>>{};
    for (final e in entries) {
      (map[e.date] ??= []).add(e);
    }
    final keys = map.keys.toList()..sort((a, b) => b.compareTo(a));
    return [for (final k in keys) (k, map[k]!)];
  }

  factory WorkoutHistory.fromJson(Map<String, dynamic> j) => WorkoutHistory(
        today: j['today'] as String,
        entries: ((j['entries'] as List?) ?? const [])
            .map((e) => WorkoutLogEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
        sessions: {
          for (final s in (j['sessions'] as List?) ?? const [])
            (s as Map<String, dynamic>)['date'] as String:
                SessionMeta.fromJson(s),
        },
      );
}

/// Optional performance details of a completed exercise. `null` = not logged
/// (on an edit it clears the stored value).
class WorkoutDetails {
  const WorkoutDetails({
    this.setsDone,
    this.repsDone,
    this.weightKg,
    this.durationMin,
    this.notes,
  });

  final int? setsDone;
  final int? repsDone;
  final double? weightKg;
  final int? durationMin;
  final String? notes;

  Map<String, dynamic> toJson() => {
        'setsDone': setsDone,
        'repsDone': repsDone,
        'weightKg': weightKg,
        'durationMin': durationMin,
        'notes': notes,
      };
}

/// Bounds mirror the API validators / DB CHECK constraints.
class WorkoutLimits {
  WorkoutLimits._();

  static const setsMax = 100;
  static const repsMax = 1000;
  static const weightMax = 1000.0;
  static const durationMax = 600;
  static const notesMax = 500;
}

const effortLabels = {
  1: 'Easy',
  2: 'Light',
  3: 'Moderate',
  4: 'Hard',
  5: 'Max effort',
};
