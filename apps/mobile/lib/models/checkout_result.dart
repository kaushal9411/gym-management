/// `POST /subscription`, `/subscription/upgrade`, `/subscription/downgrade`
/// — a free/fully-discounted change activates immediately
/// ([requiresPayment] false); anything with a balance due returns a real
/// Razorpay Order instead, for the native Checkout modal ([orderId]/
/// [amount]/[currency]/[keyId] set — [amount] is in the currency's
/// smallest unit, e.g. paise for INR, exactly as `razorpay_flutter` wants).
class CheckoutResult {
  const CheckoutResult({
    required this.requiresPayment,
    this.paymentId,
    this.orderId,
    this.amount,
    this.currency,
    this.keyId,
  });

  final bool requiresPayment;
  final String? paymentId;
  final String? orderId;
  final int? amount;
  final String? currency;
  final String? keyId;

  factory CheckoutResult.fromJson(Map<String, dynamic> json) => CheckoutResult(
        requiresPayment: json['requiresPayment'] as bool,
        paymentId: json['paymentId'] as String?,
        orderId: json['orderId'] as String?,
        amount: json['amount'] as int?,
        currency: json['currency'] as String?,
        keyId: json['keyId'] as String?,
      );
}

/// `POST /subscription/checkout/:paymentId/verify` — called once the
/// Razorpay Checkout modal's success callback delivers a signed
/// order/payment pair; the backend verifies the signature before
/// activating anything.
class VerifyCheckoutResult {
  const VerifyCheckoutResult({required this.status});

  /// `SUCCEEDED` | `FAILED`
  final String status;

  factory VerifyCheckoutResult.fromJson(Map<String, dynamic> json) =>
      VerifyCheckoutResult(status: json['status'] as String);
}
