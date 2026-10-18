class AttendanceTrendDay {
  const AttendanceTrendDay({required this.date, required this.count});

  final String date;
  final int count;

  factory AttendanceTrendDay.fromJson(Map<String, dynamic> json) =>
      AttendanceTrendDay(
        date: json['date'] as String,
        count: (json['count'] as num?)?.toInt() ?? 0,
      );
}

/// Mirrors `AttendanceSummaryDto` (`GET /attendance/summary`).
///
/// `totalCheckInsToday` / `totalCheckOutsToday` / `currentlyInside` /
/// `peakCheckInHour` are always *today's* live figures (regardless of the
/// requested range); only `trend` follows `dateFrom`/`dateTo` (default: the
/// last 7 days).
class AttendanceSummary {
  const AttendanceSummary({
    required this.totalCheckInsToday,
    required this.currentlyInside,
    required this.trend,
    this.totalCheckOutsToday = 0,
    this.peakCheckInHour,
  });

  final int totalCheckInsToday;
  final int totalCheckOutsToday;
  final int currentlyInside;

  /// Hour of day (0-23) with the most check-ins today, null when none yet.
  final int? peakCheckInHour;
  final List<AttendanceTrendDay> trend;

  factory AttendanceSummary.fromJson(Map<String, dynamic> json) =>
      AttendanceSummary(
        totalCheckInsToday: (json['totalCheckInsToday'] as num?)?.toInt() ?? 0,
        totalCheckOutsToday:
            (json['totalCheckOutsToday'] as num?)?.toInt() ?? 0,
        currentlyInside: (json['currentlyInside'] as num?)?.toInt() ?? 0,
        peakCheckInHour: (json['peakCheckInHour'] as num?)?.toInt(),
        trend: ((json['trend'] as List?) ?? const [])
            .map((e) => AttendanceTrendDay.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// Mirrors `AttendanceRecordDto`. The original "Currently inside" list only
/// needed the first four fields; `method`/`status` feed the member-detail
/// "Recent visits" list (`GET /attendance/member/:memberId`);
/// `memberCode`/`branchName` the tenant-wide history list (`GET /attendance`);
/// the rest (member uuid + photo, notes, device, who checked in / out) back
/// the redesigned visit-detail sheet.
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
    this.memberUuid,
    this.memberPhotoUrl,
    this.branchId,
    this.deviceName,
    this.notes,
    this.checkedInBy,
    this.checkedOutBy,
  });

  final String id;
  final String memberName;
  final DateTime checkInTime;
  final DateTime? checkOutTime;
  final String? method;
  final String? status;
  final String? memberCode;
  final String? branchName;

  /// The member's row id (what check-out / member detail take).
  final String? memberUuid;
  final String? memberPhotoUrl;
  final String? branchId;
  final String? deviceName;
  final String? notes;
  final String? checkedInBy;
  final String? checkedOutBy;

  /// Still inside: the server `status` when present, else "no check-out time".
  bool get isInside =>
      status != null ? status == 'CHECKED_IN' : checkOutTime == null;

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    final member = json['member'] as Map<String, dynamic>;
    final branch = json['branch'] as Map<String, dynamic>?;
    final inBy = json['checkedInBy'];
    final outBy = json['checkedOutBy'];
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
      memberUuid: member['id'] as String?,
      memberPhotoUrl: member['profilePhotoUrl'] as String?,
      branchId: branch?['id'] as String?,
      deviceName: json['deviceName'] as String?,
      notes: json['notes'] as String?,
      checkedInBy:
          inBy is Map<String, dynamic> ? inBy['name'] as String? : null,
      checkedOutBy:
          outBy is Map<String, dynamic> ? outBy['name'] as String? : null,
    );
  }
}
