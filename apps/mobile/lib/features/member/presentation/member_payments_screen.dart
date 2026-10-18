import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_overview.dart';
import '../../../models/portal_payment.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/motion.dart';
import '../../team/presentation/widgets/team_ui.dart' show TeamColors, TeamTag;
import 'member_invoice_logic.dart';
import 'widgets/member_dash_ui.dart';

/// Payment history — web's `/portal/payments`, redesigned for the member
/// plane. Hero ("N payments on record", "Full history" chip once everything is
/// loaded, Total paid / Payments / 90 days, and an Invoices button), then the
/// "All payments" card, newest first: method icon, payment number, method ·
/// date · invoice number, the refunded amount when there is one, the amount and
/// a status chip; a row with an invoice opens it. "Total paid" sums only the
/// payments on screen (net of refunds) and says "Paid (loaded)" until the
/// whole history is loaded — never a guess. Load more shows how many are left.
class MemberPaymentsScreen extends StatefulWidget {
  const MemberPaymentsScreen({super.key});

  @override
  State<MemberPaymentsScreen> createState() => _MemberPaymentsScreenState();
}

class _MemberPaymentsScreenState extends State<MemberPaymentsScreen> {
  static const _page = 20;

  List<PortalPayment> _items = const [];
  int _total = 0;
  int _limit = _page;
  OverviewBilling? _billing;
  bool _loading = true;
  bool _more = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool more = false}) async {
    final repo = getIt<MemberPortalRepository>();
    setState(() {
      if (more) {
        _more = true;
      } else {
        _loading = _items.isEmpty;
      }
      _error = null;
    });
    if (!more) {
      repo.overview().then((o) {
        if (mounted) setState(() => _billing = o.billing);
      }).catchError((_) {});
    }
    try {
      final r = await repo.payments(limit: _limit);
      if (!mounted) return;
      setState(() {
        _items = r.items;
        _total = r.total;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load payments ($e)');
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _more = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: _loading
          ? const AppLoadingView(role: AppRole.member)
          : _error != null && _items.isEmpty
              ? AppErrorView(
                  message: _error!,
                  onRetry: _load,
                  role: AppRole.member,
                )
              : RefreshIndicator(
                  color: AppColors.memberB,
                  backgroundColor: AppColors.surface2,
                  onRefresh: _load,
                  child: _content(),
                ),
    );
  }

  Widget _content() {
    final complete = _total <= _items.length;
    final loadedPaid = _items
        .where((p) => p.status == 'SUCCESS' || p.status == 'PARTIALLY_REFUNDED')
        .fold<double>(0, (s, p) => s + p.amount - p.totalRefunded);
    final b = _billing;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 28),
      children: [
        MemberPageHero(
          eyebrow: 'Billing',
          title: 'Payment history',
          subtitle: _total > 0
              ? '$_total ${_total == 1 ? 'payment' : 'payments'} on record'
              : 'No payments yet',
          chips: [if (complete && _items.isNotEmpty) 'Full history'],
          stats: [
            if (_items.isNotEmpty)
              (
                complete ? 'Total paid' : 'Paid (loaded)',
                loadedPaid.round(),
                (n) => memberMoney(n.toDouble()),
              ),
            ('Payments', _total, (n) => '$n'),
            if (b != null)
              (
                '90 days',
                b.paidLast90Days.round(),
                (n) => memberMoney(n.toDouble())
              ),
          ],
          actions: [
            MemberHeroButton(
              icon: Icons.receipt_long_rounded,
              label: 'Invoices',
              onTap: () => context.push(AppRoutes.memberInvoices),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              MemberSection(
                title: 'All payments',
                subtitle: 'Newest first',
                icon: Icons.account_balance_wallet_outlined,
                color: TeamColors.green,
                flush: true,
                child: _items.isEmpty
                    ? const MemberEmpty(
                        icon: Icons.account_balance_wallet_outlined,
                        title: 'No payments yet',
                        message: 'Payments you make at the gym or online will '
                            'be listed here.',
                      )
                    : Column(
                        children: [
                          for (var i = 0; i < _items.length; i++)
                            StaggeredReveal(
                              index: i < 8 ? i : 0,
                              child: PaymentRow(
                                payment: _items[i],
                                onTap: _items[i].invoiceId == null
                                    ? null
                                    : () => context.push(
                                          AppRoutes.memberInvoiceDetail,
                                          extra: _items[i].invoiceId,
                                        ),
                              ),
                            ),
                        ],
                      ),
              ),
              if (_items.length < _total)
                Center(
                  child: TextButton(
                    key: const ValueKey('pay-more'),
                    onPressed: _more
                        ? null
                        : () {
                            _limit += _page;
                            _load(more: true);
                          },
                    child: Text(
                      _more
                          ? 'Loading…'
                          : 'Load more (${_total - _items.length} left)',
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class PaymentRow extends StatelessWidget {
  const PaymentRow({required this.payment, this.onTap, super.key});

  final PortalPayment payment;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = payment;
    final c = paymentStatusColor(p.status);
    final date = DateTime.tryParse(p.paymentDate);
    return MemberListRow(
      icon: paymentMethodIcon(p.method),
      color: c,
      title: p.paymentNumber,
      subtitle: [
        paymentMethodLabel(p.method),
        if (date != null) formatInvoiceDate(date),
        if (p.invoiceNumber != null) p.invoiceNumber!,
        if (p.hasRefund) '${memberMoney(p.totalRefunded)} refunded',
      ].join(' · '),
      trailing: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            memberMoney(p.amount),
            style: AppText.body(size: 13, weight: FontWeight.w800),
          ),
          TeamTag(label: paymentStatusLabel(p.status), color: c),
        ],
      ),
      onTap: onTap,
    );
  }
}
