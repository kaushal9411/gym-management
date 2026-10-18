import 'package:flutter/material.dart';

import '../../team/presentation/widgets/team_ui.dart' show TeamColors;

/// Web's `invoice-utils.ts`: status labels / colours, the "open" rule and the
/// client-computed due chip.
bool isOpenInvoice(String status) =>
    status == 'UNPAID' || status == 'PARTIALLY_PAID' || status == 'OVERDUE';

String invoiceStatusLabel(String s) => switch (s) {
      'PAID' => 'Paid',
      'UNPAID' => 'Unpaid',
      'PARTIALLY_PAID' => 'Partly paid',
      'OVERDUE' => 'Overdue',
      'CANCELLED' => 'Cancelled',
      _ => s,
    };

Color invoiceStatusColor(String s) => switch (s) {
      'PAID' => TeamColors.green,
      'UNPAID' => TeamColors.amber,
      'PARTIALLY_PAID' => TeamColors.sky,
      'OVERDUE' => TeamColors.rose,
      _ => TeamColors.slate,
    };

String paymentStatusLabel(String s) => switch (s) {
      'SUCCESS' => 'Paid',
      'PENDING' => 'Pending',
      'FAILED' => 'Failed',
      'CANCELLED' => 'Cancelled',
      'REFUNDED' => 'Refunded',
      'PARTIALLY_REFUNDED' => 'Part refunded',
      _ => s,
    };

Color paymentStatusColor(String s) => switch (s) {
      'SUCCESS' => TeamColors.green,
      'PENDING' => TeamColors.amber,
      'FAILED' => TeamColors.rose,
      'REFUNDED' || 'PARTIALLY_REFUNDED' => TeamColors.violet,
      _ => TeamColors.slate,
    };

String paymentMethodLabel(String m) => switch (m) {
      'CASH' => 'Cash',
      'UPI' => 'UPI',
      'CREDIT_CARD' => 'Credit card',
      'DEBIT_CARD' => 'Debit card',
      'BANK_TRANSFER' => 'Bank transfer',
      'CHEQUE' => 'Cheque',
      'ONLINE_GATEWAY' => 'Online',
      _ => m,
    };

IconData paymentMethodIcon(String m) => switch (m) {
      'CASH' => Icons.payments_outlined,
      'UPI' => Icons.smartphone_rounded,
      'CREDIT_CARD' || 'DEBIT_CARD' => Icons.credit_card_rounded,
      'BANK_TRANSFER' => Icons.account_balance_outlined,
      'CHEQUE' => Icons.description_outlined,
      'ONLINE_GATEWAY' => Icons.public_rounded,
      _ => Icons.account_balance_wallet_outlined,
    };

/// Whole days from [today] to [due] (negative = overdue).
int daysUntil(DateTime due, [DateTime? now]) {
  final n = now ?? DateTime.now();
  return DateTime(due.year, due.month, due.day)
      .difference(DateTime(n.year, n.month, n.day))
      .inDays;
}

/// Web's `dueChip`: null for settled invoices.
({String label, Color color})? invoiceDueChip(
  String status,
  DateTime due, [
  DateTime? now,
]) {
  if (!isOpenInvoice(status)) return null;
  final d = daysUntil(due, now);
  if (d < 0 || status == 'OVERDUE') {
    return (
      label: d < 0 ? 'Overdue by ${-d} ${-d == 1 ? 'day' : 'days'}' : 'Overdue',
      color: TeamColors.rose,
    );
  }
  if (d == 0) return (label: 'Due today', color: TeamColors.amber);
  return (
    label: 'Due in $d ${d == 1 ? 'day' : 'days'}',
    color: d <= 3 ? TeamColors.amber : TeamColors.sky,
  );
}

String formatInvoiceDate(DateTime date) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', //
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${date.day} ${months[date.month - 1]} ${date.year}';
}
