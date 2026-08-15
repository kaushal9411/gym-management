import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/fitcloud_invoice.dart';
import '../../../repositories/billing_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

const _invoiceStatusTones = {
  'PAID': AppPillTone.success,
  'PENDING': AppPillTone.warning,
  'OVERDUE': AppPillTone.danger,
  'VOID': AppPillTone.neutral,
};

/// Design frame "16a. Billing history" — the FitCloud subscription
/// invoices (`GET /invoice`), split out of the Billing screen as the
/// design has it.
class BillingHistoryScreen extends StatefulWidget {
  const BillingHistoryScreen({super.key});

  @override
  State<BillingHistoryScreen> createState() => _BillingHistoryScreenState();
}

class _BillingHistoryScreenState extends State<BillingHistoryScreen> {
  List<FitCloudInvoice>? _invoices;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final invoices = await getIt<BillingRepository>().invoices();
      if (!mounted) return;
      setState(() => _invoices = invoices);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Billing History', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : _invoices == null
                ? const AppLoadingView()
                : _invoices!.isEmpty
                    ? const AppEmptyState(
                        icon: Icons.receipt_long_outlined,
                        title: 'No invoices yet',
                        message: 'FitCloud subscription invoices appear here.',
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                        itemCount: _invoices!.length,
                        itemBuilder: (context, i) =>
                            _InvoiceTile(invoice: _invoices![i]),
                      ),
      ),
    );
  }
}

class _InvoiceTile extends StatelessWidget {
  const _InvoiceTile({required this.invoice});

  final FitCloudInvoice invoice;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  invoice.invoiceNumber,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  _formatDate(invoice.createdAt),
                  style: AppText.body(
                    size: 11,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${invoice.currency} ${invoice.total.toStringAsFixed(2)}',
                style: AppText.tabular(size: 13, weight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              AppPill(
                label: invoice.status,
                tone:
                    _invoiceStatusTones[invoice.status] ?? AppPillTone.neutral,
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';
}
