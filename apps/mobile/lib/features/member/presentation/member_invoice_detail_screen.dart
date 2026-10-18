import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_invoice.dart';
import '../../../models/member_invoice_detail.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/motion.dart';
import '../../team/presentation/widgets/team_ui.dart'
    show TeamCenter, TeamColors, TeamTag;
import 'member_invoice_actions.dart';
import 'member_invoice_logic.dart';
import 'member_pay_invoice_sheet.dart';
import 'widgets/member_dash_ui.dart';

/// One invoice — web's `/portal/invoices/:id`, redesigned for the member plane.
///
/// Opened from the invoices list (with the list item, so it renders at once)
/// or from a payment (by [invoiceId] only; then it waits for the detail).
/// `GET /portal/invoices/:id` supplies items with unit prices, discount, the
/// linked payments and the server-computed Paid / Balance.
///
/// Hero: number, issued date and branch, status + due chips, a paid-percentage
/// ring, Total / Paid / Balance, and **Pay now** (open invoices),
/// **Download PDF** (system share sheet) and **Payments**. Then the Items card
/// with the Subtotal / Discount / Tax / Total / Paid / Balance due lines, and
/// the Payments card. If the detail call fails and a list item is available,
/// its numbers stay on screen with a retry note — nothing is invented.
class MemberInvoiceDetailScreen extends StatefulWidget {
  const MemberInvoiceDetailScreen({this.invoice, this.invoiceId, super.key})
      : assert(invoice != null || invoiceId != null);

  final MemberInvoice? invoice;
  final String? invoiceId;

  @override
  State<MemberInvoiceDetailScreen> createState() =>
      _MemberInvoiceDetailScreenState();
}

class _MemberInvoiceDetailScreenState extends State<MemberInvoiceDetailScreen> {
  MemberInvoiceDetail? _detail;
  bool _loading = true;
  bool _downloading = false;
  String? _error;

  String get _id => widget.invoice?.id ?? widget.invoiceId!;

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
      final d = await getIt<MemberPortalRepository>().invoiceDetail(_id);
      if (mounted) setState(() => _detail = d);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load this invoice ($e)');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pay(String number, double amount) async {
    final paid = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => MemberPayInvoiceSheet(
        invoiceId: _id,
        invoiceNumber: number,
        amount: amount,
      ),
    );
    if (paid == true) _load();
  }

  Future<void> _download(String number) async {
    if (_downloading) return;
    setState(() => _downloading = true);
    try {
      await downloadMemberInvoice(
        context,
        invoiceId: _id,
        invoiceNumber: number,
      );
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final inv = widget.invoice;
    final d = _detail;
    if (inv == null && d == null) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: _loading
            ? const AppLoadingView(role: AppRole.member)
            : AppErrorView(
                message: _error ?? 'Invoice not found.',
                onRetry: _load,
                role: AppRole.member,
              ),
      );
    }
    final number = d?.invoiceNumber ?? inv!.invoiceNumber;
    final status = d?.status ?? inv!.status;
    final total = d?.totalAmount ?? inv!.totalAmount;
    final subtotal = d?.subtotal ?? inv!.subtotal;
    final tax = d?.taxAmount ?? inv!.taxAmount;
    final discount = d?.discountAmount ?? 0;
    final paid = d?.paid;
    final balance = d?.balance;
    final issued = d?.invoiceDate ?? inv?.invoiceDate;
    final dueDate = d?.dueDate ?? inv?.dueDate;
    final branch = d?.branchName;
    final open = isOpenInvoice(status);
    final due = dueDate == null ? null : invoiceDueChip(status, dueDate);
    final pct = paid == null
        ? 0.0
        : total > 0
            ? (paid / total).clamp(0.0, 1.0)
            : (status == 'PAID' ? 1.0 : 0.0);
    final items = d != null
        ? [
            for (final i in d.items)
              (i.description, i.quantity, i.unitPrice, i.amount),
          ]
        : [
            for (final i in inv!.items)
              (
                i.description,
                i.quantity,
                i.amount / (i.quantity == 0 ? 1 : i.quantity),
                i.amount
              ),
          ];
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.memberB,
        backgroundColor: AppColors.surface2,
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: 28),
          children: [
            MemberPageHero(
              eyebrow: 'Invoice',
              title: number,
              subtitle: [
                if (issued != null) 'Issued ${formatInvoiceDate(issued)}',
                if (branch != null) branch,
              ].join(' · '),
              chips: [
                invoiceStatusLabel(status),
                if (due != null) due.label,
                if (open && dueDate != null)
                  'Due ${formatInvoiceDate(dueDate)}',
              ],
              stats: [
                ('Total', total.round(), (n) => memberMoney(n.toDouble())),
                if (paid != null)
                  ('Paid', paid.round(), (n) => memberMoney(n.toDouble())),
                if (balance != null)
                  (
                    'Balance',
                    balance.round(),
                    (n) => memberMoney(n.toDouble())
                  ),
              ],
              actions: [
                if (open)
                  MemberHeroButton(
                    icon: Icons.credit_card_rounded,
                    label: 'Pay now',
                    solid: true,
                    onTap: () => _pay(number, balance ?? total),
                  ),
                MemberHeroButton(
                  icon: Icons.download_rounded,
                  label: _downloading ? 'Preparing…' : 'Download PDF',
                  onTap: () => _download(number),
                ),
                MemberHeroButton(
                  icon: Icons.account_balance_wallet_outlined,
                  label: 'Payments',
                  onTap: () => context.push(AppRoutes.memberPayments),
                ),
              ],
            ),
            TeamCenter(
              maxWidth: 760,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_error != null && d == null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Showing list details — $_error',
                                style: AppText.body(
                                  size: 12,
                                  color: AppColors.inkFaint,
                                  weight: FontWeight.w600,
                                ),
                              ),
                            ),
                            TextButton(
                              onPressed: _load,
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      ),
                    if (_loading && d == null)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 12),
                        child: LinearProgressIndicator(minHeight: 3),
                      ),
                    StaggeredReveal(
                      child: MemberSection(
                        title: 'Items',
                        subtitle:
                            '${items.length} line ${items.length == 1 ? 'item' : 'items'}',
                        icon: Icons.checklist_rounded,
                        color: TeamColors.sky,
                        flush: true,
                        child: Column(
                          children: [
                            if (items.isEmpty)
                              const MemberEmpty(
                                icon: Icons.description_outlined,
                                title: 'No line items',
                                message: 'This invoice has no itemised lines.',
                              )
                            else
                              for (final i in items)
                                MemberListRow(
                                  icon: Icons.description_outlined,
                                  color: TeamColors.sky,
                                  title: i.$1,
                                  subtitle: '${i.$2} × ${memberMoney(i.$3)}',
                                  trailing: Text(
                                    memberMoney(i.$4),
                                    style: AppText.body(
                                      size: 13,
                                      weight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                            Container(
                              color: AppColors.surface3,
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                children: [
                                  _line('Subtotal', memberMoney(subtotal)),
                                  if (discount > 0)
                                    _line(
                                      'Discount',
                                      '− ${memberMoney(discount)}',
                                      color: TeamColors.green,
                                    ),
                                  if (tax > 0) _line('Tax', memberMoney(tax)),
                                  const Divider(height: 16),
                                  _line('Total', memberMoney(total), big: true),
                                  if (paid != null)
                                    _line(
                                      'Paid',
                                      memberMoney(paid),
                                      color: TeamColors.green,
                                    ),
                                  if (balance != null)
                                    _line(
                                      'Balance due',
                                      memberMoney(balance),
                                      color:
                                          balance > 0 ? TeamColors.rose : null,
                                      bold: true,
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    MemberSection(
                      title: 'Payments',
                      subtitle: d == null
                          ? null
                          : d.payments.isEmpty
                              ? 'None yet'
                              : '${d.payments.length} on this invoice',
                      icon: Icons.account_balance_wallet_outlined,
                      color: TeamColors.green,
                      flush: true,
                      child: d == null
                          ? const MemberEmpty(
                              icon: Icons.account_balance_wallet_outlined,
                              title: 'Loading payments…',
                              message: 'Payments on this invoice appear here.',
                            )
                          : d.payments.isEmpty
                              ? MemberEmpty(
                                  icon: Icons.account_balance_wallet_outlined,
                                  title: 'No payments yet',
                                  message: open
                                      ? 'Pay now to settle this invoice.'
                                      : 'Nothing was paid on this invoice.',
                                )
                              : Column(
                                  children: [
                                    for (final p in d.payments)
                                      MemberListRow(
                                        icon: Icons
                                            .account_balance_wallet_outlined,
                                        color: paymentStatusColor(p.status),
                                        title: p.paymentNumber,
                                        subtitle: formatInvoiceDate(
                                          DateTime.tryParse(p.paymentDate) ??
                                              DateTime.now(),
                                        ),
                                        trailing: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.end,
                                          children: [
                                            Text(
                                              memberMoney(p.finalAmount),
                                              style: AppText.body(
                                                size: 13,
                                                weight: FontWeight.w800,
                                              ),
                                            ),
                                            TeamTag(
                                              label:
                                                  paymentStatusLabel(p.status),
                                              color:
                                                  paymentStatusColor(p.status),
                                            ),
                                          ],
                                        ),
                                      ),
                                  ],
                                ),
                    ),
                    if (pct > 0 && pct < 1)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          '${(pct * 100).round()}% paid',
                          textAlign: TextAlign.center,
                          style: AppText.body(
                            size: 12,
                            color: AppColors.inkFaint,
                            weight: FontWeight.w700,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _line(
    String label,
    String value, {
    Color? color,
    bool bold = false,
    bool big = false,
  }) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: AppText.body(
                size: big ? 14 : 13,
                color: big ? AppColors.ink : AppColors.inkFaint,
                weight: big || bold ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
            Text(
              value,
              style: AppText.body(
                size: big ? 15 : 13,
                weight: big || bold ? FontWeight.w800 : FontWeight.w700,
                color: color ?? AppColors.ink,
              ),
            ),
          ],
        ),
      );
}
