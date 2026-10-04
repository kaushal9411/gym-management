import 'payments_analytics.dart' show jsonMoney;

/// One row of `GET /portal/payments` (the member's OWN payments). Named
/// `PortalPayment` because the staff-plane `MemberPayment` already exists.
class PortalPayment {
  const PortalPayment({
    required this.id,
    required this.paymentNumber,
    required this.amount,
    required this.method,
    required this.status,
    required this.paymentDate,
    required this.invoiceId,
    required this.invoiceNumber,
    required this.totalRefunded,
  });

  final String id;
  final String paymentNumber;
  final double amount;
  final String method;
  final String status;
  final String paymentDate;
  final String? invoiceId;
  final String? invoiceNumber;
  final double totalRefunded;

  bool get hasRefund => totalRefunded > 0;

  factory PortalPayment.fromJson(Map<String, dynamic> j) => PortalPayment(
        id: j['id'] as String? ?? '',
        paymentNumber: j['paymentNumber'] as String? ?? '',
        amount: jsonMoney(j['amount']),
        method: j['method'] as String? ?? '',
        status: j['status'] as String? ?? '',
        paymentDate: j['paymentDate'] as String? ?? '',
        invoiceId: j['invoiceId'] as String?,
        invoiceNumber: j['invoiceNumber'] as String?,
        totalRefunded: jsonMoney(j['totalRefunded']),
      );
}
