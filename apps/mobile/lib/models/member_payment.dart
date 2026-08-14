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

/// One entry of a payment's refund history (`MemberPaymentDetailDto.refunds`).
class PaymentRefund {
  const PaymentRefund({
    required this.id,
    required this.amount,
    required this.reason,
    required this.refundedByName,
    required this.refundedAt,
  });

  final String id;
  final double amount;
  final String? reason;
  final String? refundedByName;
  final DateTime refundedAt;

  factory PaymentRefund.fromJson(Map<String, dynamic> json) => PaymentRefund(
        id: json['id'] as String,
        amount: double.parse(json['amount'] as String),
        reason: json['reason'] as String?,
        refundedByName:
            (json['refundedBy'] as Map<String, dynamic>?)?['name'] as String?,
        refundedAt: DateTime.parse(json['refundedAt'] as String),
      );
}

/// Mirrors `MemberPaymentListItemDto`/`MemberPaymentDetailDto` as one class,
/// the same way [GymMember] and [StaffMember] do — the detail-only fields
/// (`refunds`, `totalRefunded`, `recordedByName`, `notes`) simply stay
/// empty/null on rows that came from the list endpoint.
class MemberPayment {
  const MemberPayment({
    required this.id,
    required this.paymentNumber,
    required this.memberName,
    required this.memberCode,
    required this.branchName,
    required this.planName,
    required this.invoiceId,
    required this.finalAmount,
    required this.method,
    required this.paymentDate,
    required this.status,
    this.notes,
    this.recordedByName,
    this.refunds = const [],
    this.totalRefunded = 0,
  });

  final String id;
  final String paymentNumber;
  final String memberName;
  final String memberCode;
  final String branchName;
  final String? planName;
  final String? invoiceId;
  final double finalAmount;
  final String method;
  final DateTime paymentDate;
  final String status;
  final String? notes;
  final String? recordedByName;
  final List<PaymentRefund> refunds;
  final double totalRefunded;

  /// What's still refundable — the backend rejects a refund beyond this.
  double get refundableAmount => finalAmount - totalRefunded;

  bool get canRefund => status == 'SUCCESS' && refundableAmount > 0;

  /// The API only allows cancelling a payment that hasn't been refunded.
  bool get canCancel =>
      status != 'CANCELLED' && status != 'REFUNDED' && refunds.isEmpty;

  factory MemberPayment.fromJson(Map<String, dynamic> json) => MemberPayment(
        id: json['id'] as String,
        paymentNumber: json['paymentNumber'] as String,
        memberName:
            (json['member'] as Map<String, dynamic>)['name'] as String? ?? '',
        memberCode:
            (json['member'] as Map<String, dynamic>)['memberId'] as String? ??
                '',
        branchName:
            (json['branch'] as Map<String, dynamic>?)?['name'] as String? ?? '',
        planName:
            (json['membership'] as Map<String, dynamic>?)?['planName'] as String?,
        invoiceId: json['invoiceId'] as String?,
        finalAmount: double.parse(json['finalAmount'] as String),
        method: json['method'] as String,
        paymentDate: DateTime.parse(json['paymentDate'] as String),
        status: json['status'] as String,
        notes: json['notes'] as String?,
        recordedByName:
            (json['recordedBy'] as Map<String, dynamic>?)?['name'] as String?,
        refunds: json['refunds'] == null
            ? const []
            : (json['refunds'] as List)
                .map((r) => PaymentRefund.fromJson(r as Map<String, dynamic>))
                .toList(),
        totalRefunded: json['totalRefunded'] == null
            ? 0
            : double.parse(json['totalRefunded'] as String),
      );
}
