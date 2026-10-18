import 'payments_analytics.dart' show jsonMoney;

/// One row of `GET /payment/history` — a charge attempt for the tenant's own
/// platform subscription (web's `PaymentRecord`; not a member payment, which
/// is `MemberPayment`). `status` is the backend enum: `SUCCEEDED | PENDING |
/// FAILED | REFUNDED | PARTIALLY_REFUNDED`.
class BillingPayment {
  const BillingPayment({
    required this.id,
    required this.provider,
    required this.status,
    required this.amount,
    required this.currency,
    required this.gatewayReference,
    required this.failureReason,
    required this.createdAt,
  });

  final String id;

  /// Lower-case gateway name as the API sends it (`razorpay`, ...).
  final String provider;
  final String status;
  final double amount;
  final String currency;
  final String? gatewayReference;
  final String? failureReason;
  final DateTime createdAt;

  bool get isSucceeded => status == 'SUCCEEDED';
  bool get isFailed => status == 'FAILED';
  bool get isRefunded => status == 'REFUNDED' || status == 'PARTIALLY_REFUNDED';

  factory BillingPayment.fromJson(Map<String, dynamic> json) => BillingPayment(
        id: json['id'] as String,
        provider: json['provider'] as String? ?? '',
        status: json['status'] as String? ?? '',
        amount: jsonMoney(json['amount']),
        currency: json['currency'] as String? ?? 'INR',
        gatewayReference: json['gatewayReference'] as String?,
        failureReason: json['failureReason'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
