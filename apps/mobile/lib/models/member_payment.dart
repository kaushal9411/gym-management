import 'payments_analytics.dart' show jsonMoney;

/// Offline ("collected now") methods offered on the Record payment screen —
/// web's `OFFLINE_METHODS`. `ONLINE_GATEWAY` is never picked by staff: it is
/// the Payment Link flow's own method.
enum PaymentMethod { cash, upi, debitCard, creditCard, bank, cheque }

extension PaymentMethodX on PaymentMethod {
  /// The backend's `memberPaymentMethodSchema` value (UPPER_SNAKE).
  String get apiValue => switch (this) {
        PaymentMethod.cash => 'CASH',
        PaymentMethod.upi => 'UPI',
        PaymentMethod.debitCard => 'DEBIT_CARD',
        PaymentMethod.creditCard => 'CREDIT_CARD',
        PaymentMethod.bank => 'BANK_TRANSFER',
        PaymentMethod.cheque => 'CHEQUE',
      };

  String get label => switch (this) {
        PaymentMethod.cash => 'Cash',
        PaymentMethod.upi => 'UPI',
        PaymentMethod.debitCard => 'Debit card',
        PaymentMethod.creditCard => 'Credit card',
        PaymentMethod.bank => 'Bank transfer',
        PaymentMethod.cheque => 'Cheque',
      };
}

/// Every method the backend knows, in web's `METHOD_LABELS` order — used by
/// the list's method filter chips.
const paymentMethodValues = [
  'CASH',
  'UPI',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'BANK_TRANSFER',
  'CHEQUE',
  'ONLINE_GATEWAY',
];

/// Every status the backend knows, in web's chip order.
const paymentStatusValues = [
  'SUCCESS',
  'PENDING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'FAILED',
  'CANCELLED',
];

/// Web's `METHOD_LABELS`.
String paymentMethodLabel(String api) => switch (api) {
      'CASH' => 'Cash',
      'UPI' => 'UPI',
      'CREDIT_CARD' => 'Credit Card',
      'DEBIT_CARD' => 'Debit Card',
      'BANK_TRANSFER' => 'Bank Transfer',
      'CHEQUE' => 'Cheque',
      'ONLINE_GATEWAY' => 'Online Gateway',
      _ => api
          .split('_')
          .map((w) => w.isEmpty ? w : w[0] + w.substring(1).toLowerCase())
          .join(' '),
    };

/// Web's `PAYMENT_STATUS_META` labels.
String paymentStatusLabel(String api) => switch (api) {
      'SUCCESS' => 'Success',
      'PENDING' => 'Pending',
      'PARTIALLY_REFUNDED' => 'Partially refunded',
      'REFUNDED' => 'Refunded',
      'FAILED' => 'Failed',
      'CANCELLED' => 'Cancelled',
      _ => api.replaceAll('_', ' '),
    };

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
        id: json['id']?.toString() ?? '',
        amount: jsonMoney(json['amount']),
        reason: json['reason'] as String?,
        refundedByName:
            (json['refundedBy'] as Map<String, dynamic>?)?['name'] as String?,
        refundedAt: DateTime.tryParse(json['refundedAt']?.toString() ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0),
      );
}

/// Mirrors `MemberPaymentListItemDto`/`MemberPaymentDetailDto` as one class,
/// the same way [GymMember] and [StaffMember] do — the detail-only fields
/// (`refunds`, `recordedByName`, `notes`) simply stay empty/null on rows that
/// came from the list endpoint. Money arrives as decimal STRINGS, parsed with
/// the tolerant [jsonMoney].
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
    this.memberId = '',
    this.amount = 0,
    this.discount = 0,
    this.tax = 0,
    this.reference,
    this.createdAt,
    this.notes,
    this.recordedByName,
    this.refunds = const [],
    this.totalRefunded = 0,
  });

  final String id;
  final String paymentNumber;
  final String memberId;
  final String memberName;
  final String memberCode;
  final String branchName;
  final String? planName;
  final String? invoiceId;

  /// Gross amount before discount and tax.
  final double amount;
  final double discount;
  final double tax;
  final double finalAmount;
  final String method;
  final DateTime paymentDate;
  final String status;

  /// `transactionReference` (UPI ref / cheque no. / gateway id).
  final String? reference;
  final DateTime? createdAt;
  final String? notes;
  final String? recordedByName;
  final List<PaymentRefund> refunds;
  final double totalRefunded;

  /// What's still refundable — the backend rejects a refund beyond this.
  double get refundableAmount => finalAmount - totalRefunded;

  bool get canRefund =>
      (status == 'SUCCESS' || status == 'PARTIALLY_REFUNDED') &&
      refundableAmount > 0;

  /// Money actually received (web's `received`): SUCCESS and the refunded
  /// states. PENDING / FAILED / CANCELLED never reached the till.
  bool get isReceived =>
      status == 'SUCCESS' ||
      status == 'PARTIALLY_REFUNDED' ||
      status == 'REFUNDED';

  /// Refundable balance as shown on the summary tiles (0 unless the payment
  /// is in a refundable status).
  double get refundableShown =>
      status == 'SUCCESS' || status == 'PARTIALLY_REFUNDED'
          ? (refundableAmount < 0 ? 0 : refundableAmount)
          : 0;

  /// Net received after refunds (0 for a payment that never landed).
  double get netReceived => isReceived ? finalAmount - totalRefunded : 0;

  /// Status the payment will have after refunding [amount] more — mirrors
  /// the backend rule (balance left → PARTIALLY_REFUNDED, else REFUNDED).
  /// [amount] null means "full remainder".
  String statusAfterRefund(double? amount) {
    final remaining = refundableAmount - (amount ?? refundableAmount);
    return remaining > 0.004 ? 'PARTIALLY_REFUNDED' : 'REFUNDED';
  }

  /// The API only allows cancelling a payment that hasn't been refunded.
  bool get canCancel =>
      status != 'CANCELLED' && status != 'REFUNDED' && refunds.isEmpty;

  factory MemberPayment.fromJson(Map<String, dynamic> json) {
    final member = json['member'] as Map<String, dynamic>? ?? const {};
    return MemberPayment(
      id: json['id'] as String,
      paymentNumber: json['paymentNumber'] as String? ?? '',
      memberId: member['id']?.toString() ?? '',
      memberName: member['name'] as String? ?? '',
      memberCode: member['memberId'] as String? ?? '',
      branchName:
          (json['branch'] as Map<String, dynamic>?)?['name'] as String? ?? '',
      planName:
          (json['membership'] as Map<String, dynamic>?)?['planName'] as String?,
      invoiceId: json['invoiceId'] as String?,
      amount: jsonMoney(json['amount']),
      discount: jsonMoney(json['discount']),
      tax: jsonMoney(json['tax']),
      finalAmount: jsonMoney(json['finalAmount']),
      method: json['method'] as String? ?? '',
      paymentDate: DateTime.tryParse(json['paymentDate']?.toString() ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      status: json['status'] as String? ?? '',
      reference: json['transactionReference'] as String?,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
      notes: json['notes'] as String?,
      recordedByName:
          (json['recordedBy'] as Map<String, dynamic>?)?['name'] as String?,
      refunds: json['refunds'] is List
          ? (json['refunds'] as List)
              .whereType<Map<String, dynamic>>()
              .map(PaymentRefund.fromJson)
              .toList()
          : const [],
      totalRefunded: jsonMoney(json['totalRefunded']),
    );
  }
}

/// `summary` block of `GET /payments` — totals for the filtered result set
/// (not just the loaded page). Decimal strings on the wire.
class PaymentListSummary {
  const PaymentListSummary({
    required this.collectedTotal,
    required this.refundedTotal,
  });

  final double collectedTotal;
  final double refundedTotal;

  factory PaymentListSummary.fromJson(Map<String, dynamic> json) =>
      PaymentListSummary(
        collectedTotal: jsonMoney(json['collectedTotal']),
        refundedTotal: jsonMoney(json['refundedTotal']),
      );
}
