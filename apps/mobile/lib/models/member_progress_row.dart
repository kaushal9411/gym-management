import 'payments_analytics.dart' show jsonInt;

/// Mirrors `MemberProgressRow` (`GET /reports/member-progress`) — one row
/// per member's *active* workout/diet assignment (either may be absent).
/// Percentages are 0..100 or null when the member has no active plan of
/// that kind.
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
        memberCode: json['memberCode']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        workoutPlan: json['workoutPlan'] as String?,
        workoutProgressPercent: json['workoutProgressPercent'] == null
            ? null
            : jsonInt(json['workoutProgressPercent']),
        dietPlan: json['dietPlan'] as String?,
        dietProgressPercent: json['dietProgressPercent'] == null
            ? null
            : jsonInt(json['dietProgressPercent']),
      );
}
