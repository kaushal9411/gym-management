/// Mirrors `ActiveVsInactiveRow` (`GET /reports/active-vs-inactive`).
class ActiveVsInactiveRow {
  const ActiveVsInactiveRow({required this.status, required this.count});

  final String status;
  final int count;

  factory ActiveVsInactiveRow.fromJson(Map<String, dynamic> json) =>
      ActiveVsInactiveRow(
        status: json['status'] as String,
        count: json['count'] as int,
      );
}
