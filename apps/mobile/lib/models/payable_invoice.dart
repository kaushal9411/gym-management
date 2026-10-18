import 'payments_analytics.dart' show jsonMoney;

/// An UNPAID / PARTIALLY_PAID invoice offered as web's "Invoice (optional)"
/// step on the Record payment screen. Read from `GET /invoices?memberId=`
/// (perm `finance:invoice-view`) through the payments repository so the
/// Invoices feature's own model stays untouched.
class PayableInvoice {
  const PayableInvoice({
    required this.id,
    required this.number,
    required this.total,
    required this.status,
    required this.dueDate,
  });

  final String id;
  final String number;
  final double total;
  final String status;
  final DateTime? dueDate;

  bool get isPartiallyPaid => status == 'PARTIALLY_PAID';

  factory PayableInvoice.fromJson(Map<String, dynamic> json) => PayableInvoice(
        id: json['id'] as String,
        number: json['invoiceNumber'] as String? ?? '',
        total: jsonMoney(json['totalAmount']),
        status: json['status'] as String? ?? '',
        dueDate: DateTime.tryParse(json['dueDate']?.toString() ?? ''),
      );
}

/// What is still owed on one invoice: `total - sum(SUCCESS payments)` — the
/// same arithmetic web uses to prefill the amount (never below zero).
class InvoiceDue {
  const InvoiceDue({
    required this.number,
    required this.total,
    required this.paid,
  });

  final String number;
  final double total;
  final double paid;

  double get due => (total - paid) < 0 ? 0 : total - paid;

  factory InvoiceDue.fromJson(Map<String, dynamic> json) {
    var paid = 0.0;
    final payments = json['payments'];
    if (payments is List) {
      for (final p in payments.whereType<Map<String, dynamic>>()) {
        if (p['status'] == 'SUCCESS') paid += jsonMoney(p['finalAmount']);
      }
    }
    return InvoiceDue(
      number: json['invoiceNumber'] as String? ?? '',
      total: jsonMoney(json['totalAmount']),
      paid: paid,
    );
  }
}
