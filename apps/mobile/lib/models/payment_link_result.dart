import 'member_payment.dart';

/// Mirrors `POST /payments/razorpay/link`'s
/// `{ payment, shortUrl, paymentLinkId, notifiedEmail, notifiedSms }`.
class PaymentLinkResult {
  const PaymentLinkResult({
    required this.payment,
    required this.shortUrl,
    this.notifiedEmail = false,
    this.notifiedSms = false,
  });

  final MemberPayment payment;
  final String shortUrl;

  /// Whether the server actually sent the link by email / SMS.
  final bool notifiedEmail;
  final bool notifiedSms;

  factory PaymentLinkResult.fromJson(Map<String, dynamic> json) =>
      PaymentLinkResult(
        payment:
            MemberPayment.fromJson(json['payment'] as Map<String, dynamic>),
        shortUrl: json['shortUrl'] as String,
        notifiedEmail: json['notifiedEmail'] == true,
        notifiedSms: json['notifiedSms'] == true,
      );
}
