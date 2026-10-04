import 'payments_analytics.dart';

/// Mirrors `BranchComparisonRow` (`GET /analytics/branch-comparison`, perm
/// `analytics:view`, optional `dateFrom`/`dateTo`; default month-to-date).
/// `members` = ACTIVE members (point-in-time); `revenue`/`attendance` cover
/// the requested range.
class BranchComparisonRow {
  const BranchComparisonRow({
    required this.branchId,
    required this.branch,
    required this.members,
    required this.revenue,
    required this.attendance,
  });

  final String branchId;
  final String branch;
  final int members;
  final double revenue;
  final int attendance;

  factory BranchComparisonRow.fromJson(Map<String, dynamic> j) =>
      BranchComparisonRow(
        branchId: j['branchId'] as String? ?? '',
        branch: j['branch'] as String? ?? '',
        members: jsonInt(j['members']),
        revenue: jsonMoney(j['revenue']),
        attendance: jsonInt(j['attendance']),
      );
}
