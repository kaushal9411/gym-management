/// Mirrors `StaffReportRow` (`GET /reports/staff`) — Managers, Trainers,
/// and Receptionists (the report excludes Owner accounts server-side).
class StaffReportRow {
  const StaffReportRow({
    required this.name,
    required this.role,
    required this.branch,
    required this.status,
    required this.joiningDate,
  });

  final String name;
  final String role;
  final String? branch;
  final String status;
  final String? joiningDate;

  factory StaffReportRow.fromJson(Map<String, dynamic> json) => StaffReportRow(
        name: json['name'] as String,
        role: json['role'] as String,
        branch: json['branch'] as String?,
        status: json['status'] as String,
        joiningDate: json['joiningDate'] as String?,
      );
}
