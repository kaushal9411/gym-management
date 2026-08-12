/// Mirrors `GET /invoice` — FitCloud's invoices to this tenant for its own
/// subscription (distinct from invoices the tenant issues to its members).
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
        total: (json['total'] as num).toDouble(),
        currency: json['currency'] as String,
        dueDate: json['dueDate'] == null
            ? null
            : DateTime.parse(json['dueDate'] as String),
        paidAt: json['paidAt'] == null
            ? null
            : DateTime.parse(json['paidAt'] as String),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
