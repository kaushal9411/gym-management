import 'payments_analytics.dart' show jsonMoney;

/// Mirrors `ExpenseReportRow` (`GET /reports/expenses`). `date` is a bare
/// `YYYY-MM-DD`, `amount` a DECIMAL string.
class ExpenseReportRow {
  const ExpenseReportRow({
    required this.date,
    required this.branch,
    required this.category,
    required this.amount,
    required this.description,
  });

  final String date;
  final String branch;
  final String category;
  final double amount;
  final String? description;

  factory ExpenseReportRow.fromJson(Map<String, dynamic> json) =>
      ExpenseReportRow(
        date: json['date']?.toString() ?? '',
        branch: json['branch']?.toString() ?? '',
        category: json['category']?.toString() ?? '',
        amount: jsonMoney(json['amount']),
        description: json['description'] as String?,
      );
}
