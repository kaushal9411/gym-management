class InvoiceMemberSummary {
  const InvoiceMemberSummary({
    required this.id,
    required this.memberId,
    required this.name,
  });

  final String id;
  final String memberId;
  final String name;

  factory InvoiceMemberSummary.fromJson(Map<String, dynamic> json) =>
      InvoiceMemberSummary(
        id: json['id'] as String,
        memberId: json['memberId'] as String,
        name: json['name'] as String,
      );
}

class InvoiceLineItem {
  const InvoiceLineItem({
    required this.description,
    required this.quantity,
    required this.amount,
  });

  final String description;
  final int quantity;
  final double amount;

  factory InvoiceLineItem.fromJson(Map<String, dynamic> json) =>
      InvoiceLineItem(
        description: json['description'] as String,
        quantity: json['quantity'] as int,
        amount: double.parse(json['amount'] as String),
      );
}

/// Mirrors `MemberInvoiceListItemDto`/`MemberInvoiceDetailDto`
/// (`GET /invoices`, `/invoices/:id`) as one class — `items` stays empty
/// until fetched via [InvoiceRepository.getById].
class MemberInvoice {
  const MemberInvoice({
    required this.id,
    required this.invoiceNumber,
    required this.member,
    required this.invoiceDate,
    required this.subtotal,
    required this.taxAmount,
    required this.totalAmount,
    required this.status,
    this.items = const [],
  });

  final String id;
  final String invoiceNumber;
  final InvoiceMemberSummary member;
  final DateTime invoiceDate;
  final double subtotal;
  final double taxAmount;
  final double totalAmount;
  final String status;
  final List<InvoiceLineItem> items;

  factory MemberInvoice.fromJson(Map<String, dynamic> json) => MemberInvoice(
        id: json['id'] as String,
        invoiceNumber: json['invoiceNumber'] as String,
        member: InvoiceMemberSummary.fromJson(
          json['member'] as Map<String, dynamic>,
        ),
        invoiceDate: DateTime.parse(json['invoiceDate'] as String),
        subtotal: double.parse(json['subtotal'] as String),
        taxAmount: double.parse(json['taxAmount'] as String),
        totalAmount: double.parse(json['totalAmount'] as String),
        status: json['status'] as String,
        items: json['items'] == null
            ? const []
            : (json['items'] as List)
                .map(
                  (e) => InvoiceLineItem.fromJson(e as Map<String, dynamic>),
                )
                .toList(),
      );
}
