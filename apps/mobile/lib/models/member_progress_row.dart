/// Mirrors `MemberProgressRow` (`GET /reports/member-progress`) — one row
/// per member's *active* workout/diet assignment (either may be absent).
class MemberProgressRow {
  const MemberProgressRow({
    required this.memberCode,
    required this.name,
    required this.workoutPlan,
    required this.workoutProgressPercent,
    required this.dietPlan,
    required this.dietProgressPercent,
  });

  final String memberCode;
  final String name;
  final String? workoutPlan;
  final int? workoutProgressPercent;
  final String? dietPlan;
  final int? dietProgressPercent;

  factory MemberProgressRow.fromJson(Map<String, dynamic> json) =>
      MemberProgressRow(
        memberCode: json['memberCode'] as String,
        name: json['name'] as String,
        workoutPlan: json['workoutPlan'] as String?,
        workoutProgressPercent: json['workoutProgressPercent'] as int?,
        dietPlan: json['dietPlan'] as String?,
        dietProgressPercent: json['dietProgressPercent'] as int?,
      );
}
