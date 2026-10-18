import 'payments_analytics.dart' show jsonInt;

/// Mirrors `ActiveVsInactiveRow` (`GET /reports/active-vs-inactive`) — the
/// member count for one status (`ACTIVE`, `INACTIVE`, `FROZEN`, `EXPIRED`...).
class ActiveVsInactiveRow {
  const ActiveVsInactiveRow({required this.status, required this.count});

  final String status;
  final int count;

  factory ActiveVsInactiveRow.fromJson(Map<String, dynamic> json) =>
      ActiveVsInactiveRow(
        status: json['status']?.toString() ?? '',
        count: jsonInt(json['count']),
      );
}
