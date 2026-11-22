// Wire enums of the HR API (`docs/HR-API-CONTRACT.md` §0). Every parser is
// tolerant: an unknown string maps to a safe fallback instead of throwing, so
// a newer server value never blanks a whole screen.

/// How much of a day a leave request covers.
enum DayPart {
  fullDay('FULL_DAY', 'Full day', 1),
  halfMorning('HALF_DAY_MORNING', 'Half day · morning', 0.5),
  halfEvening('HALF_DAY_EVENING', 'Half day · evening', 0.5);

  const DayPart(this.api, this.label, this.weight);

  final String api;
  final String label;

  /// Days one working date counts for.
  final double weight;

  bool get isHalf => this != DayPart.fullDay;

  static DayPart parse(Object? v) => DayPart.values.firstWhere(
        (e) => e.api == v,
        orElse: () => DayPart.fullDay,
      );
}

enum LeaveStatus {
  pending('PENDING', 'Pending'),
  approved('APPROVED', 'Approved'),
  rejected('REJECTED', 'Rejected'),
  cancelled('CANCELLED', 'Cancelled');

  const LeaveStatus(this.api, this.label);

  final String api;
  final String label;

  static LeaveStatus parse(Object? v) => LeaveStatus.values.firstWhere(
        (e) => e.api == v,
        orElse: () => LeaveStatus.pending,
      );
}

/// What a day shows on a read endpoint: the stored `AttendanceStatus` values
/// plus the two computed ones.
enum DayStatus {
  present('PRESENT', 'Present'),
  late('LATE', 'Late'),
  halfDay('HALF_DAY', 'Half day'),
  onLeave('ON_LEAVE', 'On leave'),
  absent('ABSENT', 'Absent'),
  weeklyOff('WEEKLY_OFF', 'Weekly off'),
  holiday('HOLIDAY', 'Holiday'),
  notMarked('NOT_MARKED', 'Not marked'),
  notJoined('NOT_JOINED', 'Not joined');

  const DayStatus(this.api, this.label);

  final String api;
  final String label;

  /// The statuses HR may write with `PUT /hr/attendance`.
  static const markable = [
    present,
    late,
    halfDay,
    absent,
    onLeave,
    weeklyOff,
    holiday,
  ];

  /// Only these accept check-in / check-out times.
  bool get acceptsTimes => this == present || this == late || this == halfDay;

  static DayStatus parse(Object? v) => DayStatus.values.firstWhere(
        (e) => e.api == v,
        orElse: () => DayStatus.notMarked,
      );
}

enum PayslipStatus {
  draft('DRAFT', 'Draft'),
  paid('PAID', 'Paid');

  const PayslipStatus(this.api, this.label);

  final String api;
  final String label;

  static PayslipStatus parse(Object? v) => PayslipStatus.values.firstWhere(
        (e) => e.api == v,
        orElse: () => PayslipStatus.draft,
      );
}

enum PayrollRunStatus {
  draft('DRAFT', 'Draft'),
  approved('APPROVED', 'Approved'),
  paid('PAID', 'Paid');

  const PayrollRunStatus(this.api, this.label);

  final String api;
  final String label;

  static PayrollRunStatus parse(Object? v) =>
      PayrollRunStatus.values.firstWhere(
        (e) => e.api == v,
        orElse: () => PayrollRunStatus.draft,
      );
}

enum PaymentMode {
  cash('CASH', 'Cash'),
  upi('UPI', 'UPI'),
  bankTransfer('BANK_TRANSFER', 'Bank transfer'),
  cheque('CHEQUE', 'Cheque'),
  other('OTHER', 'Other');

  const PaymentMode(this.api, this.label);

  final String api;
  final String label;

  static PaymentMode? tryParse(Object? v) {
    for (final e in PaymentMode.values) {
      if (e.api == v) return e;
    }
    return null;
  }
}

/// Safe numeric reads: the API sends JSON numbers, but a stringified decimal
/// must not crash a screen.
double hrNum(Object? v, [double fallback = 0]) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? fallback;
  return fallback;
}

double? hrNumOrNull(Object? v) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v);
  return null;
}

int hrInt(Object? v, [int fallback = 0]) {
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v) ?? fallback;
  return fallback;
}

/// `YYYY-MM-DD` → a local-midnight `DateTime` (no timezone drift: the API's
/// dates are IST business dates, never instants).
DateTime hrParseDate(Object? v) {
  if (v is String && v.length >= 10) {
    final y = int.tryParse(v.substring(0, 4));
    final m = int.tryParse(v.substring(5, 7));
    final d = int.tryParse(v.substring(8, 10));
    if (y != null && m != null && d != null) return DateTime(y, m, d);
  }
  return DateTime(1970);
}

/// ISO instant → [DateTime] (UTC), `null` when absent/unparseable.
DateTime? hrParseInstant(Object? v) =>
    v is String ? DateTime.tryParse(v) : null;

/// Weekday of the HR API (`MONDAY` ... `SUNDAY`, upper-case). Monday-first.
enum HrWeekday {
  monday('MONDAY', 'Mon'),
  tuesday('TUESDAY', 'Tue'),
  wednesday('WEDNESDAY', 'Wed'),
  thursday('THURSDAY', 'Thu'),
  friday('FRIDAY', 'Fri'),
  saturday('SATURDAY', 'Sat'),
  sunday('SUNDAY', 'Sun');

  const HrWeekday(this.api, this.short);

  final String api;
  final String short;

  static HrWeekday? tryParse(Object? v) {
    for (final e in HrWeekday.values) {
      if (e.api == v) return e;
    }
    return null;
  }

  /// A weekday list sorted Monday-first with unknown values dropped.
  static List<String> normalise(Iterable<String> days) => [
        for (final d in HrWeekday.values)
          if (days.contains(d.api)) d.api,
      ];

  /// `["SATURDAY","SUNDAY"]` -> `Sat, Sun` (`None` when empty).
  static String shortList(Iterable<String> days) {
    final list = [
      for (final d in HrWeekday.values)
        if (days.contains(d.api)) d.short,
    ];
    return list.isEmpty ? 'None' : list.join(', ');
  }
}
