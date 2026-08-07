/// Mirrors apps/api reports/dto/reports.dto.ts's dashboard KPI shape exactly
/// (confirmed live against GET /reports/dashboard/kpis).
class DashboardKpis {
  final int totalMembers;
  final int activeMembers;
  final int newMembersThisMonth;
  final int expiringMemberships;
  final int todaysAttendance;
  final String monthlyRevenue;
  final int totalStaff;
  final int activeBranches;

  const DashboardKpis({
    required this.totalMembers,
    required this.activeMembers,
    required this.newMembersThisMonth,
    required this.expiringMemberships,
    required this.todaysAttendance,
    required this.monthlyRevenue,
    required this.totalStaff,
    required this.activeBranches,
  });

  factory DashboardKpis.fromJson(Map<String, dynamic> json) => DashboardKpis(
        totalMembers: json['totalMembers'] as int? ?? 0,
        activeMembers: json['activeMembers'] as int? ?? 0,
        newMembersThisMonth: json['newMembersThisMonth'] as int? ?? 0,
        expiringMemberships: json['expiringMemberships'] as int? ?? 0,
        todaysAttendance: json['todaysAttendance'] as int? ?? 0,
        monthlyRevenue: json['monthlyRevenue']?.toString() ?? '0',
        totalStaff: json['totalStaff'] as int? ?? 0,
        activeBranches: json['activeBranches'] as int? ?? 0,
      );
}

class Announcement {
  final String id;
  final String title;
  final String? message;

  const Announcement({required this.id, required this.title, this.message});

  factory Announcement.fromJson(Map<String, dynamic> json) => Announcement(
        id: json['id'] as String,
        title: json['title'] as String? ?? '',
        message: json['message'] as String?,
      );
}

/// Mirrors GET /reports/dashboard/recent-activities exactly.
class RecentActivity {
  final String type; // PAYMENT | CHECK_IN | NEW_MEMBER
  final String id;
  final String label;
  final String detail;
  final DateTime occurredAt;

  const RecentActivity({
    required this.type,
    required this.id,
    required this.label,
    required this.detail,
    required this.occurredAt,
  });

  factory RecentActivity.fromJson(Map<String, dynamic> json) => RecentActivity(
        type: json['type'] as String? ?? '',
        id: json['id'] as String,
        label: json['label'] as String? ?? '',
        detail: json['detail'] as String? ?? '',
        occurredAt: DateTime.parse(json['occurredAt'] as String),
      );
}

/// Mirrors GET /analytics/revenue-trends exactly (income/expenses per day).
class RevenueTrendPoint {
  final DateTime date;
  final double income;

  const RevenueTrendPoint({required this.date, required this.income});

  factory RevenueTrendPoint.fromJson(Map<String, dynamic> json) =>
      RevenueTrendPoint(
        date: DateTime.parse(json['date'] as String),
        income: (json['income'] as num?)?.toDouble() ?? 0,
      );
}
