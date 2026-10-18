import 'payments_analytics.dart' show jsonMoney;

/// Mirrors `PaymentReportRow` (`GET /reports/payments`). `paymentDate` is a
/// bare `YYYY-MM-DD`, `finalAmount` a DECIMAL string.
class PaymentReportRow {
  const PaymentReportRow({
    required this.paymentNumber,
    required this.memberCode,
    required this.name,
    required this.branch,
    required this.finalAmount,
    required this.method,
    required this.status,
    required this.paymentDate,
  });

  final String paymentNumber;
  final String memberCode;
  final String name;
  final String branch;
  final double finalAmount;
  final String method;
  final String status;
  final String paymentDate;

  factory PaymentReportRow.fromJson(Map<String, dynamic> json) =>
      PaymentReportRow(
        paymentNumber: json['paymentNumber']?.toString() ?? '',
        memberCode: json['memberCode']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        branch: json['branch']?.toString() ?? '',
        finalAmount: jsonMoney(json['finalAmount']),
        method: json['method']?.toString() ?? '',
        status: json['status']?.toString() ?? '',
        paymentDate: json['paymentDate']?.toString() ?? '',
      );
}
