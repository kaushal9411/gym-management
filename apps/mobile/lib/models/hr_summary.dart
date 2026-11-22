import 'hr_attendance.dart';
import 'hr_enums.dart';
import 'hr_leave.dart';
import 'hr_payroll.dart';

/// "Today" block of `GET /hr/me/summary`: the day's record plus exactly what
/// the Check in / Check out buttons may do.
class HrToday {
  const HrToday({
    required this.date,
    required this.attendance,
    required this.canCheckIn,
    required this.canCheckOut,
    this.isWeeklyOff = false,
    this.holidayName,
  });

  final DateTime date;
  final HrAttendanceDay attendance;
  final bool isWeeklyOff;
  final String? holidayName;
  final bool canCheckIn;
  final bool canCheckOut;

  /// Checked in and out already - nothing left to do today.
  bool get isDone => attendance.hasCheckedIn && attendance.hasCheckedOut;

  factory HrToday.fromJson(Map<String, dynamic> j) => HrToday(
        date: hrParseDate(j['date']),
        attendance: HrAttendanceDay.fromJson(
          j['attendance'] as Map<String, dynamic>,
        ),
        isWeeklyOff: j['isWeeklyOff'] as bool? ?? false,
        holidayName: j['holidayName'] as String?,
        canCheckIn: j['canCheckIn'] as bool? ?? false,
        canCheckOut: j['canCheckOut'] as bool? ?? false,
      );

  HrToday withAttendance(HrAttendanceDay a) => HrToday(
        date: date,
        attendance: a,
        isWeeklyOff: isWeeklyOff,
        holidayName: holidayName,
        // After a punch the server recomputes these; the cubit refetches the
        // summary, this is only the bridge until then.
        canCheckIn: false,
        canCheckOut: a.hasCheckedIn && !a.hasCheckedOut,
      );
}

/// `employee` block of the self summary (an [HrEmployeeRef] + work setup).
class HrMeEmployee {
  const HrMeEmployee({
    required this.ref,
    this.joiningDate,
    this.shift,
    this.weeklyOff = const [],
  });

  final HrEmployeeRef ref;
  final DateTime? joiningDate;
  final HrShiftRef? shift;

  /// Upper-case weekday names, e.g. `SUNDAY`.
  final List<String> weeklyOff;

  factory HrMeEmployee.fromJson(Map<String, dynamic> j) => HrMeEmployee(
        ref: HrEmployeeRef.fromJson(j),
        joiningDate:
            j['joiningDate'] == null ? null : hrParseDate(j['joiningDate']),
        shift: HrShiftRef.tryParse(j['shift']),
        weeklyOff: (j['weeklyOff'] as List? ?? const []).cast<String>(),
      );
}

/// `GET /hr/me/summary` - the whole My HR landing page in one call.
class HrMeSummary {
  const HrMeSummary({
    required this.employee,
    required this.today,
    required this.month,
    required this.monthStats,
    this.leaveBalances = const [],
    this.pendingLeaves = const [],
    this.upcomingLeaves = const [],
    this.upcomingHolidays = const [],
    this.latestPayslip,
    this.unreadNotifications = 0,
  });

  final HrMeEmployee employee;
  final HrToday today;

  /// `YYYY-MM`.
  final String month;
  final HrAttendanceStats monthStats;
  final List<HrLeaveBalance> leaveBalances;
  final List<HrLeaveRequest> pendingLeaves;
  final List<HrLeaveRequest> upcomingLeaves;
  final List<HrHoliday> upcomingHolidays;
  final HrPayslipSummary? latestPayslip;
  final int unreadNotifications;

  factory HrMeSummary.fromJson(Map<String, dynamic> j) {
    List<T> list<T>(String key, T Function(Map<String, dynamic>) f) =>
        (j[key] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(f)
            .toList();
    final month = j['month'] as Map<String, dynamic>? ?? const {};
    return HrMeSummary(
      employee: HrMeEmployee.fromJson(j['employee'] as Map<String, dynamic>),
      today: HrToday.fromJson(j['today'] as Map<String, dynamic>),
      month: month['month'] as String? ?? '',
      monthStats: HrAttendanceStats.tryParse(month['stats']),
      leaveBalances: list('leaveBalances', HrLeaveBalance.fromJson),
      pendingLeaves: list('pendingLeaves', HrLeaveRequest.fromJson),
      upcomingLeaves: list('upcomingLeaves', HrLeaveRequest.fromJson),
      upcomingHolidays: list('upcomingHolidays', HrHoliday.fromJson),
      latestPayslip: j['latestPayslip'] is Map<String, dynamic>
          ? HrPayslipSummary.fromJson(
              j['latestPayslip'] as Map<String, dynamic>,
            )
          : null,
      unreadNotifications: hrInt(j['unreadNotifications']),
    );
  }

  HrMeSummary copyWith({HrToday? today, int? unreadNotifications}) =>
      HrMeSummary(
        employee: employee,
        today: today ?? this.today,
        month: month,
        monthStats: monthStats,
        leaveBalances: leaveBalances,
        pendingLeaves: pendingLeaves,
        upcomingLeaves: upcomingLeaves,
        upcomingHolidays: upcomingHolidays,
        latestPayslip: latestPayslip,
        unreadNotifications: unreadNotifications ?? this.unreadNotifications,
      );
}
