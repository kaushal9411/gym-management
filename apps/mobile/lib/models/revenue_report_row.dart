import 'payments_analytics.dart' show jsonMoney;

/// Mirrors `RevenueReportRow` (`GET /reports/revenue`). `date` is a bare
/// `YYYY-MM-DD` (a `@db.Date` column) and `amount` a DECIMAL string.
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
        date: json['date']?.toString() ?? '',
        branch: json['branch']?.toString() ?? '',
        method: json['method']?.toString() ?? '',
        amount: jsonMoney(json['amount']),
      );
}
