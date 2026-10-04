import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_invoice.dart';
import '../../../models/member_invoice_detail.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/motion.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../finance/presentation/widgets/analytics_parts.dart';
import 'member_invoices_screen.dart';
import 'member_payments_screen.dart' show paymentStatusTone;

/// Design frame "8d. Invoice detail". Renders instantly from the list
/// payload, then enriches itself from `GET /portal/invoices/:id`
/// (`MemberInvoiceDetail`): per-item unit prices, discount, linked payments
/// and the server-computed Paid / Balance. If that call fails the list data
/// stays on screen with a retry note — nothing is invented. The pay flow
/// lives on the invoices list (`MemberPayInvoiceSheet`) and is untouched.
/// Still dropped: "Download PDF" — `GET /portal/invoices/:id/download`
/// streams bytes and the app has no file-saving package (same reason the
/// Receptionist invoice screen dropped it in Chunk 5).
class MemberInvoiceDetailScreen extends StatefulWidget {
  const MemberInvoiceDetailScreen({required this.invoice, super.key});

  final MemberInvoice invoice;

  @override
  State<MemberInvoiceDetailScreen> createState() =>
      _MemberInvoiceDetailScreenState();
}

class _MemberInvoiceDetailScreenState extends State<MemberInvoiceDetailScreen> {
  MemberInvoiceDetail? _detail;
  bool _loading = true;
  String? _error;

  MemberInvoice get invoice => widget.invoice;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final d = await getIt<MemberPortalRepository>().invoiceDetail(invoice.id);
      if (!mounted) return;
      setState(() => _detail = d);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    final status = detail?.status ?? invoice.status;
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
            if (_loading) const LinearProgressIndicator(minHeight: 2, color: AppColors.memberB, backgroundColor: AppColors.surface3),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Payment details unavailable: $_error',
                        style: AppText.body(size: 12, color: AppColors.inkFaint),
                      ),
                    ),
                    TextButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ),
              ),
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
                        label: status,
                        tone: status == 'PAID'
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
            if (detail == null ? invoice.items.isNotEmpty : detail.items.isNotEmpty) ...[
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
                    if (detail != null)
                      ...detail.items.map(
                        (item) => _ItemRow(
                          text: item.quantity > 1
                              ? '${item.description} × ${item.quantity}'
                              : item.description,
                          amount: item.amount,
                        ),
                      )
                    else
                      ...invoice.items.map(
                        (item) => _ItemRow(
                          text: item.quantity > 1
                              ? '${item.description} × ${item.quantity}'
                              : item.description,
                          amount: item.amount,
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
                  if (detail != null && detail.discountAmount > 0)
                    _Row(
                      label: 'Discount',
                      value: '-₹${detail.discountAmount.toStringAsFixed(2)}',
                    ),
                  _Row(
                    label: 'Total',
                    value: '₹${invoice.totalAmount.toStringAsFixed(2)}',
                  ),
                  if (detail != null) ...[
                    _Row(
                      label: 'Paid',
                      value: '₹${detail.paid.toStringAsFixed(2)}',
                    ),
                    _Row(
                      label: 'Balance',
                      value: '₹${detail.balance.toStringAsFixed(2)}',
                      emphasis: detail.balance > 0,
                    ),
                  ],
                ],
              ),
            ),
            if (detail != null && detail.payments.isNotEmpty) ...[
              const SizedBox(height: 12),
              StaggeredReveal(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surface2,
                    borderRadius: BorderRadius.circular(AppRadii.card),
                    border: Border.all(color: AppColors.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Payments', style: AppText.eyebrow()),
                      const SizedBox(height: 8),
                      for (final p in detail.payments)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      p.paymentNumber,
                                      style: AppText.body(
                                        size: 13,
                                        weight: FontWeight.w700,
                                      ),
                                    ),
                                    Text(
                                      shortDate(p.paymentDate),
                                      style: AppText.body(
                                        size: 11,
                                        color: AppColors.inkFaint,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    '₹${p.finalAmount.toStringAsFixed(2)}',
                                    style: AppText.body(
                                      size: 13,
                                      weight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  AppPill(
                                    label: prettyEnum(p.status),
                                    tone: paymentStatusTone(p.status),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({required this.text, required this.amount});

  final String text;
  final double amount;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(
              text,
              style: AppText.body(size: 13, weight: FontWeight.w600),
            ),
          ),
          Text(
            '₹${amount.toStringAsFixed(2)}',
            style: AppText.body(size: 13, weight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.emphasis = false});

  final String label;
  final String value;
  final bool emphasis;

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
          Text(
            value,
            style: AppText.body(
              size: 13,
              weight: FontWeight.w700,
              color: emphasis ? AppColors.warning : AppColors.ink,
            ),
          ),
        ],
      ),
    );
  }
}
