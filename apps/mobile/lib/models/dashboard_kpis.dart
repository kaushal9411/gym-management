/// Mirrors `KpiMetricsDto` (`GET /reports/dashboard/kpis`).
class DashboardKpis {
  const DashboardKpis({
    required this.totalMembers,
    required this.activeMembers,
    required this.newMembersThisMonth,
    required this.expiringMemberships,
    required this.todaysAttendance,
    required this.monthlyRevenue,
    required this.monthlyExpenses,
    required this.outstandingPayments,
    required this.totalStaff,
    required this.activeTrainers,
    required this.activeBranches,
  });

  final int totalMembers;
  final int activeMembers;
  final int newMembersThisMonth;
  final int expiringMemberships;
  final int todaysAttendance;
  final double monthlyRevenue;
  final double monthlyExpenses;
  final double outstandingPayments;
  final int totalStaff;
  final int activeTrainers;
  final int activeBranches;

  factory DashboardKpis.fromJson(Map<String, dynamic> json) => DashboardKpis(
        totalMembers: json['totalMembers'] as int,
        activeMembers: json['activeMembers'] as int,
        newMembersThisMonth: json['newMembersThisMonth'] as int,
        expiringMemberships: json['expiringMemberships'] as int,
        todaysAttendance: json['todaysAttendance'] as int,
        monthlyRevenue: double.parse(json['monthlyRevenue'] as String),
        monthlyExpenses: double.parse(json['monthlyExpenses'] as String),
        outstandingPayments:
            double.parse(json['outstandingPayments'] as String),
        totalStaff: json['totalStaff'] as int,
        activeTrainers: json['activeTrainers'] as int,
        activeBranches: json['activeBranches'] as int,
      );
}
