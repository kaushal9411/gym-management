import 'hr_attendance.dart';
import 'hr_enums.dart';

/// `Shift` of `GET /hr/shifts` (the full row, unlike the slim [HrShiftRef]).
class HrShift {
  const HrShift({
    required this.id,
    required this.name,
    required this.startTime,
    required this.endTime,
    required this.graceMinutes,
    this.weeklyOffDays = const [],
    this.isDefault = false,
    this.isActive = true,
    this.employeeCount = 0,
  });

  final String id;
  final String name;

  /// `HH:mm`, IST.
  final String startTime;
  final String endTime;
  final int graceMinutes;

  /// `MONDAY` ... `SUNDAY`.
  final List<String> weeklyOffDays;
  final bool isDefault;
  final bool isActive;
  final int employeeCount;

  factory HrShift.fromJson(Map<String, dynamic> j) => HrShift(
        id: j['id'] as String? ?? '',
        name: j['name'] as String? ?? '',
        startTime: j['startTime'] as String? ?? '',
        endTime: j['endTime'] as String? ?? '',
        graceMinutes: hrInt(j['graceMinutes']),
        weeklyOffDays: (j['weeklyOffDays'] as List? ?? const [])
            .whereType<String>()
            .toList(),
        isDefault: j['isDefault'] as bool? ?? false,
        isActive: j['isActive'] as bool? ?? true,
        employeeCount: hrInt(j['employeeCount']),
      );
}

/// What the shift form submits (`POST` / `PATCH /hr/shifts`).
class HrShiftInput {
  const HrShiftInput({
    required this.name,
    required this.startTime,
    required this.endTime,
    required this.graceMinutes,
    required this.weeklyOffDays,
    required this.isDefault,
    this.isActive,
  });

  final String name;
  final String startTime;
  final String endTime;
  final int graceMinutes;
  final List<String> weeklyOffDays;
  final bool isDefault;

  /// Only sent when editing.
  final bool? isActive;

  Map<String, dynamic> toJson() => {
        'name': name.trim(),
        'startTime': startTime,
        'endTime': endTime,
        'graceMinutes': graceMinutes,
        'weeklyOffDays': HrWeekday.normalise(weeklyOffDays),
        'isDefault': isDefault,
        if (isActive != null) 'isActive': isActive,
      };
}

/// What the leave-type form submits (`POST` / `PATCH /hr/leave-types`).
class HrLeaveTypeInput {
  const HrLeaveTypeInput({
    required this.name,
    required this.code,
    required this.yearlyQuota,
    required this.isPaid,
    required this.carryForward,
    required this.carryForwardMax,
    required this.color,
    this.isActive,
  });

  final String name;
  final String code;

  /// `null` = unlimited.
  final double? yearlyQuota;
  final bool isPaid;
  final bool carryForward;
  final double? carryForwardMax;
  final String color;

  /// Only sent when editing.
  final bool? isActive;

  Map<String, dynamic> toJson() => {
        'name': name.trim(),
        'code': code,
        'yearlyQuota': yearlyQuota,
        'isPaid': isPaid,
        'carryForward': carryForward,
        'carryForwardMax': carryForward ? carryForwardMax : null,
        'color': color,
        if (isActive != null) 'isActive': isActive,
      };
}

/// `Policy` of `GET` / `PUT /hr/policy`.
class HrPolicy {
  const HrPolicy({
    required this.leaveYearStartMonth,
    required this.defaultWeeklyOff,
    required this.lateGraceMinutes,
    required this.halfDayThresholdHours,
    required this.standardDayHours,
    required this.latePenaltyEnabled,
    required this.latePenaltyLatesPerUnit,
    required this.latePenaltyDays,
    required this.overtimeEnabled,
    required this.overtimeMultiplier,
    required this.backdateLeaveDays,
    this.workingDaysBasis = 'CALENDAR_MINUS_WEEKLY_OFFS',
  });

  final int leaveYearStartMonth;
  final List<String> defaultWeeklyOff;
  final int lateGraceMinutes;
  final double halfDayThresholdHours;
  final double standardDayHours;
  final bool latePenaltyEnabled;
  final int latePenaltyLatesPerUnit;
  final double latePenaltyDays;
  final bool overtimeEnabled;
  final double overtimeMultiplier;
  final int backdateLeaveDays;

  /// Read-only constant (not editable, never sent back).
  final String workingDaysBasis;

  factory HrPolicy.fromJson(Map<String, dynamic> j) => HrPolicy(
        leaveYearStartMonth: hrInt(j['leaveYearStartMonth'], 4),
        defaultWeeklyOff: (j['defaultWeeklyOff'] as List? ?? const [])
            .whereType<String>()
            .toList(),
        lateGraceMinutes: hrInt(j['lateGraceMinutes']),
        halfDayThresholdHours: hrNum(j['halfDayThresholdHours'], 4),
        standardDayHours: hrNum(j['standardDayHours'], 8),
        latePenaltyEnabled: j['latePenaltyEnabled'] as bool? ?? false,
        latePenaltyLatesPerUnit: hrInt(j['latePenaltyLatesPerUnit'], 3),
        latePenaltyDays: hrNum(j['latePenaltyDays'], 0.5),
        overtimeEnabled: j['overtimeEnabled'] as bool? ?? false,
        overtimeMultiplier: hrNum(j['overtimeMultiplier'], 1.5),
        backdateLeaveDays: hrInt(j['backdateLeaveDays'], 30),
        workingDaysBasis:
            j['workingDaysBasis'] as String? ?? 'CALENDAR_MINUS_WEEKLY_OFFS',
      );

  /// `PUT /hr/policy` body: every field except `workingDaysBasis`.
  Map<String, dynamic> toJson() => {
        'leaveYearStartMonth': leaveYearStartMonth,
        'defaultWeeklyOff': HrWeekday.normalise(defaultWeeklyOff),
        'lateGraceMinutes': lateGraceMinutes,
        'halfDayThresholdHours': halfDayThresholdHours,
        'standardDayHours': standardDayHours,
        'latePenaltyEnabled': latePenaltyEnabled,
        'latePenaltyLatesPerUnit': latePenaltyLatesPerUnit,
        'latePenaltyDays': latePenaltyDays,
        'overtimeEnabled': overtimeEnabled,
        'overtimeMultiplier': overtimeMultiplier,
        'backdateLeaveDays': backdateLeaveDays,
      };
}

/// One employee row of the monthly grid: a [DayStatus] per day.
class HrGridRow {
  const HrGridRow({
    required this.employee,
    required this.cells,
    required this.stats,
  });

  final HrEmployeeRef employee;

  /// `cells[i]` is the status of `HrMonthlyGrid.days[i]`.
  final List<DayStatus> cells;
  final HrAttendanceStats stats;

  /// Days the person showed up (present + late + half-day) - the "P" column.
  int get attended => stats.attended;

  factory HrGridRow.fromJson(Map<String, dynamic> j) => HrGridRow(
        employee: HrEmployeeRef.fromJson(j['employee'] as Map<String, dynamic>),
        cells: (j['cells'] as List? ?? const [])
            .map<DayStatus>(DayStatus.parse)
            .toList(),
        stats: HrAttendanceStats.tryParse(j['stats']),
      );
}

/// `GET /hr/attendance/monthly?month=` - employee x day.
class HrMonthlyGrid {
  const HrMonthlyGrid({
    required this.month,
    required this.days,
    required this.rows,
  });

  /// `YYYY-MM`.
  final String month;
  final List<DateTime> days;
  final List<HrGridRow> rows;

  factory HrMonthlyGrid.fromJson(Map<String, dynamic> j) => HrMonthlyGrid(
        month: j['month'] as String? ?? '',
        days: (j['days'] as List? ?? const []).map(hrParseDate).toList(),
        rows: (j['employees'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(HrGridRow.fromJson)
            .toList(),
      );
}

/// `POST /hr/attendance/bulk` -> `{ date, updated, items }`.
class HrBulkResult {
  const HrBulkResult({required this.updated, this.items = const []});

  final int updated;
  final List<HrAttendanceDay> items;

  factory HrBulkResult.fromJson(Map<String, dynamic> j) => HrBulkResult(
        updated: hrInt(j['updated']),
        items: (j['items'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(HrAttendanceDay.fromJson)
            .toList(),
      );
}

/// `PUT /hr/employees/:id/work-setup` -> `{ shift, weeklyOff }`.
class HrWorkSetup {
  const HrWorkSetup({this.shift, this.weeklyOff = const []});

  final HrShiftRef? shift;
  final List<String> weeklyOff;

  factory HrWorkSetup.fromJson(Map<String, dynamic> j) => HrWorkSetup(
        shift: HrShiftRef.tryParse(j['shift']),
        weeklyOff: (j['weeklyOff'] as List? ?? const []).cast<String>(),
      );
}
