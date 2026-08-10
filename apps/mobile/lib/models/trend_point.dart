/// Mirrors `TrendPoint` (`{ date, value }`) — used by
/// `/analytics/attendance-trends` and `/analytics/new-member-growth`.
class TrendPoint {
  const TrendPoint({required this.date, required this.value});

  final String date;
  final int value;

  factory TrendPoint.fromJson(Map<String, dynamic> json) =>
      TrendPoint(date: json['date'] as String, value: json['value'] as int);
}
