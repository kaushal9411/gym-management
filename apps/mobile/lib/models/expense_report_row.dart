/// Mirrors `ExpenseReportRow` (`GET /reports/expenses`).
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
        date: json['date'] as String,
        branch: json['branch'] as String,
        category: json['category'] as String,
        amount: double.parse(json['amount'] as String),
        description: json['description'] as String?,
      );
}
