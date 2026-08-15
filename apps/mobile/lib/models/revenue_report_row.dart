/// Mirrors `RevenueReportRow` (`GET /reports/revenue`).
class RevenueReportRow {
  const RevenueReportRow({
    required this.date,
    required this.branch,
    required this.method,
    required this.amount,
  });

  final String date;
  final String branch;
  final String method;
  final double amount;

  factory RevenueReportRow.fromJson(Map<String, dynamic> json) =>
      RevenueReportRow(
        date: json['date'] as String,
        branch: json['branch'] as String,
        method: json['method'] as String,
        amount: double.parse(json['amount'] as String),
      );
}
