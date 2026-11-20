/// FitCloud runs on Indian Standard Time. Anything that asks "what day is it
/// for the gym" — default dates on a form, the end of a report range, the
/// "today" / "this month" analytics windows — uses [AppClock], not
/// `DateTime.now()` (the phone's zone) or `.toUtc()` (a day behind for the
/// first 5½ hours of every Indian morning).
///
/// [now] returns India's wall-clock time as an ordinary local-flavoured
/// `DateTime`, so `toIso8601String().substring(0, 10)` and friends give the
/// Indian date. It is for CALENDAR maths only — never subtract it from a real
/// instant (a server timestamp, a `Stopwatch`); use `DateTime.now()` for those.
///
/// Mirrors `apps/api/src/core/utils/business-time.ts` and
/// `apps/tenant-web/src/lib/business-time.ts`.
class AppClock {
  AppClock._();

  static const timezone = 'Asia/Kolkata';
  static const country = 'India';
  static const _offset = Duration(hours: 5, minutes: 30);

  /// Right now on India's wall clock.
  static DateTime now() {
    final u = DateTime.now().toUtc().add(_offset);
    return DateTime(
      u.year,
      u.month,
      u.day,
      u.hour,
      u.minute,
      u.second,
      u.millisecond,
    );
  }

  /// Today's date in India, at midnight.
  static DateTime today() {
    final n = now();
    return DateTime(n.year, n.month, n.day);
  }
}
