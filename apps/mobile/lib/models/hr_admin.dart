import 'hr_attendance.dart';
import 'hr_enums.dart';
import 'hr_leave.dart';
import 'hr_payroll.dart';

/// `GET /hr/overview` -> `today` bucket counts.
class HrTodayBuckets {
  const HrTodayBuckets({
    this.present = 0,
    this.late = 0,
    this.halfDay = 0,
    this.onLeave = 0,
    this.absent = 0,
    this.weeklyOff = 0,
    this.holiday = 0,
    this.notMarked = 0,
    int? yetToCheckIn,
    this.checkedInNow = 0,
  }) : yetToCheckIn = yetToCheckIn ?? notMarked;

  final int present;
  final int late;
  final int halfDay;
  final int onLeave;
  final int absent;
  final int weeklyOff;
  final int holiday;
  final int notMarked;

  /// Still expected today, shift not over yet (v1.2; equals [notMarked] -
  /// older servers omit it and the default makes it so).
  final int yetToCheckIn;
  final int checkedInNow;

  /// Every bucket; they are mutually exclusive and add up to the headcount.
  int get bucketTotal =>
      present +
      late +
      halfDay +
      onLeave +
      absent +
      weeklyOff +
      holiday +
      notMarked;

  factory HrTodayBuckets.fromJson(Map<String, dynamic> j) => HrTodayBuckets(
        present: hrInt(j['present']),
        late: hrInt(j['late']),
        halfDay: hrInt(j['halfDay']),
        onLeave: hrInt(j['onLeave']),
        absent: hrInt(j['absent']),
        weeklyOff: hrInt(j['weeklyOff']),
        holiday: hrInt(j['holiday']),
        notMarked: hrInt(j['notMarked']),
        yetToCheckIn:
            j['yetToCheckIn'] == null ? null : hrInt(j['yetToCheckIn']),
        checkedInNow: hrInt(j['checkedInNow']),
      );
}

/// One day of the 7-day trend.
class HrTrendPoint {
  const HrTrendPoint({
    required this.date,
    this.present = 0,
    this.late = 0,
    this.halfDay = 0,
    this.onLeave = 0,
    this.absent = 0,
  });

  final DateTime date;
  final int present;
  final int late;
  final int halfDay;
  final int onLeave;
  final int absent;

  int get total => present + late + halfDay + onLeave + absent;

  factory HrTrendPoint.fromJson(Map<String, dynamic> j) => HrTrendPoint(
        date: hrParseDate(j['date']),
        present: hrInt(j['present']),
        late: hrInt(j['late']),
        halfDay: hrInt(j['halfDay']),
        onLeave: hrInt(j['onLeave']),
        absent: hrInt(j['absent']),
      );
}

/// `payroll` block of the overview (only with `hr:payroll_manage`).
class HrOverviewPayroll {
  const HrOverviewPayroll({
    required this.month,
    required this.status,
    this.runId,
    this.totalNet,
    this.unpaidPayslips,
  });

  final String month;

  /// `NOT_GENERATED` | `DRAFT` | `APPROVED` | `PAID`.
  final String status;
  final String? runId;
  final double? totalNet;
  final int? unpaidPayslips;

  bool get notGenerated => status == 'NOT_GENERATED';

  factory HrOverviewPayroll.fromJson(Map<String, dynamic> j) =>
      HrOverviewPayroll(
        month: j['month'] as String? ?? '',
        status: j['status'] as String? ?? 'NOT_GENERATED',
        runId: j['runId'] as String?,
        totalNet: hrNumOrNull(j['totalNet']),
        unpaidPayslips:
            j['unpaidPayslips'] == null ? null : hrInt(j['unpaidPayslips']),
      );
}

/// Compact upcoming-leave row of the overview.
class HrUpcomingLeave {
  const HrUpcomingLeave({
    required this.id,
    required this.employee,
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    required this.dayPart,
    required this.days,
  });

  final String id;
  final HrEmployeeRef employee;
  final HrLeaveTypeRef leaveType;
  final DateTime startDate;
  final DateTime endDate;
  final DayPart dayPart;
  final double days;

  factory HrUpcomingLeave.fromJson(Map<String, dynamic> j) => HrUpcomingLeave(
        id: j['id'] as String? ?? '',
        employee: HrEmployeeRef.fromJson(j['employee'] as Map<String, dynamic>),
        leaveType: HrLeaveTypeRef.fromJson(
          j['leaveType'] as Map<String, dynamic>,
        ),
        startDate: hrParseDate(j['startDate']),
        endDate: hrParseDate(j['endDate']),
        dayPart: DayPart.parse(j['dayPart']),
        days: hrNum(j['days']),
      );
}

/// `GET /hr/overview`.
class HrOverview {
  const HrOverview({
    required this.date,
    required this.headcount,
    required this.today,
    required this.pendingLeaves,
    this.payroll,
    this.upcomingLeaves = const [],
    this.trend = const [],
    this.upcomingHolidays = const [],
  });

  final DateTime date;
  final int headcount;
  final HrTodayBuckets today;
  final int pendingLeaves;

  /// `null` without `hr:payroll_manage`.
  final HrOverviewPayroll? payroll;
  final List<HrUpcomingLeave> upcomingLeaves;
  final List<HrTrendPoint> trend;
  final List<HrHoliday> upcomingHolidays;

  factory HrOverview.fromJson(Map<String, dynamic> j) {
    List<T> list<T>(String key, T Function(Map<String, dynamic>) f) =>
        (j[key] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(f)
            .toList();
    return HrOverview(
      date: hrParseDate(j['date']),
      headcount: hrInt(j['headcount']),
      today: HrTodayBuckets.fromJson(
        j['today'] as Map<String, dynamic>? ?? const {},
      ),
      pendingLeaves: hrInt(j['pendingLeaves']),
      payroll: j['payroll'] is Map<String, dynamic>
          ? HrOverviewPayroll.fromJson(j['payroll'] as Map<String, dynamic>)
          : null,
      upcomingLeaves: list('upcomingLeaves', HrUpcomingLeave.fromJson),
      trend: list('trend', HrTrendPoint.fromJson),
      upcomingHolidays: list('upcomingHolidays', HrHoliday.fromJson),
    );
  }
}

/// Branch chip on an employee row.
class HrBranchRef {
  const HrBranchRef({required this.id, required this.name});

  final String id;
  final String name;
}

/// `GET /hr/employees` item (also `employee` of the detail payload).
class HrEmployee {
  const HrEmployee({
    required this.ref,
    required this.email,
    required this.accountStatus,
    required this.workStatus,
    this.phone,
    this.employmentType,
    this.joiningDate,
    this.branches = const [],
    this.shift,
    this.weeklyOff = const [],
    this.todayStatus = DayStatus.notMarked,
    this.todayCheckIn,
    this.todayCheckOut,
    this.leaveBalances = const [],
    this.pendingLeaves = 0,
  });

  final HrEmployeeRef ref;
  final String email;
  final String? phone;
  final String accountStatus;
  final String workStatus;
  final String? employmentType;
  final DateTime? joiningDate;
  final List<HrBranchRef> branches;
  final HrShiftRef? shift;
  final List<String> weeklyOff;
  final DayStatus todayStatus;
  final String? todayCheckIn;
  final String? todayCheckOut;

  /// `(code, name, available)` - `available == null` means unlimited.
  final List<({String code, String name, double? available, String typeId})>
      leaveBalances;
  final int pendingLeaves;

  String get userId => ref.userId;
  String get name => ref.name;

  factory HrEmployee.fromJson(Map<String, dynamic> j) {
    final today = j['today'] as Map<String, dynamic>? ?? const {};
    return HrEmployee(
      ref: HrEmployeeRef.fromJson(j),
      email: j['email'] as String? ?? '',
      phone: j['phone'] as String?,
      accountStatus: j['accountStatus'] as String? ?? '',
      workStatus: j['workStatus'] as String? ?? '',
      employmentType: j['employmentType'] as String?,
      joiningDate:
          j['joiningDate'] == null ? null : hrParseDate(j['joiningDate']),
      branches: (j['branches'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(
            (b) => HrBranchRef(
              id: b['id'] as String? ?? '',
              name: b['name'] as String? ?? '',
            ),
          )
          .toList(),
      shift: HrShiftRef.tryParse(j['shift']),
      weeklyOff: (j['weeklyOff'] as List? ?? const []).cast<String>(),
      todayStatus: DayStatus.parse(today['status']),
      todayCheckIn: today['checkInTime'] as String?,
      todayCheckOut: today['checkOutTime'] as String?,
      leaveBalances: (j['leaveBalances'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(
            (b) => (
              code: b['code'] as String? ?? '',
              name: b['name'] as String? ?? '',
              available: hrNumOrNull(b['available']),
              typeId: b['leaveTypeId'] as String? ?? '',
            ),
          )
          .toList(),
      pendingLeaves: hrInt(j['pendingLeaves']),
    );
  }
}

/// `GET /hr/employees/:userId?month=`.
class HrEmployeeDetail {
  const HrEmployeeDetail({
    required this.employee,
    required this.attendance,
    this.leaves = const [],
    this.balances = const [],
    this.payStructure,
    this.payslips = const [],
  });

  final HrEmployee employee;
  final HrMonthAttendance attendance;

  /// Latest 50; empty unless the caller holds `hr:leave_manage`.
  final List<HrLeaveRequest> leaves;
  final List<HrLeaveBalance> balances;

  /// `null` unless the caller holds `hr:payroll_manage`.
  final HrPayStructure? payStructure;
  final List<HrPayslipSummary> payslips;

  factory HrEmployeeDetail.fromJson(Map<String, dynamic> j) {
    List<T> list<T>(String key, T Function(Map<String, dynamic>) f) =>
        (j[key] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(f)
            .toList();
    return HrEmployeeDetail(
      employee: HrEmployee.fromJson(j['employee'] as Map<String, dynamic>),
      attendance: HrMonthAttendance.fromJson(
        j['attendance'] as Map<String, dynamic>,
      ),
      leaves: list('leaves', HrLeaveRequest.fromJson),
      balances: list('balances', HrLeaveBalance.fromJson),
      payStructure: j['payStructure'] is Map<String, dynamic>
          ? HrPayStructure.fromJson(j['payStructure'] as Map<String, dynamic>)
          : null,
      payslips: list('payslips', HrPayslipSummary.fromJson),
    );
  }
}
