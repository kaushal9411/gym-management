import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_invoice.dart';
import '../../../models/member_overview.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/motion.dart';
import '../../team/presentation/widgets/team_ui.dart'
    show TeamColors, TeamTag, fmtDate;
import 'member_invoice_actions.dart';
import 'member_invoice_logic.dart';
import 'member_pay_invoice_sheet.dart';
import 'widgets/member_dash_ui.dart';

export 'member_invoice_logic.dart' show formatInvoiceDate;

/// My invoices — web's `/portal/invoices`, redesigned for the member plane.
///
/// Hero ("N invoices waiting for payment" / "You are all paid up", next-due
/// chip, Outstanding / Next due / Paid · 90 days from `GET /portal/overview`,
/// and a Payment history button), status filter chips with counts (All /
/// Unpaid / Paid / Overdue — the list endpoint has no status filter, so they
/// filter the loaded invoices, like web), and a card per invoice: number,
/// issued date, total, status chip, the due chip (overdue by N days / due in
/// N days), **PDF download** (shared through the system share sheet) and
/// **Pay** for open ones. Tapping a card opens the invoice. Load more asks for
/// 20 more (shows how many are left).
///
/// The overview only feeds the hero numbers; without it the outstanding total
/// is summed from the loaded invoices.
class MemberInvoicesScreen extends StatefulWidget {
  const MemberInvoicesScreen({super.key});

  @override
  State<MemberInvoicesScreen> createState() => _MemberInvoicesScreenState();
}

class _MemberInvoicesScreenState extends State<MemberInvoicesScreen> {
  static const _page = 20;

  List<MemberInvoice> _invoices = const [];
  int _total = 0;
  int _limit = _page;
  OverviewBilling? _billing;
  bool _loading = true;
  bool _more = false;
  String? _error;
  String _filter = 'ALL';
  final Set<String> _downloading = {};

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
        _loading = _invoices.isEmpty;
      }
      _error = null;
    });
    if (!more) {
      repo.overview().then((o) {
        if (mounted) setState(() => _billing = o.billing);
      }).catchError((_) {});
    }
    try {
      final r = await repo.invoices(limit: _limit);
      if (!mounted) return;
      setState(() {
        _invoices = r.items;
        _total = r.total;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load invoices ($e)');
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _more = false;
        });
      }
    }
  }

  Future<void> _pay(MemberInvoice inv) async {
    final paid = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => MemberPayInvoiceSheet(
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.totalAmount,
      ),
    );
    if (paid == true) _load();
  }

  Future<void> _download(MemberInvoice inv) async {
    if (_downloading.contains(inv.id)) return;
    setState(() => _downloading.add(inv.id));
    try {
      await downloadMemberInvoice(
        context,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
      );
    } finally {
      if (mounted) setState(() => _downloading.remove(inv.id));
    }
  }

  bool _matches(MemberInvoice i) => switch (_filter) {
        'PAID' => i.status == 'PAID',
        'OVERDUE' => i.status == 'OVERDUE',
        'UNPAID' => i.status == 'UNPAID' || i.status == 'PARTIALLY_PAID',
        _ => true,
      };

  int _count(String f) {
    switch (f) {
      case 'PAID':
        return _invoices.where((i) => i.status == 'PAID').length;
      case 'OVERDUE':
        return _invoices.where((i) => i.status == 'OVERDUE').length;
      case 'UNPAID':
        return _invoices
            .where((i) => i.status == 'UNPAID' || i.status == 'PARTIALLY_PAID')
            .length;
      default:
        return _invoices.length;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: _loading
          ? const AppLoadingView(role: AppRole.member)
          : _error != null && _invoices.isEmpty
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
    final b = _billing;
    final open = _invoices.where((i) => isOpenInvoice(i.status)).toList();
    final outstanding =
        b?.outstanding ?? open.fold<double>(0, (s, i) => s + i.totalAmount);
    final openCount = b?.outstandingInvoiceCount ?? open.length;
    final shown = _invoices.where(_matches).toList();
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 28),
      children: [
        MemberPageHero(
          eyebrow: 'Billing',
          title: 'My invoices',
          subtitle: outstanding > 0
              ? '$openCount ${openCount == 1 ? 'invoice' : 'invoices'} '
                  'waiting for payment'
              : 'You are all paid up',
          chips: [
            if (outstanding > 0)
              b?.nextDueDate != null
                  ? 'Next due ${fmtDate(DateTime.tryParse(b!.nextDueDate!))}'
                  : 'Payment due'
            else
              'Nothing due',
          ],
          stats: [
            (
              'Outstanding',
              outstanding.round(),
              (n) => memberMoney(n.toDouble())
            ),
            if (b != null)
              (
                'Paid · 90 days',
                b.paidLast90Days.round(),
                (n) => memberMoney(n.toDouble())
              ),
          ],
          actions: [
            MemberHeroButton(
              icon: Icons.account_balance_wallet_outlined,
              label: 'Payment history',
              onTap: () => context.push(AppRoutes.memberPayments),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final f in const [
                      ('ALL', 'All'),
                      ('UNPAID', 'Unpaid'),
                      ('PAID', 'Paid'),
                      ('OVERDUE', 'Overdue'),
                    ])
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          key: ValueKey('inv-filter-${f.$1}'),
                          label: Text('${f.$2} · ${_count(f.$1)}'),
                          selected: _filter == f.$1,
                          selectedColor: AppColors.memberB,
                          labelStyle: AppText.body(
                            size: 12.5,
                            weight: FontWeight.w800,
                            color: _filter == f.$1
                                ? AppColors.memberOnGrad
                                : AppColors.ink,
                          ),
                          onSelected: (_) => setState(() => _filter = f.$1),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              if (shown.isEmpty)
                MemberSection(
                  title: _invoices.isEmpty
                      ? 'No invoices yet'
                      : 'No invoices match',
                  icon: Icons.receipt_long_rounded,
                  color: TeamColors.amber,
                  child: MemberEmpty(
                    icon: Icons.receipt_long_rounded,
                    title: _invoices.isEmpty
                        ? 'No invoices yet'
                        : 'No invoices match',
                    message: _invoices.isEmpty
                        ? "Your invoices will show up here once you're billed."
                        : 'Try a different filter.',
                  ),
                )
              else
                for (var i = 0; i < shown.length; i++)
                  StaggeredReveal(
                    index: i < 8 ? i : 0,
                    child: _InvoiceCard(
                      invoice: shown[i],
                      downloading: _downloading.contains(shown[i].id),
                      onOpen: () => context.push(
                        AppRoutes.memberInvoiceDetail,
                        extra: shown[i],
                      ),
                      onPay: () => _pay(shown[i]),
                      onDownload: () => _download(shown[i]),
                    ),
                  ),
              if (_invoices.length < _total)
                Center(
                  child: TextButton(
                    key: const ValueKey('inv-more'),
                    onPressed: _more
                        ? null
                        : () {
                            _limit += _page;
                            _load(more: true);
                          },
                    child: Text(
                      _more
                          ? 'Loading…'
                          : 'Load more (${_total - _invoices.length} left)',
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

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({
    required this.invoice,
    required this.downloading,
    required this.onOpen,
    required this.onPay,
    required this.onDownload,
  });

  final MemberInvoice invoice;
  final bool downloading;
  final VoidCallback onOpen;
  final VoidCallback onPay;
  final VoidCallback onDownload;

  @override
  Widget build(BuildContext context) {
    final inv = invoice;
    final color = invoiceStatusColor(inv.status);
    final due = invoiceDueChip(inv.status, inv.dueDate);
    final open = isOpenInvoice(inv.status);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: due?.color == TeamColors.rose
              ? TeamColors.rose.withValues(alpha: 0.5)
              : AppColors.line,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          InkWell(
            onTap: onOpen,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          Icons.receipt_long_rounded,
                          size: 19,
                          color: color,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              inv.invoiceNumber,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.body(
                                size: 13.5,
                                weight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              'Issued ${formatInvoiceDate(inv.invoiceDate)}',
                              style: AppText.body(
                                size: 11.5,
                                color: AppColors.inkFaint,
                                weight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        memberMoney(inv.totalAmount),
                        style: AppText.display(size: 18),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      TeamTag(
                        label: invoiceStatusLabel(inv.status),
                        color: color,
                      ),
                      if (due != null)
                        TeamTag(label: due.label, color: due.color),
                      if (inv.status != 'PAID')
                        Text(
                          'Due ${formatInvoiceDate(inv.dueDate)}',
                          style: AppText.body(
                            size: 11.5,
                            color: AppColors.inkFaint,
                            weight: FontWeight.w600,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Container(
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: AppColors.line)),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(
                  key: ValueKey('inv-pdf-${inv.id}'),
                  onPressed: downloading ? null : onDownload,
                  icon: downloading
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.download_rounded, size: 17),
                  label: const Text('PDF'),
                ),
                if (open)
                  FilledButton(
                    key: ValueKey('inv-pay-${inv.id}'),
                    onPressed: onPay,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.memberB,
                      foregroundColor: AppColors.memberOnGrad,
                      visualDensity: VisualDensity.compact,
                    ),
                    child: const Text('Pay now'),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
