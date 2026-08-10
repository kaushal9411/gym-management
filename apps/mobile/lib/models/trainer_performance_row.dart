/// Mirrors `TrainerPerformanceRow` (`GET /reports/trainer-performance`).
class TrainerPerformanceRow {
  const TrainerPerformanceRow({
    required this.trainerId,
    required this.name,
    required this.assignedMembers,
    required this.activeWorkoutPlans,
    required this.activeDietPlans,
  });

  final String trainerId;
  final String name;
  final int assignedMembers;
  final int activeWorkoutPlans;
  final int activeDietPlans;

  factory TrainerPerformanceRow.fromJson(Map<String, dynamic> json) =>
      TrainerPerformanceRow(
        trainerId: json['trainerId'] as String,
        name: json['name'] as String,
        assignedMembers: json['assignedMembers'] as int,
        activeWorkoutPlans: json['activeWorkoutPlans'] as int,
        activeDietPlans: json['activeDietPlans'] as int,
      );
}
