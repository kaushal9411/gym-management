import 'member_payment.dart';

/// Mirrors `POST /payments/razorpay/link`'s `{ payment, shortUrl, paymentLinkId }`.
class PaymentLinkResult {
  const PaymentLinkResult({
    required this.payment,
    required this.shortUrl,
  });

  final MemberPayment payment;
  final String shortUrl;

  factory PaymentLinkResult.fromJson(Map<String, dynamic> json) =>
      PaymentLinkResult(
        payment:
            MemberPayment.fromJson(json['payment'] as Map<String, dynamic>),
        shortUrl: json['shortUrl'] as String,
      );
}
