/// Mirrors `ExpiringMembershipRow` (`GET /reports/expiring-memberships`) —
/// active memberships ending within the next 30 days (server default).
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
        memberCode: json['memberCode'] as String,
        name: json['name'] as String,
        branch: json['branch'] as String,
        plan: json['plan'] as String,
        endDate: json['endDate'] as String,
        daysRemaining: json['daysRemaining'] as int,
      );
}
