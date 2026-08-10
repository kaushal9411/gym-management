/// Mirrors `RecentActivityDto` (`GET /reports/dashboard/recent-activities`).
enum RecentActivityType { payment, checkIn, newMember }

class RecentActivity {
  const RecentActivity({
    required this.type,
    required this.id,
    required this.label,
    required this.detail,
    required this.occurredAt,
  });

  final RecentActivityType type;
  final String id;
  final String label;
  final String detail;
  final DateTime occurredAt;

  factory RecentActivity.fromJson(Map<String, dynamic> json) => RecentActivity(
        type: switch (json['type'] as String) {
          'PAYMENT' => RecentActivityType.payment,
          'CHECK_IN' => RecentActivityType.checkIn,
          _ => RecentActivityType.newMember,
        },
        id: json['id'] as String,
        label: json['label'] as String,
        detail: json['detail'] as String,
        occurredAt: DateTime.parse(json['occurredAt'] as String),
      );
}
