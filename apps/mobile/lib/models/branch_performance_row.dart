/// Mirrors `BranchPerformanceRow` (`GET /reports/branch-performance`).
class BranchPerformanceRow {
  const BranchPerformanceRow({
    required this.branchId,
    required this.branch,
    required this.totalMembers,
    required this.activeMembers,
    required this.monthlyRevenue,
    required this.monthlyAttendance,
    required this.staffCount,
  });

  final String branchId;
  final String branch;
  final int totalMembers;
  final int activeMembers;
  final double monthlyRevenue;
  final int monthlyAttendance;
  final int staffCount;

  factory BranchPerformanceRow.fromJson(Map<String, dynamic> json) =>
      BranchPerformanceRow(
        branchId: json['branchId'] as String,
        branch: json['branch'] as String,
        totalMembers: json['totalMembers'] as int? ?? 0,
        activeMembers: json['activeMembers'] as int? ?? 0,
        monthlyRevenue: double.parse(json['monthlyRevenue'] as String),
        monthlyAttendance: json['monthlyAttendance'] as int? ?? 0,
        staffCount: json['staffCount'] as int? ?? 0,
      );
}
