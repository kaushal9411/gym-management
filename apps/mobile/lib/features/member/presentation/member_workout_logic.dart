import '../../../models/member_workout_tracking.dart';

/// Pure helpers for the member workout screens (kept out of the widgets so
/// they can be unit-tested).

const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const _weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/// `2026-10-19` → `19 Oct`.
String shortDay(String key) {
  final d = parseDayKey(key);
  return '${d.day} ${_months[d.month - 1]}';
}

/// `2026-10-19` → `Mon`.
String weekdayShort(String key) => _weekdays[parseDayKey(key).weekday - 1];

/// `2026-10-19` → `Mon, 19 Oct`.
String dayLong(String key) => '${weekdayShort(key)}, ${shortDay(key)}';

/// The Monday key of the week containing [key].
String weekStartOf(String key) {
  final d = parseDayKey(key);
  return dayKey(DateTime(d.year, d.month, d.day - (d.weekday - 1)));
}

/// [key] shifted by [days] calendar days.
String addDaysKey(String key, int days) {
  final d = parseDayKey(key);
  return dayKey(DateTime(d.year, d.month, d.day + days));
}

/// The result of validating the details form: parsed values or per-field
/// messages (never both).
class DetailsValidation {
  const DetailsValidation.ok(this.details) : errors = const {};
  const DetailsValidation.errors(this.errors) : details = null;

  final WorkoutDetails? details;
  final Map<String, String> errors;

  bool get isValid => details != null;
}

/// Validates the sets / reps / weight / duration / note inputs of the
/// exercise-details sheet. Blank = not logged (null). Bounds mirror the API.
DetailsValidation validateWorkoutDetails({
  required String sets,
  required String reps,
  required String weight,
  required String duration,
  required String notes,
}) {
  final errors = <String, String>{};

  int? whole(String key, String raw, int max, String label) {
    final t = raw.trim();
    if (t.isEmpty) return null;
    final n = int.tryParse(t);
    if (n == null) {
      errors[key] = '$label must be a whole number.';
    } else if (n < 1) {
      errors[key] = '$label must be at least 1.';
    } else if (n > max) {
      errors[key] = '$label can be at most $max.';
    } else {
      return n;
    }
    return null;
  }

  final setsDone = whole('sets', sets, WorkoutLimits.setsMax, 'Sets');
  final repsDone = whole('reps', reps, WorkoutLimits.repsMax, 'Reps');
  final durationMin =
      whole('duration', duration, WorkoutLimits.durationMax, 'Duration');

  double? weightKg;
  final w = weight.trim().replaceAll(',', '.');
  if (w.isNotEmpty) {
    final n = double.tryParse(w);
    if (n == null || n.isNaN || n.isInfinite) {
      errors['weight'] = 'Weight must be a number.';
    } else if (n <= 0) {
      errors['weight'] = 'Weight must be greater than 0.';
    } else if (n > WorkoutLimits.weightMax) {
      errors['weight'] =
          'Weight can be at most ${WorkoutLimits.weightMax.toStringAsFixed(0)} kg.';
    } else {
      weightKg = (n * 100).round() / 100;
    }
  }

  final note = notes.trim();
  if (note.length > WorkoutLimits.notesMax) {
    errors['notes'] = 'Keep notes under ${WorkoutLimits.notesMax} characters.';
  }

  if (errors.isNotEmpty) return DetailsValidation.errors(errors);
  return DetailsValidation.ok(
    WorkoutDetails(
      setsDone: setsDone,
      repsDone: repsDone,
      weightKg: weightKg,
      durationMin: durationMin,
      notes: note.isEmpty ? null : note,
    ),
  );
}

/// Validates the finish-workout duration (whole minutes, blank = not logged).
/// Returns the minutes via [minutes] or an error message.
({int? minutes, String? error}) validateDurationMinutes(String raw) {
  final t = raw.trim();
  if (t.isEmpty) return (minutes: null, error: null);
  final n = int.tryParse(t);
  if (n == null || n < 1 || n > WorkoutLimits.durationMax) {
    return (
      minutes: null,
      error: 'Enter whole minutes between 1 and ${WorkoutLimits.durationMax}.',
    );
  }
  return (minutes: n, error: null);
}

/// Why the day's exercises are locked, or null when they can be logged.
String? lockedReason(TrackingDay day, int backdateDays) {
  if (day.canLog) return null;
  if (day.isFuture) return 'You can log this on the day.';
  return 'Logging is open for the last $backdateDays days.';
}
