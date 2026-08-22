class AttendanceTrendDay {
  const AttendanceTrendDay({required this.date, required this.count});

  final String date;
  final int count;

  factory AttendanceTrendDay.fromJson(Map<String, dynamic> json) =>
      AttendanceTrendDay(
        date: json['date'] as String,
        count: json['count'] as int,
      );
}

/// Mirrors `AttendanceSummaryDto` (`GET /attendance/summary`).
class AttendanceSummary {
  const AttendanceSummary({
    required this.totalCheckInsToday,
    required this.currentlyInside,
    required this.trend,
  });

  final int totalCheckInsToday;
  final int currentlyInside;
  final List<AttendanceTrendDay> trend;

  factory AttendanceSummary.fromJson(Map<String, dynamic> json) =>
      AttendanceSummary(
        totalCheckInsToday: json['totalCheckInsToday'] as int,
        currentlyInside: json['currentlyInside'] as int,
        trend: (json['trend'] as List)
            .map((e) => AttendanceTrendDay.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// Mirrors `AttendanceRecordDto` — the "Currently inside" list only needs
/// the first four fields; `method`/`status` are additionally used by the
/// member-detail "Recent visits" list (`GET /attendance/member/:memberId`);
/// `memberCode`/`branchName` are additionally used by the tenant-wide
/// Attendance History list (`GET /attendance`).
class AttendanceRecord {
  const AttendanceRecord({
    required this.id,
    required this.memberName,
    required this.checkInTime,
    required this.checkOutTime,
    this.method,
    this.status,
    this.memberCode,
    this.branchName,
  });

  final String id;
  final String memberName;
  final DateTime checkInTime;
  final DateTime? checkOutTime;
  final String? method;
  final String? status;
  final String? memberCode;
  final String? branchName;

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    final member = json['member'] as Map<String, dynamic>;
    final branch = json['branch'] as Map<String, dynamic>?;
    return AttendanceRecord(
      id: json['id'] as String,
      memberName: member['name'] as String,
      checkInTime: DateTime.parse(json['checkInTime'] as String),
      checkOutTime: json['checkOutTime'] == null
          ? null
          : DateTime.parse(json['checkOutTime'] as String),
      method: json['method'] as String?,
      status: json['status'] as String?,
      memberCode: member['memberId'] as String?,
      branchName: branch?['name'] as String?,
    );
  }
}
