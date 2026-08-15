/// Mirrors `PaymentReportRow` (`GET /reports/payments`).
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
        paymentNumber: json['paymentNumber'] as String,
        memberCode: json['memberCode'] as String,
        name: json['name'] as String,
        branch: json['branch'] as String,
        finalAmount: double.parse(json['finalAmount'] as String),
        method: json['method'] as String,
        status: json['status'] as String,
        paymentDate: json['paymentDate'] as String,
      );
}
