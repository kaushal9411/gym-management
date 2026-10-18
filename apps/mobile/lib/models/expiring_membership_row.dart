import 'payments_analytics.dart' show jsonInt;

/// Mirrors `ExpiringMembershipRow` (`GET /reports/expiring-memberships`) —
/// active memberships ending within the next 30 days (server default).
/// `endDate` is a plain `YYYY-MM-DD` (never timezone-shifted).
class ExpiringMembershipRow {
  const ExpiringMembershipRow({
    required this.memberCode,
    required this.name,
    required this.branch,
    required this.plan,
    required this.endDate,
    required this.daysRemaining,
  });

  final String memberCode;
  final String name;
  final String branch;
  final String plan;
  final String endDate;
  final int daysRemaining;

  factory ExpiringMembershipRow.fromJson(Map<String, dynamic> json) =>
      ExpiringMembershipRow(
        memberCode: json['memberCode']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        branch: json['branch']?.toString() ?? '',
        plan: json['plan']?.toString() ?? '',
        endDate: json['endDate']?.toString() ?? '',
        daysRemaining: jsonInt(json['daysRemaining']),
      );
}
