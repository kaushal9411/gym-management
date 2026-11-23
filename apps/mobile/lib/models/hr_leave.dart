import 'hr_attendance.dart';
import 'hr_enums.dart';
import 'paginated_result.dart';

/// `LeaveType` (`GET /hr/me/leave-types`, `GET /hr/leave-types`).
class HrLeaveType {
  const HrLeaveType({
    required this.id,
    required this.name,
    required this.code,
    required this.isPaid,
    required this.colorHex,
    this.yearlyQuota,
    this.isActive = true,
    this.carryForward = false,
    this.carryForwardMax,
    this.sortOrder = 0,
  });

  final String id;
  final String name;
  final String code;

  /// Unused days roll into the next leave year (capped by [carryForwardMax]).
  final bool carryForward;

  /// `null` = no cap.
  final double? carryForwardMax;
  final int sortOrder;

  /// `null` = unlimited.
  final double? yearlyQuota;
  final bool isPaid;
  final String colorHex;
  final bool isActive;

  factory HrLeaveType.fromJson(Map<String, dynamic> j) => HrLeaveType(
        id: j['id'] as String? ?? '',
        name: j['name'] as String? ?? '',
        code: j['code'] as String? ?? '',
        yearlyQuota: hrNumOrNull(j['yearlyQuota']),
        isPaid: j['isPaid'] as bool? ?? true,
        colorHex: j['color'] as String? ?? '',
        isActive: j['isActive'] as bool? ?? true,
        carryForward: j['carryForward'] as bool? ?? false,
        carryForwardMax: hrNumOrNull(j['carryForwardMax']),
        sortOrder: hrInt(j['sortOrder']),
      );
}

/// `LeaveBalance` - one per active leave type for the current leave year.
class HrLeaveBalance {
  const HrLeaveBalance({
    required this.leaveType,
    required this.leaveYearLabel,
    required this.used,
    required this.pending,
    this.entitled,
    this.available,
    this.quota,
    this.carriedForward = 0,
    this.adjustment = 0,
  });

  final HrLeaveTypeRef leaveType;
  final String leaveYearLabel;
  final double? quota;
  final double carriedForward;
  final double adjustment;

  /// `null` when the type is unlimited.
  final double? entitled;
  final double used;
  final double pending;

  /// entitled - used - pending; `null` when unlimited.
  final double? available;

  bool get unlimited => entitled == null;

  factory HrLeaveBalance.fromJson(Map<String, dynamic> j) => HrLeaveBalance(
        leaveType: HrLeaveTypeRef.fromJson(
          j['leaveType'] as Map<String, dynamic>,
        ),
        leaveYearLabel: j['leaveYearLabel'] as String? ?? '',
        quota: hrNumOrNull(j['quota']),
        carriedForward: hrNum(j['carriedForward']),
        adjustment: hrNum(j['adjustment']),
        entitled: hrNumOrNull(j['entitled']),
        used: hrNum(j['used']),
        pending: hrNum(j['pending']),
        available: hrNumOrNull(j['available']),
      );
}

/// `LeaveRequest`.
class HrLeaveRequest {
  const HrLeaveRequest({
    required this.id,
    required this.employee,
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    required this.dayPart,
    required this.days,
    required this.reason,
    required this.status,
    this.appliedOnBehalf = false,
    this.appliedBy,
    this.createdAt,
    this.decidedBy,
    this.decidedAt,
    this.decisionRemark,
    this.cancelledAt,
    this.canCancel = false,
  });

  final String id;
  final HrEmployeeRef employee;
  final HrLeaveTypeRef leaveType;
  final DateTime startDate;
  final DateTime endDate;
  final DayPart dayPart;

  /// Working days only (weekly offs / holidays excluded; half day = 0.5).
  final double days;
  final String reason;
  final LeaveStatus status;
  final bool appliedOnBehalf;
  final HrUserRef? appliedBy;
  final DateTime? createdAt;
  final HrUserRef? decidedBy;
  final DateTime? decidedAt;

  /// The approver's remark (always present on a rejection).
  final String? decisionRemark;
  final DateTime? cancelledAt;

  /// Only meaningful on `/hr/me/leaves*`.
  final bool canCancel;

  bool get isSingleDay =>
      startDate.year == endDate.year &&
      startDate.month == endDate.month &&
      startDate.day == endDate.day;

  factory HrLeaveRequest.fromJson(Map<String, dynamic> j) => HrLeaveRequest(
        id: j['id'] as String? ?? '',
        employee: HrEmployeeRef.fromJson(j['employee'] as Map<String, dynamic>),
        leaveType: HrLeaveTypeRef.fromJson(
          j['leaveType'] as Map<String, dynamic>,
        ),
        startDate: hrParseDate(j['startDate']),
        endDate: hrParseDate(j['endDate']),
        dayPart: DayPart.parse(j['dayPart']),
        days: hrNum(j['days']),
        reason: j['reason'] as String? ?? '',
        status: LeaveStatus.parse(j['status']),
        appliedOnBehalf: j['appliedOnBehalf'] as bool? ?? false,
        appliedBy: HrUserRef.tryParse(j['appliedBy']),
        createdAt: hrParseInstant(j['createdAt']),
        decidedBy: HrUserRef.tryParse(j['decidedBy']),
        decidedAt: hrParseInstant(j['decidedAt']),
        decisionRemark: j['decisionRemark'] as String?,
        cancelledAt: hrParseInstant(j['cancelledAt']),
        canCancel: j['canCancel'] as bool? ?? false,
      );
}

/// Someone else off on the same dates (`GET /hr/leaves/:id` -> `conflicts`).
class HrLeaveConflict {
  const HrLeaveConflict({
    required this.employee,
    required this.leaveRequestId,
    required this.startDate,
    required this.endDate,
  });

  final HrEmployeeRef employee;
  final String leaveRequestId;
  final DateTime startDate;
  final DateTime endDate;

  factory HrLeaveConflict.fromJson(Map<String, dynamic> j) => HrLeaveConflict(
        employee: HrEmployeeRef.fromJson(j['employee'] as Map<String, dynamic>),
        leaveRequestId: j['leaveRequestId'] as String? ?? '',
        startDate: hrParseDate(j['startDate']),
        endDate: hrParseDate(j['endDate']),
      );
}

/// `GET /hr/leaves/:id` - the request + the applicant's balance + who else is
/// off (the context an approver needs to decide).
class HrLeaveDetail {
  const HrLeaveDetail({
    required this.request,
    this.balance,
    this.conflicts = const [],
  });

  final HrLeaveRequest request;
  final HrLeaveBalance? balance;
  final List<HrLeaveConflict> conflicts;

  factory HrLeaveDetail.fromJson(Map<String, dynamic> j) => HrLeaveDetail(
        request: HrLeaveRequest.fromJson(j),
        balance: j['balance'] is Map<String, dynamic>
            ? HrLeaveBalance.fromJson(j['balance'] as Map<String, dynamic>)
            : null,
        conflicts: (j['conflicts'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(HrLeaveConflict.fromJson)
            .toList(),
      );
}

/// A date the leave range skips (weekly off or holiday).
class HrExcludedDay {
  const HrExcludedDay({required this.date, required this.reason, this.name});

  final DateTime date;

  /// `WEEKLY_OFF` | `HOLIDAY`.
  final String reason;
  final String? name;

  factory HrExcludedDay.fromJson(Map<String, dynamic> j) => HrExcludedDay(
        date: hrParseDate(j['date']),
        reason: j['reason'] as String? ?? '',
        name: j['name'] as String?,
      );
}

/// `POST /hr/me/leaves/preview`.
class HrLeavePreview {
  const HrLeavePreview({
    required this.days,
    required this.sufficient,
    this.available,
    this.excluded = const [],
  });

  final double days;
  final bool sufficient;

  /// `null` = unlimited.
  final double? available;
  final List<HrExcludedDay> excluded;

  factory HrLeavePreview.fromJson(Map<String, dynamic> j) => HrLeavePreview(
        days: hrNum(j['days']),
        sufficient: j['sufficient'] as bool? ?? true,
        available: hrNumOrNull(j['available']),
        excluded: (j['excluded'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(HrExcludedDay.fromJson)
            .toList(),
      );
}

/// `{ pending, approved, rejected, cancelled }` over the same filters as the
/// page except status.
class HrLeaveCounts {
  const HrLeaveCounts({
    this.pending = 0,
    this.approved = 0,
    this.rejected = 0,
    this.cancelled = 0,
  });

  final int pending;
  final int approved;
  final int rejected;
  final int cancelled;

  int get all => pending + approved + rejected + cancelled;

  int of(LeaveStatus s) => switch (s) {
        LeaveStatus.pending => pending,
        LeaveStatus.approved => approved,
        LeaveStatus.rejected => rejected,
        LeaveStatus.cancelled => cancelled,
      };

  static HrLeaveCounts? tryParse(Object? j) => j is Map<String, dynamic>
      ? HrLeaveCounts(
          pending: hrInt(j['pending']),
          approved: hrInt(j['approved']),
          rejected: hrInt(j['rejected']),
          cancelled: hrInt(j['cancelled']),
        )
      : null;
}

/// A page of leave requests plus (admin list only) the status counts.
class HrLeavePage {
  const HrLeavePage({required this.page, this.counts});

  final PaginatedResult<HrLeaveRequest> page;
  final HrLeaveCounts? counts;

  factory HrLeavePage.fromJson(Map<String, dynamic> j) => HrLeavePage(
        page: PaginatedResult.fromJson(j, HrLeaveRequest.fromJson),
        counts: HrLeaveCounts.tryParse(j['counts']),
      );
}

/// `Holiday`.
class HrHoliday {
  const HrHoliday({
    required this.id,
    required this.date,
    required this.name,
    this.description,
    this.branchName,
    this.branchId,
  });

  final String id;
  final DateTime date;
  final String name;
  final String? description;

  /// `null` = every branch.
  final String? branchName;
  final String? branchId;

  factory HrHoliday.fromJson(Map<String, dynamic> j) => HrHoliday(
        id: j['id'] as String? ?? '',
        date: hrParseDate(j['date']),
        name: j['name'] as String? ?? '',
        description: j['description'] as String?,
        branchName: (j['branch'] is Map<String, dynamic>)
            ? (j['branch'] as Map<String, dynamic>)['name'] as String?
            : null,
        branchId: (j['branch'] is Map<String, dynamic>)
            ? (j['branch'] as Map<String, dynamic>)['id'] as String?
            : null,
      );
}

/// One request of `GET /hr/leaves/calendar` (v1.2): the slim "who is off
/// when" row. Its dates are the request's own and may extend outside the
/// window asked for - clip with [coversDay].
class HrCalendarLeave {
  const HrCalendarLeave({
    required this.id,
    required this.userId,
    required this.employeeName,
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    required this.dayPart,
    required this.days,
    required this.status,
  });

  final String id;
  final String userId;
  final String employeeName;
  final HrLeaveTypeRef leaveType;
  final DateTime startDate;
  final DateTime endDate;
  final DayPart dayPart;
  final double days;

  /// Only `PENDING` or `APPROVED` (the endpoint never returns the others).
  final LeaveStatus status;

  bool get isPending => status == LeaveStatus.pending;

  bool get isSingleDay =>
      startDate.year == endDate.year &&
      startDate.month == endDate.month &&
      startDate.day == endDate.day;

  bool coversDay(DateTime d) {
    final x = DateTime(d.year, d.month, d.day);
    return !x.isBefore(startDate) && !x.isAfter(endDate);
  }

  /// For the avatar (the calendar row carries no employee id / avatar).
  HrEmployeeRef get employee => HrEmployeeRef(
        userId: userId,
        employeeId: '',
        name: employeeName,
      );

  factory HrCalendarLeave.fromJson(Map<String, dynamic> j) => HrCalendarLeave(
        id: j['id'] as String? ?? '',
        userId: j['userId'] as String? ?? '',
        employeeName: j['employeeName'] as String? ?? '',
        leaveType: HrLeaveTypeRef.fromJson(
          j['leaveType'] as Map<String, dynamic>? ?? const {},
        ),
        startDate: hrParseDate(j['startDate']),
        endDate: hrParseDate(j['endDate']),
        dayPart: DayPart.parse(j['dayPart']),
        days: hrNum(j['days']),
        status: LeaveStatus.parse(j['status']),
      );
}

/// `GET /hr/leaves/calendar?from&to` (`hr:leave_manage`, window 1-62 days
/// else 422): every PENDING / APPROVED request overlapping the window plus
/// the holidays inside it.
class HrLeaveCalendar {
  const HrLeaveCalendar({
    required this.from,
    required this.to,
    this.items = const [],
    this.holidays = const [],
  });

  final DateTime from;
  final DateTime to;
  final List<HrCalendarLeave> items;
  final List<HrHoliday> holidays;

  factory HrLeaveCalendar.fromJson(Map<String, dynamic> j) => HrLeaveCalendar(
        from: hrParseDate(j['from']),
        to: hrParseDate(j['to']),
        items: (j['items'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(HrCalendarLeave.fromJson)
            .toList(),
        holidays: (j['holidays'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(HrHoliday.fromJson)
            .toList(),
      );
}

/// `GET /hr/me/notifications` item.
class HrNotification {
  const HrNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.createdAt,
    this.entityType,
    this.entityId,
    this.readAt,
  });

  final String id;

  /// `LEAVE_APPLIED` | `LEAVE_APPROVED` | `LEAVE_REJECTED` | `LEAVE_CANCELLED`
  /// | `PAYSLIP_PAID`.
  final String type;
  final String title;
  final String body;
  final String? entityType;
  final String? entityId;
  final DateTime? readAt;
  final DateTime createdAt;

  bool get isUnread => readAt == null;

  factory HrNotification.fromJson(Map<String, dynamic> j) => HrNotification(
        id: j['id'] as String? ?? '',
        type: j['type'] as String? ?? '',
        title: j['title'] as String? ?? '',
        body: j['body'] as String? ?? '',
        entityType: j['entityType'] as String?,
        entityId: j['entityId'] as String?,
        readAt: hrParseInstant(j['readAt']),
        createdAt: hrParseInstant(j['createdAt']) ?? DateTime(1970),
      );
}

class HrNotificationPage {
  const HrNotificationPage({required this.page, required this.unreadCount});

  final PaginatedResult<HrNotification> page;
  final int unreadCount;

  factory HrNotificationPage.fromJson(Map<String, dynamic> j) =>
      HrNotificationPage(
        page: PaginatedResult.fromJson(j, HrNotification.fromJson),
        unreadCount: hrInt(j['unreadCount']),
      );
}
