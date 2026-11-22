import 'hr_enums.dart';

/// Small refs shared by every HR payload (`docs/HR-API-CONTRACT.md` §2).

class HrUserRef {
  const HrUserRef({required this.id, required this.name});

  final String id;
  final String name;

  static HrUserRef? tryParse(Object? j) => j is Map<String, dynamic>
      ? HrUserRef(
          id: j['id'] as String? ?? '',
          name: j['name'] as String? ?? '',
        )
      : null;
}

class HrEmployeeRef {
  const HrEmployeeRef({
    required this.userId,
    required this.employeeId,
    required this.name,
    this.avatarUrl,
    this.role = '',
  });

  final String userId;
  final String employeeId;
  final String name;
  final String? avatarUrl;
  final String role;

  factory HrEmployeeRef.fromJson(Map<String, dynamic> j) => HrEmployeeRef(
        userId: j['userId'] as String? ?? '',
        employeeId: j['employeeId'] as String? ?? '',
        name: j['name'] as String? ?? '',
        avatarUrl: j['avatarUrl'] as String?,
        role: j['role'] as String? ?? '',
      );

  static HrEmployeeRef? tryParse(Object? j) =>
      j is Map<String, dynamic> ? HrEmployeeRef.fromJson(j) : null;

  String get initials {
    final words =
        name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return '?';
    if (words.length == 1) return words.first[0].toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  /// `TRAINER` -> `Trainer`.
  String get roleLabel => role.isEmpty
      ? ''
      : role[0] + role.substring(1).toLowerCase().replaceAll('_', ' ');
}

class HrShiftRef {
  const HrShiftRef({
    required this.name,
    required this.startTime,
    required this.endTime,
    this.id,
    this.graceMinutes = 0,
  });

  final String? id;
  final String name;

  /// `HH:mm`, IST.
  final String startTime;
  final String endTime;
  final int graceMinutes;

  factory HrShiftRef.fromJson(Map<String, dynamic> j) => HrShiftRef(
        id: j['id'] as String?,
        name: j['name'] as String? ?? '',
        startTime: j['startTime'] as String? ?? '',
        endTime: j['endTime'] as String? ?? '',
        graceMinutes: hrInt(j['graceMinutes']),
      );

  static HrShiftRef? tryParse(Object? j) =>
      j is Map<String, dynamic> ? HrShiftRef.fromJson(j) : null;

  /// Minutes after midnight of [startTime] (`06:00` -> 360), -1 when unparsable.
  int get startMinute => parseHm(startTime);
  int get endMinute => parseHm(endTime);

  /// Length of the shift in minutes (0 when unparsable / overnight).
  int get lengthMinutes {
    final s = startMinute;
    final e = endMinute;
    return s < 0 || e <= s ? 0 : e - s;
  }
}

/// `HH:mm` -> minutes after midnight, -1 on garbage.
int parseHm(String v) {
  final p = v.split(':');
  if (p.length < 2) return -1;
  final h = int.tryParse(p[0]);
  final m = int.tryParse(p[1]);
  if (h == null || m == null) return -1;
  return h * 60 + m;
}

class HrLeaveTypeRef {
  const HrLeaveTypeRef({
    required this.id,
    required this.name,
    required this.code,
    required this.colorHex,
    required this.isPaid,
  });

  final String id;
  final String name;
  final String code;

  /// `#RRGGBB` as configured by HR (the leave-type hue).
  final String colorHex;
  final bool isPaid;

  factory HrLeaveTypeRef.fromJson(Map<String, dynamic> j) => HrLeaveTypeRef(
        id: j['id'] as String? ?? '',
        name: j['name'] as String? ?? '',
        code: j['code'] as String? ?? '',
        colorHex: j['color'] as String? ?? '',
        isPaid: j['isPaid'] as bool? ?? true,
      );

  static HrLeaveTypeRef? tryParse(Object? j) =>
      j is Map<String, dynamic> ? HrLeaveTypeRef.fromJson(j) : null;
}

/// One calendar day for one employee (`AttendanceDay`).
class HrAttendanceDay {
  const HrAttendanceDay({
    required this.date,
    required this.userId,
    required this.status,
    required this.recorded,
    this.id,
    this.checkInAt,
    this.checkOutAt,
    this.checkInTime,
    this.checkOutTime,
    this.workedMinutes,
    this.lateMinutes = 0,
    this.overtimeMinutes = 0,
    this.source,
    this.remark,
    this.markedBy,
    this.leaveRequestId,
    this.leaveType,
    this.leaveDayPart,
    this.holidayName,
    this.shift,
  });

  final DateTime date;
  final String userId;
  final DayStatus status;

  /// `false` means computed (no DB row).
  final bool recorded;
  final String? id;
  final DateTime? checkInAt;
  final DateTime? checkOutAt;

  /// IST `HH:mm` of the instants above.
  final String? checkInTime;
  final String? checkOutTime;
  final int? workedMinutes;
  final int lateMinutes;
  final int overtimeMinutes;

  /// `SELF` | `MANUAL` | `SYSTEM`.
  final String? source;
  final String? remark;
  final HrUserRef? markedBy;
  final String? leaveRequestId;
  final HrLeaveTypeRef? leaveType;
  final DayPart? leaveDayPart;
  final String? holidayName;
  final HrShiftRef? shift;

  bool get isManual => source == 'MANUAL';
  bool get hasCheckedIn => checkInAt != null || checkInTime != null;
  bool get hasCheckedOut => checkOutAt != null || checkOutTime != null;

  factory HrAttendanceDay.fromJson(Map<String, dynamic> j) {
    final part = j['leaveDayPart'];
    return HrAttendanceDay(
      date: hrParseDate(j['date']),
      userId: j['userId'] as String? ?? '',
      status: DayStatus.parse(j['status']),
      recorded: j['recorded'] as bool? ?? false,
      id: j['id'] as String?,
      checkInAt: hrParseInstant(j['checkInAt']),
      checkOutAt: hrParseInstant(j['checkOutAt']),
      checkInTime: j['checkInTime'] as String?,
      checkOutTime: j['checkOutTime'] as String?,
      workedMinutes:
          j['workedMinutes'] == null ? null : hrInt(j['workedMinutes']),
      lateMinutes: hrInt(j['lateMinutes']),
      overtimeMinutes: hrInt(j['overtimeMinutes']),
      source: j['source'] as String?,
      remark: j['remark'] as String?,
      markedBy: HrUserRef.tryParse(j['markedBy']),
      leaveRequestId: j['leaveRequestId'] as String?,
      leaveType: HrLeaveTypeRef.tryParse(j['leaveType']),
      leaveDayPart: part == null ? null : DayPart.parse(part),
      holidayName: j['holidayName'] as String?,
      shift: HrShiftRef.tryParse(j['shift']),
    );
  }
}

/// Day counts for a month (`AttendanceStats`).
class HrAttendanceStats {
  const HrAttendanceStats({
    this.present = 0,
    this.late = 0,
    this.halfDay = 0,
    this.onLeave = 0,
    this.absent = 0,
    this.weeklyOff = 0,
    this.holiday = 0,
    this.notMarked = 0,
    this.workedMinutes = 0,
    this.lateCount = 0,
    this.overtimeMinutes = 0,
  });

  final int present;
  final int late;
  final int halfDay;
  final int onLeave;
  final int absent;
  final int weeklyOff;
  final int holiday;
  final int notMarked;
  final int workedMinutes;
  final int lateCount;
  final int overtimeMinutes;

  /// Days the person actually showed up (present + late + half-day).
  int get attended => present + late + halfDay;

  factory HrAttendanceStats.fromJson(Map<String, dynamic> j) =>
      HrAttendanceStats(
        present: hrInt(j['present']),
        late: hrInt(j['late']),
        halfDay: hrInt(j['halfDay']),
        onLeave: hrInt(j['onLeave']),
        absent: hrInt(j['absent']),
        weeklyOff: hrInt(j['weeklyOff']),
        holiday: hrInt(j['holiday']),
        notMarked: hrInt(j['notMarked']),
        workedMinutes: hrInt(j['workedMinutes']),
        lateCount: hrInt(j['lateCount']),
        overtimeMinutes: hrInt(j['overtimeMinutes']),
      );

  static HrAttendanceStats tryParse(Object? j) => j is Map<String, dynamic>
      ? HrAttendanceStats.fromJson(j)
      : const HrAttendanceStats();
}

/// `{ month, days, stats }` - one employee's month.
class HrMonthAttendance {
  const HrMonthAttendance({
    required this.month,
    required this.days,
    required this.stats,
  });

  /// `YYYY-MM`.
  final String month;
  final List<HrAttendanceDay> days;
  final HrAttendanceStats stats;

  /// Day-of-month -> record.
  Map<int, HrAttendanceDay> get byDay => {for (final d in days) d.date.day: d};

  factory HrMonthAttendance.fromJson(Map<String, dynamic> j) =>
      HrMonthAttendance(
        month: j['month'] as String? ?? '',
        days: (j['days'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(HrAttendanceDay.fromJson)
            .toList(),
        stats: HrAttendanceStats.tryParse(j['stats']),
      );
}

/// A row of `GET /hr/attendance?date=` (one employee, one day).
class HrBoardRow {
  const HrBoardRow({
    required this.employee,
    required this.attendance,
    this.shift,
  });

  final HrEmployeeRef employee;
  final HrShiftRef? shift;
  final HrAttendanceDay attendance;

  factory HrBoardRow.fromJson(Map<String, dynamic> j) => HrBoardRow(
        employee: HrEmployeeRef.fromJson(j['employee'] as Map<String, dynamic>),
        shift: HrShiftRef.tryParse(j['shift']),
        attendance: HrAttendanceDay.fromJson(
          j['attendance'] as Map<String, dynamic>,
        ),
      );
}

/// `GET /hr/attendance?date=` - the whole team for one day.
class HrDayBoard {
  const HrDayBoard({
    required this.date,
    required this.summary,
    required this.rows,
  });

  final DateTime date;
  final HrAttendanceStats summary;
  final List<HrBoardRow> rows;

  factory HrDayBoard.fromJson(Map<String, dynamic> j) => HrDayBoard(
        date: hrParseDate(j['date']),
        summary: HrAttendanceStats.tryParse(j['summary']),
        rows: (j['items'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(HrBoardRow.fromJson)
            .toList(),
      );
}
