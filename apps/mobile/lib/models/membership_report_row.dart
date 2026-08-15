/// Mirrors `MembershipReportRow` (`GET /reports/membership`).
class MembershipReportRow {
  const MembershipReportRow({
    required this.memberId,
    required this.memberCode,
    required this.name,
    required this.branch,
    required this.plan,
    required this.status,
    required this.startDate,
    required this.endDate,
  });

  final String memberId;
  final String memberCode;
  final String name;
  final String branch;
  final String? plan;
  final String status;
  final String? startDate;
  final String? endDate;

  factory MembershipReportRow.fromJson(Map<String, dynamic> json) =>
      MembershipReportRow(
        memberId: json['memberId'] as String,
        memberCode: json['memberCode'] as String,
        name: json['name'] as String,
        branch: json['branch'] as String,
        plan: json['plan'] as String?,
        status: json['status'] as String,
        startDate: json['startDate'] as String?,
        endDate: json['endDate'] as String?,
      );
}
