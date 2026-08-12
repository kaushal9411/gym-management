import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/member_invoice.dart';
import '../../../repositories/invoice_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

const _statusTones = {
  'PAID': AppPillTone.success,
  'UNPAID': AppPillTone.warning,
  'PARTIALLY_PAID': AppPillTone.warning,
  'OVERDUE': AppPillTone.danger,
  'CANCELLED': AppPillTone.neutral,
};

/// Design frame "8. Invoice detail". "Download PDF" is dropped — no
/// file-opening package (`url_launcher`/`path_provider`) exists in this
/// app yet to do anything useful with the downloaded bytes — "Email" is
/// kept since `/invoices/:id/email` is a plain API call, no local file
/// handling needed.
class InvoiceDetailScreen extends StatefulWidget {
  const InvoiceDetailScreen({super.key, required this.invoiceId});

  final String invoiceId;

  @override
  State<InvoiceDetailScreen> createState() => _InvoiceDetailScreenState();
}

class _InvoiceDetailScreenState extends State<InvoiceDetailScreen> {
  MemberInvoice? _invoice;
  String? _error;
  bool _emailing = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final invoice =
          await getIt<InvoiceRepository>().getById(widget.invoiceId);
      if (!mounted) return;
      setState(() => _invoice = invoice);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _email() async {
    setState(() => _emailing = true);
    try {
      await getIt<InvoiceRepository>().email(widget.invoiceId);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Invoice emailed')));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _emailing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text(
          _invoice?.invoiceNumber ?? 'Invoice',
          style: AppText.display(size: 18),
        ),
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : _invoice == null
                ? const AppLoadingView()
                : _buildContent(_invoice!),
      ),
    );
  }

  Widget _buildContent(MemberInvoice invoice) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        GlassCard(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      invoice.member.name,
                      style: AppText.body(size: 15, weight: FontWeight.w800),
                    ),
                  ),
                  AppPill(
                    label: invoice.status.replaceAll('_', ' '),
                    tone: _statusTones[invoice.status] ?? AppPillTone.neutral,
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                'Billed to ${invoice.member.name} · ${invoice.member.memberId}',
                style: AppText.body(size: 11, color: AppColors.inkFaint),
              ),
              const Divider(height: 24, color: AppColors.line),
              for (final item in invoice.items)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          item.description,
                          style: AppText.body(size: 13),
                        ),
                      ),
                      Text(
                        Formatters.currency(item.amount),
                        style: AppText.tabular(
                          size: 13,
                          weight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              if (invoice.taxAmount > 0)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Tax', style: AppText.body(size: 13)),
                      Text(
                        Formatters.currency(invoice.taxAmount),
                        style: AppText.tabular(
                          size: 13,
                          weight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              const Divider(height: 20, color: AppColors.line),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Total',
                    style: AppText.body(size: 15, weight: FontWeight.w800),
                  ),
                  Text(
                    Formatters.currency(invoice.totalAmount),
                    style: AppText.tabular(size: 15, weight: FontWeight.w800),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppButton(
          label: 'Email invoice',
          loading: _emailing,
          onPressed: _email,
        ),
      ],
    );
  }
}
