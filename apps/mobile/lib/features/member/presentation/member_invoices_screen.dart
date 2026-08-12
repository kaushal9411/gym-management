import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_invoice.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "8c. Invoices" — the member's own invoices via
/// `GET /portal/invoices`.
class MemberInvoicesScreen extends StatefulWidget {
  const MemberInvoicesScreen({super.key});

  @override
  State<MemberInvoicesScreen> createState() => _MemberInvoicesScreenState();
}

class _MemberInvoicesScreenState extends State<MemberInvoicesScreen> {
  List<MemberInvoice> _invoices = const [];
  bool _loading = true;
  String? _error;

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
      final result = await getIt<MemberPortalRepository>().invoices();
      if (!mounted) return;
      setState(() => _invoices = result.items);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Invoices', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const AppLoadingView(role: AppRole.member)
            : _error != null
                ? AppErrorView(
                    message: _error!,
                    onRetry: _load,
                    role: AppRole.member,
                  )
                : _invoices.isEmpty
                    ? const AppEmptyState(
                        icon: Icons.receipt_long_outlined,
                        title: 'No invoices yet',
                        message: 'Invoices appear here once you are billed.',
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                        itemCount: _invoices.length,
                        itemBuilder: (context, i) => _InvoiceCard(
                          invoice: _invoices[i],
                          onTap: () => context.push(
                            AppRoutes.memberInvoiceDetail,
                            extra: _invoices[i],
                          ),
                        ),
                      ),
      ),
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({required this.invoice, required this.onTap});

  final MemberInvoice invoice;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
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
                    Text(
                      formatInvoiceDate(invoice.invoiceDate),
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
                    '₹${invoice.totalAmount.toStringAsFixed(0)}',
                    style: AppText.body(size: 13, weight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  AppPill(
                    label: invoice.status,
                    tone: invoice.status == 'PAID'
                        ? AppPillTone.success
                        : AppPillTone.warning,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String formatInvoiceDate(DateTime date) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${date.day} ${months[date.month - 1]} ${date.year}';
}
