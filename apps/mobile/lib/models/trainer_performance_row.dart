import 'payments_analytics.dart' show jsonInt;

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
        trainerId: json['trainerId']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        assignedMembers: jsonInt(json['assignedMembers']),
        activeWorkoutPlans: jsonInt(json['activeWorkoutPlans']),
        activeDietPlans: jsonInt(json['activeDietPlans']),
      );
}
