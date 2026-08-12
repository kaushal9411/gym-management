import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_invoice.dart';
import '../../../shared/widgets/app_pill.dart';
import 'member_invoices_screen.dart';

/// Design frame "8d. Invoice detail" — rendered from the list payload:
/// the member plane has no per-invoice GET, only
/// `GET /portal/invoices/:id/download` (a PDF byte stream), and the app has
/// no file-saving package to do anything with those bytes — the same
/// reason the Receptionist invoice screen dropped "Download PDF" in
/// Chunk 5.
class MemberInvoiceDetailScreen extends StatelessWidget {
  const MemberInvoiceDetailScreen({required this.invoice, super.key});

  final MemberInvoice invoice;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(invoice.invoiceNumber, style: AppText.display(size: 18)),
            Text(
              formatInvoiceDate(invoice.invoiceDate),
              style: AppText.eyebrow(),
            ),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0x24C6F135), Color(0x1A14E0B4)],
                ),
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Total',
                        style: AppText.body(
                          size: 11,
                          weight: FontWeight.w800,
                          color: AppColors.memberPillFg,
                        ),
                      ),
                      AppPill(
                        label: invoice.status,
                        tone: invoice.status == 'PAID'
                            ? AppPillTone.success
                            : AppPillTone.warning,
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '₹${invoice.totalAmount.toStringAsFixed(2)}',
                    style: AppText.display(size: 24),
                  ),
                ],
              ),
            ),
            if (invoice.items.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface2,
                  borderRadius: BorderRadius.circular(AppRadii.card),
                  border: Border.all(color: AppColors.line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Items', style: AppText.eyebrow()),
                    const SizedBox(height: 8),
                    ...invoice.items.map(
                      (item) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                item.quantity > 1
                                    ? '${item.description} × ${item.quantity}'
                                    : item.description,
                                style: AppText.body(
                                  size: 13,
                                  weight: FontWeight.w600,
                                ),
                              ),
                            ),
                            Text(
                              '₹${item.amount.toStringAsFixed(2)}',
                              style: AppText.body(
                                size: 13,
                                weight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.surface2,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                children: [
                  _Row(
                    label: 'Subtotal',
                    value: '₹${invoice.subtotal.toStringAsFixed(2)}',
                  ),
                  _Row(
                    label: 'Tax',
                    value: '₹${invoice.taxAmount.toStringAsFixed(2)}',
                  ),
                  _Row(
                    label: 'Total',
                    value: '₹${invoice.totalAmount.toStringAsFixed(2)}',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppText.body(
              size: 13,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          Text(value, style: AppText.body(size: 13, weight: FontWeight.w700)),
        ],
      ),
    );
  }
}
