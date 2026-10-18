import 'payments_analytics.dart' show jsonMoney;

/// Mirrors `GET /invoice` — the platform's invoices to this tenant for its own
/// subscription (distinct from invoices the tenant issues to its members).
///
/// `status` is the backend enum, UPPER_SNAKE: `DRAFT | OPEN | PAID | VOID |
/// UNCOLLECTIBLE`.
class FitCloudInvoice {
  const FitCloudInvoice({
    required this.id,
    required this.invoiceNumber,
    required this.status,
    required this.total,
    required this.currency,
    required this.dueDate,
    required this.paidAt,
    required this.createdAt,
  });

  final String id;
  final String invoiceNumber;
  final String status;
  final double total;
  final String currency;
  final DateTime? dueDate;
  final DateTime? paidAt;
  final DateTime createdAt;

  factory FitCloudInvoice.fromJson(Map<String, dynamic> json) =>
      FitCloudInvoice(
        id: json['id'] as String,
        invoiceNumber: json['invoiceNumber'] as String,
        status: json['status'] as String,
        total: jsonMoney(json['total']),
        currency: json['currency'] as String? ?? 'INR',
        dueDate: _date(json['dueDate']),
        paidAt: _date(json['paidAt']),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  static DateTime? _date(Object? v) =>
      v is String ? DateTime.tryParse(v) : null;
}
