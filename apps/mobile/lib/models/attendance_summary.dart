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
/// member-detail "Recent visits" list (`GET /attendance/member/:memberId`).
class AttendanceRecord {
  const AttendanceRecord({
    required this.id,
    required this.memberName,
    required this.checkInTime,
    required this.checkOutTime,
    this.method,
    this.status,
  });

  final String id;
  final String memberName;
  final DateTime checkInTime;
  final DateTime? checkOutTime;
  final String? method;
  final String? status;

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) =>
      AttendanceRecord(
        id: json['id'] as String,
        memberName: (json['member'] as Map<String, dynamic>)['name'] as String,
        checkInTime: DateTime.parse(json['checkInTime'] as String),
        checkOutTime: json['checkOutTime'] == null
            ? null
            : DateTime.parse(json['checkOutTime'] as String),
        method: json['method'] as String?,
        status: json['status'] as String?,
      );
}
