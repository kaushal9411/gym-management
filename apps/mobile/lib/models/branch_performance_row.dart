import 'payments_analytics.dart' show jsonInt, jsonMoney;

/// Mirrors `BranchPerformanceRow` (`GET /reports/branch-performance`).
/// `monthlyRevenue` is a DECIMAL string (month to date).
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
        branchId: json['branchId']?.toString() ?? '',
        branch: json['branch']?.toString() ?? '',
        totalMembers: jsonInt(json['totalMembers']),
        activeMembers: jsonInt(json['activeMembers']),
        monthlyRevenue: jsonMoney(json['monthlyRevenue']),
        monthlyAttendance: jsonInt(json['monthlyAttendance']),
        staffCount: jsonInt(json['staffCount']),
      );
}
