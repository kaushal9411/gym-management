/// Mirrors `RevenueTrendPoint` (`GET /analytics/revenue-trends`).
class RevenueTrendPoint {
  const RevenueTrendPoint({
    required this.date,
    required this.income,
    required this.expenses,
  });

  final String date;
  final double income;
  final double expenses;

  factory RevenueTrendPoint.fromJson(Map<String, dynamic> json) =>
      RevenueTrendPoint(
        date: json['date'] as String,
        income: (json['income'] as num).toDouble(),
        expenses: (json['expenses'] as num).toDouble(),
      );
}
