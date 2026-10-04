import 'payments_analytics.dart' show jsonList, jsonMap, jsonMoney, jsonInt;

class PortalInvoiceItem {
  const PortalInvoiceItem({
    required this.description,
    required this.quantity,
    required this.unitPrice,
    required this.amount,
  });

  final String description;
  final int quantity;
  final double unitPrice;
  final double amount;
}

class PortalInvoicePayment {
  const PortalInvoicePayment({
    required this.paymentNumber,
    required this.finalAmount,
    required this.status,
    required this.paymentDate,
  });

  final String paymentNumber;
  final double finalAmount;
  final String status;
  final String paymentDate;
}

/// Mirrors `MemberInvoiceDetailPortalDto` (`GET /portal/invoices/:id`) —
/// the additions the list payload lacks: discount, linked payments, and the
/// server-computed paid/balance.
class MemberInvoiceDetail {
  const MemberInvoiceDetail({
    required this.id,
    required this.invoiceNumber,
    required this.status,
    required this.subtotal,
    required this.taxAmount,
    required this.discountAmount,
    required this.totalAmount,
    required this.items,
    required this.payments,
    required this.paid,
    required this.balance,
    required this.branchName,
  });

  final String id;
  final String invoiceNumber;
  final String status;
  final double subtotal;
  final double taxAmount;
  final double discountAmount;
  final double totalAmount;
  final List<PortalInvoiceItem> items;
  final List<PortalInvoicePayment> payments;
  final double paid;
  final double balance;
  final String? branchName;

  factory MemberInvoiceDetail.fromJson(Map<String, dynamic> j) =>
      MemberInvoiceDetail(
        id: j['id'] as String? ?? '',
        invoiceNumber: j['invoiceNumber'] as String? ?? '',
        status: j['status'] as String? ?? '',
        subtotal: jsonMoney(j['subtotal']),
        taxAmount: jsonMoney(j['taxAmount']),
        discountAmount: jsonMoney(j['discountAmount']),
        totalAmount: jsonMoney(j['totalAmount']),
        items: jsonList(j['items'])
            .map(
              (e) => PortalInvoiceItem(
                description: e['description'] as String? ?? '',
                quantity: jsonInt(e['quantity']),
                unitPrice: jsonMoney(e['unitPrice']),
                amount: jsonMoney(e['amount']),
              ),
            )
            .toList(),
        payments: jsonList(j['payments'])
            .map(
              (e) => PortalInvoicePayment(
                paymentNumber: e['paymentNumber'] as String? ?? '',
                finalAmount: jsonMoney(e['finalAmount']),
                status: e['status'] as String? ?? '',
                paymentDate: e['paymentDate'] as String? ?? '',
              ),
            )
            .toList(),
        paid: jsonMoney(j['paid']),
        balance: jsonMoney(j['balance']),
        branchName: jsonMap(j['branch'])['name'] as String?,
      );
}
