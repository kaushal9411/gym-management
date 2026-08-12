/// Mirrors `MemberDietPlanDto` (`GET /diet-plans/members/:memberId` →
/// `current`).
class MemberDietProgress {
  const MemberDietProgress({
    required this.id,
    required this.dietPlanId,
    required this.dietPlanName,
    required this.status,
    required this.progressPercent,
    required this.daysLogged,
  });

  final String id;
  final String dietPlanId;
  final String dietPlanName;
  final String status;
  final int progressPercent;
  final int daysLogged;

  factory MemberDietProgress.fromJson(Map<String, dynamic> json) =>
      MemberDietProgress(
        id: json['id'] as String,
        dietPlanId: (json['dietPlan'] as Map<String, dynamic>)['id'] as String,
        dietPlanName:
            (json['dietPlan'] as Map<String, dynamic>)['name'] as String,
        status: json['status'] as String,
        progressPercent: json['progressPercent'] as int? ?? 0,
        daysLogged: json['daysLogged'] as int? ?? 0,
      );
}
