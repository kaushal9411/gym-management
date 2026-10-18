import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/platform/platform_config_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/fitcloud_invoice.dart';
import '../../../repositories/billing_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'billing_ui.dart';

/// web's invoice status filters, `(value, label)`; a chip only shows when it
/// has invoices (`ALL` always).
const kInvoiceFilters = [
  ('ALL', 'All'),
  ('PAID', 'Paid'),
  ('OPEN', 'Open'),
  ('DRAFT', 'Draft'),
  ('VOID', 'Void'),
  ('UNCOLLECTIBLE', 'Uncollectible'),
];

/// Totals shown on the Invoices page (web computes them inline).
class InvoiceTotals {
  InvoiceTotals._({
    required this.currency,
    required this.totalInvoiced,
    required this.outstanding,
    required this.openCount,
    required this.counts,
  });

  final String currency;

  /// Sum of non-draft, non-void invoices in the first invoice's currency.
  final double totalInvoiced;

  /// Sum of `OPEN` (issued, unpaid) invoices in that currency.
  final double outstanding;
  final int openCount;
  final Map<String, int> counts;

  factory InvoiceTotals.from(List<FitCloudInvoice> list) {
    final currency = list.isEmpty ? 'INR' : list.first.currency;
    final billable = list
        .where(
          (i) =>
              i.currency == currency &&
              i.status != 'VOID' &&
              i.status != 'DRAFT',
        )
        .toList();
    final open = billable.where((i) => i.status == 'OPEN').toList();
    final counts = <String, int>{'ALL': list.length};
    for (final i in list) {
      counts[i.status] = (counts[i.status] ?? 0) + 1;
    }
    return InvoiceTotals._(
      currency: currency,
      totalInvoiced: billable.fold<double>(0, (s, i) => s + i.total),
      outstanding: open.fold<double>(0, (s, i) => s + i.total),
      openCount: open.length,
      counts: counts,
    );
  }
}

/// Invoices — web's `/billing/invoices`: the platform's invoices for the gym's
/// own subscription (`GET /invoice`, `billing:read`).
///
/// Same order as web: gradient `ListHero` (invoice count + outstanding), three
/// summary tiles (Invoices / Total invoiced "Excludes draft & void" /
/// Outstanding "N open"), then the "Invoices" list with status chips (only
/// statuses that exist, with counts) and one card per invoice (number, date,
/// status, total).
///
/// This list used to be the Billing History screen (and showed the invoices
/// with bogus `PENDING`/`OVERDUE` tones); the real statuses are `DRAFT | OPEN |
/// PAID | VOID | UNCOLLECTIBLE`.
///
/// **Dropped vs web**: the per-invoice "Download" button — `GET
/// /invoice/:id/download` needs the bearer token and returns an HTML file, and
/// the app has no file-saving / sharing package (the same documented omission
/// as the member invoice and report screens), so there is nothing real to
/// open.
class BillingInvoicesScreen extends StatefulWidget {
  const BillingInvoicesScreen({super.key});

  @override
  State<BillingInvoicesScreen> createState() => _BillingInvoicesScreenState();
}

class _BillingInvoicesScreenState extends State<BillingInvoicesScreen> {
  List<FitCloudInvoice>? _invoices;
  InvoiceTotals? _totals;
  String? _error;
  bool _loading = true;
  String _filter = 'ALL';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final list = await getIt<BillingRepository>().invoices();
      if (!mounted) return;
      setState(() {
        _invoices = list;
        _totals = InvoiceTotals.from(list);
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted && _invoices == null) setState(() => _error = e.message);
    } catch (e) {
      if (mounted && _invoices == null) {
        setState(() => _error = 'Could not load invoices ($e)');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appName = context.watch<PlatformConfigCubit>().state.appName;
    final top = MediaQuery.of(context).padding.top;
    final invoices = _invoices;
    final totals = _totals;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: () => _load(silent: true),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: ListHero(
                title: 'Invoices',
                subtitle: 'Your $appName subscription invoices.',
                topInset: top,
                side: 18 + teamSideInset(context),
                leading: ListHeroButton(
                  icon: Icons.arrow_back_rounded,
                  onTap: () => context.pop(),
                ),
                chips: [
                  if (invoices != null && totals != null) ...[
                    ListHeroChip(
                      icon: Icons.tag_rounded,
                      label: '${invoices.length} '
                          '${invoices.length == 1 ? 'invoice' : 'invoices'}',
                    ),
                    ListHeroChip(
                      icon: Icons.hourglass_bottom_rounded,
                      label:
                          '${billingMoney(totals.outstanding, totals.currency)}'
                          ' outstanding',
                    ),
                  ],
                ],
              ),
            ),
            if (_error != null && invoices == null)
              SliverFillRemaining(
                hasScrollBody: false,
                child: AppErrorView(message: _error!, onRetry: _load),
              )
            else ...[
              SliverToBoxAdapter(
                child: TeamCenter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        BillingKpiGrid(
                          loading: _loading && totals == null,
                          wideColumns: 3,
                          tiles: [
                            BillingKpi(
                              icon: Icons.tag_rounded,
                              label: 'Invoices',
                              value: '${invoices?.length ?? 0}',
                              hint: 'All statuses',
                              color: TeamColors.teal,
                            ),
                            BillingKpi(
                              icon: Icons.paid_rounded,
                              label: 'Total invoiced',
                              value: totals == null
                                  ? ''
                                  : billingMoney(
                                      totals.totalInvoiced,
                                      totals.currency,
                                    ),
                              hint: 'Excludes draft & void',
                              color: TeamColors.indigo,
                            ),
                            BillingKpi(
                              icon: Icons.description_rounded,
                              label: 'Outstanding',
                              value: totals == null
                                  ? ''
                                  : billingMoney(
                                      totals.outstanding,
                                      totals.currency,
                                    ),
                              hint: '${totals?.openCount ?? 0} open',
                              color: TeamColors.amber,
                            ),
                          ],
                        ),
                        const SizedBox(height: 18),
                        Text('Invoices', style: AppText.display(size: 17)),
                        if (invoices != null &&
                            invoices.isNotEmpty &&
                            totals != null) ...[
                          const SizedBox(height: 10),
                          BillingFilterChips(
                            options: [
                              for (final f in kInvoiceFilters)
                                if (f.$1 == 'ALL' ||
                                    (totals.counts[f.$1] ?? 0) > 0)
                                  f,
                            ],
                            current: _filter,
                            counts: totals.counts,
                            onChanged: (v) => setState(() => _filter = v),
                          ),
                        ],
                        const SizedBox(height: 12),
                      ],
                    ),
                  ),
                ),
              ),
              ..._list(invoices),
            ],
          ],
        ),
      ),
    );
  }

  List<Widget> _list(List<FitCloudInvoice>? invoices) {
    if (invoices == null) {
      return const [
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: AppLoadingView(),
          ),
        ),
      ];
    }
    if (invoices.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: TeamCenter(
            child: const Padding(
              padding: EdgeInsets.fromLTRB(18, 0, 18, 32),
              child: BillingEmptyBlock(
                icon: Icons.receipt_long_rounded,
                title: 'No invoices yet',
                message: 'They appear here after your first charge.',
              ),
            ),
          ),
        ),
      ];
    }
    final visible = [
      for (final i in invoices)
        if (_filter == 'ALL' || i.status == _filter) i,
    ];
    if (visible.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 32),
            child: Center(
              child: Text(
                'No invoices match this filter.',
                style: AppText.body(
                  size: 13,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
      ];
    }
    return [
      teamCardSliver<FitCloudInvoice>(
        context,
        items: visible,
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 32),
        builder: (inv, i) => InvoiceCard(
          key: ValueKey('invoice-${inv.id}'),
          invoice: inv,
        ),
      ),
    ];
  }
}

/// One subscription invoice: number, local created date, status pill, total
/// (2 decimals).
class InvoiceCard extends StatelessWidget {
  const InvoiceCard({super.key, required this.invoice});

  final FitCloudInvoice invoice;

  @override
  Widget build(BuildContext context) {
    final color = billingStatusColor(invoice.status);
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
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color, Color.lerp(color, TeamColors.fuchsia, 0.4)!],
              ),
              borderRadius: BorderRadius.circular(13),
            ),
            child: const Icon(
              Icons.receipt_long_rounded,
              size: 19,
              color: Colors.white,
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  invoice.invoiceNumber,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 13.5, weight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(
                  billingDate(invoice.createdAt),
                  style: AppText.body(
                    size: 11.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                billingMoney(invoice.total, invoice.currency, decimals: 2),
                style: AppText.tabular(size: 14.5, weight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              BillingStatusPill(status: invoice.status),
            ],
          ),
        ],
      ),
    );
  }
}
