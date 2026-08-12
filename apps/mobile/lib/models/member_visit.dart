/// Mirrors one item of `GET /portal/attendance` — the member's own visit
/// history (design frames "8a. My attendance" / "8b. Visit detail").
class MemberVisit {
  const MemberVisit({
    required this.id,
    required this.branchName,
    required this.checkInTime,
    required this.checkOutTime,
    required this.attendanceDate,
    required this.method,
    required this.status,
  });

  final String id;
  final String branchName;
  final DateTime checkInTime;
  final DateTime? checkOutTime;
  final DateTime attendanceDate;
  final String method;
  final String status;

  /// Null while the member is still inside (no check-out recorded yet).
  Duration? get duration => checkOutTime?.difference(checkInTime);

  factory MemberVisit.fromJson(Map<String, dynamic> json) => MemberVisit(
        id: json['id'] as String,
        branchName:
            (json['branch'] as Map<String, dynamic>)['name'] as String? ?? '',
        checkInTime: DateTime.parse(json['checkInTime'] as String).toLocal(),
        checkOutTime: json['checkOutTime'] == null
            ? null
            : DateTime.parse(json['checkOutTime'] as String).toLocal(),
        attendanceDate: DateTime.parse(json['attendanceDate'] as String),
        method: json['method'] as String? ?? '',
        status: json['status'] as String? ?? '',
      );
}
