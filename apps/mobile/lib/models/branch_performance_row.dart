/// Mirrors `BranchPerformanceRow` (`GET /reports/branch-performance`).
class BranchPerformanceRow {
  const BranchPerformanceRow({
    required this.branchId,
    required this.branch,
    required this.monthlyRevenue,
  });

  final String branchId;
  final String branch;
  final double monthlyRevenue;

  factory BranchPerformanceRow.fromJson(Map<String, dynamic> json) =>
      BranchPerformanceRow(
        branchId: json['branchId'] as String,
        branch: json['branch'] as String,
        monthlyRevenue: double.parse(json['monthlyRevenue'] as String),
      );
}
