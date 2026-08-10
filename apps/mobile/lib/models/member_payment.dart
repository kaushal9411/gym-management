enum PaymentMethod { cash, upi, card, bank }

extension PaymentMethodX on PaymentMethod {
  /// Design mockup shows 4 chips (Cash/UPI/Card/Bank) — Card maps to the
  /// backend's `CREDIT_CARD` (of its 7 methods, `DEBIT_CARD`/`CHEQUE`/
  /// `ONLINE_GATEWAY` aren't in the mockup's set, so aren't offered here).
  String get apiValue => switch (this) {
        PaymentMethod.cash => 'CASH',
        PaymentMethod.upi => 'UPI',
        PaymentMethod.card => 'CREDIT_CARD',
        PaymentMethod.bank => 'BANK_TRANSFER',
      };

  String get label => switch (this) {
        PaymentMethod.cash => 'Cash',
        PaymentMethod.upi => 'UPI',
        PaymentMethod.card => 'Card',
        PaymentMethod.bank => 'Bank',
      };
}

/// Mirrors `MemberPaymentListItemDto` — just the fields the Record Payment
/// success state shows.
class MemberPayment {
  const MemberPayment({
    required this.id,
    required this.paymentNumber,
    required this.finalAmount,
    required this.method,
    required this.status,
  });

  final String id;
  final String paymentNumber;
  final double finalAmount;
  final String method;
  final String status;

  factory MemberPayment.fromJson(Map<String, dynamic> json) => MemberPayment(
        id: json['id'] as String,
        paymentNumber: json['paymentNumber'] as String,
        finalAmount: double.parse(json['finalAmount'] as String),
        method: json['method'] as String,
        status: json['status'] as String,
      );
}
